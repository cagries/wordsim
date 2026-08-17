import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { loadCatalog, loadCollection, loadPuzzle } from "../src/data";
import type { CollectionSummary } from "../src/types";

afterEach(() => {
  mock.restoreAll();
});

const summary: CollectionSummary = {
  id: "embeddingmagibu-768-tr-v1",
  language: "tr",
  label: "Türkçe",
  shortLabel: "TR",
  file: "collections/embeddingmagibu-768-tr-v1/collection.json",
};

describe("data loading", () => {
  it("loads and validates the collection catalog", async () => {
    const catalog = {
      schemaVersion: 1,
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
          schemaVersion: 2,
          id: summary.id,
          language: "tr",
          extractor: {
            id: "embeddingmagibu",
            model: "alibayram/embeddingmagibu-200m",
            revision: "revision",
            prompt: "task: sentence similarity | query: ",
            dimensions: 768,
            trustRemoteCode: false,
          },
          vocabularyFile: "vocabulary.json",
          puzzles: [{ id: "one", label: "Bulmaca 1", file: "puzzles/one.json" }],
        }),
      },
      {
        ok: true,
        json: async () => ({
          schemaVersion: 2,
          version: "abc",
          language: "tr",
          normalization: "tr-modern-lower-nfc-v1",
          vocabularyPolicy: "zeyrek-tr-reviewed-v1",
          keyEncoding: "plain",
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
    assert.equal(result.collectionRoot, "/base/data/collections/embeddingmagibu-768-tr-v1");
    assert.deepEqual(requested, [
      "/base/data/collections/embeddingmagibu-768-tr-v1/collection.json",
      "/base/data/collections/embeddingmagibu-768-tr-v1/vocabulary.json",
    ]);
  });

  it("rejects a manifest that disagrees with its catalog entry", async () => {
    mock.method(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({ schemaVersion: 2, id: "other", language: "tr", puzzles: [{}] }),
    }) as Response);
    await assert.rejects(loadCollection("/data", summary), /invalid or empty/);
  });

  it("rejects unsupported or remote-code-enabled extractors", async () => {
    mock.method(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        schemaVersion: 2,
        id: summary.id,
        language: summary.language,
        extractor: {
          id: "embeddingmagibu",
          prompt: "task: sentence similarity | query: ",
          dimensions: 768,
          trustRemoteCode: true,
        },
        puzzles: [{}],
      }),
    }) as Response);
    await assert.rejects(loadCollection("/data", summary), /invalid or empty/);
  });

  it("reports unsuccessful puzzle requests", async () => {
    mock.method(globalThis, "fetch", async () => ({ ok: false, status: 404 }) as Response);
    await assert.rejects(loadPuzzle("/data", "missing.json"), /404/);
  });

  it("loads categorized puzzle schema version 2", async () => {
    const puzzle = {
      schemaVersion: 2,
      vocabularyVersion: "abc",
      targetKey: "violin",
      category: "object",
      scores: [10_000],
      topIndices: [0],
    };
    mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => puzzle }) as Response);
    assert.deepEqual(await loadPuzzle("/data", "puzzles/0.json"), puzzle);
  });

  it("rejects unsupported puzzle schemas and categories", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () => ({ ok: true, json: async () => ({ schemaVersion: 3 }) }) as Response,
    );
    await assert.rejects(loadPuzzle("/data", "future.json"), /not supported/);

    mock.restoreAll();
    mock.method(
      globalThis,
      "fetch",
      async () => ({ ok: true, json: async () => ({ schemaVersion: 2, category: "abstract" }) }) as Response,
    );
    await assert.rejects(loadPuzzle("/data", "invalid.json"), /not supported/);
  });
});
