# Turkish vocabulary preprocessing

Turkish is agglutinative, so a frequency list of surface forms contains many variants of the same lexeme. Those variants can crowd out distinct semantic neighbors in a similarity puzzle. The Turkish collection therefore applies a conservative Stanza-based policy before generating embeddings.

## Reproducible setup

The generator pins Stanza 1.14.0 and uses its Turkish IMST models for tokenization, part-of-speech tagging, and lemmatization. Each normalized `wordfreq` entry is analyzed as its own pre-tokenized, one-word sentence. Models are downloaded to the ignored `pipeline-cache/stanza/` directory when needed; they occupy roughly 182 MB.

Run the normal collection command after installing the project into the `game/` environment:

```sh
source game/bin/activate
pip install -e .
python -m pipeline generate --collection embeddinggemma-768-tr-v1
```

The generated vocabulary records `vocabularyPolicy: "stanza-tr-guarded-v1"`. This policy is distinct from the input normalization policy, `tr-modern-lower-nfc-v1`.

## Guarded policy

Candidates first receive Turkish-aware lowercase conversion, NFC normalization, circumflex collapse, character validation, and stable deduplication. Stanza output is then handled as follows:

- `PROPN` and `X` entries are discarded.
- `VERB` entries use Stanza's lemma stem and receive the infinitive suffix `-mek` after the last front vowel (`e`, `i`, `ö`, `ü`) or `-mak` after the last back vowel (`a`, `ı`, `o`, `u`). A stem without a vowel is discarded.
- `NOUN` entries retain their original surface spelling only when case is absent or nominative, number is absent or singular, and no possessive feature is present. Other noun forms are discarded.
- `ADJ` entries retain their surface spelling unless they are non-nominative, plural, or possessive.
- Other parts of speech retain their normalized surface spelling.
- Outputs are normalized and validated again, then stably deduplicated in the original `wordfreq` order.

The policy deliberately does not demand 30,000 outputs. Preserving questionable entries merely to reach a round number would reintroduce the morphology problem.

## Why not lemmatize everything?

Applying Stanza lemmas wholesale damaged ordinary Turkish nouns in the probe, including `kaplumbağa` → `kaplumbak`, `martı` → `mart`, `pusula` → `pusul`, `kayısı` → `kayı`, and `yayla` → `yay`. Keeping qualified noun and adjective surfaces avoids those corruptions while still removing many obvious inflections. A suffix-only heuristic was too brittle; Zemberek is comparatively cumbersome to package here, and Zeyrek has maintenance and integration concerns.

## Baseline and limitations

With the pinned tools and models, 60,849 normalized candidates produce 18,315 unique words. The baseline converts 17,812 verbs and drops 21,320 inflected nouns, 16,442 duplicate outputs, 3,355 proper nouns, 1,415 inflected adjectives, and 2 vowel-less verbs.

Single-word analysis has unavoidable ambiguity. For example, isolated `yer` and `at` may be interpreted as verbs and become `yermek` and `atmak`; `yüz` can also receive a contextually surprising tag. Lowercasing before analysis can make proper-name detection less reliable. These are known consequences of using a contextual model without sentence context, so generated targets and nearest-neighbor lists must still be audited.

The Turkish collection was not deployed when this policy was introduced, so its existing `embeddinggemma-768-tr-v1` ID was reused and its data replaced. After deployment, any incompatible normalization or vocabulary-policy change should use a new collection ID to preserve browser progress and reproducibility.
