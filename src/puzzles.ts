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

export function nextUnfinishedPuzzle(
  puzzles: readonly PuzzleSummary[],
  category: CategoryFilter,
  currentPuzzleId: string,
  progress: Readonly<Record<string, SavedPuzzleProgress>>,
): PuzzleSummary | undefined {
  const matching = puzzlesForCategory(puzzles, category);
  const currentIndex = matching.findIndex((puzzle) => puzzle.id === currentPuzzleId);
  for (let offset = 1; offset <= matching.length; offset += 1) {
    const puzzle = matching[(currentIndex + offset) % matching.length];
    if (!puzzle || puzzle.id === currentPuzzleId) continue;
    const saved = progress[puzzle.id];
    if (!saved?.solved && !saved?.gaveUp) return puzzle;
  }
  return undefined;
}
