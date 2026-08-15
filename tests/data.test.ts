import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { loadCollection, loadPuzzle } from "../src/data";

afterEach(() => {
  mock.restoreAll();
});

describe("data loading", () => {
  it("loads a collection and resolves its vocabulary relative to the data root", async () => {
    const responses = [
      {
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          extractor: {},
          vocabularyFile: "vocabulary.json",
          puzzles: [{ id: "one", label: "Puzzle 1", file: "puzzles/one.json" }],
        }),
      },
      {
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          version: "abc",
          keyEncoding: "plain",
          keys: ["word"],
        }),
      },
    ];
    const requested: string[] = [];
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      requested.push(String(input));
      return responses.shift() as Response;
    });

    const result = await loadCollection("/base/data/");
    assert.deepEqual(result.vocabulary.keys, ["word"]);
    assert.deepEqual(requested, ["/base/data/collection.json", "/base/data/vocabulary.json"]);
  });

  it("reports unsuccessful puzzle requests", async () => {
    mock.method(globalThis, "fetch", async () => ({ ok: false, status: 404 }) as Response);
    await assert.rejects(loadPuzzle("/data", "missing.json"), /404/);
  });

  it("rejects unsupported puzzle schemas", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () => ({ ok: true, json: async () => ({ schemaVersion: 2 }) }) as Response,
    );
    await assert.rejects(loadPuzzle("/data", "future.json"), /not supported/);
  });
});
