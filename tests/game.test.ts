import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canRevealCategoryHint,
  CATEGORY_GUESS_REQUIREMENT,
  encodeGuessKey,
  formatScore,
  GameSession,
  GuessError,
  isValidGuessWord,
  normalizeGuess,
} from "../src/game";
import type { PuzzleData, VocabularyData } from "../src/types";

const vocabulary: VocabularyData = {
  schemaVersion: 2,
  version: "test-version",
  language: "en",
  normalization: "en-lower-nfc-v1",
  vocabularyPolicy: "wordfreq-surface-v1",
  keyEncoding: "plain",
  keys: ["cold", "target", "warm"],
};

const puzzle: PuzzleData = {
  schemaVersion: 2,
  vocabularyVersion: "test-version",
  targetKey: "target",
  category: "object",
  scores: [-1200, 10000, 7345],
  topIndices: [1, 2],
};

describe("normalizeGuess", () => {
  it("trims and lowercases input", () => {
    assert.equal(normalizeGuess("  WaRm "), "warm");
  });

  it("uses Turkish casing and collapses common circumflexes", () => {
    assert.equal(normalizeGuess("  İSTANBUL ", "tr"), "istanbul");
    assert.equal(normalizeGuess("IŞIK", "tr"), "ışık");
    assert.equal(normalizeGuess("KÂR ÎMAN SÛR", "tr"), "kar iman sur");
  });

  it("accepts the modern Turkish alphabet plus q, w, and x", () => {
    for (const word of ["çığ", "öykü", "web", "quiz", "xenon"]) {
      assert.equal(isValidGuessWord(word, "tr"), true);
    }
    assert.equal(isValidGuessWord("iki kelime", "tr"), false);
    assert.equal(isValidGuessWord("söz!", "tr"), false);
  });
});

describe("Turkish GameSession", () => {
  const turkishVocabulary: VocabularyData = {
    schemaVersion: 2,
    version: "tr-version",
    language: "tr",
    normalization: "tr-modern-lower-nfc-v1",
    vocabularyPolicy: "zeyrek-tr-reviewed-v1",
    keyEncoding: "plain",
    keys: ["ışık", "kar"],
  };
  const turkishPuzzle: PuzzleData = {
    schemaVersion: 2,
    vocabularyVersion: "tr-version",
    targetKey: "ışık",
    category: "object",
    scores: [10_000, 4000],
    topIndices: [0, 1],
  };

  it("looks up locale-normalized and circumflex-collapsed guesses", () => {
    const session = new GameSession(turkishVocabulary, turkishPuzzle);
    assert.equal(session.guess("KÂR").word, "kar");
    assert.equal(session.guess("IŞIK").solved, true);
  });
});

describe("formatScore", () => {
  it("formats signed basis-point values", () => {
    assert.equal(formatScore(-1200), "-12.00");
    assert.equal(formatScore(7345), "73.45");
  });
});

describe("encodeGuessKey", () => {
  it("keeps plain vocabulary keys unchanged", () => {
    assert.equal(encodeGuessKey("warm", vocabulary), "warm");
  });
});

describe("GameSession", () => {
  it("scores ranked and cold guesses", () => {
    const session = new GameSession(vocabulary, puzzle);
    assert.deepEqual(session.guess("warm"), {
      word: "warm",
      score: 7345,
      rank: 2,
      solved: false,
      source: "guess",
    });
    assert.deepEqual(session.guess("cold"), {
      word: "cold",
      score: -1200,
      rank: null,
      solved: false,
      source: "guess",
    });
  });

  it("sorts history by score", () => {
    const session = new GameSession(vocabulary, puzzle);
    session.guess("cold");
    session.guess("warm");
    assert.deepEqual(session.getResults().map((result) => result.word), ["warm", "cold"]);
  });

  it("normalizes and solves the target", () => {
    const session = new GameSession(vocabulary, puzzle);
    assert.equal(session.guess(" TARGET ").solved, true);
    assert.equal(session.solved, true);
    assert.throws(() => session.guess("warm"), GuessError);
  });

  for (const [value, code] of [
    ["", "empty"],
    ["two words", "invalid"],
    ["missing", "unknown"],
  ] as const) {
    it(`rejects ${JSON.stringify(value)} with ${code}`, () => {
      const session = new GameSession(vocabulary, puzzle);
      assert.throws(
        () => session.guess(value),
        (error: unknown) => error instanceof GuessError && error.code === code,
      );
    });
  }

  it("rejects duplicate guesses", () => {
    const session = new GameSession(vocabulary, puzzle);
    session.guess("warm");
    assert.throws(
      () => session.guess("WARM"),
      (error: unknown) => error instanceof GuessError && error.code === "duplicate",
    );
  });

  it("rejects vocabulary and puzzle version mismatches", () => {
    assert.throws(
      () => new GameSession(vocabulary, { ...puzzle, vocabularyVersion: "other" }),
      /versions do not match/,
    );
  });
});

