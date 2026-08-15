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

export interface PuzzleData {
  schemaVersion: 1;
  vocabularyVersion: string;
  targetKey: string;
  scores: number[];
  topIndices: number[];
}

export interface GuessResult {
  word: string;
  score: number;
  rank: number | null;
  solved: boolean;
}

