from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Iterable

import numpy as np


WORD_PATTERN = re.compile(r"^[a-z]+$")


def build_vocabulary(candidates: Iterable[str], size: int) -> list[str]:
    words: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        word = candidate.strip().lower()
        if not WORD_PATTERN.fullmatch(word) or word in seen:
            continue
        seen.add(word)
        words.append(word)
        if len(words) == size:
            break
    if len(words) != size:
        raise ValueError(f"Only found {len(words)} valid words; expected {size}.")
    return words


def vocabulary_version(words: list[str]) -> str:
    payload = "\n".join(words).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def normalize_rows(embeddings: np.ndarray) -> np.ndarray:
    matrix = np.asarray(embeddings, dtype=np.float32)
    if matrix.ndim != 2:
        raise ValueError("Embeddings must be a two-dimensional matrix.")
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    if np.any(norms == 0):
        raise ValueError("Embeddings must not contain zero-length rows.")
    return matrix / norms


def score_target(
    words: list[str], embeddings: np.ndarray, target: str, top_count: int
) -> tuple[list[int], list[int]]:
    if target not in words:
        raise ValueError(f'Target "{target}" is not in the vocabulary.')
    if embeddings.shape[0] != len(words):
        raise ValueError("Embedding count does not match the vocabulary.")

    target_index = words.index(target)
    similarities = np.clip(embeddings @ embeddings[target_index], -1.0, 1.0)
    similarities[target_index] = 1.0
    scores = np.rint(similarities * 10_000).astype(np.int16)
    scores[target_index] = 10_000

    indices = np.arange(len(words))
    target_priority = np.ones(len(words), dtype=np.int8)
    target_priority[target_index] = 0
    order = np.lexsort((indices, target_priority, -similarities))
    top_indices = order[: min(top_count, len(words))].astype(int).tolist()
    if top_indices[0] != target_index:
        raise AssertionError("The target must have proximity rank 1.")
    return scores.astype(int).tolist(), top_indices


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))