describe("GameSession hints", () => {
  const hintVocabulary: VocabularyData = {
    schemaVersion: 2,
    version: "hint-version",
    language: "en",
    normalization: "en-lower-nfc-v1",
    vocabularyPolicy: "wordfreq-surface-v1",
    keyEncoding: "plain",
    keys: Array.from({ length: 26 }, (_, index) => `word${String.fromCharCode(97 + index)}`),
  };
  const hintPuzzle: PuzzleData = {
    schemaVersion: 2,
    vocabularyVersion: "hint-version",
    targetKey: "worda",
    category: "action",
    scores: Array.from({ length: 26 }, (_, index) => 10_000 - index * 100),
    topIndices: Array.from({ length: 25 }, (_, index) => index),
  };

  it("starts at rank 20 when there are no guesses", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    assert.equal(session.getNextHintRank(), 20);
    assert.deepEqual(session.revealHint(), {
      word: "wordt",
      score: 8100,
      rank: 20,
      solved: false,
      source: "hint",
    });
  });

  it("starts at rank 20 when all guesses are cold", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    assert.equal(session.guess("wordz").rank, null);
    assert.equal(session.getNextHintRank(), 20);
  });

  it("reveals one rank better than the current best", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    assert.equal(session.guess("wordl").rank, 12);
    assert.equal(session.getNextHintRank(), 11);
    assert.equal(session.revealHint()?.rank, 11);
  });

  it("progresses one rank at a time and stops after rank 3", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    const ranks: number[] = [];
    while (session.getNextHintRank() !== null) {
      const hint = session.revealHint();
      assert.ok(hint);
      ranks.push(hint.rank as number);
    }
    assert.deepEqual(ranks, Array.from({ length: 18 }, (_, index) => 20 - index));
    assert.equal(session.revealHint(), null);
  });

  it("offers no hint when a player is already at rank 3", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    assert.equal(session.guess("wordc").rank, 3);
    assert.equal(session.getNextHintRank(), null);
  });

  it("treats revealed hints as duplicate words", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    const hint = session.revealHint();
    assert.ok(hint);
    assert.throws(
      () => session.guess(hint.word),
      (error: unknown) => error instanceof GuessError && error.code === "duplicate",
    );
  });

  it("counts guesses and hints separately", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    session.guess("wordz");
    session.revealHint();
    session.revealHint();
    assert.deepEqual(session.getResultCounts(), { guesses: 1, hints: 2 });
  });

  it("disables hints after solving", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    session.guess("worda");
    assert.equal(session.getNextHintRank(), null);
    assert.equal(session.revealHint(), null);
  });

  it("round-trips chronological guesses and hints", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    session.guess("wordz");
    session.revealHint();
    session.guess("wordl");
    session.revealHint();

    const restored = GameSession.restore(hintVocabulary, hintPuzzle, session.getActions());
    assert.deepEqual(restored.getActions(), session.getActions());
    assert.deepEqual(restored.getResults(), session.getResults());
    assert.deepEqual(restored.getResultCounts(), { guesses: 2, hints: 2 });
  });

  it("rejects stale saved hints", () => {
    assert.throws(
      () => GameSession.restore(hintVocabulary, hintPuzzle, [{ source: "hint", word: "wordb" }]),
      /does not match/,
    );
  });

  it("resets all session state", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    session.guess("wordz");
    session.revealHint();
    session.reset();
    assert.deepEqual(session.getActions(), []);
    assert.deepEqual(session.getResults(), []);
    assert.deepEqual(session.getResultCounts(), { guesses: 0, hints: 0 });
    assert.equal(session.solved, false);
    assert.equal(session.getNextHintRank(), 20);
    assert.equal(canRevealCategoryHint(session), false);
  });
});

