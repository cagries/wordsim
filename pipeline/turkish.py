from __future__ import annotations

import json
import logging
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

from pipeline.core import is_valid_word, normalize_word, write_json


INFLECTIONAL_MORPHEMES = frozenset(
    {
        "A3pl", "Acc", "Dat", "Loc", "Abl", "Gen", "Ins", "Equ",
        "P1sg", "P2sg", "P3sg", "P1pl", "P2pl", "P3pl",
    }
)
INVARIANT_POS = frozenset(
    {"Adv", "Pron", "Postp", "Conj", "Det", "Interj", "Num"}
)


@dataclass(frozen=True)
class LexicalAnalysis:
    lemma: str
    primary_pos: str
    secondary_pos: str
    final_pos: str
    morphemes: frozenset[str]


@dataclass(frozen=True)
class TurkishOverrides:
    allow: frozenset[str]
    reject: frozenset[str]


@dataclass(frozen=True)
class TurkishVocabularyResult:
    words: list[str]
    candidate_count: int
    analyses: Counter[str]
    drops: Counter[str]
    suspect_count: int


def _validated_override_words(value: object, field: str) -> frozenset[str]:
    if not isinstance(value, list) or not all(isinstance(word, str) for word in value):
        raise ValueError(f"Turkish override '{field}' must be an array of strings.")
    if len(value) != len(set(value)):
        raise ValueError(f"Turkish override '{field}' contains duplicates.")
    for word in value:
        if normalize_word(word, "tr") != word or not is_valid_word(word, "tr"):
            raise ValueError(
                f"Turkish override '{field}' contains a non-normalized word: {word!r}."
            )
    return frozenset(value)


def load_turkish_overrides(path: Path) -> TurkishOverrides:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or value.get("schemaVersion") != 1:
        raise ValueError("Turkish overrides must use schemaVersion 1.")
    if set(value) != {"schemaVersion", "allow", "reject"}:
        raise ValueError("Turkish overrides contain unsupported fields.")
    allow = _validated_override_words(value.get("allow"), "allow")
    reject = _validated_override_words(value.get("reject"), "reject")
    overlap = allow & reject
    if overlap:
        raise ValueError(
            f"Turkish overrides contradict each other: {', '.join(sorted(overlap))}."
        )
    return TurkishOverrides(allow=allow, reject=reject)


def select_analysis_outputs(
    surface: str,
    analyses: Sequence[LexicalAnalysis],
    *,
    allow_surface: bool = False,
) -> list[str]:
    """Select conservative dictionary forms from every possible Zeyrek reading."""
    word = normalize_word(surface, "tr")
    surface_outputs: list[str] = [word] if allow_surface else []
    verb_outputs: list[str] = []

    for analysis in analyses:
        if analysis.secondary_pos in {"Prop", "Abbrv"}:
            continue
        if analysis.primary_pos == "Verb":
            lemma = normalize_word(analysis.lemma, "tr")
            if lemma.endswith(("mak", "mek")) and is_valid_word(lemma, "tr"):
                verb_outputs.append(lemma)
            continue
        if analysis.final_pos in {"Noun", "Adj"}:
            if not (analysis.morphemes & INFLECTIONAL_MORPHEMES):
                surface_outputs.append(word)
            continue
        if analysis.final_pos in INVARIANT_POS:
            lemma = normalize_word(analysis.lemma, "tr")
            if lemma == word:
                surface_outputs.append(word)

    result: list[str] = []
    seen: set[str] = set()
    for output in (*surface_outputs, *verb_outputs):
        if output not in seen and is_valid_word(output, "tr"):
            seen.add(output)
            result.append(output)
    return result


def _is_cross_language_suspect(word: str) -> tuple[bool, float, float]:
    from wordfreq import zipf_frequency

    english = zipf_frequency(word, "en")
    turkish = zipf_frequency(word, "tr")
    suspect = len(word) >= 3 and english >= 4.0 and english - turkish >= 1.5
    return suspect, english, turkish


def _zeyrek_analyzer():
    try:
        from zeyrek.lexicon import RootLexicon
        from zeyrek.morphotactics import TurkishMorphotactics
        from zeyrek.rulebasedanalyzer import RuleBasedAnalyzer
    except ImportError as error:
        raise RuntimeError(
            "Turkish vocabulary generation requires Zeyrek; install the pipeline dependencies."
        ) from error

    logging.getLogger("zeyrek.rulebasedanalyzer").setLevel(logging.ERROR)
    lexicon = RootLexicon.default_text_dictionaries()
    return RuleBasedAnalyzer(TurkishMorphotactics(lexicon))


