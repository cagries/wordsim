import type { GuessResult, PuzzleData, VocabularyData } from "./types";

export type GuessErrorCode = "empty" | "invalid" | "unknown" | "duplicate" | "solved";

export class GuessError extends Error {
  constructor(public readonly code: GuessErrorCode, message: string) {
    super(message);
    this.name = "GuessError";
  }
}

export function normalizeGuess(value: string): string {
  return value.trim().toLowerCase();
}

export function formatScore(score: number): string {
  return (score / 100).toFixed(2);
}

export function encodeGuessKey(word: string, vocabulary: VocabularyData): string {
  if (vocabulary.keyEncoding !== "plain") {
    throw new Error(`Unsupported vocabulary encoding: ${String(vocabulary.keyEncoding)}.`);
  }
  return word;
}

export class GameSession {
  private readonly indexByKey: Map<string, number>;
  private readonly rankByIndex: Map<number, number>;
  private readonly guessedWords = new Set<string>();
  private results: GuessResult[] = [];
  private isSolved = false;

  constructor(
    private readonly vocabulary: VocabularyData,
    private readonly puzzle: PuzzleData,
  ) {
    if (vocabulary.version !== puzzle.vocabularyVersion) {
      throw new Error("Puzzle and vocabulary versions do not match.");
    }
    if (vocabulary.keys.length !== puzzle.scores.length) {
      throw new Error("Puzzle score count does not match the vocabulary.");
    }

    this.indexByKey = new Map(vocabulary.keys.map((key, index) => [key, index]));
    this.rankByIndex = new Map(puzzle.topIndices.map((index, rank) => [index, rank + 1]));
  }

  guess(rawValue: string): GuessResult {
    if (this.isSolved) {
      throw new GuessError("solved", "This puzzle is already solved. Reset it to play again.");
    }

    const word = normalizeGuess(rawValue);
    if (!word) {
      throw new GuessError("empty", "Enter a word.");
    }
    if (!/^[a-z]+$/.test(word)) {
      throw new GuessError("invalid", "Guesses must contain letters only.");
    }
    if (this.guessedWords.has(word)) {
      throw new GuessError("duplicate", `You already guessed “${word}”.`);
    }

    const key = encodeGuessKey(word, this.vocabulary);
    const index = this.indexByKey.get(key);
    if (index === undefined) {
      throw new GuessError("unknown", `“${word}” is not in this game’s vocabulary.`);
    }

    const result: GuessResult = {
      word,
      score: this.puzzle.scores[index],
      rank: this.rankByIndex.get(index) ?? null,
      solved: key === this.puzzle.targetKey,
    };

    this.guessedWords.add(word);
    this.results.push(result);
    this.results.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
    this.isSolved = result.solved;
    return result;
  }

  getResults(): readonly GuessResult[] {
    return this.results;
  }

  get solved(): boolean {
    return this.isSolved;
  }
}
