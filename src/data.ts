import { TARGET_CATEGORIES } from "./types";
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

const WORD2VEC_MODEL_SHA256 =
  "ab24d19b9d811a9636e633710c5bb5b61a85e0cda82e9230fed69f7b684a026f";
const TARGET_CATEGORY_SET = new Set<string>(TARGET_CATEGORIES);

function extractorIsSupported(manifest: CollectionManifest): boolean {
  const extractor = manifest.extractor;
  if (manifest.language === "en") {
    return (
      extractor?.id === "embeddinggemma" &&
      extractor.dimensions === 768 &&
      extractor.prompt === "task: sentence similarity | query: " &&
      extractor.trustRemoteCode === false
    );
  }
  return (
    extractor?.id === "word2vec-skipgram" &&
    extractor.kind === "word2vec-binary" &&
    extractor.dimensions === 300 &&
    extractor.prompt === "" &&
    extractor.trustRemoteCode === false &&
    extractor.revision === "v1.0.0" &&
    extractor.artifact?.release === "v1.0.0" &&
    extractor.artifact.archive === "word2vec_10ep-300emb.zip" &&
    extractor.artifact.member === "word2vec_10ep-300emb.bin" &&
    extractor.artifactSha256 === WORD2VEC_MODEL_SHA256
  );
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
    catalog.schemaVersion !== 2 ||
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
      !collection.label
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
  if (
    manifest.schemaVersion !== 4 ||
    manifest.id !== summary.id ||
    manifest.language !== summary.language ||
    !extractorIsSupported(manifest) ||
    manifest.puzzles.length === 0 ||
    manifest.puzzles.some(
      (puzzle) =>
        typeof puzzle.id !== "string" ||
        typeof puzzle.file !== "string" ||
        !TARGET_CATEGORY_SET.has(puzzle.category),
    )
  ) {
    throw new Error("The puzzle collection is invalid or empty.");
  }

  const vocabulary = await fetchJson<VocabularyData>(
    resolveDataUrl(collectionRoot, manifest.vocabularyFile),
  );
  if (
    vocabulary.schemaVersion !== 3 ||
    vocabulary.language !== manifest.language ||
    vocabulary.normalization !== (
      vocabulary.language === "tr" ? "tr-modern-lower-nfc-v1" : "en-lower-nfc-v1"
    ) ||
    vocabulary.vocabularyPolicy !== (
      vocabulary.language === "tr"
        ? "zeyrek-tr-reviewed-word2vec-covered-v1"
        : "wordfreq-surface-v1"
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
    puzzle.schemaVersion !== 3 ||
    !TARGET_CATEGORY_SET.has(puzzle.category) ||
    !Array.isArray(puzzle.topIndices)
  ) {
    throw new Error("The puzzle format is not supported.");
  }
  return puzzle;
}
