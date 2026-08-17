import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRANSLATIONS } from "../src/i18n";

describe("guess feedback translations", () => {
  it("explains the temperature scale in both languages", () => {
    assert.match(TRANSLATIONS.en.howRankingText, /blue .* red/);
    assert.match(TRANSLATIONS.tr.howRankingText, /mavi .* kırmızı/);
  });

  it("formats compact English results", () => {
    assert.equal(
      TRANSLATIONS.en.rankedStatus("tiger", "72.46", 184),
      "“tiger” · 72.46 · #184",
    );
    assert.equal(
      TRANSLATIONS.en.coldStatus("apple", "28.13"),
      "“apple” · 28.13 · cold",
    );
    assert.equal(TRANSLATIONS.en.solvedStatus("answer"), "Solved! “answer” · 100.00 · #1");
  });

  it("formats compact Turkish results", () => {
    assert.equal(
      TRANSLATIONS.tr.rankedStatus("kaplan", "72.46", 184),
      "“kaplan” · 72.46 · #184",
    );
    assert.equal(
      TRANSLATIONS.tr.coldStatus("elma", "28.13"),
      "“elma” · 28.13 · uzak",
    );
    assert.equal(TRANSLATIONS.tr.solvedStatus("cevap"), "Çözdün! “cevap” · 100.00 · #1");
  });
});
