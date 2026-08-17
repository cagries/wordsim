import type {
  CollectionCatalog,
  CollectionManifest,
  CollectionSummary,
  PuzzleData,
  VocabularyData,
} from "./types";

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

function parentUrl(url: string): string {
  const separator = url.lastIndexOf("/");
  if (separator < 0) throw new Error(`Could not resolve the parent of ${url}.`);
  return url.slice(0, separator);
}

export async function loadCatalog(root: string): Promise<CollectionCatalog> {
  const catalog = await fetchJson<CollectionCatalog>(resolveDataUrl(root, "catalog.json"));
  const ids = new Set<string>();
  if (
    catalog.schemaVersion !== 1 ||
    catalog.collections.length === 0 ||
    !catalog.collections.some((collection) => collection.id === catalog.defaultCollectionId)
  ) {
    throw new Error("The collection catalog is invalid or empty.");
  }
  for (const collection of catalog.collections) {
    if (
      ids.has(collection.id) ||
      !["en", "tr"].includes(collection.language) ||
      !collection.file ||
      !collection.shortLabel
    ) {
      throw new Error("The collection catalog contains an invalid entry.");
    }
    ids.add(collection.id);
  }
  return catalog;
}

export async function loadCollection(
  root: string,
  summary: CollectionSummary,
): Promise<{
  manifest: CollectionManifest;
  vocabulary: VocabularyData;
  collectionRoot: string;
}> {
  const manifestUrl = resolveDataUrl(root, summary.file);
  const collectionRoot = parentUrl(manifestUrl);
  const manifest = await fetchJson<CollectionManifest>(manifestUrl);
  const expectedExtractor = summary.language === "tr" ? "embeddingmagibu" : "embeddinggemma";
  if (
    manifest.schemaVersion !== 2 ||
    manifest.id !== summary.id ||
    manifest.language !== summary.language ||
    manifest.extractor?.id !== expectedExtractor ||
    manifest.extractor.dimensions !== 768 ||
    manifest.extractor.prompt !== "task: sentence similarity | query: " ||
    manifest.extractor.trustRemoteCode !== false ||
    manifest.puzzles.length === 0
  ) {
    throw new Error("The puzzle collection is invalid or empty.");
  }

  const vocabulary = await fetchJson<VocabularyData>(
    resolveDataUrl(collectionRoot, manifest.vocabularyFile),
  );
  if (
    vocabulary.schemaVersion !== 2 ||
    vocabulary.keyEncoding !== "plain" ||
    vocabulary.language !== manifest.language ||
    vocabulary.normalization !== (
      vocabulary.language === "tr" ? "tr-modern-lower-nfc-v1" : "en-lower-nfc-v1"
    ) ||
    vocabulary.vocabularyPolicy !== (
      vocabulary.language === "tr" ? "zeyrek-tr-reviewed-v1" : "wordfreq-surface-v1"
    ) ||
    vocabulary.version.length === 0
  ) {
    throw new Error("The vocabulary format is not supported.");
  }

  return { manifest, vocabulary, collectionRoot };
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
