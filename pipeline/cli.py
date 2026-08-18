from __future__ import annotations

import argparse
import importlib.metadata
import json
from pathlib import Path

import numpy as np

from pipeline.artifacts import fetch_artifact
from pipeline.config import (
    CACHE_ROOT,
    COLLECTIONS,
    DATA_ROOT,
    DEFAULT_COLLECTION_ID,
    TARGET_COUNT,
    TARGETS_PER_CATEGORY,
    TOP_RANK_COUNT,
    TURKISH_OVERRIDES_FILE,
    VOCABULARY_SIZE,
    CollectionConfig,
    Paths,
    catalog_value,
)
from pipeline.core import (
    build_vocabulary,
    load_targets,
    read_json,
    score_target,
    vocabulary_version,
    write_json,
)
from pipeline.extractors import SentenceTransformerExtractor
from pipeline.extractors import read_word2vec_binary


def load_common_words(collection: CollectionConfig, audit_path: Path) -> list[str]:
    if collection.vocabulary_source is not None:
        value = read_json(collection.vocabulary_source)
        if not isinstance(value, dict) or not isinstance(value.get("keys"), list):
            raise ValueError(
                f"Invalid source vocabulary: {collection.vocabulary_source}"
            )
        keys = value["keys"]
        if (
            value.get("language") != collection.language
            or value.get("normalization") != collection.normalization
            or len(keys) < TOP_RANK_COUNT
            or not all(isinstance(word, str) for word in keys)
        ):
            raise ValueError(
                f"Incompatible source vocabulary: {collection.vocabulary_source}"
            )
        print(f"Using source vocabulary from {collection.vocabulary_source}")
        return keys

    from wordfreq import iter_wordlist

    if collection.language == "tr":
        from pipeline.turkish import build_zeyrek_vocabulary

        result = build_zeyrek_vocabulary(
            iter_wordlist("tr", wordlist="best"),
            VOCABULARY_SIZE,
            TURKISH_OVERRIDES_FILE,
            audit_path,
        )
        print(
            f"Turkish preprocessing: {result.candidate_count} candidates -> "
            f"{len(result.words)} words; {result.suspect_count} overlaps reviewed."
        )
        print(f"Analysis counts: {dict(result.analyses.most_common())}")
        print(f"Drops: {dict(result.drops.most_common())}")
        print(f"Vocabulary audit: {audit_path}")
        return result.words
    return build_vocabulary(
        iter_wordlist(collection.language, wordlist="best"),
        VOCABULARY_SIZE,
        collection.language,
    )


def load_or_create_vocabulary(
    paths: Paths,
    collection: CollectionConfig,
) -> list[str]:
    if collection.vocabulary_source is not None:
        return load_common_words(collection, paths.vocabulary_audit)
    if paths.vocabulary.exists():
        value = read_json(paths.vocabulary)
        if isinstance(value, dict):
            keys = value.get("keys")
            version = value.get("version")
            if (
                value.get("schemaVersion") == 2
                and value.get("language") == collection.language
                and value.get("normalization") == collection.normalization
                and value.get("vocabularyPolicy") == collection.vocabulary_policy
                and value.get("keyEncoding") == "plain"
                and isinstance(keys, list)
                and TOP_RANK_COUNT <= len(keys) <= VOCABULARY_SIZE
                and (collection.language != "en" or len(keys) == VOCABULARY_SIZE)
                and all(isinstance(word, str) for word in keys)
                and version == vocabulary_version(keys)
            ):
                print(f"Using existing vocabulary from {paths.vocabulary}")
                return keys
    return load_common_words(collection, paths.vocabulary_audit)


def expected_cache_metadata(
    version: str,
    collection: CollectionConfig,
    sentence_transformers_version: str | None = None,
) -> dict[str, object]:
    if sentence_transformers_version is None:
        sentence_transformers_version = importlib.metadata.version("sentence-transformers")
    extractor = collection.extractor
    return {
        "model": extractor.model,
        "revision": extractor.revision,
        "prompt": extractor.prompt,
        "dimensions": extractor.dimensions,
        "collectionId": collection.id,
        "language": collection.language,
        "normalization": collection.normalization,
        "vocabularyVersion": version,
        "sentenceTransformersVersion": sentence_transformers_version,
    }


