from __future__ import annotations

import hashlib
import json
import unicodedata
from pathlib import Path
from typing import Iterable

import numpy as np


TARGET_CATEGORIES = {
    "animal",
    "object",
    "action",
    "adjective",
    "food",
    "place",
    "occupation",
    "clothing",
}
ALLOWED_CHARACTERS = {
    "en": frozenset("abcdefghijklmnopqrstuvwxyz"),
    "tr": frozenset("abcdefghijklmnopqrstuvwxyzçğıöşü"),
}
TURKISH_CIRCUMFLEXES = str.maketrans({"â": "a", "î": "i", "û": "u"})


def normalize_word(value: str, language: str = "en") -> str:
    if language not in ALLOWED_CHARACTERS:
        raise ValueError(f"Unsupported language: {language}.")
    word = unicodedata.normalize("NFC", value.strip())
    if language == "tr":
        word = word.replace("I", "ı").replace("İ", "i").lower()
        word = word.translate(TURKISH_CIRCUMFLEXES)
    else:
        word = word.lower()
    return unicodedata.normalize("NFC", word)


def is_valid_word(word: str, language: str = "en") -> bool:
    allowed = ALLOWED_CHARACTERS.get(language)
    if allowed is None:
        raise ValueError(f"Unsupported language: {language}.")
    return bool(word) and all(character in allowed for character in word)


def load_targets(
    path: Path,
    expected_count: int,
    language: str = "en",
    expected_per_category: int | None = None,
) -> list[dict[str, str]]:
    value = read_json(path)
    if not isinstance(value, list) or len(value) != expected_count:
        actual = len(value) if isinstance(value, list) else "non-list"
        raise ValueError(f"Target file has {actual} entries; expected {expected_count}.")

    targets: list[dict[str, str]] = []
    seen_words: set[str] = set()
    for index, entry in enumerate(value):
        if not isinstance(entry, dict):
            raise ValueError(f"Target entry {index} must be an object.")
        target_id = entry.get("id")
        word = entry.get("word")
        category = entry.get("category")
        if target_id != str(index):
            raise ValueError(f'Target entry {index} must have ID "{index}".')
        if (
            not isinstance(word, str)
            or normalize_word(word, language) != word
            or not is_valid_word(word, language)
        ):
            raise ValueError(
                f"Target entry {index} must have a normalized lowercase alphabetic word."
            )
        if word in seen_words:
            raise ValueError(f'Duplicate target word: "{word}".')
        if category not in TARGET_CATEGORIES:
            raise ValueError(f'Unsupported category for "{word}": {category!r}.')
        seen_words.add(word)
        targets.append({"id": target_id, "word": word, "category": category})
    if expected_per_category is not None:
        counts = {
            category: sum(target["category"] == category for target in targets)
            for category in TARGET_CATEGORIES
        }
        invalid = {
            category: count
            for category, count in counts.items()
            if count != expected_per_category
        }
        if invalid:
            details = ", ".join(
                f"{category}={count}" for category, count in sorted(invalid.items())
            )
            raise ValueError(
                f"Target categories must each contain {expected_per_category} entries; "
                f"found {details}."
            )
    return targets


def build_vocabulary(
    candidates: Iterable[str], size: int, language: str = "en"
) -> list[str]:
    words: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        word = normalize_word(candidate, language)
        if not is_valid_word(word, language) or word in seen:
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
