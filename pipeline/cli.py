from __future__ import annotations

import argparse
import importlib.metadata
import json
from pathlib import Path

import numpy as np

from pipeline.config import (
    CACHE_ROOT,
    COLLECTIONS,
    DATA_ROOT,
    DEFAULT_COLLECTION_ID,
    MODEL_DIMENSIONS,
    MODEL_ID,
    MODEL_PROMPT,
    MODEL_REVISION,
    TARGET_COUNT,
    TOP_RANK_COUNT,
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
from pipeline.extractors import EmbeddingGemmaExtractor


def load_common_words(language: str) -> list[str]:
    from wordfreq import iter_wordlist

    return build_vocabulary(
        iter_wordlist(language, wordlist="best"), VOCABULARY_SIZE, language
    )


def load_or_create_vocabulary(paths: Paths, collection: CollectionConfig) -> list[str]:
    if paths.vocabulary.exists():
        value = read_json(paths.vocabulary)
        if isinstance(value, dict):
            keys = value.get("keys")
            version = value.get("version")
            if (
                value.get("schemaVersion") == 2
                and value.get("language") == collection.language
                and value.get("normalization") == collection.normalization
                and value.get("keyEncoding") == "plain"
                and isinstance(keys, list)
                and len(keys) == VOCABULARY_SIZE
                and all(isinstance(word, str) for word in keys)
                and version == vocabulary_version(keys)
            ):
                print(f"Using existing vocabulary from {paths.vocabulary}")
                return keys
    return load_common_words(collection.language)


def expected_cache_metadata(
    version: str,
    collection: CollectionConfig,
    sentence_transformers_version: str | None = None,
) -> dict[str, object]:
    if sentence_transformers_version is None:
        sentence_transformers_version = importlib.metadata.version("sentence-transformers")
    return {
        "model": MODEL_ID,
        "revision": MODEL_REVISION,
        "prompt": MODEL_PROMPT,
        "dimensions": MODEL_DIMENSIONS,
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
            if embeddings.shape == (len(words), MODEL_DIMENSIONS):
                print(f"Using cached embeddings from {paths.embeddings}")
                return embeddings

    extractor = EmbeddingGemmaExtractor(
        model_id=MODEL_ID,
        revision=MODEL_REVISION,
        prompt=MODEL_PROMPT,
        dimensions=MODEL_DIMENSIONS,
        device=device,
    )
    embeddings = extractor.encode(words, batch_size=batch_size)
    paths.cache.mkdir(parents=True, exist_ok=True)
    np.save(paths.embeddings, embeddings)
    write_json(paths.cache_metadata, expected)
    return embeddings


def generate(args: argparse.Namespace) -> None:
    collection = COLLECTIONS[args.collection]
    default_output = args.output is None
    paths = Paths(
        output=args.output or collection.output,
        cache=args.cache / collection.id,
    )
    targets_path = args.targets or collection.targets
    targets = load_targets(targets_path, TARGET_COUNT, collection.language)
    words = load_or_create_vocabulary(paths, collection)
    missing = [target["word"] for target in targets if target["word"] not in words]
    if missing:
        raise ValueError(f"Targets missing from vocabulary: {', '.join(missing)}")

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

    write_json(
        paths.vocabulary,
        {
            "schemaVersion": 2,
            "version": version,
            "language": collection.language,
            "normalization": collection.normalization,
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
        puzzles.append({"id": target_id, "label": label, "file": filename})

    puzzle_directory = paths.output / "puzzles"
    if puzzle_directory.exists():
        for existing in puzzle_directory.glob("*.json"):
            if existing not in expected_puzzle_files:
                existing.unlink()

    write_json(
        paths.manifest,
        {
            "schemaVersion": 2,
            "id": collection.id,
            "language": collection.language,
            "extractor": {
                "id": "embeddinggemma",
                "model": MODEL_ID,
                "revision": MODEL_REVISION,
                "prompt": MODEL_PROMPT,
                "dimensions": MODEL_DIMENSIONS,
            },
            "vocabularyFile": "vocabulary.json",
            "puzzles": puzzles,
        },
    )
    if default_output:
        write_json(DATA_ROOT / "catalog.json", catalog_value())
    print(f"Generated {len(puzzles)} puzzles in {paths.output}")


def audit(args: argparse.Namespace) -> None:
    collection = COLLECTIONS[args.collection]
    paths = Paths(
        output=args.output or collection.output,
        cache=args.cache / collection.id,
    )
    targets = load_targets(
        args.targets or collection.targets, TARGET_COUNT, collection.language
    )
    vocabulary = read_json(paths.vocabulary)
    if not isinstance(vocabulary, dict) or not isinstance(vocabulary.get("keys"), list):
        raise ValueError("Generate the vocabulary before running an audit.")
    words = vocabulary["keys"]

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


def parser() -> argparse.ArgumentParser:
    command_parser = argparse.ArgumentParser(description="Generate wordsim data.")
    command_parser.add_argument(
        "command", choices=("generate", "audit"), help="Pipeline operation to run."
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
    else:
        audit(args)


if __name__ == "__main__":
    main()