describe("giving up", () => {
  it("reveals the answer without counting it as a guess or hint", () => {
    const session = new GameSession(vocabulary, puzzle);
    session.guess("cold");
    assert.deepEqual(session.revealAnswer(), {
      word: "target",
      score: 10_000,
      rank: 1,
      solved: false,
      source: "answer",
    });
    assert.equal(session.outcome, "gave-up");
    assert.equal(session.gaveUp, true);
    assert.equal(session.solved, false);
    assert.equal(session.complete, true);
    assert.deepEqual(session.getResultCounts(), { guesses: 1, hints: 0 });
    assert.throws(
      () => session.guess("warm"),
      (error: unknown) => error instanceof GuessError && error.code === "solved",
    );
    assert.equal(session.revealHint(), null);
  });

  it("restores and validates an answer reveal", () => {
    const session = new GameSession(vocabulary, puzzle);
    session.guess("warm");
    session.revealAnswer();
    const restored = GameSession.restore(vocabulary, puzzle, session.getActions());
    assert.equal(restored.gaveUp, true);
    assert.deepEqual(restored.getActions(), session.getActions());
    assert.throws(
      () => GameSession.restore(vocabulary, puzzle, [{ source: "answer", word: "warm" }]),
      /does not match/,
    );
  });

  it("can be retried after reset", () => {
    const session = new GameSession(vocabulary, puzzle);
    session.revealAnswer();
    session.reset();
    assert.equal(session.outcome, "active");
    assert.equal(session.complete, false);
    assert.equal(session.guess("warm").word, "warm");
  });
});

describe("category hint access", () => {
  const words = Array.from({ length: 25 }, (_, index) => `guess${String.fromCharCode(97 + index)}`);
  const categoryVocabulary: VocabularyData = {
    schemaVersion: 2,
    version: "category-version",
    language: "en",
    normalization: "en-lower-nfc-v1",
    vocabularyPolicy: "wordfreq-surface-v1",
    keyEncoding: "plain",
    keys: ["target", ...words, "hint"],
  };
  const categoryPuzzle: PuzzleData = {
    schemaVersion: 2,
    vocabularyVersion: "category-version",
    targetKey: "target",
    category: "food",
    scores: categoryVocabulary.keys.map((_, index) => 10_000 - index * 100),
    topIndices: categoryVocabulary.keys.map((_, index) => index),
  };

  it("unlocks after the required number of accepted player guesses", () => {
    const session = new GameSession(categoryVocabulary, categoryPuzzle);
    for (const word of words.slice(0, CATEGORY_GUESS_REQUIREMENT - 1)) session.guess(word);
    assert.equal(canRevealCategoryHint(session), false);
    session.guess(words[CATEGORY_GUESS_REQUIREMENT - 1]);
    assert.equal(canRevealCategoryHint(session), true);
  });

  it("does not count rejected guesses or word hints", () => {
    const session = new GameSession(categoryVocabulary, categoryPuzzle);
    assert.throws(() => session.guess("missing"), GuessError);
    session.revealHint();
    assert.deepEqual(session.getResultCounts(), { guesses: 0, hints: 1 });
    assert.equal(canRevealCategoryHint(session), false);
  });

  it("remains unavailable after an early solve", () => {
    const session = new GameSession(categoryVocabulary, categoryPuzzle);
    session.guess("target");
    assert.equal(canRevealCategoryHint(session), false);
  });
});
