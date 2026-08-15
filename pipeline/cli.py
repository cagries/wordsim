from __future__ import annotations

import argparse
import importlib.metadata
import json
from pathlib import Path

import numpy as np

from pipeline.config import (
    MODEL_DIMENSIONS,
    MODEL_ID,
    MODEL_PROMPT,
    MODEL_REVISION,
    TARGET_COUNT,
    TARGETS_FILE,
    TOP_RANK_COUNT,
    VOCABULARY_SIZE,
    Paths,
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


def load_common_words() -> list[str]:
    from wordfreq import iter_wordlist

    return build_vocabulary(iter_wordlist("en", wordlist="best"), VOCABULARY_SIZE)


def load_or_create_vocabulary(paths: Paths) -> list[str]:
    if paths.vocabulary.exists():
        value = read_json(paths.vocabulary)
        if isinstance(value, dict):
            keys = value.get("keys")
            version = value.get("version")
            if (
                isinstance(keys, list)
                and len(keys) == VOCABULARY_SIZE
                and all(isinstance(word, str) for word in keys)
                and version == vocabulary_version(keys)
            ):
                print(f"Using existing vocabulary from {paths.vocabulary}")
                return keys
    return load_common_words()


def expected_cache_metadata(
    version: str, sentence_transformers_version: str | None = None
) -> dict[str, object]:
    if sentence_transformers_version is None:
        sentence_transformers_version = importlib.metadata.version("sentence-transformers")
    return {
        "model": MODEL_ID,
        "revision": MODEL_REVISION,
        "prompt": MODEL_PROMPT,
        "dimensions": MODEL_DIMENSIONS,
        "vocabularyVersion": version,
        "sentenceTransformersVersion": sentence_transformers_version,
    }


def load_or_create_embeddings(
    paths: Paths,
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
        expected = expected_cache_metadata(version)
    except importlib.metadata.PackageNotFoundError:
        cached_version = (
            actual.get("sentenceTransformersVersion") if isinstance(actual, dict) else None
        )
        if not isinstance(cached_version, str):
            raise
        expected = expected_cache_metadata(version, cached_version)
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
    paths = Paths(output=args.output, cache=args.cache)
    targets = load_targets(args.targets, TARGET_COUNT)
    words = load_or_create_vocabulary(paths)
    missing = [target["word"] for target in targets if target["word"] not in words]
    if missing:
        raise ValueError(f"Targets missing from vocabulary: {', '.join(missing)}")

    version = vocabulary_version(words)
    embeddings = load_or_create_embeddings(
        paths,
        words,
        version,
        batch_size=args.batch_size,
        device=args.device,
        force=args.force,
    )

    write_json(
        paths.vocabulary,
        {"schemaVersion": 1, "version": version, "keyEncoding": "plain", "keys": words},
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
            "schemaVersion": 1,
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
    print(f"Generated {len(puzzles)} puzzles in {paths.output}")


def audit(args: argparse.Namespace) -> None:
    paths = Paths(output=args.output, cache=args.cache)
    targets = load_targets(args.targets, TARGET_COUNT)
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
    command_parser = argparse.ArgumentParser(description="Generate semantic game data.")
    command_parser.add_argument(
        "command", choices=("generate", "audit"), help="Pipeline operation to run."
    )
    command_parser.add_argument(
        "--output", type=Path, default=Path("assets/semantic-game/data")
    )
    command_parser.add_argument("--cache", type=Path, default=Path("pipeline-cache"))
    command_parser.add_argument("--targets", type=Path, default=TARGETS_FILE)
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
