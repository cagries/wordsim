export interface ExtractorMetadata {
  id: "embeddinggemma";
  model: string;
  revision: string;
  prompt: string;
  dimensions: 768;
}

export interface PuzzleSummary {
  id: string;
  label: string;
  file: string;
}

export interface CollectionManifest {
  schemaVersion: 1;
  extractor: ExtractorMetadata;
  vocabularyFile: string;
  puzzles: PuzzleSummary[];
}

export interface VocabularyData {
  schemaVersion: 1;
  version: string;
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
  source: "guess" | "hint";
}

export interface GameAction {
  word: string;
  source: "guess" | "hint";
}

export interface SavedPuzzleProgress {
  actions: GameAction[];
  categoryRevealed: boolean;
  solved: boolean;
}

export interface StoredProgress {
  schemaVersion: 1;
  vocabularyVersion: string;
  selectedPuzzleId: string;
  puzzles: Record<string, SavedPuzzleProgress>;
}