def load_or_create_embeddings(
    paths: Paths,
    collection: CollectionConfig,
    words: list[str],
    version: str,
    *,
    batch_size: int,
    device: str | None,
    force: bool,
) -> np.ndarray:
    actual = (
        read_json(paths.cache_metadata)
        if paths.embeddings.exists() and paths.cache_metadata.exists()
        else None
    )
    try:
        expected = expected_cache_metadata(version, collection)
    except importlib.metadata.PackageNotFoundError:
        cached_version = (
            actual.get("sentenceTransformersVersion") if isinstance(actual, dict) else None
        )
        if not isinstance(cached_version, str):
            raise
        expected = expected_cache_metadata(version, collection, cached_version)
    if not force and paths.embeddings.exists() and paths.cache_metadata.exists():
        if actual == expected:
            embeddings = np.load(paths.embeddings)
            if embeddings.shape == (len(words), collection.extractor.dimensions):
                print(f"Using cached embeddings from {paths.embeddings}")
                return embeddings

    extractor_config = collection.extractor
    extractor = SentenceTransformerExtractor(
        model_id=extractor_config.model,
        revision=extractor_config.revision,
        prompt=extractor_config.prompt,
        dimensions=extractor_config.dimensions,
        trust_remote_code=extractor_config.trust_remote_code,
        device=device,
    )
    embeddings = extractor.encode(words, batch_size=batch_size)
    paths.cache.mkdir(parents=True, exist_ok=True)
    np.save(paths.embeddings, embeddings)
    write_json(paths.cache_metadata, expected)
    return embeddings


def static_source_directory(cache_root: Path, collection: CollectionConfig) -> Path:
    return cache_root / "sources" / collection.id


def load_or_create_static_embeddings(
    paths: Paths,
    collection: CollectionConfig,
    requested_words: list[str],
    targets: list[dict[str, str]],
    *,
    cache_root: Path,
    force: bool,
) -> tuple[list[str], np.ndarray, dict[str, object]]:
    artifact = collection.extractor.artifact
    if artifact is None:
        raise ValueError(f"Collection {collection.id} has no static artifact configured.")
    source_directory = static_source_directory(cache_root, collection)
    model_path = source_directory / artifact.member_name
    receipt_path = source_directory / "artifact.json"
    if not model_path.exists() or not receipt_path.exists():
        raise FileNotFoundError(
            f"Static model is not available. Run: python -m pipeline fetch "
            f"--collection {collection.id}"
        )
    receipt = read_json(receipt_path)
    if not isinstance(receipt, dict) or not isinstance(
        receipt.get("modelSha256"), str
    ):
        raise ValueError(f"Invalid artifact receipt: {receipt_path}")

    requested_version = vocabulary_version(requested_words)
    actual = (
        read_json(paths.cache_metadata)
        if paths.embeddings.exists()
        and paths.cache_metadata.exists()
        and paths.static_vocabulary.exists()
        else None
    )
    cached_vocabulary = (
        read_json(paths.static_vocabulary)
        if paths.static_vocabulary.exists()
        else None
    )
    cached_words = (
        cached_vocabulary.get("keys")
        if isinstance(cached_vocabulary, dict)
        else None
    )
    if isinstance(cached_words, list) and all(
        isinstance(word, str) for word in cached_words
    ):
        usable_version = vocabulary_version(cached_words)
        expected = {
            "model": collection.extractor.model,
            "revision": collection.extractor.revision,
            "dimensions": collection.extractor.dimensions,
            "collectionId": collection.id,
            "language": collection.language,
            "normalization": collection.normalization,
            "vocabularyVersion": usable_version,
            "requestedVocabularyVersion": requested_version,
            "artifactSha256": receipt["modelSha256"],
        }
        if not force and actual == expected:
            embeddings = np.load(paths.embeddings)
            if embeddings.shape == (
                len(cached_words),
                collection.extractor.dimensions,
            ):
                print(f"Using cached embeddings from {paths.embeddings}")
                return cached_words, embeddings, expected

    selection = read_word2vec_binary(
        model_path,
        requested_words,
        expected_dimensions=collection.extractor.dimensions,
    )
    missing_targets = [
        target["word"] for target in targets if target["word"] in selection.missing
    ]
    coverage = {
        "schemaVersion": 1,
        "collectionId": collection.id,
        "requestedVocabularyVersion": requested_version,
        "requestedCount": len(requested_words),
        "foundCount": len(selection.words),
        "missingCount": len(selection.missing),
        "coveragePercent": round(100 * len(selection.words) / len(requested_words), 4),
        "missingWords": selection.missing,
        "missingTargets": missing_targets,
        "artifactSha256": receipt["modelSha256"],
    }
    paths.cache.mkdir(parents=True, exist_ok=True)
    write_json(paths.coverage_audit, coverage)
    if missing_targets:
        raise ValueError(
            "Word2Vec model is missing puzzle targets: " + ", ".join(missing_targets)
        )
    if len(selection.words) < TOP_RANK_COUNT:
        raise ValueError(
            f"Word2Vec model covers only {len(selection.words)} words; "
            f"at least {TOP_RANK_COUNT} are required."
        )

    usable_version = vocabulary_version(selection.words)
    expected = {
        "model": collection.extractor.model,
        "revision": collection.extractor.revision,
        "dimensions": collection.extractor.dimensions,
        "collectionId": collection.id,
        "language": collection.language,
        "normalization": collection.normalization,
        "vocabularyVersion": usable_version,
        "requestedVocabularyVersion": requested_version,
        "artifactSha256": receipt["modelSha256"],
    }
    np.save(paths.embeddings, selection.embeddings)
    write_json(paths.static_vocabulary, {"keys": selection.words})
    write_json(paths.cache_metadata, expected)
    return selection.words, selection.embeddings, expected


