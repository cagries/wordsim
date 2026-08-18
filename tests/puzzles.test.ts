import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { preferredPuzzleForCategory, puzzlesForCategory } from "../src/puzzles";
import type { PuzzleSummary, SavedPuzzleProgress } from "../src/types";

const puzzles: PuzzleSummary[] = [
  { id: "0", label: "Puzzle 1", file: "puzzles/0.json", category: "animal" },
  { id: "1", label: "Puzzle 2", file: "puzzles/1.json", category: "food" },
  { id: "2", label: "Puzzle 3", file: "puzzles/2.json", category: "animal" },
];

const solved: SavedPuzzleProgress = {
  actions: [],
  categoryRevealed: false,
  solved: true,
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
