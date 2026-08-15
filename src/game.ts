import type {
  GameAction,
  GameOutcome,
  GuessResult,
  PuzzleData,
  TargetCategory,
  VocabularyData,
} from "./types";

export type GuessErrorCode = "empty" | "invalid" | "unknown" | "duplicate" | "solved";
export const CATEGORY_GUESS_REQUIREMENT = 10;
export const CLOSEST_HINT_RANK = 3;

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
  return !session.complete && session.getResultCounts().guesses >= CATEGORY_GUESS_REQUIREMENT;
}

export class GameSession {
  private readonly indexByKey: Map<string, number>;
  private readonly rankByIndex: Map<number, number>;
  private readonly guessedWords = new Set<string>();
  private results: GuessResult[] = [];
  private actions: GameAction[] = [];
  private currentOutcome: GameOutcome = "active";

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
      } else if (action.source === "answer") {
        const result = session.revealAnswer();
        if (result.word !== action.word) {
          throw new Error("Saved answer does not match this puzzle.");
        }
      } else {
        throw new Error("Saved progress contains an unsupported action.");
      }
    }
    return session;
  }

  guess(rawValue: string): GuessResult {
    if (this.complete) {
      const message = this.gaveUp
        ? "This attempt has ended. Reset it to play again."
        : "This puzzle is already solved. Reset it to play again.";
      throw new GuessError("solved", message);
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
    if (this.complete) return null;

    const rankedResults = this.results
      .map((result) => result.rank)
      .filter((rank): rank is number => rank !== null);
    const bestRank = rankedResults.length === 0 ? null : Math.min(...rankedResults);
    const nextRank = bestRank === null || bestRank > 20 ? 20 : bestRank - 1;

    if (nextRank < CLOSEST_HINT_RANK || nextRank > this.puzzle.topIndices.length) return null;
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

  revealAnswer(): GuessResult {
    if (this.complete) {
      throw new Error("This puzzle is already complete. Reset it to play again.");
    }
    const index = this.indexByKey.get(this.puzzle.targetKey);
    const score = index === undefined ? undefined : this.puzzle.scores[index];
    if (index === undefined || score === undefined) {
      throw new Error("The puzzle answer does not resolve to a vocabulary word.");
    }
    const result: GuessResult = {
      word: this.puzzle.targetKey,
      score,
      rank: 1,
      solved: false,
      source: "answer",
    };
    this.recordResult(result, { word: result.word, source: "answer" });
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
      else if (result.source === "guess") guesses += 1;
    }
    return { guesses, hints };
  }

  get solved(): boolean {
    return this.currentOutcome === "solved";
  }

  get gaveUp(): boolean {
    return this.currentOutcome === "gave-up";
  }

  get complete(): boolean {
    return this.currentOutcome !== "active";
  }

  get outcome(): GameOutcome {
    return this.currentOutcome;
  }

  get category(): TargetCategory {
    return this.puzzle.category;
  }

  reset(): void {
    this.guessedWords.clear();
    this.results = [];
    this.actions = [];
    this.currentOutcome = "active";
  }

  private recordResult(result: GuessResult, action: GameAction): void {
    this.guessedWords.add(result.word);
    this.actions.push(action);
    this.results.push(result);
    this.results.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
    if (result.solved) this.currentOutcome = "solved";
    else if (result.source === "answer") this.currentOutcome = "gave-up";
  }
}
