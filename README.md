# Semantic Game

A small Semantle-like game that scores guesses by semantic similarity. The website is a static Jekyll page with a vanilla TypeScript client; all embeddings, cosine similarities, and proximity ranks are computed offline.

The demo contains five puzzles: elephant, bicycle, violin, volcano, and kitchen. EmbeddingGemma is the only active extractor in this version. The browser downloads a shared 30,000-word vocabulary and one compact score table at a time.

Players may request progressive hints without a usage quota. The first hint reveals proximity rank 20, each subsequent hint moves one rank closer, and hints stop at rank 5 so that the answer and its four nearest words remain hidden. Hints are marked in the shared history and counted separately from player guesses.

## Prerequisites

- Node.js 18 or newer
- Ruby 3.3 and Bundler
- Python 3.11 or newer
- A Hugging Face account with the [EmbeddingGemma terms](https://huggingface.co/google/embeddinggemma-300m) accepted

## Install

```sh
npm install
bundle install
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
hf auth login
```

The model download is gated but approval is immediate after accepting Google's terms. Model weights and generated NumPy caches remain local and are ignored by Git.

## Generate puzzle data

```sh
source .venv/bin/activate
python -m pipeline generate
python -m pipeline audit --limit 25
```

Generation performs the following work:

1. Selects the 30,000 most frequent lowercase alphabetic English entries from `wordfreq`.
2. Encodes `task: sentence similarity | query: <word>` with the pinned EmbeddingGemma revision.
3. Stores normalized embeddings in `pipeline-cache/embeddings.npy` for reuse.
4. Writes the versioned vocabulary, collection manifest, and five minified puzzle tables to `assets/semantic-game/data/`.

Useful generator options include `--device mps`, `--device cuda`, `--batch-size N`, and `--force`. The default uses the framework-selected device and float32 model activations. Regeneration is automatic if the model, prompt, Sentence Transformers version, or vocabulary checksum changes.

## Build and run

```sh
npm run build:game
bundle exec jekyll serve
```

Open `http://localhost:4000/semantic-game/`. To test a non-empty Jekyll base path:

```sh
bundle exec jekyll serve --baseurl /example
```

Then open `http://localhost:4000/example/semantic-game/`.

The repository intentionally contains no deployment workflow. `npm run build:site` bundles the browser code and creates the local `_site/` output.

## Tests

```sh
npm test
source .venv/bin/activate
python -m unittest discover -s tests -p 'test_*.py'
npm run build:site
```

## Data format and future extractors

Scores are signed integers equal to `round(cosine_similarity * 10000)`. The UI divides them by 100, so a cosine of `0.7345` appears as `73.45`. Each puzzle also contains the vocabulary indices of its nearest 1,000 words.

The Python extractor boundary returns a normalized NumPy matrix. A future Google News word2vec implementation can produce the same matrix and reuse all scoring code without exposing a model selector in the user interface.

The vocabulary schema currently declares `keyEncoding: "plain"`. A future version may store salted hashes and change only the guess-key encoder. This would discourage casual inspection but cannot prevent offline dictionary enumeration in a fully static application.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for model and vocabulary attribution.
