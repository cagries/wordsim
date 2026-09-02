import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRANSLATIONS } from "../src/i18n";

describe("guess feedback translations", () => {
  it("localizes the descriptive document title", () => {
    assert.equal(TRANSLATIONS.en.documentTitle, "wordsim - word similarity guessing game");
    assert.equal(TRANSLATIONS.tr.documentTitle, "wordsim - kelime benzerliği tahmin oyunu");
  });

  it("localizes the changelog footer label", () => {
    assert.equal(TRANSLATIONS.en.changelog, "Changelog");
    assert.equal(TRANSLATIONS.tr.changelog, "Değişiklikler");
  });

  it("localizes the technical article footer label", () => {
    assert.equal(TRANSLATIONS.en.howItWorks, "How does it work?");
    assert.equal(TRANSLATIONS.tr.howItWorks, "Nasıl çalışır?");
  });

  it("localizes category selection and the expanded categories", () => {
    assert.equal(TRANSLATIONS.en.anything, "Anything");
    assert.equal(TRANSLATIONS.tr.anything, "Herhangi");
    assert.equal(TRANSLATIONS.en.categories.occupation, "Occupation");
    assert.equal(TRANSLATIONS.tr.categories.occupation, "Meslek");
    assert.equal(TRANSLATIONS.en.categories.clothing, "Clothing");
    assert.equal(TRANSLATIONS.tr.categories.clothing, "Giyim");
  });

  it("provides a five-step localized tutorial", () => {
    assert.equal(TRANSLATIONS.en.tutorialSlides.length, 5);
    assert.equal(TRANSLATIONS.tr.tutorialSlides.length, 5);
    assert.match(TRANSLATIONS.en.tutorialSlides[1].text, /cold, blue/);
    assert.match(TRANSLATIONS.en.tutorialSlides[3].text, /Redder colors/);
    assert.match(TRANSLATIONS.tr.tutorialSlides[1].text, /Mavi ve uzak/);
    assert.match(TRANSLATIONS.tr.tutorialSlides[3].text, /Kırmızıya/);
    assert.equal(TRANSLATIONS.en.tutorialSlides.at(-1)?.rows[0].rank, 1);
    assert.equal(TRANSLATIONS.tr.tutorialSlides.at(-1)?.rows[0].rank, 1);
  });

  it("uses tutorial answers that are not live puzzle targets", async () => {
    const { readFileSync } = await import("node:fs");
    const targets = new Set(
      ["en", "tr"].flatMap((language) => (
        JSON.parse(readFileSync(`pipeline/targets/${language}.json`, "utf8")) as { word: string }[]
      ).map((target) => target.word)),
    );
    assert.equal(targets.has("planet"), false);
    assert.equal(targets.has("okyanus"), false);
  });

  it("formats compact English results", () => {
    assert.equal(
      TRANSLATIONS.en.rankedStatus("tiger", 184),
      "“tiger” · #184",
    );
    assert.equal(
      TRANSLATIONS.en.coldStatus("apple"),
      "“apple” · cold",
    );
    assert.equal(TRANSLATIONS.en.solvedStatus("answer"), "Great job! “answer” · #1");
  });

  it("formats compact Turkish results", () => {
    assert.equal(
      TRANSLATIONS.tr.rankedStatus("kaplan", 184),
      "“kaplan” · #184",
    );
    assert.equal(
      TRANSLATIONS.tr.coldStatus("elma"),
      "“elma” · uzak",
    );
    assert.equal(TRANSLATIONS.tr.solvedStatus("cevap"), "Tebrikler! “cevap” · #1");
  });
});
