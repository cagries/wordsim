import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { loadCatalog, loadCollection, loadPuzzle } from "../src/data";
import type { CollectionSummary } from "../src/types";

afterEach(() => {
  mock.restoreAll();
});

const summary: CollectionSummary = {
  id: "word2vec-skipgram-300-tr-v1",
  language: "tr",
  label: "Türkçe",
  file: "collections/word2vec-skipgram-300-tr-v1/collection.json",
};

describe("data loading", () => {
  it("loads and validates the collection catalog", async () => {
    const catalog = {
      schemaVersion: 2,
      defaultCollectionId: summary.id,
      collections: [summary],
    };
    mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => catalog }) as Response);
    assert.deepEqual(await loadCatalog("/base/data/"), catalog);
  });

  it("loads a collection and resolves files relative to its directory", async () => {
    const responses = [
      {
        ok: true,
        json: async () => ({
          schemaVersion: 4,
          id: summary.id,
          language: "tr",
          extractor: {
            id: "word2vec-skipgram",
            kind: "word2vec-binary",
            model: "Turkish-Word-Embeddings/Word-Embeddings-Repository-for-Turkish",
            revision: "v1.0.0",
            prompt: "",
            dimensions: 300,
            trustRemoteCode: false,
            artifact: {
              release: "v1.0.0",
              archive: "word2vec_10ep-300emb.zip",
              member: "word2vec_10ep-300emb.bin",
            },
            artifactSha256: "ab24d19b9d811a9636e633710c5bb5b61a85e0cda82e9230fed69f7b684a026f",
          },
          vocabularyFile: "vocabulary.json",
          puzzles: [{
            id: "one",
            file: "puzzles/one.json",
            category: "animal",
          }],
        }),
      },
      {
        ok: true,
        json: async () => ({
          schemaVersion: 3,
          version: "abc",
          language: "tr",
          normalization: "tr-modern-lower-nfc-v1",
          vocabularyPolicy: "zeyrek-tr-reviewed-word2vec-covered-v1",
          keys: ["sözcük"],
        }),
      },
    ];
    const requested: string[] = [];
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      requested.push(String(input));
      return responses.shift() as Response;
    });

    const result = await loadCollection("/base/data/", summary);
    assert.deepEqual(result.vocabulary.keys, ["sözcük"]);
    assert.equal(result.collectionRoot, "/base/data/collections/word2vec-skipgram-300-tr-v1");
    assert.deepEqual(requested, [
      "/base/data/collections/word2vec-skipgram-300-tr-v1/collection.json",
      "/base/data/collections/word2vec-skipgram-300-tr-v1/vocabulary.json",
    ]);
  });

  it("rejects a manifest that disagrees with its catalog entry", async () => {
    mock.method(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({ schemaVersion: 4, id: "other", language: "tr", puzzles: [{}] }),
    }) as Response);
    await assert.rejects(loadCollection("/data", summary), /invalid or empty/);
  });

  it("rejects unsupported or remote-code-enabled extractors", async () => {
    mock.method(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        schemaVersion: 4,
        id: summary.id,
        language: summary.language,
        extractor: {
          id: "word2vec-skipgram",
          kind: "word2vec-binary",
          prompt: "",
          dimensions: 300,
          trustRemoteCode: true,
        },
        puzzles: [{ id: "0", file: "puzzles/0.json", category: "animal" }],
      }),
    }) as Response);
    await assert.rejects(loadCollection("/data", summary), /invalid or empty/);
  });

  it("rejects a Turkish Word2Vec manifest with the wrong artifact identity", async () => {
    mock.method(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        schemaVersion: 4,
        id: summary.id,
        language: summary.language,
        extractor: {
          id: "word2vec-skipgram",
          kind: "word2vec-binary",
          model: "Turkish-Word-Embeddings/Word-Embeddings-Repository-for-Turkish",
          revision: "v1.0.0",
          prompt: "",
          dimensions: 300,
          trustRemoteCode: false,
          artifact: {
            release: "v1.0.0",
            archive: "word2vec_10ep-300emb.zip",
            member: "word2vec_10ep-300emb.bin",
          },
          artifactSha256: "wrong",
        },
        puzzles: [{ id: "0", file: "puzzles/0.json", category: "animal" }],
      }),
    }) as Response);
    await assert.rejects(loadCollection("/data", summary), /invalid or empty/);
  });

  it("reports unsuccessful puzzle requests", async () => {
    mock.method(globalThis, "fetch", async () => ({ ok: false, status: 404 }) as Response);
    await assert.rejects(loadPuzzle("/data", "missing.json"), /404/);
  });

  it("loads categorized rank-only puzzle schema version 3", async () => {
    const puzzle = {
      schemaVersion: 3,
      vocabularyVersion: "abc",
      targetKey: "violin",
      category: "object",
      topIndices: [0],
    };
    mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => puzzle }) as Response);
    assert.deepEqual(await loadPuzzle("/data", "puzzles/0.json"), puzzle);
  });

  it("rejects unsupported puzzle schemas and categories", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () => ({ ok: true, json: async () => ({ schemaVersion: 4 }) }) as Response,
    );
    await assert.rejects(loadPuzzle("/data", "future.json"), /not supported/);

    mock.restoreAll();
    mock.method(
      globalThis,
      "fetch",
      async () => ({ ok: true, json: async () => ({ schemaVersion: 3, category: "abstract", topIndices: [] }) }) as Response,
    );
    await assert.rejects(loadPuzzle("/data", "invalid.json"), /not supported/);
  });
});
