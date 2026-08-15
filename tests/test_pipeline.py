import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from pipeline.core import (
    build_vocabulary,
    normalize_rows,
    score_target,
    vocabulary_version,
    write_json,
)


class PipelineCoreTests(unittest.TestCase):
    def test_build_vocabulary_filters_and_deduplicates(self) -> None:
        candidates = [" Cat ", "two words", "DOG", "dog", "can't", "owl"]
        self.assertEqual(build_vocabulary(candidates, 3), ["cat", "dog", "owl"])

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

