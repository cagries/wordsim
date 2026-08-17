from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np

from pipeline.core import normalize_rows


class EmbeddingExtractor(Protocol):
    @property
    def dimensions(self) -> int: ...

    def encode(self, words: list[str], *, batch_size: int) -> np.ndarray: ...


class SentenceTransformerExtractor:
    def __init__(
        self,
        *,
        model_id: str,
        revision: str,
        prompt: str,
        dimensions: int,
        trust_remote_code: bool = False,
        device: str | None = None,
    ) -> None:
        from sentence_transformers import SentenceTransformer

        self._prompt = prompt
        self._dimensions = dimensions
        self._model = SentenceTransformer(
            model_id,
            revision=revision,
            trust_remote_code=trust_remote_code,
            device=device,
        )

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def encode(self, words: list[str], *, batch_size: int) -> np.ndarray:
        embeddings = self._model.encode(
            words,
            prompt=self._prompt,
            batch_size=batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=True,
        )
        if embeddings.shape != (len(words), self.dimensions):
            raise ValueError(
                f"Unexpected embedding shape {embeddings.shape}; "
                f"expected ({len(words)}, {self.dimensions})."
            )
        return normalize_rows(embeddings)


@dataclass(frozen=True)
class Word2VecSelection:
    words: list[str]
    embeddings: np.ndarray
    missing: list[str]


def read_word2vec_binary(
    path: Path,
    requested_words: list[str],
    *,
    expected_dimensions: int,
) -> Word2VecSelection:
    requested = set(requested_words)
    found: dict[str, np.ndarray] = {}
    vector_bytes = expected_dimensions * np.dtype("<f4").itemsize

    with path.open("rb") as source:
        header = source.readline()
        try:
            vocabulary_size, dimensions = map(int, header.split())
        except (TypeError, ValueError) as error:
            raise ValueError("Invalid Word2Vec binary header.") from error
        if dimensions != expected_dimensions:
            raise ValueError(
                f"Word2Vec model has {dimensions} dimensions; "
                f"expected {expected_dimensions}."
            )

        for _ in range(vocabulary_size):
            token = bytearray()
            while True:
                character = source.read(1)
                if not character:
                    raise ValueError("Word2Vec model ended while reading a token.")
                if character == b" ":
                    break
                if character != b"\n":
                    token.extend(character)
            try:
                word = unicodedata.normalize("NFC", token.decode("utf-8"))
            except UnicodeDecodeError as error:
                raise ValueError("Word2Vec model contains a non-UTF-8 token.") from error

            payload = source.read(vector_bytes)
            if len(payload) != vector_bytes:
                raise ValueError(f'Word2Vec vector for "{word}" is truncated.')
            if word in requested and word not in found:
                found[word] = np.frombuffer(payload, dtype="<f4").copy()

    words = [word for word in requested_words if word in found]
    missing = [word for word in requested_words if word not in found]
    if not words:
        raise ValueError("None of the requested words exist in the Word2Vec model.")
    matrix = np.vstack([found[word] for word in words]).astype(np.float32, copy=False)
    return Word2VecSelection(words, normalize_rows(matrix), missing)
