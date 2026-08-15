import type { GameAction, GuessResult, PuzzleData, TargetCategory, VocabularyData } from "./types";

export type GuessErrorCode = "empty" | "invalid" | "unknown" | "duplicate" | "solved";
export const CATEGORY_GUESS_REQUIREMENT = 10;

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

export function canRevealCategoryHint(session: GameSession): boolean {
  return !session.solved && session.getResultCounts().guesses >= CATEGORY_GUESS_REQUIREMENT;
}

export class GameSession {
  private readonly indexByKey: Map<string, number>;
  private readonly rankByIndex: Map<number, number>;
  private readonly guessedWords = new Set<string>();
  private results: GuessResult[] = [];
  private actions: GameAction[] = [];
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

  static restore(
    vocabulary: VocabularyData,
    puzzle: PuzzleData,
    actions: readonly GameAction[],
  ): GameSession {
    const session = new GameSession(vocabulary, puzzle);
    for (const action of actions) {
      if (action.source === "guess") {
        const result = session.guess(action.word);
        if (result.word !== action.word) throw new Error("Saved guess is not normalized.");
      } else if (action.source === "hint") {
        const result = session.revealHint();
        if (!result || result.word !== action.word) {
          throw new Error("Saved hint does not match this puzzle.");
        }
      } else {
        throw new Error("Saved progress contains an unsupported action.");
      }
    }
    return session;
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
      source: "guess",
    };

    this.recordResult(result, { word, source: "guess" });
    return result;
  }

  getNextHintRank(): number | null {
    if (this.isSolved) return null;

    const rankedResults = this.results
      .map((result) => result.rank)
      .filter((rank): rank is number => rank !== null);
    const bestRank = rankedResults.length === 0 ? null : Math.min(...rankedResults);
    const nextRank = bestRank === null || bestRank > 20 ? 20 : bestRank - 1;

    if (nextRank < 5 || nextRank > this.puzzle.topIndices.length) return null;
    return nextRank;
  }

  revealHint(): GuessResult | null {
    const rank = this.getNextHintRank();
    if (rank === null) return null;

    const index = this.puzzle.topIndices[rank - 1];
    const word = index === undefined ? undefined : this.vocabulary.keys[index];
    const score = index === undefined ? undefined : this.puzzle.scores[index];
    if (word === undefined || score === undefined) {
      throw new Error(`Hint rank #${rank} does not resolve to a vocabulary word.`);
    }

    const result: GuessResult = {
      word,
      score,
      rank,
      solved: false,
      source: "hint",
    };
    this.recordResult(result, { word, source: "hint" });
    return result;
  }

  getResults(): readonly GuessResult[] {
    return this.results;
  }

  getActions(): readonly GameAction[] {
    return this.actions;
  }

  getResultCounts(): { guesses: number; hints: number } {
    let guesses = 0;
    let hints = 0;
    for (const result of this.results) {
      if (result.source === "hint") hints += 1;
      else guesses += 1;
    }
    return { guesses, hints };
  }

  get solved(): boolean {
    return this.isSolved;
  }

  get category(): TargetCategory {
    return this.puzzle.category;
  }

  reset(): void {
    this.guessedWords.clear();
    this.results = [];
    this.actions = [];
    this.isSolved = false;
  }

  private recordResult(result: GuessResult, action: GameAction): void {
    this.guessedWords.add(result.word);
    this.actions.push(action);
    this.results.push(result);
    this.results.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
    this.isSolved = result.solved;
  }
}
