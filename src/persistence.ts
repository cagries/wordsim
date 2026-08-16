import { isValidGuessWord, normalizeGuess } from "./game";
import type {
  GameAction,
  LanguageCode,
  SavedPuzzleProgress,
  StoredProgress,
} from "./types";

export const LEGACY_PROGRESS_STORAGE_KEY = "wordsim.progress.v1";
export const PROGRESS_STORAGE_PREFIX = "wordsim.progress.v1.";
export const COLLECTION_STORAGE_KEY = "wordsim.collection.v1";
const ENGLISH_COLLECTION_ID = "embeddinggemma-768-en-v1";

export function progressStorageKey(collectionId: string): string {
  return `${PROGRESS_STORAGE_PREFIX}${collectionId}`;
}

function isAction(value: unknown, language: LanguageCode): value is GameAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<GameAction>;
  return (
    (action.source === "guess" || action.source === "hint" || action.source === "answer") &&
    typeof action.word === "string" &&
    normalizeGuess(action.word, language) === action.word &&
    isValidGuessWord(action.word, language)
  );
}

function normalizeSavedPuzzle(
  value: unknown,
  language: LanguageCode,
): SavedPuzzleProgress | null {
  if (!value || typeof value !== "object") return null;
  const puzzle = value as Partial<SavedPuzzleProgress>;
  if (
    !Array.isArray(puzzle.actions) ||
    !puzzle.actions.every((action) => isAction(action, language)) ||
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
  collectionId: string,
  vocabularyVersion: string,
  puzzleIds: readonly string[],
  language: LanguageCode,
): StoredProgress {
  const fallback = emptyProgress(vocabularyVersion, puzzleIds[0] ?? "0");
  try {
    const key = progressStorageKey(collectionId);
    const raw = storage.getItem(key) ?? (
      collectionId === ENGLISH_COLLECTION_ID
        ? storage.getItem(LEGACY_PROGRESS_STORAGE_KEY)
        : null
    );
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
      const normalized = normalizeSavedPuzzle(puzzle, language);
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
  collectionId: string,
  progress: StoredProgress,
): void {
  try {
    storage.setItem(progressStorageKey(collectionId), JSON.stringify(progress));
  } catch {
    // The game remains playable when storage is unavailable or full.
  }
}

export function loadSelectedCollection(
  storage: Pick<Storage, "getItem">,
  validCollectionIds: readonly string[],
): string | null {
  try {
    const selected = storage.getItem(COLLECTION_STORAGE_KEY);
    return selected && validCollectionIds.includes(selected) ? selected : null;
  } catch {
    return null;
  }
}

export function saveSelectedCollection(
  storage: Pick<Storage, "setItem">,
  collectionId: string,
): void {
  try {
    storage.setItem(COLLECTION_STORAGE_KEY, collectionId);
  } catch {
    // Language switching remains available when storage is unavailable or full.
  }
}
