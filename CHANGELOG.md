# Changelog

Notable user-facing changes to wordsim are recorded here.

## [Unreleased]

## [1.1.1] - 2026-08-17

### Changed

- Moved live game feedback beside the guess input and added the guessed word, similarity, and rank so results remain visible on mobile keyboards.
- Added blue-to-red temperature indicators to make proximity ranks easier to scan.

## [1.1.0] - 2026-08-17

### Added

- Added a fully localized Turkish game and a language selector.
- Added Turkish vocabulary preprocessing and rankings generated from a Turkish skip-gram Word2Vec model.
- Added an in-game explanation of the rules, category hints, and clearer puzzle progress controls.

### Changed

- Packaged the game as a self-contained static directory suitable for installation below another static or Jekyll site.

## [1.0.0] - 2026-08-16

### Added

- Released the original English word guessing game with precomputed EmbeddingGemma similarities.
