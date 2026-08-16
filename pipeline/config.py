from dataclasses import dataclass
from pathlib import Path


MODEL_ID = "google/embeddinggemma-300m"
MODEL_REVISION = "57c266a740f537b4dc058e1b0cda161fd15afa75"
MODEL_PROMPT = "task: sentence similarity | query: "
MODEL_DIMENSIONS = 768
VOCABULARY_SIZE = 30_000
TOP_RANK_COUNT = 1_000
TARGET_COUNT = 50
DATA_ROOT = Path("wordsim/data")
CACHE_ROOT = Path("pipeline-cache")


@dataclass(frozen=True)
class CollectionConfig:
    id: str
    language: str
    label: str
    short_label: str
    normalization: str
    vocabulary_policy: str
    targets: Path

    @property
    def output(self) -> Path:
        return DATA_ROOT / "collections" / self.id


ENGLISH_COLLECTION_ID = "embeddinggemma-768-en-v1"
TURKISH_COLLECTION_ID = "embeddinggemma-768-tr-v1"
COLLECTIONS = {
    ENGLISH_COLLECTION_ID: CollectionConfig(
        id=ENGLISH_COLLECTION_ID,
        language="en",
        label="English",
        short_label="EN",
        normalization="en-lower-nfc-v1",
        vocabulary_policy="wordfreq-surface-v1",
        targets=Path(__file__).with_name("targets") / "en.json",
    ),
    TURKISH_COLLECTION_ID: CollectionConfig(
        id=TURKISH_COLLECTION_ID,
        language="tr",
        label="Türkçe",
        short_label="TR",
        normalization="tr-modern-lower-nfc-v1",
        vocabulary_policy="stanza-tr-guarded-v1",
        targets=Path(__file__).with_name("targets") / "tr.json",
    ),
}
DEFAULT_COLLECTION_ID = ENGLISH_COLLECTION_ID
TARGETS_FILE = COLLECTIONS[DEFAULT_COLLECTION_ID].targets


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


def catalog_value() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "defaultCollectionId": DEFAULT_COLLECTION_ID,
        "collections": [
            {
                "id": collection.id,
                "language": collection.language,
                "label": collection.label,
                "shortLabel": collection.short_label,
                "file": f"collections/{collection.id}/collection.json",
            }
            for collection in COLLECTIONS.values()
        ],
    }
