import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  nextUnfinishedPuzzle,
  preferredPuzzleForCategory,
  puzzlesForCategory,
} from "../src/puzzles";
import type { PuzzleSummary, SavedPuzzleProgress } from "../src/types";

const puzzles: PuzzleSummary[] = [
  { id: "0", file: "puzzles/0.json", category: "animal" },
  { id: "1", file: "puzzles/1.json", category: "food" },
  { id: "2", file: "puzzles/2.json", category: "animal" },
];

const solved: SavedPuzzleProgress = {
  actions: [],
  categoryRevealed: false,
  solved: true,
  gaveUp: false,
};

const revealed: SavedPuzzleProgress = { ...solved, solved: false, gaveUp: true };
const started: SavedPuzzleProgress = {
  actions: [{ word: "guess", source: "guess" }],
  categoryRevealed: false,
  solved: false,
  gaveUp: false,
};

describe("category puzzle selection", () => {
  it("filters without changing global puzzle identity", () => {
    assert.deepEqual(puzzlesForCategory(puzzles, "animal").map((puzzle) => puzzle.id), ["0", "2"]);
    assert.deepEqual(puzzlesForCategory(puzzles, "anything"), puzzles);
  });

  it("keeps a matching current puzzle", () => {
    assert.equal(preferredPuzzleForCategory(puzzles, "animal", "2", {},)?.id, "2");
  });

  it("chooses the first incomplete match then falls back to the first match", () => {
    assert.equal(
      preferredPuzzleForCategory(puzzles, "animal", "1", { "0": solved })?.id,
      "2",
    );
    assert.equal(
      preferredPuzzleForCategory(puzzles, "animal", "1", { "0": solved, "2": solved })?.id,
      "0",
    );
  });
});

describe("next unfinished puzzle selection", () => {
  it("advances within the active category and wraps", () => {
    assert.equal(nextUnfinishedPuzzle(puzzles, "animal", "0", {})?.id, "2");
    assert.equal(nextUnfinishedPuzzle(puzzles, "animal", "2", {})?.id, "0");
  });

  it("skips solved and answer-revealed puzzles", () => {
    assert.equal(
      nextUnfinishedPuzzle(puzzles, "anything", "0", { "1": solved, "2": revealed }),
      undefined,
    );
  });

  it("keeps started but unfinished puzzles eligible", () => {
    assert.equal(
      nextUnfinishedPuzzle(puzzles, "anything", "0", { "1": started }),
      puzzles[1],
    );
  });

  it("does not return the current puzzle when it is the only match", () => {
    assert.equal(nextUnfinishedPuzzle(puzzles, "food", "1", {}), undefined);
  });
});
