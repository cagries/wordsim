import type { GameAction, SavedPuzzleProgress, StoredProgress } from "./types";

export const PROGRESS_STORAGE_KEY = "wordsim.progress.v1";

function isAction(value: unknown): value is GameAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<GameAction>;
  return (
    (action.source === "guess" || action.source === "hint" || action.source === "answer") &&
    typeof action.word === "string" &&
    /^[a-z]+$/.test(action.word)
  );
}

function normalizeSavedPuzzle(value: unknown): SavedPuzzleProgress | null {
  if (!value || typeof value !== "object") return null;
  const puzzle = value as Partial<SavedPuzzleProgress>;
  if (
    !Array.isArray(puzzle.actions) ||
    !puzzle.actions.every(isAction) ||
    typeof puzzle.categoryRevealed !== "boolean" ||
    typeof puzzle.solved !== "boolean" ||
    (puzzle.gaveUp !== undefined && typeof puzzle.gaveUp !== "boolean")
  ) {
    return null;
  }
  return {
    actions: puzzle.actions,
    categoryRevealed: puzzle.categoryRevealed,
    solved: puzzle.solved,
    gaveUp: Boolean(puzzle.gaveUp || puzzle.actions.some((action) => action.source === "answer")),
  };
}

export function emptyProgress(vocabularyVersion: string, selectedPuzzleId: string): StoredProgress {
  return {
    schemaVersion: 1,
    vocabularyVersion,
    selectedPuzzleId,
    puzzles: {},
  };
}

export function loadProgress(
  storage: Pick<Storage, "getItem">,
  vocabularyVersion: string,
  puzzleIds: readonly string[],
): StoredProgress {
  const fallback = emptyProgress(vocabularyVersion, puzzleIds[0] ?? "0");
  try {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return fallback;
    const value = JSON.parse(raw) as Partial<StoredProgress>;
    if (
      value.schemaVersion !== 1 ||
      value.vocabularyVersion !== vocabularyVersion ||
      !value.puzzles ||
      typeof value.puzzles !== "object"
    ) {
      return fallback;
    }

    const validIds = new Set(puzzleIds);
    const puzzles: Record<string, SavedPuzzleProgress> = {};
    for (const [id, puzzle] of Object.entries(value.puzzles)) {
      const normalized = normalizeSavedPuzzle(puzzle);
      if (validIds.has(id) && normalized) puzzles[id] = normalized;
    }
    return {
      schemaVersion: 1,
      vocabularyVersion,
      selectedPuzzleId:
        typeof value.selectedPuzzleId === "string" && validIds.has(value.selectedPuzzleId)
          ? value.selectedPuzzleId
          : fallback.selectedPuzzleId,
      puzzles,
    };
  } catch {
    return fallback;
  }
}

export function saveProgress(
  storage: Pick<Storage, "setItem">,
  progress: StoredProgress,
): void {
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // The game remains playable when storage is unavailable or full.
  }
}
