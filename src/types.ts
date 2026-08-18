interface SentenceTransformerMetadata {
  id: "embeddinggemma";
  kind?: "sentence-transformer";
  model: string;
  revision: string;
  prompt: "task: sentence similarity | query: ";
  dimensions: 768;
  trustRemoteCode: false;
}

interface Word2VecArtifactMetadata {
  release: "v1.0.0";
  archive: "word2vec_10ep-300emb.zip";
  member: "word2vec_10ep-300emb.bin";
}

interface Word2VecMetadata {
  id: "word2vec-skipgram";
  kind: "word2vec-binary";
  model: string;
  revision: "v1.0.0";
  prompt: "";
  dimensions: 300;
  trustRemoteCode: false;
  artifact: Word2VecArtifactMetadata;
  artifactSha256: string;
}

export type ExtractorMetadata = SentenceTransformerMetadata | Word2VecMetadata;

export type LanguageCode = "en" | "tr";
export type NormalizationStrategy = "en-lower-nfc-v1" | "tr-modern-lower-nfc-v1";
export type VocabularyPolicy =
  | "wordfreq-surface-v1"
  | "zeyrek-tr-reviewed-word2vec-covered-v1";

export interface CollectionSummary {
  id: string;
  language: LanguageCode;
  label: string;
  shortLabel: string;
  file: string;
}

export interface CollectionCatalog {
  schemaVersion: 1;
  defaultCollectionId: string;
  collections: CollectionSummary[];
}

export interface PuzzleSummary {
  id: string;
  label: string;
  file: string;
  category: TargetCategory;
}

export interface CollectionManifest {
  schemaVersion: 3;
  id: string;
  language: LanguageCode;
  extractor: ExtractorMetadata;
  vocabularyFile: string;
  puzzles: PuzzleSummary[];
}

export interface VocabularyData {
  schemaVersion: 2;
  version: string;
  language: LanguageCode;
  normalization: NormalizationStrategy;
  vocabularyPolicy: VocabularyPolicy;
  keyEncoding: "plain";
  keys: string[];
}

export type TargetCategory =
  | "animal"
  | "object"
  | "action"
  | "adjective"
  | "food"
  | "place"
  | "occupation"
  | "clothing";

export type CategoryFilter = TargetCategory | "anything";

export interface PuzzleData {
  schemaVersion: 2;
  vocabularyVersion: string;
  targetKey: string;
  category: TargetCategory;
  scores: number[];
  topIndices: number[];
}

export interface GuessResult {
  word: string;
  score: number;
  rank: number | null;
  solved: boolean;
  source: "guess" | "hint" | "answer";
}

export interface GameAction {
  word: string;
  source: "guess" | "hint" | "answer";
}

export type GameOutcome = "active" | "solved" | "gave-up";

export interface SavedPuzzleProgress {
  actions: GameAction[];
  categoryRevealed: boolean;
  solved: boolean;
  gaveUp: boolean;
}

export interface StoredProgress {
  schemaVersion: 1;
  vocabularyVersion: string;
  selectedPuzzleId: string;
  puzzles: Record<string, SavedPuzzleProgress>;
}
