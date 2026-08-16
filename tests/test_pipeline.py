import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from pipeline.cli import parser
from pipeline.config import (
    COLLECTIONS,
    DEFAULT_COLLECTION_ID,
    ENGLISH_COLLECTION_ID,
    TARGET_COUNT,
    TURKISH_COLLECTION_ID,
)
from pipeline.core import (
    build_vocabulary,
    is_valid_word,
    load_targets,
    normalize_word,
    normalize_rows,
    score_target,
    vocabulary_version,
    write_json,
)
from pipeline.turkish import canonicalize_analysis, parse_features, turkish_infinitive


class PipelineCoreTests(unittest.TestCase):
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
                collection.targets, TARGET_COUNT, collection.language
            )
            self.assertEqual(tuple(target["word"] for target in targets[:2]), opening)
            self.assertEqual({target["category"] for target in targets}, {
                "animal", "object", "action", "adjective", "food", "place"
            })

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

    def test_turkish_infinitive_uses_two_way_vowel_harmony(self) -> None:
        self.assertEqual(turkish_infinitive("gel"), "gelmek")
        self.assertEqual(turkish_infinitive("bak"), "bakmak")
        self.assertEqual(turkish_infinitive("gör"), "görmek")
        self.assertIsNone(turkish_infinitive("hmm"))

    def test_turkish_policy_converts_only_verbs_to_lemmas(self) -> None:
        self.assertEqual(
            canonicalize_analysis("geliyor", "gel", "VERB", "Mood=Ind"),
            ("gelmek", "kept"),
        )
        self.assertEqual(
            canonicalize_analysis("kaplumbağa", "kaplumbak", "NOUN", "Case=Nom|Number=Sing"),
            ("kaplumbağa", "kept"),
        )

    def test_turkish_policy_drops_inflections_and_proper_nouns(self) -> None:
        self.assertEqual(
            canonicalize_analysis("evler", "ev", "NOUN", "Case=Nom|Number=Plur"),
            (None, "inflected-noun"),
        )
        self.assertEqual(
            canonicalize_analysis("evim", "ev", "NOUN", "Number[psor]=Sing"),
            (None, "inflected-noun"),
        )
        self.assertEqual(
            canonicalize_analysis("ankara", "Ankara", "PROPN", "Case=Nom"),
            (None, "propn"),
        )

    def test_parse_turkish_features_ignores_malformed_items(self) -> None:
        self.assertEqual(
            parse_features("Case=Nom|broken|Number=Sing"),
            {"Case": "Nom", "Number": "Sing"},
        )

    def test_build_vocabulary_requires_requested_size(self) -> None:
        with self.assertRaisesRegex(ValueError, "expected 2"):
            build_vocabulary(["cat"], 2)

    def test_normalize_rows(self) -> None:
        result = normalize_rows(np.array([[3.0, 4.0], [0.0, 2.0]], dtype=np.float32))
        np.testing.assert_allclose(np.linalg.norm(result, axis=1), [1.0, 1.0])

    def test_normalize_rows_rejects_zero_vector(self) -> None:
        with self.assertRaisesRegex(ValueError, "zero-length"):
            normalize_rows(np.array([[0.0, 0.0]], dtype=np.float32))

    def test_score_target_quantizes_and_ranks(self) -> None:
        words = ["cold", "target", "warm"]
        embeddings = normalize_rows(
            np.array([[-1.0, 0.0], [1.0, 0.0], [0.8, 0.6]], dtype=np.float32)
        )
        scores, top = score_target(words, embeddings, "target", 3)
        self.assertEqual(scores, [-10_000, 10_000, 8_000])
        self.assertEqual(top, [1, 2, 0])

    def test_score_target_requires_matching_inputs(self) -> None:
        with self.assertRaisesRegex(ValueError, "not in the vocabulary"):
            score_target(["word"], np.ones((1, 2)), "missing", 1)

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
