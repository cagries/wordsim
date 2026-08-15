from dataclasses import dataclass
from pathlib import Path


MODEL_ID = "google/embeddinggemma-300m"
MODEL_REVISION = "57c266a740f537b4dc058e1b0cda161fd15afa75"
MODEL_PROMPT = "task: sentence similarity | query: "
MODEL_DIMENSIONS = 768
VOCABULARY_SIZE = 30_000
TOP_RANK_COUNT = 1_000
TARGET_COUNT = 50
TARGETS_FILE = Path(__file__).with_name("targets.json")


@dataclass(frozen=True)
class Paths:
    output: Path
    cache: Path

    @property
    def vocabulary(self) -> Path:
        return self.output / "vocabulary.json"

    @property
    def manifest(self) -> Path:
        return self.output / "collection.json"

    @property
    def embeddings(self) -> Path:
        return self.cache / "embeddings.npy"

    @property
    def cache_metadata(self) -> Path:
        return self.cache / "embeddings.json"
