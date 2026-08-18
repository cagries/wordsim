import type {
  CategoryFilter,
  PuzzleSummary,
  SavedPuzzleProgress,
} from "./types";

export function puzzlesForCategory(
  puzzles: readonly PuzzleSummary[],
  category: CategoryFilter,
): PuzzleSummary[] {
  return category === "anything"
    ? [...puzzles]
    : puzzles.filter((puzzle) => puzzle.category === category);
}

export function preferredPuzzleForCategory(
  puzzles: readonly PuzzleSummary[],
  category: CategoryFilter,
  currentPuzzleId: string | null,
  progress: Readonly<Record<string, SavedPuzzleProgress>>,
): PuzzleSummary | undefined {
  const matching = puzzlesForCategory(puzzles, category);
  const current = matching.find((puzzle) => puzzle.id === currentPuzzleId);
  if (current) return current;
  return matching.find((puzzle) => {
    const saved = progress[puzzle.id];
    return !saved?.solved && !saved?.gaveUp;
  }) ?? matching[0];
}
