from __future__ import annotations

from typing import Protocol

import numpy as np

from pipeline.core import normalize_rows


class EmbeddingExtractor(Protocol):
    @property
    def dimensions(self) -> int: ...

    def encode(self, words: list[str], *, batch_size: int) -> np.ndarray: ...


class EmbeddingGemmaExtractor:
    def __init__(
        self,
        *,
        model_id: str,
        revision: str,
        prompt: str,
        dimensions: int,
        device: str | None = None,
    ) -> None:
        from sentence_transformers import SentenceTransformer

        self._prompt = prompt
        self._dimensions = dimensions
        self._model = SentenceTransformer(model_id, revision=revision, device=device)

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

