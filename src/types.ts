export interface ExtractorMetadata {
  id: "embeddinggemma" | "embeddingmagibu";
  model: string;
  revision: string;
  prompt: string;
  dimensions: 768;
  trustRemoteCode: false;
}

export type LanguageCode = "en" | "tr";
export type NormalizationStrategy = "en-lower-nfc-v1" | "tr-modern-lower-nfc-v1";
export type VocabularyPolicy = "wordfreq-surface-v1" | "zeyrek-tr-reviewed-v1";

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
}

export interface CollectionManifest {
  schemaVersion: 2;
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

export type TargetCategory = "animal" | "object" | "action" | "adjective" | "food" | "place";

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
