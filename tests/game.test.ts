import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { encodeGuessKey, formatScore, GameSession, GuessError, normalizeGuess } from "../src/game";
import type { PuzzleData, VocabularyData } from "../src/types";

const vocabulary: VocabularyData = {
  schemaVersion: 1,
  version: "test-version",
  keyEncoding: "plain",
  keys: ["cold", "target", "warm"],
};

const puzzle: PuzzleData = {
  schemaVersion: 1,
  vocabularyVersion: "test-version",
  targetKey: "target",
  scores: [-1200, 10000, 7345],
  topIndices: [1, 2],
};

describe("normalizeGuess", () => {
  it("trims and lowercases input", () => {
    assert.equal(normalizeGuess("  WaRm "), "warm");
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
    assert.throws(() => session.guess("WARM"), /already guessed/);
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
    schemaVersion: 1,
    version: "hint-version",
    keyEncoding: "plain",
    keys: Array.from({ length: 26 }, (_, index) => `word${String.fromCharCode(97 + index)}`),
  };
  const hintPuzzle: PuzzleData = {
    schemaVersion: 1,
    vocabularyVersion: "hint-version",
    targetKey: "worda",
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

  it("progresses one rank at a time and stops after rank 5", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    const ranks: number[] = [];
    while (session.getNextHintRank() !== null) {
      const hint = session.revealHint();
      assert.ok(hint);
      ranks.push(hint.rank as number);
    }
    assert.deepEqual(ranks, Array.from({ length: 16 }, (_, index) => 20 - index));
    assert.equal(session.revealHint(), null);
  });

  it("offers no hint when a player is already better than rank 5", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    assert.equal(session.guess("wordd").rank, 4);
    assert.equal(session.getNextHintRank(), null);
  });

  it("treats revealed hints as duplicate words", () => {
    const session = new GameSession(hintVocabulary, hintPuzzle);
    const hint = session.revealHint();
    assert.ok(hint);
    assert.throws(() => session.guess(hint.word), /already guessed/);
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
});
