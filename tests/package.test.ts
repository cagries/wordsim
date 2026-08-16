import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import type {
  CollectionCatalog,
  CollectionManifest,
  PuzzleData,
  VocabularyData,
} from "../src/types";

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
    assert.match(indexHtml, /<details class="how-to-play">\s*<summary id="how-summary">How to play\??<\/summary>/);
    assert.doesNotMatch(indexHtml, /<details class="how-to-play"[^>]*\sopen(?:[\s>])/);
    for (const text of ["Similarity:", "Ranking:", "cold", "category hint"]) {
      assert.match(indexHtml, new RegExp(text, "i"));
    }
  });

  it("includes a language control and localizable static copy", () => {
    assert.match(indexHtml, /<label[^>]*for="language-select"[^>]*>Language<\/label>/);
    assert.match(indexHtml, /<select id="language-select"[^>]*disabled>/);
    assert.doesNotMatch(indexHtml, /id="language-button"/);
    for (const id of ["tagline", "guess-label", "guesses-heading", "how-summary"]) {
      assert.match(indexHtml, new RegExp(`id="${id}"`));
    }
  });

  it("contains every runtime file referenced by every catalog collection", () => {
    for (const file of ["app.js", "app.css", "data/catalog.json"]) {
      assert.equal(statSync(path.join(packageRoot, file)).isFile(), true);
    }

    const catalog = JSON.parse(
      readFileSync(path.join(packageRoot, "data/catalog.json"), "utf8"),
    ) as CollectionCatalog;
    assert.equal(catalog.collections.length, 2);
    assert.equal(catalog.defaultCollectionId, "embeddinggemma-768-en-v1");

    for (const collection of catalog.collections) {
      const manifestPath = path.join(packageRoot, "data", collection.file);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CollectionManifest;
      const collectionRoot = path.dirname(manifestPath);
      const vocabularyPath = path.join(collectionRoot, manifest.vocabularyFile);
      const vocabulary = JSON.parse(readFileSync(vocabularyPath, "utf8")) as VocabularyData;
      assert.equal(manifest.id, collection.id);
      assert.equal(manifest.language, collection.language);
      assert.equal(vocabulary.language, collection.language);
      assert.equal(vocabulary.keys.length, 30_000);
      assert.equal(manifest.puzzles.length, 50);
      for (const puzzle of manifest.puzzles) {
        const puzzlePath = path.join(collectionRoot, puzzle.file);
        assert.equal(statSync(puzzlePath).isFile(), true);
        const data = JSON.parse(readFileSync(puzzlePath, "utf8")) as PuzzleData;
        assert.equal(data.vocabularyVersion, vocabulary.version);
        assert.equal(data.scores.length, vocabulary.keys.length);
        assert.equal(data.topIndices.length, 1_000);
        assert.equal(vocabulary.keys[data.topIndices[0]], data.targetKey);
        assert.equal(data.scores[data.topIndices[0]], 10_000);
      }
    }
  });
});
