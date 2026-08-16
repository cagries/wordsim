# wordsim

A small game that scores guesses by semantic similarity. The game is a standalone static page with a vanilla TypeScript client; all embeddings, cosine similarities, and proximity ranks are computed offline. This repository also includes a Jekyll landing page for local previewing.

The demo contains 50 puzzles spanning animals, objects, actions, adjectives, foods, and places. Their stable randomized IDs and category assignments live in `pipeline/targets.json`; Puzzle 1 is violin and Puzzle 2 is airport. EmbeddingGemma is the only active extractor in this version. The browser downloads a shared 30,000-word vocabulary and one compact score table at a time.

Players choose puzzles from a responsive numbered grid. Started, solved, and answer-revealed puzzles are marked separately, and progress for every puzzle is saved in browser-local storage. Ranked word hints remain unlimited: the first reveals proximity rank 20, each subsequent hint moves one rank closer, and hints stop at rank 3 so that the answer and its nearest neighbor remain hidden. A separate category hint unlocks after 5 accepted player guesses; invalid guesses and word hints do not advance that threshold. Players may also give up at any time, confirm the choice, and reveal the answer without counting the puzzle as solved.

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
4. Reads the 50 stable IDs, words, and categories from `pipeline/targets.json`.
5. Writes the versioned vocabulary, collection manifest, and 50 minified puzzle tables to `wordsim/data/`.

Useful generator options include `--device mps`, `--device cuda`, `--batch-size N`, `--targets PATH`, and `--force`. The default uses the framework-selected device and float32 model activations. A valid generated vocabulary and embedding cache can be reused without loading the model dependencies; a fresh vocabulary still requires `wordfreq`. Embedding regeneration is automatic if the model, prompt, Sentence Transformers version, or vocabulary checksum changes.

## Storage and client footprint

The offline embedding cache contains:

```text
30,000 words × 768 dimensions = 23,040,000 values
23,040,000 values × 4 bytes (float32) = 92,160,000 bytes
```

The actual NumPy file is 92,160,128 bytes (92.16 MB, or 87.89 MiB including its header). It is used only by the generator and is never sent to the browser. The cache remains the same size as more puzzles are added because every target reuses the shared vocabulary embeddings.

Measured static data sizes for the current build are:

| Asset | Raw | Gzip level 9 |
| --- | ---: | ---: |
| Collection manifest | 3.1 KB | 602 B |
| Shared 30,000-word vocabulary | 301.8 KB | 118.1 KB |
| Similarity scores for one puzzle | 150.0 KB | about 57 KB |
| Top-1,000 ranks for one puzzle | about 5.6 KB | about 2.7 KB |
| Complete puzzle file | about 155.7 KB | about 60 KB |

The first puzzle therefore requires about 461 KB of raw game data, or 179 KB with gzip, including the shared vocabulary and manifest. Each later puzzle requires only its approximately 156 KB raw / 60 KB compressed table. The current minified JavaScript and CSS add about 16 KB raw.

For the generated 50-puzzle collection, the complete static data is:

- 7.79 MB raw / 3.00 MB compressed for the puzzle files;
- 8.09 MB raw / 3.11 MB compressed after adding the shared vocabulary and manifest;
- unchanged first-puzzle transfer size, because puzzle tables are fetched on demand;
- unchanged 92.16 MB local embedding cache.

Fifty puzzles are therefore comfortably within the lightweight range for a static site. A typical player still downloads only the vocabulary and the puzzle they select. Actual network transfer sizes depend on the production host enabling gzip or Brotli; without HTTP compression, the raw sizes apply.

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

## Add to another static or Jekyll site

The complete runtime is the `wordsim/` directory:

```text
wordsim/
├── index.html
├── app.js
├── app.css
└── data/
    ├── collection.json
    ├── vocabulary.json
    └── puzzles/
```

Copy that directory into the root of the destination site. It needs no Jekyll layout, plugin, configuration, Node dependency, Python dependency, or server-side application. Jekyll copies it as ordinary static content, and the game is then available at `/wordsim/`.

All runtime references are relative, so the directory can be renamed or hosted beneath a base path. For example, copying it to `experiments/semantic-game/` makes it available at `/experiments/semantic-game/`. The heading links to the directory immediately above the installed game.

Run `npm run build:game` before copying when the TypeScript or CSS source has changed. Regenerating puzzle data is only necessary when the vocabulary, model configuration, or targets change.

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
