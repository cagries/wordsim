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
      TRANSLATIONS.en.rankedStatus("tiger", 184),
      "“tiger” · #184",
    );
    assert.equal(
      TRANSLATIONS.en.coldStatus("apple"),
      "“apple” · cold",
    );
    assert.equal(TRANSLATIONS.en.solvedStatus("answer"), "Solved! “answer” · #1");
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
    assert.equal(TRANSLATIONS.tr.solvedStatus("cevap"), "Çözdün! “cevap” · #1");
  });
});
