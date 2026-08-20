# Changelog

## [1.4.0] - 2026-08-20

### Added

- Improved the tutorial.
- Added a "Next puzzle" action for easier transition to the next unfinished puzzle.

## [1.3.1] - 2026-08-19

### Changed

- Reduced generated puzzle downloads by storing only the nearest 1,000 word ranks instead of a score for every vocabulary entry.
- Simplified the data schemas and pipeline while preserving existing puzzle IDs and saved progress.
- Made the cached Turkish embedding subset reusable without retaining the full source model locally.

## [1.3.0] - 2026-08-18

### Added

- Added category selection with an “Anything” default.
- Added two new categories: occupations and clothing.
- Expanded the English and Turkish collections to 160 puzzles each from 50, with 20 puzzles in every category.

### Changed

- Collapsed the larger puzzle grid behind a compact Show puzzles control while keeping global puzzle numbers.

## [1.2.1] - 2026-08-18

### Added

- Added the changelog!

## [1.2.0] - 2026-08-17

### Changed

- Moved live game feedback beside the guess input and added the guessed word and rank so results remain visible on mobile keyboards.
- Added blue-to-red temperature indicators to make proximity ranks easier to scan.
- Removed numeric similarity scores from the game UI for simplicity.
- Applied the blue-to-red temperature scale to the wordsim heading.

## [1.1.0] - 2026-08-17

### Added

- Added a fully localized Turkish game and a language selector.
- Added Turkish vocabulary preprocessing and rankings.
- Added an in-game explanation of the rules, category hints, and clearer puzzle progress controls.

## [1.0.0] - 2026-08-16

### Added

- Released the original English word guessing game with precomputed similarities.
