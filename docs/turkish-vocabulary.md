# Turkish vocabulary preprocessing

Turkish is agglutinative, so a frequency list of surface forms contains many variants of the same lexeme. Those variants can crowd out distinct semantic neighbors in a similarity puzzle. The Turkish collection therefore applies a conservative, lexicon-backed Zeyrek policy before generating embeddings.

## Reproducible setup

The generator pins Zeyrek 0.1.3. It calls the rule-based analyzer directly on each normalized `wordfreq` entry.

Run the normal collection command after installing the project into the `game/` environment:

```sh
source game/bin/activate
pip install -e .
python -m pipeline fetch --collection word2vec-skipgram-300-tr-v1
python -m pipeline generate --collection word2vec-skipgram-300-tr-v1
```

The model-independent reviewed base is identified as `zeyrek-tr-reviewed-v1`. The served, Word2Vec-covered derivative records `vocabularyPolicy: "zeyrek-tr-reviewed-word2vec-covered-v1"`. Both are distinct from the input normalization policy, `tr-modern-lower-nfc-v1`.

## Lexical policy

Candidates first receive Turkish-aware lowercase conversion, NFC normalization, circumflex collapse, character validation, and stable deduplication. Every possible Zeyrek analysis is considered rather than choosing one context-free reading:

- Analyses marked as proper nouns or abbreviations are ignored unless their source word is explicitly allowed.
- Primary verbs use Zeyrek's dictionary lemma only when it is already a valid `-mak`/`-mek` infinitive. The pipeline never guesses an infinitive suffix. This turns an analyzed form into `kaçırmak`, not the fabricated `kaçıramak` seen in the earlier pipeline.
- Final nouns and adjectives retain their normalized surface spelling unless the analysis contains plural, case, or possessive morphology. This keeps lexical derivations such as `meraklı`, `huzurlu`, and `sarımsaklı`, while dropping forms such as `evler`, `evim`, and `evdeki`.
- Adverbs, pronouns, postpositions, conjunctions, determiners, interjections, and numbers retain their surface only when the normalized dictionary lemma matches it.
- A source may produce more than one entry. Surface readings precede verb infinitives, so ambiguous words such as `at`, `yat`, and `yar` retain both the noun and the verb (`at`/`atmak`, `yat`/`yatmak`, and `yar`/`yarmak`).
- Outputs are validated and stably deduplicated in the original `wordfreq` order.

The policy deliberately does not backfill to 30,000 entries. Preserving questionable entries merely to reach a round number would reintroduce the morphology problem.

## English-overlap review

A valid Turkish spelling can also be a much more frequent English word. Zeyrek may give such strings a plausible Turkish analysis, so morphology alone cannot reliably reject leaks such as `run`.

An output of at least three characters is flagged when its English Zipf frequency is at least 4.0 and exceeds its Turkish Zipf frequency by at least 1.5. Every flagged output must be classified in [`pipeline/targets/tr-overrides.json`](../pipeline/targets/tr-overrides.json):

- `allow` retains reviewed Turkish words and is also the only mechanism that may retain a proper-only or abbreviation-only surface, such as `internet`.
- `reject` removes reviewed English leakage.
- A word may not appear in both lists. Entries must be normalized, unique, and present in the source candidates.
- Generation fails if a new suspect is not reviewed. It first writes `pipeline-cache/<collection-id>/vocabulary-audit.json`, where the unresolved list, frequencies, analysis counts, drop counts, decisions, and output provenance can be inspected.

This is intentionally a review gate, not an unattended language detector. When `wordfreq`, Zeyrek, or the thresholds change, inspect the audit and edit the checked-in override file deliberately.

## Current baseline and checks

With the pinned dependencies, 60,849 normalized candidates produce 12,826 unique proposed outputs. The reviewed list rejects 14 English leaks, leaving 12,812 vocabulary entries. The current pass records 36,794 sources without an approved analysis and 13,383 duplicate outputs; all 31 frequency suspects are classified.

Regression checks require the vocabulary to include `at`, `atmak`, `yat`, `yatmak`, `yar`, `yarmak`, `kaçırmak`, `hızlı`, `açık`, and `internet`. They also require it to exclude `kaçıramak`, `hızlımak`, `açik`, `run`, `running`, `the`, `evler`, `evim`, and `evdeki`.

## Limitations and collection identity

Zeyrek is an alpha-stage partial Python port of Zemberek. Its lexicon and morphology are a better fit for isolated dictionary candidates than contextual tagging, but analyses can still be missing or ambiguous. Generated targets and nearest-neighbor lists therefore still need human review. The checked-in dependency pin, vocabulary policy identifier, override file, generated checksum, and ignored audit make those decisions reproducible.

The circumflex collapse remains deliberate: `â`, `î`, and `û` normalize to `a`, `i`, and `u`. This helps ordinary Turkish-keyboard input, while knowingly merging distinctions such as `kar`/`kâr`, `hala`/`hâlâ`, and `aşık`/`âşık`.

The served Turkish collection uses the released 300-dimensional skip-gram Word2Vec table.

After deployment, any incompatible normalization, vocabulary-policy, or embedding-model change should use a new collection ID to preserve browser progress and reproducibility.

## Static Word2Vec coverage policy

The `word2vec-skipgram-300-tr-v1` collection starts from this exact reviewed vocabulary, then keeps only words present in the released binary model. Word2Vec has no out-of-vocabulary inference, so missing entries are reported rather than approximated with subword vectors or another model. The ordering of retained words remains the original `wordfreq`/Zeyrek ordering, and all configured puzzle targets must be covered.

Only NFC normalization is applied while reading model tokens. In particular, the game's circumflex collapse is not applied to model entries: mapping `hâlâ` onto `hala`, for example, could select the wrong sense or create a collision. This conservative choice can reduce coverage, but the resulting `coverage-audit.json` records that cost explicitly and keeps the experiment reproducible.

## Turkish normalization policy

Turkish input uses locale-aware casing (`I` becomes `ı`, while `İ` becomes `i`) and NFC Unicode normalization. The circumflex variants `â`, `î`, and `û` are deliberately collapsed to `a`, `i`, and `u` before validation, vocabulary deduplication, embedding, lookup, and persistence. This makes ordinary Turkish-keyboard input work reliably, but it also merges distinctions such as `kar`/`kâr`, `hala`/`hâlâ`, and `aşık`/`âşık`.

The accepted Turkish character set is `a-zçğıöşü`. It intentionally includes `q`, `w`, and `x` for common loanwords even though those letters are outside the traditional Turkish alphabet.

The normalization decision is identified as `tr-modern-lower-nfc-v1` in generated vocabulary metadata. The vocabulary policy uses Zeyrek's lexicon to discard proper nouns and selected noun/adjective inflections while taking verb infinitives directly from dictionary lemmas. The checked-in `pipeline/targets/tr-overrides.json` file is an active lexical-review ledger: it records deliberate exceptions and rejects English/Turkish frequency overlaps, and generation fails when a new suspect has not been classified.

The served Turkish collection is `word2vec-skipgram-300-tr-v1`. Future incompatible normalization, vocabulary-policy, or embedding-model changes require another collection ID.
