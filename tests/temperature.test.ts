import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { temperatureForRank } from "../src/temperature";

describe("temperatureForRank", () => {
  it("maps cold and cool ranks", () => {
    assert.equal(temperatureForRank(null), "cold");
    assert.equal(temperatureForRank(1_000), "cool");
    assert.equal(temperatureForRank(501), "cool");
    assert.equal(temperatureForRank(500), "mild");
    assert.equal(temperatureForRank(251), "mild");
  });

  it("maps neutral and warm ranks", () => {
    assert.equal(temperatureForRank(250), "neutral");
    assert.equal(temperatureForRank(101), "neutral");
    assert.equal(temperatureForRank(100), "warm");
    assert.equal(temperatureForRank(21), "warm");
  });

  it("maps hot ranks and the answer", () => {
    assert.equal(temperatureForRank(20), "hot");
    assert.equal(temperatureForRank(11), "hot");
    assert.equal(temperatureForRank(10), "very-hot");
    assert.equal(temperatureForRank(2), "very-hot");
    assert.equal(temperatureForRank(1), "answer");
  });
});
