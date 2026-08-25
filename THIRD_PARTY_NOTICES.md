# Third-party notices

## EmbeddingGemma

English puzzle rankings are generated locally with the pinned `google/embeddinggemma-300m` model revision created by Google DeepMind. Access requires accepting the [Gemma Terms of Use](https://ai.google.dev/gemma/terms), including the accompanying [Gemma Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy). Those terms distinguish generated outputs from model derivatives and state that Google claims no rights in generated outputs.

Wordsim does not redistribute the model weights or the generated embedding matrix. The published game data contains the accepted vocabulary and the indices of the 1,000 nearest words for each target; it does not contain embeddings or full similarity arrays. Model files and the local NumPy cache remain under the ignored `pipeline-cache/` directory and are not included in Wordsim releases.

## Turkish Word2Vec

Turkish puzzle rankings use the 300-dimensional Word2Vec skip-gram vectors published in the [Word Embeddings Repository for Turkish](https://github.com/Turkish-Word-Embeddings/Word-Embeddings-Repository-for-Turkish) and its [v1.0.0 release](https://github.com/Turkish-Word-Embeddings/Word-Embeddings-Repository-for-Turkish/releases/tag/v1.0.0). The vectors accompany:

> Karahan Sarıtaş, Cahid Arda Öz, and Tunga Güngör. “A Comprehensive Analysis of Static Word Embeddings for Turkish.” *Expert Systems with Applications* 252 (2024), 124123. [https://doi.org/10.1016/j.eswa.2024.124123](https://doi.org/10.1016/j.eswa.2024.124123)

The authors also request acknowledgement of the vector-training sources:

- Onur Güngör and Eray Yıldız. “Linguistic Features in Turkish Word Representations.” 25th Signal Processing and Communications Applications Conference, 2017. [https://doi.org/10.1109/SIU.2017.7960223](https://doi.org/10.1109/SIU.2017.7960223)
- Bünyamin Kurt, [Word Embedding Models — Datasets](https://github.com/bunyamink/word-embedding-models/tree/master/datasets).
- Haşim Sak, Tunga Güngör, and Murat Saraçlar. “Resources for Turkish Morphological Processing.” *Language Resources and Evaluation* 45 (2011), 249–261. [https://doi.org/10.1007/s10579-010-9128-6](https://doi.org/10.1007/s10579-010-9128-6)

Wordsim's explicit `pipeline fetch` command downloads the pinned archive directly from the authors' GitHub release and verifies the archive and extracted model against checked-in hashes. `pipeline generate` does not download it automatically: it reports the required `fetch` command when the local artifact is absent. Generation selects the covered vocabulary rows, normalizes them, computes the nearest-word rankings, and keeps the source model and selected embedding matrix only under the ignored `pipeline-cache/` directory.

Wordsim does not mirror the upstream archive, extracted model, or selected vector cache in this repository or its releases. The published game data contains vocabulary entries and rank indices, not the Word2Vec vectors or full similarity arrays.

## wordfreq

The accepted-word vocabulary is derived from `wordfreq` by Robyn Speer:

> Robyn Speer. (2022). rspeer/wordfreq: v3.0 (v3.0.2). Zenodo. https://doi.org/10.5281/zenodo.7199437

The `wordfreq` code is Apache-2.0 licensed. Its data includes material available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and data from Google Books Ngrams, the Leeds Internet Corpus, Wikipedia, ParaCrawl, OPUS OpenSubtitles, SUBTLEX, and other sources. Google Books Ngram Viewer is acknowledged as a source. OpenSubtitles is credited for the OPUS OpenSubtitles data. The freely available SUBTLEX word lists were created by Marc Brysbaert and collaborators, who are credited here as required by the upstream notice.

The complete source list and attribution requirements are documented in [`wordfreq` NOTICE.md](https://github.com/rspeer/wordfreq/blob/master/NOTICE.md). Wordsim's generated vocabulary data must be redistributed with this notice intact; Wordsim's MIT License does not replace the applicable upstream data terms.

## Zeyrek

The Turkish vocabulary is morphologically analyzed with [Zeyrek](https://github.com/obulat/zeyrek), a partial Python port of Zemberek by Olga Bulat. Zeyrek is distributed under the MIT License and includes default text dictionaries derived from [Zemberek-NLP](https://github.com/ahmetaa/zemberek-nlp), which is distributed under the Apache License 2.0.

The repository does not redistribute the analyzer package itself. The generated Turkish vocabulary is an output of the preprocessing pipeline.
