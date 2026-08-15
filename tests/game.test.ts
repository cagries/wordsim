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
    });
    assert.deepEqual(session.guess("cold"), {
      word: "cold",
      score: -1200,
      rank: null,
      solved: false,
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
