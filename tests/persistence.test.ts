import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COLLECTION_STORAGE_KEY,
  emptyProgress,
  LEGACY_PROGRESS_STORAGE_KEY,
  loadProgress,
  loadSelectedCollection,
  progressStorageKey,
  saveProgress,
  saveSelectedCollection,
} from "../src/persistence";

const EN = "embeddinggemma-768-en-v1";
const LEGACY_TR = "embeddingmagibu-768-tr-v1";
const TR = "word2vec-skipgram-300-tr-v1";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("progress persistence", () => {
  it("round-trips independent puzzle progress in a collection namespace", () => {
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
    saveProgress(storage, EN, progress);
    assert.deepEqual(loadProgress(storage, EN, "v1", ["0", "1"], "en"), progress);
    assert.ok(storage.values.has(progressStorageKey(EN)));
  });

  it("keeps English and Turkish progress separate", () => {
    const storage = new MemoryStorage();
    const english = emptyProgress("en-v1", "0");
    const turkish = emptyProgress("tr-v1", "0");
    turkish.puzzles["0"] = {
      actions: [{ source: "guess", word: "ışık" }],
      categoryRevealed: false,
      solved: false,
      gaveUp: false,
    };
    saveProgress(storage, EN, english);
    saveProgress(storage, TR, turkish);
    assert.deepEqual(loadProgress(storage, EN, "en-v1", ["0"], "en"), english);
    assert.deepEqual(loadProgress(storage, TR, "tr-v1", ["0"], "tr"), turkish);
  });

  it("imports the legacy unnamespaced save only for English", () => {
    const storage = new MemoryStorage();
    const legacy = emptyProgress("v1", "0");
    storage.values.set(LEGACY_PROGRESS_STORAGE_KEY, JSON.stringify(legacy));
    assert.deepEqual(loadProgress(storage, EN, "v1", ["0"], "en"), legacy);
    assert.deepEqual(loadProgress(storage, TR, "v1", ["0"], "tr"), emptyProgress("v1", "0"));
  });

  it("discards incompatible and malformed saves", () => {
    const storage = new MemoryStorage();
    storage.values.set(progressStorageKey(EN), "not json");
    assert.deepEqual(loadProgress(storage, EN, "v1", ["0"], "en"), emptyProgress("v1", "0"));

    storage.values.set(progressStorageKey(EN), JSON.stringify({
      schemaVersion: 1,
      vocabularyVersion: "old",
      selectedPuzzleId: "0",
      puzzles: {},
    }));
    assert.deepEqual(loadProgress(storage, EN, "v1", ["0"], "en"), emptyProgress("v1", "0"));
  });

  it("migrates missing gave-up state and derives it from answer actions", () => {
    const storage = new MemoryStorage();
    storage.values.set(progressStorageKey(EN), JSON.stringify({
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
    }));
    assert.equal(loadProgress(storage, EN, "v1", ["0"], "en").puzzles["0"]?.gaveUp, true);
  });

  it("drops unknown puzzle IDs and malformed locale-specific actions", () => {
    const storage = new MemoryStorage();
    storage.values.set(progressStorageKey(TR), JSON.stringify({
      schemaVersion: 1,
      vocabularyVersion: "v1",
      selectedPuzzleId: "missing",
      puzzles: {
        "0": { actions: [{ source: "guess", word: "ışık" }], categoryRevealed: false, solved: false },
        "1": { actions: [{ source: "guess", word: "IŞIK" }], categoryRevealed: false, solved: false },
        missing: { actions: [], categoryRevealed: false, solved: false },
      },
    }));
    assert.deepEqual(loadProgress(storage, TR, "v1", ["0", "1"], "tr"), {
      schemaVersion: 1,
      vocabularyVersion: "v1",
      selectedPuzzleId: "0",
      puzzles: {
        "0": {
          actions: [{ source: "guess", word: "ışık" }],
          categoryRevealed: false,
          solved: false,
          gaveUp: false,
        },
      },
    });
  });

  it("remembers only a valid explicit collection selection", () => {
    const storage = new MemoryStorage();
    saveSelectedCollection(storage, TR);
    assert.equal(storage.getItem(COLLECTION_STORAGE_KEY), TR);
    assert.equal(loadSelectedCollection(storage, [EN, TR]), TR);
    assert.equal(loadSelectedCollection(storage, [EN]), null);
  });

  it("migrates only the legacy Turkish collection selection", () => {
    const storage = new MemoryStorage();
    saveSelectedCollection(storage, LEGACY_TR);
    const legacyProgress = emptyProgress("legacy-vocabulary", "7");
    saveProgress(storage, LEGACY_TR, legacyProgress);

    assert.equal(loadSelectedCollection(storage, [EN, TR]), TR);
    assert.equal(storage.getItem(COLLECTION_STORAGE_KEY), TR);
    assert.deepEqual(
      loadProgress(storage, TR, "current-vocabulary", ["0"], "tr"),
      emptyProgress("current-vocabulary", "0"),
    );
    assert.deepEqual(
      loadProgress(storage, LEGACY_TR, "legacy-vocabulary", ["7"], "tr"),
      legacyProgress,
    );
  });
});
