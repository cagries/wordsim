import json
import hashlib
import struct
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

from pipeline.artifacts import fetch_artifact
from pipeline.cli import expected_cache_metadata, load_or_create_static_embeddings, parser
from pipeline.config import (
    ArtifactConfig,
    COLLECTIONS,
    DEFAULT_COLLECTION_ID,
    ENGLISH_COLLECTION_ID,
    TARGETS_PER_CATEGORY,
    TURKISH_COLLECTION_ID,
    TURKISH_WORD2VEC_COLLECTION_ID,
    Paths,
    catalog_value,
)
from pipeline.core import (
    build_vocabulary,
    is_valid_word,
    load_targets,
    normalize_word,
    normalize_rows,
    rank_target,
    TARGET_CATEGORIES,
    vocabulary_version,
    write_json,
)
from pipeline.extractors import SentenceTransformerExtractor, read_word2vec_binary
from pipeline.turkish import (
    LexicalAnalysis,
    load_turkish_overrides,
    select_analysis_outputs,
)


class PipelineCoreTests(unittest.TestCase):
    TARGET_COUNT = TARGETS_PER_CATEGORY * len(TARGET_CATEGORIES)

    def test_cli_defaults_to_standalone_package_data(self) -> None:
        args = parser().parse_args(["audit"])
        self.assertIsNone(args.output)
        self.assertEqual(args.collection, DEFAULT_COLLECTION_ID)
        self.assertEqual(
            COLLECTIONS[args.collection].output,
            Path("wordsim/data/collections/embeddinggemma-768-en-v1"),
        )

    def test_configured_targets_are_complete_and_pinned(self) -> None:
        expected_openings = {
            ENGLISH_COLLECTION_ID: ("violin", "airport"),
            TURKISH_COLLECTION_ID: ("sessiz", "sincap"),
        }
        for collection_id, opening in expected_openings.items():
            collection = COLLECTIONS[collection_id]
            targets = load_targets(
                collection.targets,
                self.TARGET_COUNT,
                collection.language,
                TARGETS_PER_CATEGORY,
            )
            self.assertEqual(tuple(target["word"] for target in targets[:2]), opening)
            self.assertEqual({target["category"] for target in targets}, {
                "animal", "object", "action", "adjective", "food", "place",
                "occupation", "clothing"
            })
            counts = {
                category: sum(target["category"] == category for target in targets)
                for category in {target["category"] for target in targets}
            }
            self.assertEqual(set(counts.values()), {TARGETS_PER_CATEGORY})

        english = load_targets(
            COLLECTIONS[ENGLISH_COLLECTION_ID].targets, self.TARGET_COUNT, "en"
        )
        turkish = load_targets(
            COLLECTIONS[TURKISH_COLLECTION_ID].targets, self.TARGET_COUNT, "tr"
        )
        aligned_new_categories = sum(
            english[index]["category"] == turkish[index]["category"]
            for index in range(50, self.TARGET_COUNT)
        )
        self.assertLess(aligned_new_categories, 30)
        turkish_words = {target["word"] for target in turkish}
        self.assertTrue({"mimar", "asker", "kravat"} <= turkish_words)
        self.assertTrue({"bilimci", "tesisatçı", "kot"}.isdisjoint(turkish_words))
        self.assertEqual(
            tuple(target["word"] for target in turkish[50:54]),
            ("gitar", "muz", "yapmak", "çiftlik"),
        )

    def test_only_published_collections_are_configured(self) -> None:
        collection = COLLECTIONS[TURKISH_WORD2VEC_COLLECTION_ID]
        self.assertTrue(collection.published)
        self.assertEqual(
            collection.output,
            Path("wordsim/data/collections/word2vec-skipgram-300-tr-v1"),
        )
        self.assertEqual(
            {entry["id"] for entry in catalog_value()["collections"]},
            {ENGLISH_COLLECTION_ID, TURKISH_WORD2VEC_COLLECTION_ID},
        )
        self.assertEqual(collection.extractor.kind, "word2vec-binary")
        self.assertEqual(collection.extractor.dimensions, 300)
        self.assertEqual(set(COLLECTIONS), {
            ENGLISH_COLLECTION_ID, TURKISH_WORD2VEC_COLLECTION_ID
        })

    def test_collections_pin_their_models_and_prompts(self) -> None:
        english = COLLECTIONS[ENGLISH_COLLECTION_ID].extractor
        turkish = COLLECTIONS[TURKISH_WORD2VEC_COLLECTION_ID].extractor
        self.assertEqual(english.id, "embeddinggemma")
        self.assertEqual(english.prompt, "task: sentence similarity | query: ")
        self.assertEqual(turkish.id, "word2vec-skipgram")
        self.assertEqual(turkish.prompt, "")
        self.assertFalse(english.trust_remote_code)
        self.assertFalse(turkish.trust_remote_code)

    def test_cache_metadata_uses_the_collection_extractor(self) -> None:
        collection = COLLECTIONS[ENGLISH_COLLECTION_ID]
        metadata = expected_cache_metadata("vocabulary", collection, "test-version")
        self.assertEqual(metadata["model"], "google/embeddinggemma-300m")
        self.assertEqual(metadata["revision"], collection.extractor.revision)
        self.assertEqual(metadata["prompt"], collection.extractor.prompt)
        self.assertEqual(metadata["dimensions"], 768)

    def test_extractor_explicitly_disables_remote_code(self) -> None:
        constructor: dict[str, object] = {}

        class FakeModel:
            def __init__(self, model_id: str, **kwargs: object) -> None:
                constructor.update(model_id=model_id, **kwargs)

            def encode(self, words: list[str], **kwargs: object) -> np.ndarray:
                return np.ones((len(words), 2), dtype=np.float32)

        fake_module = SimpleNamespace(SentenceTransformer=FakeModel)
        with patch.dict(sys.modules, {"sentence_transformers": fake_module}):
            extractor = SentenceTransformerExtractor(
                model_id="example/model",
                revision="revision",
                prompt="prompt: ",
                dimensions=2,
                trust_remote_code=False,
                device="cpu",
            )
            embeddings = extractor.encode(["kelime"], batch_size=1)

        self.assertEqual(constructor["trust_remote_code"], False)
        self.assertEqual(constructor["revision"], "revision")
        np.testing.assert_allclose(embeddings, [[2**-0.5, 2**-0.5]])

    def test_word2vec_reader_selects_exact_turkish_words_in_requested_order(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "vectors.bin"
            entries = [
                ("hâlâ", (1.0, 0.0)),
                ("ışık", (0.0, 2.0)),
                ("ev", (3.0, 4.0)),
            ]
            payload = bytearray(b"3 2\n")
            for word, vector in entries:
                payload.extend(word.encode("utf-8") + b" ")
                payload.extend(struct.pack("<2f", *vector))
            path.write_bytes(payload)

            selection = read_word2vec_binary(
                path, ["ev", "hala", "ışık", "yok"], expected_dimensions=2
            )

        self.assertEqual(selection.words, ["ev", "ışık"])
        self.assertEqual(selection.missing, ["hala", "yok"])
        np.testing.assert_allclose(selection.embeddings, [[0.6, 0.8], [0.0, 1.0]])

    def test_word2vec_reader_rejects_wrong_dimensions_and_truncation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "vectors.bin"
            path.write_bytes(b"1 3\nkelime " + struct.pack("<2f", 1.0, 2.0))
            with self.assertRaisesRegex(ValueError, "3 dimensions"):
                read_word2vec_binary(path, ["kelime"], expected_dimensions=2)
            with self.assertRaisesRegex(ValueError, "truncated"):
                read_word2vec_binary(path, ["kelime"], expected_dimensions=3)

    def test_static_embedding_cache_does_not_require_source_model(self) -> None:
        collection = COLLECTIONS[TURKISH_WORD2VEC_COLLECTION_ID]
        words = ["hedef", "yakın"]
        version = vocabulary_version(words)
        artifact = collection.extractor.artifact
        self.assertIsNotNone(artifact)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = Paths(root / "output", root / "cache" / collection.id)
            paths.cache.mkdir(parents=True)
            np.save(paths.embeddings, np.ones((2, 300), dtype=np.float32))
            write_json(paths.static_vocabulary, {"keys": words})
            expected = {
                "model": collection.extractor.model,
                "revision": collection.extractor.revision,
                "dimensions": collection.extractor.dimensions,
                "collectionId": collection.id,
                "language": collection.language,
                "normalization": collection.normalization,
                "vocabularyVersion": version,
                "requestedVocabularyVersion": version,
                "artifactSha256": artifact.model_sha256,
            }
            write_json(paths.cache_metadata, expected)

            cached_words, embeddings, metadata = load_or_create_static_embeddings(
                paths,
                collection,
                words,
                [{"id": "0", "word": "hedef", "category": "object"}],
                cache_root=root / "missing-sources",
                force=False,
            )

        self.assertEqual(cached_words, words)
        self.assertEqual(embeddings.shape, (2, 300))
        self.assertEqual(metadata, expected)

    def test_artifact_fetches_zip_and_records_checksums(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.zip"
            with zipfile.ZipFile(source, "w") as bundle:
                bundle.writestr("vectors.bin", b"1 1\nkelime " + struct.pack("<f", 1.0))
            archive_bytes = source.read_bytes()
            artifact = ArtifactConfig(
                url=source.as_uri(),
                release="test",
                archive_name="download.zip",
                archive_size=len(archive_bytes),
                archive_md5=hashlib.md5(archive_bytes).hexdigest(),
                archive_sha256=hashlib.sha256(archive_bytes).hexdigest(),
                member_name="vectors.bin",
                model_sha256=hashlib.sha256(
                    b"1 1\nkelime " + struct.pack("<f", 1.0)
                ).hexdigest(),
            )

            model, receipt = fetch_artifact(artifact, root / "cache")
            (root / "cache" / "download.zip").unlink()
            second_model, second_receipt = fetch_artifact(artifact, root / "cache")

            self.assertEqual(model.read_bytes(), b"1 1\nkelime " + struct.pack("<f", 1.0))
            self.assertEqual(second_model, model)
            self.assertEqual(receipt, second_receipt)
            self.assertEqual(
                receipt["modelSha256"], hashlib.sha256(model.read_bytes()).hexdigest()
            )

    def test_artifact_rejects_a_checksum_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.zip"
            with zipfile.ZipFile(source, "w") as bundle:
                bundle.writestr("vectors.bin", b"model")
            archive_bytes = source.read_bytes()
            artifact = ArtifactConfig(
                url=source.as_uri(),
                release="test",
                archive_name="download.zip",
                archive_size=len(archive_bytes),
                archive_md5=hashlib.md5(archive_bytes).hexdigest(),
                archive_sha256="0" * 64,
                member_name="vectors.bin",
                model_sha256=hashlib.sha256(b"model").hexdigest(),
            )
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                fetch_artifact(artifact, root / "cache")

    def test_load_targets_validates_and_preserves_order(self) -> None:
        targets = [
            {"id": "0", "word": "violin", "category": "object"},
            {"id": "1", "word": "airport", "category": "place"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "targets.json"
            path.write_text(json.dumps(targets))
            self.assertEqual(load_targets(path, 2), targets)

    def test_load_targets_rejects_invalid_entries(self) -> None:
        cases = [
            ([{"id": "1", "word": "violin", "category": "object"}], "ID"),
            ([{"id": "0", "word": "two words", "category": "object"}], "alphabetic"),
            ([{"id": "0", "word": "violin", "category": "abstract"}], "Unsupported"),
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "targets.json"
            for targets, message in cases:
                path.write_text(json.dumps(targets))
                with self.assertRaisesRegex(ValueError, message):
                    load_targets(path, 1)

    def test_load_targets_rejects_duplicates_and_wrong_count(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "targets.json"
            path.write_text(json.dumps([
                {"id": "0", "word": "violin", "category": "object"},
                {"id": "1", "word": "violin", "category": "object"},
            ]))
            with self.assertRaisesRegex(ValueError, "Duplicate"):
                load_targets(path, 2)
            with self.assertRaisesRegex(ValueError, "expected 3"):
                load_targets(path, 3)

    def test_load_targets_rejects_unbalanced_categories(self) -> None:
        categories = [
            "animal", "object", "action", "adjective", "food", "place",
            "occupation", "occupation",
        ]
        targets = [
            {"id": str(index), "word": f"word{chr(97 + index)}", "category": category}
            for index, category in enumerate(categories)
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "targets.json"
            path.write_text(json.dumps(targets))
            with self.assertRaisesRegex(ValueError, "each contain 1"):
                load_targets(path, 8, expected_per_category=1)

    def test_build_vocabulary_filters_and_deduplicates(self) -> None:
        candidates = [" Cat ", "two words", "DOG", "dog", "can't", "owl"]
        self.assertEqual(build_vocabulary(candidates, 3), ["cat", "dog", "owl"])

    def test_turkish_normalization_handles_casing_and_circumflexes(self) -> None:
        self.assertEqual(normalize_word("  İSTANBUL ", "tr"), "istanbul")
        self.assertEqual(normalize_word("IŞIK", "tr"), "ışık")
        self.assertEqual(normalize_word("KÂR", "tr"), "kar")
        self.assertTrue(is_valid_word("çığöşüqwx", "tr"))
        self.assertFalse(is_valid_word("iki kelime", "tr"))

    def test_turkish_vocabulary_deduplicates_after_normalization(self) -> None:
        candidates = [" KÂR ", "kar", "IŞIK", "ışık", "iki kelime", "ÖYKÜ"]
        self.assertEqual(
            build_vocabulary(candidates, 3, "tr"), ["kar", "ışık", "öykü"]
        )

    def test_turkish_policy_preserves_ambiguous_noun_and_verb(self) -> None:
        analyses = [
            LexicalAnalysis("at", "Noun", "None", "Noun", frozenset({"A3sg"})),
            LexicalAnalysis("atmak", "Verb", "None", "Verb", frozenset({"Imp"})),
        ]
        self.assertEqual(select_analysis_outputs("at", analyses), ["at", "atmak"])

    def test_turkish_policy_uses_lexicon_infinitive_without_reconstructing_it(self) -> None:
        analyses = [
            LexicalAnalysis(
                "kaçırmak", "Verb", "None", "Verb", frozenset({"Verb", "Aor"})
            )
        ]
        self.assertEqual(select_analysis_outputs("kaçırır", analyses), ["kaçırmak"])

    def test_turkish_policy_rejects_inflections_and_proper_only_readings(self) -> None:
        plural = LexicalAnalysis(
            "ev", "Noun", "None", "Noun", frozenset({"A3pl"})
        )
        possessive = LexicalAnalysis(
            "ev", "Noun", "None", "Noun", frozenset({"P1sg"})
        )
        proper = LexicalAnalysis(
            "İnternet", "Noun", "Prop", "Noun", frozenset({"A3sg"})
        )
        self.assertEqual(select_analysis_outputs("evler", [plural]), [])
        self.assertEqual(select_analysis_outputs("evim", [possessive]), [])
        self.assertEqual(select_analysis_outputs("internet", [proper]), [])
        self.assertEqual(
            select_analysis_outputs("internet", [proper], allow_surface=True),
            ["internet"],
        )

    def test_turkish_policy_keeps_derived_adjectives_but_not_case_derivations(self) -> None:
        derived = LexicalAnalysis(
            "merak", "Noun", "None", "Adj", frozenset({"With", "Adj"})
        )
        locative = LexicalAnalysis(
            "ev", "Noun", "None", "Adj", frozenset({"Loc", "Rel", "Adj"})
        )
        self.assertEqual(select_analysis_outputs("meraklı", [derived]), ["meraklı"])
        self.assertEqual(select_analysis_outputs("evdeki", [locative]), [])

    def test_turkish_overrides_reject_contradictions(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "overrides.json"
            path.write_text(
                json.dumps({"schemaVersion": 1, "allow": ["run"], "reject": ["run"]})
            )
            with self.assertRaisesRegex(ValueError, "contradict"):
                load_turkish_overrides(path)

    def test_build_vocabulary_requires_requested_size(self) -> None:
        with self.assertRaisesRegex(ValueError, "expected 2"):
            build_vocabulary(["cat"], 2)

    def test_normalize_rows(self) -> None:
        result = normalize_rows(np.array([[3.0, 4.0], [0.0, 2.0]], dtype=np.float32))
        np.testing.assert_allclose(np.linalg.norm(result, axis=1), [1.0, 1.0])

    def test_normalize_rows_rejects_zero_vector(self) -> None:
        with self.assertRaisesRegex(ValueError, "zero-length"):
            normalize_rows(np.array([[0.0, 0.0]], dtype=np.float32))

    def test_rank_target_orders_cosine_similarity(self) -> None:
        words = ["cold", "target", "warm"]
        embeddings = normalize_rows(
            np.array([[-1.0, 0.0], [1.0, 0.0], [0.8, 0.6]], dtype=np.float32)
        )
        top = rank_target(words, embeddings, "target", 3)
        self.assertEqual(top, [1, 2, 0])

    def test_rank_target_requires_matching_inputs(self) -> None:
        with self.assertRaisesRegex(ValueError, "not in the vocabulary"):
            rank_target(["word"], np.ones((1, 2)), "missing", 1)

    def test_vocabulary_version_is_stable_and_order_sensitive(self) -> None:
        self.assertEqual(vocabulary_version(["a", "b"]), vocabulary_version(["a", "b"]))
        self.assertNotEqual(vocabulary_version(["a", "b"]), vocabulary_version(["b", "a"]))

    def test_write_json_is_minified_and_round_trips(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "nested" / "value.json"
            write_json(path, {"hello": [1, 2]})
            self.assertEqual(path.read_text(), '{"hello":[1,2]}\n')
            self.assertEqual(json.loads(path.read_text()), {"hello": [1, 2]})


if __name__ == "__main__":
    unittest.main()
