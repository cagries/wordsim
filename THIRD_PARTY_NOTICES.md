# Third-party notices

## EmbeddingGemma

Puzzle scores are generated with `google/embeddinggemma-300m`, created by Google DeepMind. The model is used under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms) and the accompanying [Gemma Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy).

The repository does not redistribute the model weights. Generated score tables are outputs of the model.

## EmbeddingMagibu

The offline pipeline retains support for [`alibayram/embeddingmagibu-200m`](https://huggingface.co/alibayram/embeddingmagibu-200m), developed by M. Ali Bayram, Banu Diri, and Savaş Yıldırım. The model is distributed under the MIT License and is described in “Adapting Multilingual Embedding Models to Turkish via Cross-Lingual Tokenizer Surgery and Offline Distillation.”

The repository does not redistribute the model weights or ship Magibu-generated runtime score tables.

## Turkish Word2Vec

Turkish puzzle scores are generated with the 300-dimensional Word2Vec vectors released by Karahan Sarıtaş, Cahid Arda Öz, and Tunga Güngör with [“A Comprehensive Analysis of Static Word Embeddings for Turkish”](https://doi.org/10.1016/j.eswa.2024.124123). The accompanying [repository and release](https://github.com/Turkish-Word-Embeddings/Word-Embeddings-Repository-for-Turkish/releases/tag/v1.0.0) request citation of the work and its source corpora.

The repository code carries an MIT license, but the release does not state separate terms for the model artifacts. Wordsim does not redistribute the archive or extracted vectors; it currently includes only derived vocabulary similarity scores with attribution. The model-artifact terms should be clarified before publishing the project more broadly, or the scores should be regenerated with independently trained vectors.

## wordfreq

The accepted-word vocabulary is derived from `wordfreq` by Robyn Speer:

> Robyn Speer. (2022). rspeer/wordfreq: v3.0 (v3.0.2). Zenodo. https://doi.org/10.5281/zenodo.7199437

The `wordfreq` code is Apache-2.0 licensed. Its data includes material available under CC BY-SA 4.0 and data from Google Books Ngrams, the Leeds Internet Corpus, Wikipedia, ParaCrawl, OPUS OpenSubtitles, SUBTLEX, and other sources. The complete upstream attribution requirements are documented in [`wordfreq` NOTICE.md](https://github.com/rspeer/wordfreq/blob/master/NOTICE.md).

The generated vocabulary data should be redistributed with this notice intact.

## Zeyrek

The Turkish vocabulary is morphologically analyzed with [Zeyrek](https://github.com/obulat/zeyrek), a partial Python port of Zemberek by Olga Bulat. Zeyrek is distributed under the MIT License and includes default text dictionaries derived from [Zemberek-NLP](https://github.com/ahmetaa/zemberek-nlp), which is distributed under the Apache License 2.0.

The repository does not redistribute the analyzer package itself. The generated Turkish vocabulary is an output of the preprocessing pipeline.
