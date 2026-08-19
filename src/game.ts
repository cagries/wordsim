import type {
  GameAction,
  GameOutcome,
  GuessResult,
  LanguageCode,
  PuzzleData,
  TargetCategory,
  VocabularyData,
} from "./types";

export type GuessErrorCode = "empty" | "invalid" | "unknown" | "duplicate" | "solved";
export const CATEGORY_GUESS_REQUIREMENT = 5;
export const CLOSEST_HINT_RANK = 3;

export class GuessError extends Error {
  constructor(
    public readonly code: GuessErrorCode,
    public readonly word?: string,
  ) {
    super(code);
    this.name = "GuessError";
  }
}

export function normalizeGuess(value: string, language: LanguageCode = "en"): string {
  let word = value.trim().normalize("NFC").toLocaleLowerCase(language);
  if (language === "tr") {
    word = word.replaceAll("â", "a").replaceAll("î", "i").replaceAll("û", "u");
  }
  return word.normalize("NFC");
}

export function isValidGuessWord(word: string, language: LanguageCode): boolean {
  return language === "tr" ? /^[a-zçğıöşü]+$/.test(word) : /^[a-z]+$/.test(word);
}

export function canRevealCategoryHint(session: GameSession): boolean {
  return !session.complete && session.getResultCounts().guesses >= CATEGORY_GUESS_REQUIREMENT;
}

const vocabularyIndexes = new WeakMap<VocabularyData, ReadonlyMap<string, number>>();

function vocabularyIndex(vocabulary: VocabularyData): ReadonlyMap<string, number> {
  const cached = vocabularyIndexes.get(vocabulary);
  if (cached) return cached;
  const created = new Map(vocabulary.keys.map((key, index) => [key, index]));
  vocabularyIndexes.set(vocabulary, created);
  return created;
}

export class GameSession {
  private readonly indexByKey: ReadonlyMap<string, number>;
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
    const uniqueRanks = new Set(puzzle.topIndices);
    if (
      puzzle.topIndices.length === 0 ||
      uniqueRanks.size !== puzzle.topIndices.length ||
      puzzle.topIndices.some(
        (index) => !Number.isInteger(index) || index < 0 || index >= vocabulary.keys.length,
      )
    ) {
      throw new Error("Puzzle ranks do not resolve to unique vocabulary words.");
    }

    this.indexByKey = vocabularyIndex(vocabulary);
    if (vocabulary.keys[puzzle.topIndices[0]] !== puzzle.targetKey) {
      throw new Error("The puzzle answer must have proximity rank 1.");
    }
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
      throw new GuessError("solved");
    }

    const word = normalizeGuess(rawValue, this.vocabulary.language);
    if (!word) {
      throw new GuessError("empty");
    }
    if (!isValidGuessWord(word, this.vocabulary.language)) {
      throw new GuessError("invalid", word);
    }
    if (this.guessedWords.has(word)) {
      throw new GuessError("duplicate", word);
    }

    const key = word;
    const index = this.indexByKey.get(key);
    if (index === undefined) {
      throw new GuessError("unknown", word);
    }

    const result: GuessResult = {
      word,
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
    if (word === undefined) {
      throw new Error(`Hint rank #${rank} does not resolve to a vocabulary word.`);
    }

    const result: GuessResult = {
      word,
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
    if (index === undefined) {
      throw new Error("The puzzle answer does not resolve to a vocabulary word.");
    }
    const result: GuessResult = {
      word: this.puzzle.targetKey,
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
    this.results.sort((a, b) => {
      if (a.rank === null && b.rank !== null) return 1;
      if (a.rank !== null && b.rank === null) return -1;
      if (a.rank !== null && b.rank !== null && a.rank !== b.rank) return a.rank - b.rank;
      return a.word.localeCompare(b.word, this.vocabulary.language);
    });
    if (result.solved) this.currentOutcome = "solved";
    else if (result.source === "answer") this.currentOutcome = "gave-up";
  }
}
