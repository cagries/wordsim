# wordsim

A small game that scores guesses by semantic similarity. The game is a standalone static page with a vanilla TypeScript client; all embeddings, cosine similarities, and proximity ranks are computed offline. This repository also includes a Jekyll landing page for local previewing.

The demo contains English and Turkish collections, each with 50 puzzles spanning animals, objects, actions, adjectives, foods, and places. Their stable randomized IDs and category assignments live in `pipeline/targets/en.json` and `pipeline/targets/tr.json`. English uses EmbeddingGemma, while Turkish uses a Turkish skip-gram Word2Vec model. The browser downloads the selected language's shared vocabulary and one compact score table at a time: 30,000 English words or 12,478 morphologically filtered, model-covered Turkish words.

Players can switch the fully localized interface between English and Turkish with the language selector beside the title. On the first visit, the browser language selects a collection when possible; an explicit choice is remembered. Puzzle progress is stored separately for each collection, and existing English progress from the original single-language release is imported automatically.

Players choose puzzles from a responsive numbered grid. Started, solved, and answer-revealed puzzles are marked separately. Ranked word hints remain unlimited: the first reveals proximity rank 20, each subsequent hint moves one rank closer, and hints stop at rank 3 so that the answer and its nearest neighbor remain hidden. A separate category hint unlocks after 5 accepted player guesses; invalid guesses and word hints do not advance that threshold. Players may also give up at any time, confirm the choice, and reveal the answer without counting the puzzle as solved.

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

1. Selects and normalizes entries from `wordfreq`: the 30,000 most frequent valid English surface forms, or the reviewed Zeyrek-preprocessed Turkish vocabulary.
2. Encodes the vocabulary with the collection's pinned extractor: prompted EmbeddingGemma for English or the static Word2Vec table for Turkish.
3. Stores normalized embeddings in `pipeline-cache/<collection-id>/embeddings.npy` for reuse.
4. Reads the language's 50 stable IDs, words, and categories from `pipeline/targets/`.
5. Writes a versioned vocabulary, collection manifest, and 50 minified puzzle tables under `wordsim/data/collections/<collection-id>/`, plus the shared `catalog.json`.

Useful generator options include `--device mps`, `--device cuda`, `--batch-size N`, `--targets PATH`, and `--force`. The default uses the framework-selected embedding device and float32 model activations; Zeyrek preprocessing runs on the CPU from resources installed with the package. A valid generated vocabulary and embedding cache can be reused without loading the model dependencies. Turkish generation writes a detailed, ignored review artifact to `pipeline-cache/<collection-id>/vocabulary-audit.json`. Embedding regeneration is automatic if the model, prompt, Sentence Transformers version, or vocabulary checksum changes.

### Turkish Word2Vec model

