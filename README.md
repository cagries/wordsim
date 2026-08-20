# wordsim

A small game that scores guesses by semantic similarity, similar to Contexto or Semantle. The core game is a standalone static page with a vanilla TypeScript client; all embeddings, cosine similarities, and proximity ranks are computed offline for responsiveness. This repository also includes a Jekyll landing page for local previewing.

The demo contains English and Turkish collections, each with 160 puzzles currently: 20 each for animals, objects, actions, adjectives, foods, places, occupations, and clothing. For the generated puzzles, stable IDs and category assignments live in `pipeline/targets/en.json` and `pipeline/targets/tr.json`.

The “How to play?” control opens a localized five-step visual tutorial. After a puzzle is solved or its answer is revealed, “Next puzzle” continues to the next unfinished puzzle in the current category selection.

## Prerequisites

- Node.js 18 or newer
- Ruby 3.3 and Bundler
- Python 3.11 or newer
- A Hugging Face account with the [EmbeddingGemma terms](https://huggingface.co/google/embeddinggemma-300m) accepted when generating English data

## Install

```sh
npm install
bundle install
python3 -m venv game
source game/bin/activate
pip install -e .
hf auth login
```

The model download is gated but approval is immediate after accepting Google's terms. Model weights and generated NumPy caches remain local and are ignored by Git.

## Generate puzzle data

```sh
source game/bin/activate
python -m pipeline generate --collection embeddinggemma-768-en-v1
python -m pipeline fetch --collection word2vec-skipgram-300-tr-v1
python -m pipeline generate --collection word2vec-skipgram-300-tr-v1
python -m pipeline audit --collection embeddinggemma-768-en-v1 --limit 25
python -m pipeline audit --collection word2vec-skipgram-300-tr-v1 --limit 25
```

Generation performs the following work:

1. Selects and normalizes entries from `wordfreq`: the 30,000 most frequent valid English surface forms, or the reviewed Zeyrek-preprocessed Turkish vocabulary. See [the Turkish vocabulary documentation](docs/turkish-vocabulary.md) for the normalization rules and the `tr-overrides.json` lexical-review workflow.
2. Encodes the vocabulary with the collection's pinned extractor: prompted EmbeddingGemma for English or the static Word2Vec table for Turkish.
3. Stores normalized embeddings in `pipeline-cache/<collection-id>/embeddings.npy` for reuse.
4. Reads the language's 160 stable IDs, words, and categories from `pipeline/targets/` and verifies exactly 20 targets per category.
5. Writes a versioned vocabulary, collection manifest, and 160 minified puzzle tables under `wordsim/data/collections/<collection-id>/`, plus the shared `catalog.json`.

Useful generator options include `--device cuda`, `--batch-size N`, `--targets PATH`, and `--force`. A valid generated vocabulary and embedding cache can be reused without loading the model dependencies.

### Turkish Word2Vec model

In this current version, the published Turkish collection uses the 300-dimensional Word2Vec skip-gram vectors released with [A Comprehensive Analysis of Static Word Embeddings for Turkish](https://arxiv.org/abs/2405.07778).

```sh
source game/bin/activate
python -m pipeline fetch --collection word2vec-skipgram-300-tr-v1
python -m pipeline generate --collection word2vec-skipgram-300-tr-v1
python -m pipeline audit --collection word2vec-skipgram-300-tr-v1 --limit 25
```

With this release, 12,478 of 12,812 requested words are covered (97.3931%), including the current 160 puzzle targets. The resulting local float32 cache is 14,973,728 bytes.

Once that derived cache, its vocabulary, and metadata validate against the configured model checksum, Turkish generation no longer requires the original 1.8 GB binary. The source model is required again only for a forced rebuild or when the vocabulary or cache becomes incompatible.

The model lookup intentionally does **not** apply the game's circumflex collapse to published model tokens. For example, a vector stored only for `hâlâ` is not silently assigned to the distinct normalized game key `hala`. This makes OOV loss visible and avoids choosing arbitrarily when multiple model tokens collapse to one game spelling.

## Storage and client footprint

The offline English embedding cache contains:

```text
30,000 words × 768 dimensions = 23,040,000 values
23,040,000 values × 4 bytes (float32) = 92,160,000 bytes
```

The actual English NumPy file is 92,160,128 bytes (92.16 MB, or 87.89 MiB including its header). The 12,478-word Turkish Word2Vec cache is 14,973,728 bytes (14.97 MB, or 14.28 MiB). These files are used only by the generator and are never sent to the browser. A cache remains the same size as more puzzles are added because every target in that collection reuses the shared vocabulary embeddings.

Measured static data sizes for the current build are:

| Asset | Raw | Gzip level 9 |
| --- | ---: | ---: |
| Collection manifest | about 9.8 KB | about 1.4 KB |
| English vocabulary (30,000 words) | 301.9 KB | 118.2 KB |
| Turkish vocabulary (12,478 words) | 128.2 KB | 49.8 KB |
| Representative English puzzle | 5.8 KB | 2.9 KB |
| Representative Turkish puzzle | 4.9 KB | 2.5 KB |

The first puzzle includes the shared vocabulary and manifest. Each later puzzle fetches only the indices of its nearest 1,000 words; full similarity arrays are not shipped to the browser. The current minified JavaScript and CSS add about 37 KB raw.

The complete generated static data is:

- English: 1.23 MB raw / 581 KB compressed, with a 92.16 MB local embedding cache.
- Turkish: 966 KB raw / 475 KB compressed, with a 14.97 MB local embedding cache.
- First-puzzle transfer remains independent of the other 159 puzzles because tables are fetched on demand.

The two current collections occupy 2.20 MB raw or about 1.06 MB with gzip, roughly 93% less than the previous full-score format. A typical player still downloads only the catalog, the vocabulary for the selected language, and the puzzle they select; switching languages lazily fetches the other vocabulary. Actual network transfer sizes depend on the production host enabling gzip or Brotli; without HTTP compression, the raw sizes apply.

## Build and run

```sh
npm run build:game
bundle exec jekyll serve
```

Open `http://localhost:4000/wordsim/`. To test a non-empty Jekyll base path:

```sh
bundle exec jekyll serve --baseurl /example
```

Then open `http://localhost:4000/example/wordsim/`.

The repository intentionally contains no deployment workflow. `npm run build:site` bundles the browser code and creates the local `_site/` output.

## Tests

```sh
npm test
source game/bin/activate
python -m unittest discover -s tests -p 'test_*.py'
npm run build:site
```

## Data format and future extractors

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for model and vocabulary attribution.
