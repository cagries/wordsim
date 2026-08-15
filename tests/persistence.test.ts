import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyProgress,
  loadProgress,
  PROGRESS_STORAGE_KEY,
  saveProgress,
} from "../src/persistence";

class MemoryStorage {
  value: string | null = null;
  getItem(key: string): string | null {
    assert.equal(key, PROGRESS_STORAGE_KEY);
    return this.value;
  }
  setItem(key: string, value: string): void {
    assert.equal(key, PROGRESS_STORAGE_KEY);
    this.value = value;
  }
}

describe("progress persistence", () => {
  it("round-trips independent puzzle progress and selection", () => {
    const storage = new MemoryStorage();
    const progress = emptyProgress("v1", "0");
    progress.selectedPuzzleId = "1";
    progress.puzzles["0"] = {
      actions: [{ source: "guess", word: "music" }],
      categoryRevealed: false,
      solved: false,
      gaveUp: false,
    };
    progress.puzzles["1"] = {
      actions: [{ source: "hint", word: "terminal" }],
      categoryRevealed: true,
      solved: true,
      gaveUp: false,
    };
    saveProgress(storage, progress);
    assert.deepEqual(loadProgress(storage, "v1", ["0", "1"]), progress);
  });

  it("discards incompatible and malformed saves", () => {
    const storage = new MemoryStorage();
    storage.value = "not json";
    assert.deepEqual(loadProgress(storage, "v1", ["0"]), emptyProgress("v1", "0"));

    storage.value = JSON.stringify({
      schemaVersion: 1,
      vocabularyVersion: "old",
      selectedPuzzleId: "0",
      puzzles: {},
    });
    assert.deepEqual(loadProgress(storage, "v1", ["0"]), emptyProgress("v1", "0"));
  });

  it("migrates existing puzzle progress without a gave-up flag", () => {
    const storage = new MemoryStorage();
    storage.value = JSON.stringify({
      schemaVersion: 1,
      vocabularyVersion: "v1",
      selectedPuzzleId: "0",
      puzzles: {
        "0": {
          actions: [{ source: "guess", word: "music" }],
          categoryRevealed: false,
          solved: false,
        },
      },
    });
    assert.deepEqual(loadProgress(storage, "v1", ["0"]).puzzles["0"], {
      actions: [{ source: "guess", word: "music" }],
      categoryRevealed: false,
      solved: false,
      gaveUp: false,
    });
  });

  it("derives the revealed state from a saved answer action", () => {
    const storage = new MemoryStorage();
    storage.value = JSON.stringify({
      schemaVersion: 1,
      vocabularyVersion: "v1",
      selectedPuzzleId: "0",
      puzzles: {
        "0": {
          actions: [{ source: "answer", word: "violin" }],
          categoryRevealed: false,
          solved: false,
        },
      },
    });
    assert.equal(loadProgress(storage, "v1", ["0"]).puzzles["0"]?.gaveUp, true);
  });

  it("drops unknown puzzle IDs and malformed puzzle entries", () => {
    const storage = new MemoryStorage();
    storage.value = JSON.stringify({
      schemaVersion: 1,
      vocabularyVersion: "v1",
      selectedPuzzleId: "missing",
      puzzles: {
        "0": { actions: [], categoryRevealed: false, solved: false },
        "1": { actions: [{ source: "guess", word: "two words" }], categoryRevealed: false, solved: false },
        missing: { actions: [], categoryRevealed: false, solved: false },
      },
    });
    assert.deepEqual(loadProgress(storage, "v1", ["0", "1"]), {
      schemaVersion: 1,
      vocabularyVersion: "v1",
      selectedPuzzleId: "0",
      puzzles: { "0": { actions: [], categoryRevealed: false, solved: false, gaveUp: false } },
    });
  });
});