The published Turkish collection uses the 300-dimensional Word2Vec skip-gram vectors released with [A Comprehensive Analysis of Static Word Embeddings for Turkish](https://arxiv.org/abs/2405.07778). EmbeddingMagibu remains configured as an unpublished pipeline option for future comparisons, but none of its vocabulary or similarity tables are shipped in `wordsim/`.

```sh
source game/bin/activate
python -m pipeline fetch --collection word2vec-skipgram-300-tr-v1
python -m pipeline generate --collection word2vec-skipgram-300-tr-v1
python -m pipeline audit --collection word2vec-skipgram-300-tr-v1 --limit 25
```

`fetch` resumably downloads the 1.77 GB `word2vec_10ep-300emb.zip` release asset, verifies its byte size and pinned checksums, and extracts the single binary model under `pipeline-cache/sources/`. The archive SHA-256 is `b91a2106e39d323b92fd5fab5f61636d9ee6ca8378f3a456f6f8a33066c65b51`; the extracted model SHA-256 is `ab24d19b9d811a9636e633710c5bb5b61a85e0cda82e9230fed69f7b684a026f`. The ZIP can be deleted after successful extraction to recover about 1.77 GB; the verified model and receipt are sufficient for generation and later fetch checks. The ZIP is treated as the skip-gram export because the release provides CBOW separately and the repository's Word2Vec training script defaults to `sg=1`; this provenance is an explicit inference rather than separate release metadata. Neither archive nor extracted model is committed.

Generation scans the binary file without loading its full 1.57-million-token vocabulary into memory. It retains exact NFC matches from the 12,812-word reviewed Turkish base vocabulary and writes a coverage report to `pipeline-cache/word2vec-skipgram-300-tr-v1/coverage-audit.json`. Missing non-target words are omitted without reordering the rest. Any missing puzzle target, malformed vector, checksum failure, or coverage below 1,000 words stops generation.

With the pinned release, 12,478 of 12,812 requested words are covered (97.3931%), including all 50 puzzle targets. The resulting local float32 cache is 14,973,728 bytes. This measured baseline should be rechecked if either the reviewed Turkish vocabulary or artifact identity changes.

The model lookup intentionally does **not** apply the game's circumflex collapse to published model tokens. For example, a vector stored only for `hâlâ` is not silently assigned to the distinct normalized game key `hala`. This makes OOV loss visible and avoids choosing arbitrarily when multiple model tokens collapse to one game spelling.

## Turkish normalization policy

Turkish input uses locale-aware casing (`I` becomes `ı`, while `İ` becomes `i`) and NFC Unicode normalization. The circumflex variants `â`, `î`, and `û` are deliberately collapsed to `a`, `i`, and `u` before validation, vocabulary deduplication, embedding, lookup, and persistence. This makes ordinary Turkish-keyboard input work reliably, but it also merges distinctions such as `kar`/`kâr`, `hala`/`hâlâ`, and `aşık`/`âşık`.

The accepted Turkish character set is `a-zçğıöşü`. It intentionally includes `q`, `w`, and `x` for common loanwords even though those letters are outside the traditional Turkish alphabet.

The normalization decision is identified as `tr-modern-lower-nfc-v1` in generated vocabulary metadata. A separate `zeyrek-tr-reviewed-v1` vocabulary policy uses Zeyrek's lexicon to discard proper nouns and selected noun/adjective inflections while taking verb infinitives directly from dictionary lemmas. A checked-in review file resolves suspicious English/Turkish overlaps and causes generation to fail when a new suspect has not been classified. The rules, measured baseline, override workflow, and limitations are documented in [docs/turkish-vocabulary.md](docs/turkish-vocabulary.md).

The served Turkish collection is `word2vec-skipgram-300-tr-v1`. Its distinct ID intentionally starts fresh browser progress after the earlier Magibu collection while preserving the user's Turkish language selection. Future incompatible normalization, vocabulary-policy, or embedding-model changes require another collection ID.

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
| Collection manifest | 3.3 KB | 739 B |
| English vocabulary (30,000 words) | 301.9 KB | 118.2 KB |
| Turkish vocabulary (12,478 words) | 128.2 KB | 49.8 KB |
| Typical English puzzle | 155.8 KB | 59.9 KB |
| Typical Turkish puzzle | 65.5 KB | 27.9 KB |

The first puzzle therefore requires about 461 KB raw / 179 KB compressed for English or 197 KB raw / 78 KB compressed for Turkish, including the shared vocabulary and manifest. Each later puzzle fetches only its score table. The current minified JavaScript and CSS add about 28 KB raw.

The complete generated static data is:

- English: 8.09 MB raw / 3.12 MB compressed, with a 92.16 MB local embedding cache.
- Turkish: 3.37 MB raw / 1.45 MB compressed, with a 14.97 MB local embedding cache.
- First-puzzle transfer remains independent of the other 49 puzzles because tables are fetched on demand.

The two current collections occupy 11.47 MB raw or about 4.56 MB with gzip. A typical player still downloads only the catalog, the vocabulary for the selected language, and the puzzle they select; switching languages lazily fetches the other vocabulary. Actual network transfer sizes depend on the production host enabling gzip or Brotli; without HTTP compression, the raw sizes apply.

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
    ├── catalog.json
    └── collections/
        ├── embeddinggemma-768-en-v1/
        │   ├── collection.json
        │   ├── vocabulary.json
        │   └── puzzles/
        └── word2vec-skipgram-300-tr-v1/
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
source game/bin/activate
python -m unittest discover -s tests -p 'test_*.py'
npm run build:site
```

## Data format and future extractors

`wordsim/data/catalog.json` lists the available language collections and their manifests. Each vocabulary records its language, named normalization policy, and language-specific vocabulary policy. Scores are signed integers equal to `round(cosine_similarity * 10000)`. The UI divides them by 100, so a cosine of `0.7345` appears as `73.45`. Each puzzle also contains the vocabulary indices of its nearest 1,000 words.

The Python extractor boundary returns a normalized NumPy matrix. Sentence Transformers and selectively loaded binary Word2Vec vectors therefore reuse the same scoring code without exposing a model selector in the user interface.

The vocabulary schema currently declares `keyEncoding: "plain"`. A future version may store salted hashes and change only the guess-key encoder. This would discourage casual inspection but cannot prevent offline dictionary enumeration in a fully static application.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for model and vocabulary attribution.
