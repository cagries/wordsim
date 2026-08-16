# Third-party notices

## EmbeddingGemma

Puzzle scores are generated with `google/embeddinggemma-300m`, created by Google DeepMind. The model is used under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms) and the accompanying [Gemma Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy).

The repository does not redistribute the model weights. Generated score tables are outputs of the model.

## wordfreq

The accepted-word vocabulary is derived from `wordfreq` by Robyn Speer:

> Robyn Speer. (2022). rspeer/wordfreq: v3.0 (v3.0.2). Zenodo. https://doi.org/10.5281/zenodo.7199437

The `wordfreq` code is Apache-2.0 licensed. Its data includes material available under CC BY-SA 4.0 and data from Google Books Ngrams, the Leeds Internet Corpus, Wikipedia, ParaCrawl, OPUS OpenSubtitles, SUBTLEX, and other sources. The complete upstream attribution requirements are documented in [`wordfreq` NOTICE.md](https://github.com/rspeer/wordfreq/blob/master/NOTICE.md).

The generated vocabulary data should be redistributed with this notice intact.

## Stanza

The Turkish vocabulary is morphologically analyzed with [Stanza](https://stanfordnlp.github.io/stanza/), developed by the Stanford NLP Group, and its Turkish IMST models. Stanza is distributed under the Apache License 2.0. Model and training-data licenses are documented in the [Stanza model documentation](https://stanfordnlp.github.io/stanza/available_models.html).

The repository does not redistribute Stanza model files. The generated Turkish vocabulary is an output of the preprocessing pipeline.