def _convert_analysis(analysis: object) -> LexicalAnalysis:
    dictionary_item = analysis.dict_item
    return LexicalAnalysis(
        lemma=dictionary_item.lemma,
        primary_pos=dictionary_item.primary_pos.value or "None",
        secondary_pos=dictionary_item.secondary_pos.value or "None",
        final_pos=analysis.pos.value or "None",
        morphemes=frozenset(morpheme.id_ for morpheme, _ in analysis.morphemes),
    )


def build_zeyrek_vocabulary(
    candidates: Iterable[str],
    max_size: int,
    overrides_path: Path,
    audit_path: Path,
) -> TurkishVocabularyResult:
    """Build an audited Turkish vocabulary from rule-based lexical analyses."""
    overrides = load_turkish_overrides(overrides_path)
    analyzer = _zeyrek_analyzer()

    normalized: list[str] = []
    raw_seen: set[str] = set()
    for candidate in candidates:
        word = normalize_word(candidate, "tr")
        if not is_valid_word(word, "tr") or word in raw_seen:
            continue
        raw_seen.add(word)
        normalized.append(word)

    unknown_overrides = (overrides.allow | overrides.reject) - raw_seen
    if unknown_overrides:
        raise ValueError(
            "Turkish overrides are absent from the wordfreq candidates: "
            + ", ".join(sorted(unknown_overrides))
        )

    analyses_counter: Counter[str] = Counter()
    drops: Counter[str] = Counter()
    output_sources: defaultdict[str, list[str]] = defaultdict(list)
    proposed: list[str] = []
    proposed_seen: set[str] = set()
    for source in normalized:
        analyses = [_convert_analysis(item) for item in analyzer.analyze(source)]
        if not analyses:
            analyses_counter["unknown"] += 1
        for analysis in analyses:
            key = "/".join(
                (analysis.primary_pos, analysis.secondary_pos, analysis.final_pos)
            )
            analyses_counter[key] += 1
        outputs = select_analysis_outputs(
            source, analyses, allow_surface=source in overrides.allow
        )
        if not outputs:
            drops["no-approved-analysis"] += 1
        for output in outputs:
            output_sources[output].append(source)
            if output in proposed_seen:
                drops["duplicate-output"] += 1
                continue
            proposed_seen.add(output)
            proposed.append(output)

    words: list[str] = []
    suspects: list[dict[str, object]] = []
    unresolved: list[str] = []
    for word in proposed:
        suspect, english_zipf, turkish_zipf = _is_cross_language_suspect(word)
        decision = "not-suspect"
        if word in overrides.reject:
            decision = "reject"
            drops["reviewed-reject"] += 1
        elif suspect and word in overrides.allow:
            decision = "allow"
        elif suspect:
            decision = "unresolved"
            unresolved.append(word)
            drops["unresolved-suspect"] += 1
        if suspect:
            suspects.append(
                {
                    "word": word,
                    "englishZipf": english_zipf,
                    "turkishZipf": turkish_zipf,
                    "decision": decision,
                }
            )
        if decision not in {"reject", "unresolved"} and len(words) < max_size:
            words.append(word)
        elif decision == "not-suspect" and len(words) >= max_size:
            drops["size-limit"] += 1

    write_json(
        audit_path,
        {
            "schemaVersion": 1,
            "vocabularyPolicy": "zeyrek-tr-reviewed-v1",
            "candidateCount": len(normalized),
            "proposedCount": len(proposed),
            "finalCount": len(words),
            "analysisCounts": dict(analyses_counter.most_common()),
            "dropCounts": dict(drops.most_common()),
            "overrides": {
                "allow": sorted(overrides.allow),
                "reject": sorted(overrides.reject),
            },
            "suspects": suspects,
            "unresolvedSuspects": unresolved,
            "provenance": dict(output_sources),
        },
    )
    if unresolved:
        raise ValueError(
            "Unreviewed Turkish/English overlap; classify these words in the overrides: "
            + ", ".join(unresolved)
            + f". See {audit_path}."
        )

    return TurkishVocabularyResult(
        words=words,
        candidate_count=len(normalized),
        analyses=analyses_counter,
        drops=drops,
        suspect_count=len(suspects),
    )
