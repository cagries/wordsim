import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import type { CollectionManifest } from "../src/types";

const packageRoot = path.join(process.cwd(), "wordsim");
const indexHtml = readFileSync(path.join(packageRoot, "index.html"), "utf8");

describe("standalone package", () => {
  it("uses only directory-relative runtime references", () => {
    assert.match(indexHtml, /href="\.\/app\.css"/);
    assert.match(indexHtml, /src="\.\/app\.js"/);
    assert.match(indexHtml, /data-data-root="\.\/data"/);
    assert.match(indexHtml, /class="home-link" href="\.\.\/"/);
  });

  it("does not depend on Jekyll processing", () => {
    assert.match(indexHtml, /^<!doctype html>/);
    assert.doesNotMatch(indexHtml, /\{[{%]/);
  });

  it("reserves one invisible history row before the first result", () => {
    assert.match(indexHtml, /id="history-section"[\s\S]*?aria-hidden="true"[\s\S]*?data-empty="true"/);
    assert.match(indexHtml, /<tr class="history-placeholder">/);
    assert.doesNotMatch(indexHtml, /id="history-section"[^>]*\shidden(?:[\s>])/);
  });

  it("includes a collapsed, native how-to-play disclosure", () => {
    assert.match(indexHtml, /<details class="how-to-play">\s*<summary>How to play\??<\/summary>/);
    assert.doesNotMatch(indexHtml, /<details class="how-to-play"[^>]*\sopen(?:[\s>])/);
    for (const text of ["Similarity:", "Ranking:", "cold", "category hint"]) {
      assert.match(indexHtml, new RegExp(text, "i"));
    }
  });

  it("contains every runtime file referenced by the collection", () => {
    for (const file of ["app.js", "app.css", "data/collection.json"]) {
      assert.equal(statSync(path.join(packageRoot, file)).isFile(), true);
    }

    const manifest = JSON.parse(
      readFileSync(path.join(packageRoot, "data/collection.json"), "utf8"),
    ) as CollectionManifest;
    assert.equal(statSync(path.join(packageRoot, "data", manifest.vocabularyFile)).isFile(), true);
    assert.equal(manifest.puzzles.length, 50);
    for (const puzzle of manifest.puzzles) {
      assert.equal(statSync(path.join(packageRoot, "data", puzzle.file)).isFile(), true);
    }
  });
});