def generate(args: argparse.Namespace) -> None:
    collection = COLLECTIONS[args.collection]
    default_output = args.output is None
    paths = Paths(
        output=args.output or collection.output,
        cache=args.cache / collection.id,
    )
    targets_path = args.targets or collection.targets
    targets = load_targets(
        targets_path,
        TARGET_COUNT,
        collection.language,
        expected_per_category=TARGETS_PER_CATEGORY,
    )
    words = load_or_create_vocabulary(paths, collection)
    missing = [target["word"] for target in targets if target["word"] not in words]
    if missing:
        raise ValueError(f"Targets missing from vocabulary: {', '.join(missing)}")

    cache_metadata: dict[str, object] | None = None
    if collection.extractor.kind == "word2vec-binary":
        words, embeddings, cache_metadata = load_or_create_static_embeddings(
            paths,
            collection,
            words,
            targets,
            cache_root=args.cache,
            force=args.force,
        )
    else:
        version = vocabulary_version(words)
        embeddings = load_or_create_embeddings(
            paths,
            collection,
            words,
            version,
            batch_size=args.batch_size,
            device=args.device,
            force=args.force,
        )

    version = vocabulary_version(words)

    write_json(
        paths.vocabulary,
        {
            "schemaVersion": 2,
            "version": version,
            "language": collection.language,
            "normalization": collection.normalization,
            "vocabularyPolicy": collection.vocabulary_policy,
            "keyEncoding": "plain",
            "keys": words,
        },
    )

    puzzles: list[dict[str, str]] = []
    expected_puzzle_files: set[Path] = set()
    for target in targets:
        target_id = target["id"]
        word = target["word"]
        label = f"Puzzle {int(target_id) + 1}"
        scores, top_indices = score_target(words, embeddings, word, TOP_RANK_COUNT)
        filename = f"puzzles/{target_id}.json"
        expected_puzzle_files.add(paths.output / filename)
        write_json(
            paths.output / filename,
            {
                "schemaVersion": 2,
                "vocabularyVersion": version,
                "targetKey": word,
                "category": target["category"],
                "scores": scores,
                "topIndices": top_indices,
            },
        )
        puzzles.append(
            {
                "id": target_id,
                "label": label,
                "file": filename,
                "category": target["category"],
            }
        )

    puzzle_directory = paths.output / "puzzles"
    if puzzle_directory.exists():
        for existing in puzzle_directory.glob("*.json"):
            if existing not in expected_puzzle_files:
                existing.unlink()

    extractor_manifest = collection.extractor.manifest_value()
    if cache_metadata is not None:
        extractor_manifest["artifactSha256"] = cache_metadata["artifactSha256"]
    write_json(
        paths.manifest,
        {
            "schemaVersion": 3,
            "id": collection.id,
            "language": collection.language,
            "extractor": extractor_manifest,
            "vocabularyFile": "vocabulary.json",
            "puzzles": puzzles,
        },
    )
    if default_output and collection.published:
        write_json(DATA_ROOT / "catalog.json", catalog_value())
    print(f"Generated {len(puzzles)} puzzles in {paths.output}")


