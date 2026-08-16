from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from pipeline.core import is_valid_word, normalize_word


FRONT_VOWELS = frozenset("eiöü")
BACK_VOWELS = frozenset("aıou")


@dataclass(frozen=True)
class TurkishVocabularyResult:
    words: list[str]
    candidate_count: int
    tags: Counter[str]
    drops: Counter[str]
    changed_verbs: int


def parse_features(value: str | None) -> dict[str, str]:
    if not value:
        return {}
    result: dict[str, str] = {}
    for feature in value.split("|"):
        key, separator, item = feature.partition("=")
        if separator and key and item:
            result[key] = item
    return result


def turkish_infinitive(lemma: str) -> str | None:
    stem = normalize_word(lemma, "tr")
    for character in reversed(stem):
        if character in FRONT_VOWELS:
            return f"{stem}mek"
        if character in BACK_VOWELS:
            return f"{stem}mak"
    return None


def canonicalize_analysis(
    surface: str,
    lemma: str | None,
    upos: str | None,
    feature_string: str | None,
) -> tuple[str | None, str]:
    """Apply the deliberately conservative Turkish vocabulary policy."""
    word = normalize_word(surface, "tr")
    tag = upos or "X"
    features = parse_features(feature_string)
    has_possessive = any("psor" in key.lower() for key in features)

    if tag in {"PROPN", "X"}:
        return None, tag.lower()
    if tag == "VERB":
        infinitive = turkish_infinitive(lemma or word)
        if infinitive is None:
            return None, "verb-no-vowel"
        result = infinitive
    elif tag == "NOUN":
        if (
            features.get("Case") not in {None, "Nom"}
            or features.get("Number") not in {None, "Sing"}
            or has_possessive
        ):
            return None, "inflected-noun"
        result = word
    elif tag == "ADJ":
        if (
            features.get("Case") not in {None, "Nom"}
            or features.get("Number") == "Plur"
            or has_possessive
        ):
            return None, "inflected-adjective"
        result = word
    else:
        result = word

    result = normalize_word(result, "tr")
    if not is_valid_word(result, "tr"):
        return None, "invalid-output"
    return result, "kept"


def build_stanza_vocabulary(
    candidates: Iterable[str],
    max_size: int,
    model_dir: Path,
    *,
    analysis_batch_size: int = 2_000,
) -> TurkishVocabularyResult:
    """Analyze normalized wordfreq entries as independent, pre-tokenized words."""
    try:
        import stanza
    except ImportError as error:
        raise RuntimeError(
            "Turkish vocabulary generation requires Stanza; install the pipeline dependencies."
        ) from error

    normalized: list[str] = []
    raw_seen: set[str] = set()
    for candidate in candidates:
        word = normalize_word(candidate, "tr")
        if not is_valid_word(word, "tr") or word in raw_seen:
            continue
        raw_seen.add(word)
        normalized.append(word)

    processors = "tokenize,pos,lemma"
    packages = {
        "tokenize": "imst",
        "pos": "imst_charlm",
        "lemma": "imst_nocharlm",
    }
    stanza.download(
        "tr",
        model_dir=str(model_dir),
        processors=processors,
        package=packages,
        verbose=False,
    )
    nlp = stanza.Pipeline(
        "tr",
        model_dir=str(model_dir),
        processors=processors,
        package=packages,
        tokenize_pretokenized=True,
        use_gpu=False,
        download_method=None,
        verbose=False,
    )

    words: list[str] = []
    output_seen: set[str] = set()
    tags: Counter[str] = Counter()
    drops: Counter[str] = Counter()
    changed_verbs = 0
    for start in range(0, len(normalized), analysis_batch_size):
        batch = normalized[start : start + analysis_batch_size]
        document = nlp([[word] for word in batch])
        if len(document.sentences) != len(batch):
            raise RuntimeError("Stanza returned an unexpected number of Turkish analyses.")
        for source, sentence in zip(batch, document.sentences, strict=True):
            if len(sentence.words) != 1:
                drops["tokenization"] += 1
                continue
            analysis = sentence.words[0]
            tag = analysis.upos or "X"
            tags[tag] += 1
            output, reason = canonicalize_analysis(
                source, analysis.lemma, analysis.upos, analysis.feats
            )
            if output is None:
                drops[reason] += 1
                continue
            if tag == "VERB" and output != source:
                changed_verbs += 1
            if output in output_seen:
                drops["duplicate-output"] += 1
                continue
            output_seen.add(output)
            if len(words) < max_size:
                words.append(output)

    return TurkishVocabularyResult(
        words=words,
        candidate_count=len(normalized),
        tags=tags,
        drops=drops,
        changed_verbs=changed_verbs,
    )
