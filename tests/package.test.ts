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
const packageMetadata = JSON.parse(
  readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
) as { version: string };

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
    for (const text of ["Ranking:", "cold", "blue", "red", "category hint"]) {
      assert.match(indexHtml, new RegExp(text, "i"));
    }
    assert.doesNotMatch(indexHtml, /Similarity:/);
    assert.doesNotMatch(indexHtml, /id="how-similarity-/);
  });

  it("presents rank without a numeric similarity column", () => {
    const tableHead = indexHtml.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? "";
    const placeholder = indexHtml.match(
      /<tr class="history-placeholder">([\s\S]*?)<\/tr>/,
    )?.[1] ?? "";
    assert.equal(tableHead.match(/<th\b/g)?.length, 2);
    assert.equal(placeholder.match(/<td\b/g)?.length, 2);
    assert.doesNotMatch(indexHtml, /id="similarity-heading"/);
  });

  it("includes a language control and localizable static copy", () => {
    assert.match(indexHtml, /<label[^>]*for="language-select"[^>]*>Language<\/label>/);
    assert.match(indexHtml, /<select id="language-select"[^>]*disabled>/);
    assert.doesNotMatch(indexHtml, /id="language-button"/);
    for (const id of ["tagline", "guess-label", "guesses-heading", "how-summary"]) {
      assert.match(indexHtml, new RegExp(`id="${id}"`));
    }
  });

  it("places live feedback between the guess row and assistance controls", () => {
    assert.match(
      indexHtml,
      /class="guess-row"[\s\S]*?id="status"[^>]*role="status"[^>]*aria-live="polite"[\s\S]*?id="assistance-controls"/,
    );
    assert.equal(indexHtml.match(/id="status"/g)?.length, 1);
  });

  it("includes a collapsed, localizable footer disclosure", () => {
    assert.match(indexHtml, /<footer class="game-footer">/);
    assert.match(indexHtml, /<details class="about">\s*<summary>/);
    assert.doesNotMatch(indexHtml, /<details class="about"[^>]*\sopen(?:[\s>])/);
    for (const id of ["app-version", "about-summary", "about-description"]) {
      assert.match(indexHtml, new RegExp(`id="${id}"`));
    }
    assert.match(indexHtml, /A word guessing game based on word similarities\./);
  });

  it("keeps release metadata synchronized", () => {
    const pyproject = readFileSync(path.join(process.cwd(), "pyproject.toml"), "utf8");
    const changelog = readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8");
    const pipelineVersion = pyproject.match(/^version = "(\d+\.\d+\.\d+)"$/m)?.[1];
    const latestRelease = changelog.match(
      /^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/m,
    )?.[1];
    assert.equal(packageMetadata.version, "1.1.1");
    assert.equal(pipelineVersion, packageMetadata.version);
    assert.equal(latestRelease, packageMetadata.version);
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
      assert.equal(
        manifest.extractor.id,
        collection.language === "tr" ? "word2vec-skipgram" : "embeddinggemma",
      );
      assert.equal(manifest.extractor.trustRemoteCode, false);
      assert.equal(
        manifest.extractor.prompt,
        collection.language === "tr" ? "" : "task: sentence similarity | query: ",
      );
      assert.equal(vocabulary.language, collection.language);
      const expectedPolicy = collection.language === "tr"
        ? "zeyrek-tr-reviewed-word2vec-covered-v1"
        : "wordfreq-surface-v1";
      assert.equal(vocabulary.vocabularyPolicy, expectedPolicy);
      assert.equal(vocabulary.keys.length, collection.language === "tr" ? 12_478 : 30_000);
      if (collection.language === "tr") {
        assert.equal(manifest.extractor.dimensions, 300);
        assert.equal(manifest.extractor.id, "word2vec-skipgram");
        assert.equal(manifest.extractor.kind, "word2vec-binary");
        assert.equal(
          manifest.extractor.artifactSha256,
          "ab24d19b9d811a9636e633710c5bb5b61a85e0cda82e9230fed69f7b684a026f",
        );
        const words = new Set(vocabulary.keys);
        for (const word of [
          "at", "atmak", "yat", "yatmak", "yar", "yarmak", "kaçırmak",
          "hızlı", "açık", "internet", "meraklı", "huzurlu", "neşeli",
          "sarımsaklı", "kaplumbağa", "martı", "pusula", "kayısı", "yayla",
        ]) {
          assert.equal(words.has(word), true, `expected Turkish word: ${word}`);
        }
        for (const word of [
          "kaçıramak", "hızlımak", "açik", "run", "running", "the",
          "evler", "evim", "evdeki",
        ]) {
          assert.equal(words.has(word), false, `unexpected Turkish word: ${word}`);
        }
      }
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

    const turkish = catalog.collections.find((collection) => collection.language === "tr");
    assert.ok(turkish);
    const turkishRoot = path.dirname(path.join(packageRoot, "data", turkish.file));
    const vocabulary = JSON.parse(
      readFileSync(path.join(turkishRoot, "vocabulary.json"), "utf8"),
    ) as VocabularyData;
    const sincap = JSON.parse(
      readFileSync(path.join(turkishRoot, "puzzles/1.json"), "utf8"),
    ) as PuzzleData;
    const neighbors = sincap.topIndices.slice(0, 20).map((index) => vocabulary.keys[index]);
    assert.ok(neighbors.includes("tilki"));
    assert.ok(neighbors.includes("tavşan"));
    assert.equal(neighbors.includes("sin"), false);
  });
});