def audit(args: argparse.Namespace) -> None:
    collection = COLLECTIONS[args.collection]
    paths = Paths(
        output=args.output or collection.output,
        cache=args.cache / collection.id,
    )
    targets = load_targets(
        args.targets or collection.targets,
        TARGET_COUNT,
        collection.language,
        expected_per_category=TARGETS_PER_CATEGORY,
    )
    vocabulary = read_json(paths.vocabulary)
    if not isinstance(vocabulary, dict) or not isinstance(vocabulary.get("keys"), list):
        raise ValueError("Generate the vocabulary before running an audit.")
    words = vocabulary["keys"]

    if paths.coverage_audit.exists():
        coverage = read_json(paths.coverage_audit)
        if isinstance(coverage, dict):
            print(
                "Vocabulary coverage: "
                f"{coverage.get('foundCount')}/{coverage.get('requestedCount')} "
                f"({coverage.get('coveragePercent')}%); "
                f"{coverage.get('missingCount')} missing."
            )
            missing_targets = coverage.get("missingTargets")
            if missing_targets:
                print(f"Missing targets: {', '.join(missing_targets)}")

    for target in targets:
        target_id = target["id"]
        word = target["word"]
        label = f"Puzzle {int(target_id) + 1}"
        puzzle = read_json(paths.output / f"puzzles/{target_id}.json")
        if not isinstance(puzzle, dict):
            raise ValueError(f"Invalid puzzle data for {word}.")
        scores = puzzle["scores"]
        top_indices = puzzle["topIndices"]
        print(f'\n{label} [ID {target_id}] — {target["category"]}: {word}')
        for rank, index in enumerate(top_indices[: args.limit], start=1):
            print(f"{rank:>3}  {words[index]:<20} {scores[index] / 100:>7.2f}")


def fetch(args: argparse.Namespace) -> None:
    collection = COLLECTIONS[args.collection]
    artifact = collection.extractor.artifact
    if artifact is None:
        raise ValueError(f"Collection {collection.id} has no downloadable artifact.")
    model, receipt = fetch_artifact(
        artifact, static_source_directory(args.cache, collection)
    )
    print(f"Model ready: {model}")
    print(f"Model SHA-256: {receipt['modelSha256']}")


def parser() -> argparse.ArgumentParser:
    command_parser = argparse.ArgumentParser(description="Generate wordsim data.")
    command_parser.add_argument(
        "command",
        choices=("generate", "audit", "fetch"),
        help="Pipeline operation to run.",
    )
    command_parser.add_argument(
        "--collection",
        choices=tuple(COLLECTIONS),
        default=DEFAULT_COLLECTION_ID,
        help="Collection configuration to generate or audit.",
    )
    command_parser.add_argument(
        "--output", type=Path, default=None
    )
    command_parser.add_argument("--cache", type=Path, default=CACHE_ROOT)
    command_parser.add_argument("--targets", type=Path, default=None)
    command_parser.add_argument("--batch-size", type=int, default=64)
    command_parser.add_argument("--device", default=None)
    command_parser.add_argument("--force", action="store_true")
    command_parser.add_argument("--limit", type=int, default=25)
    return command_parser


def main() -> None:
    args = parser().parse_args()
    if args.command == "generate":
        generate(args)
    elif args.command == "audit":
        audit(args)
    else:
        fetch(args)


if __name__ == "__main__":
    main()
