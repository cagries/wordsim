import type { CollectionManifest, PuzzleData, VocabularyData } from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url} (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function resolveDataUrl(root: string, file: string): string {
  return `${root.replace(/\/$/, "")}/${file.replace(/^\//, "")}`;
}

export async function loadCollection(root: string): Promise<{
  manifest: CollectionManifest;
  vocabulary: VocabularyData;
}> {
  const manifest = await fetchJson<CollectionManifest>(resolveDataUrl(root, "collection.json"));
  if (manifest.schemaVersion !== 1 || manifest.puzzles.length === 0) {
    throw new Error("The puzzle collection is invalid or empty.");
  }

  const vocabulary = await fetchJson<VocabularyData>(
    resolveDataUrl(root, manifest.vocabularyFile),
  );
  if (
    vocabulary.schemaVersion !== 1 ||
    vocabulary.keyEncoding !== "plain" ||
    vocabulary.version.length === 0
  ) {
    throw new Error("The vocabulary format is not supported.");
  }

  return { manifest, vocabulary };
}

export async function loadPuzzle(root: string, file: string): Promise<PuzzleData> {
  const puzzle = await fetchJson<PuzzleData>(resolveDataUrl(root, file));
  if (
    puzzle.schemaVersion !== 2 ||
    !["animal", "object", "action", "adjective", "food", "place"].includes(puzzle.category)
  ) {
    throw new Error("The puzzle format is not supported.");
  }
  return puzzle;
}
