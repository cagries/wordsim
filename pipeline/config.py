from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


STS_PROMPT = "task: sentence similarity | query: "
VOCABULARY_SIZE = 30_000
TOP_RANK_COUNT = 1_000
TARGETS_PER_CATEGORY = 20
TARGET_CATEGORY_COUNT = 8
TARGET_COUNT = TARGETS_PER_CATEGORY * TARGET_CATEGORY_COUNT
DATA_ROOT = Path("wordsim/data")
CACHE_ROOT = Path("pipeline-cache")


@dataclass(frozen=True)
class ArtifactConfig:
    url: str
    release: str
    archive_name: str
    archive_size: int
    archive_md5: str
    archive_sha256: str
    member_name: str
    model_sha256: str


@dataclass(frozen=True)
class ExtractorConfig:
    id: str
    model: str
    revision: str
    prompt: str
    dimensions: int
    trust_remote_code: bool = False
    kind: str = "sentence-transformer"
    artifact: ArtifactConfig | None = None

    def manifest_value(self) -> dict[str, object]:
        value: dict[str, object] = {
            "id": self.id,
            "kind": self.kind,
            "model": self.model,
            "revision": self.revision,
            "prompt": self.prompt,
            "dimensions": self.dimensions,
            "trustRemoteCode": self.trust_remote_code,
        }
        if self.artifact is not None:
            value["artifact"] = {
                "release": self.artifact.release,
                "archive": self.artifact.archive_name,
                "member": self.artifact.member_name,
            }
        return value


@dataclass(frozen=True)
class CollectionConfig:
    id: str
    language: str
    label: str
    short_label: str
    normalization: str
    vocabulary_policy: str
    targets: Path
    extractor: ExtractorConfig
    published: bool = True
    vocabulary_source: Path | None = None

    @property
    def output(self) -> Path:
        root = DATA_ROOT / "collections" if self.published else CACHE_ROOT / "staging"
        return root / self.id


ENGLISH_COLLECTION_ID = "embeddinggemma-768-en-v1"
TURKISH_MAGIBU_COLLECTION_ID = "embeddingmagibu-768-tr-v1"
TURKISH_WORD2VEC_COLLECTION_ID = "word2vec-skipgram-300-tr-v1"
TURKISH_COLLECTION_ID = TURKISH_WORD2VEC_COLLECTION_ID
COLLECTIONS = {
    ENGLISH_COLLECTION_ID: CollectionConfig(
        id=ENGLISH_COLLECTION_ID,
        language="en",
        label="English",
        short_label="EN",
        normalization="en-lower-nfc-v1",
        vocabulary_policy="wordfreq-surface-v1",
        targets=Path(__file__).with_name("targets") / "en.json",
        extractor=ExtractorConfig(
            id="embeddinggemma",
            model="google/embeddinggemma-300m",
            revision="57c266a740f537b4dc058e1b0cda161fd15afa75",
            prompt=STS_PROMPT,
            dimensions=768,
        ),
    ),
    TURKISH_MAGIBU_COLLECTION_ID: CollectionConfig(
        id=TURKISH_MAGIBU_COLLECTION_ID,
        language="tr",
        label="Türkçe — EmbeddingMagibu",
        short_label="TR-MAG",
        normalization="tr-modern-lower-nfc-v1",
        vocabulary_policy="zeyrek-tr-reviewed-v1",
        targets=Path(__file__).with_name("targets") / "tr.json",
        extractor=ExtractorConfig(
            id="embeddingmagibu",
            model="alibayram/embeddingmagibu-200m",
            revision="27755be9526bab57567896307597e6a6a89c8c39",
            prompt=STS_PROMPT,
            dimensions=768,
        ),
        published=False,
    ),
    TURKISH_WORD2VEC_COLLECTION_ID: CollectionConfig(
        id=TURKISH_WORD2VEC_COLLECTION_ID,
        language="tr",
        label="Türkçe",
        short_label="TR",
        normalization="tr-modern-lower-nfc-v1",
        vocabulary_policy="zeyrek-tr-reviewed-word2vec-covered-v1",
        targets=Path(__file__).with_name("targets") / "tr.json",
        extractor=ExtractorConfig(
            id="word2vec-skipgram",
            kind="word2vec-binary",
            model=(
                "Turkish-Word-Embeddings/"
                "Word-Embeddings-Repository-for-Turkish"
            ),
            revision="v1.0.0",
            prompt="",
            dimensions=300,
            artifact=ArtifactConfig(
                url=(
                    "https://github.com/Turkish-Word-Embeddings/"
                    "Word-Embeddings-Repository-for-Turkish/releases/download/"
                    "v1.0.0/word2vec_10ep-300emb.zip"
                ),
                release="v1.0.0",
                archive_name="word2vec_10ep-300emb.zip",
                archive_size=1_774_532_944,
                archive_md5="3c40eabb26597ddab827afc8353acaa0",
                archive_sha256=(
                    "b91a2106e39d323b92fd5fab5f61636d"
                    "9ee6ca8378f3a456f6f8a33066c65b51"
                ),
                member_name="word2vec_10ep-300emb.bin",
                model_sha256=(
                    "ab24d19b9d811a9636e633710c5bb5b6"
                    "1a85e0cda82e9230fed69f7b684a026f"
                ),
            ),
        ),
        published=True,
    ),
}
DEFAULT_COLLECTION_ID = ENGLISH_COLLECTION_ID
TARGETS_FILE = COLLECTIONS[DEFAULT_COLLECTION_ID].targets
TURKISH_OVERRIDES_FILE = Path(__file__).with_name("targets") / "tr-overrides.json"


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

    @property
    def vocabulary_audit(self) -> Path:
        return self.cache / "vocabulary-audit.json"

    @property
    def coverage_audit(self) -> Path:
        return self.cache / "coverage-audit.json"

    @property
    def static_vocabulary(self) -> Path:
        return self.cache / "static-vocabulary.json"


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
            if collection.published
        ],
    }
