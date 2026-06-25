// tests/levels.test.ts
import { describe, it, expect } from "vitest";
import { buildAcceleratingLevel, LEVELS } from "../src/levels";

describe("buildAcceleratingLevel", () => {
  const lvl = buildAcceleratingLevel({
    id: "x", mode: "upper", trackId: "t",
    poseIds: ["a", "b", "c", "d"],
    holdBeats: 4, startSecPerBeat: 1.0, endSecPerBeat: 0.5,
  });

  it("creates one beat per pose id, in order", () => {
    expect(lvl.beats.map((b) => b.poseId)).toEqual(["a", "b", "c", "d"]);
  });

  it("beat times strictly increase", () => {
    for (let i = 1; i < lvl.beats.length; i++) {
      expect(lvl.beats[i].beatTime).toBeGreaterThan(lvl.beats[i - 1].beatTime);
    }
  });

  it("accelerates: later gaps are smaller than earlier gaps", () => {
    const gaps = lvl.beats.slice(1).map((b, i) => b.beatTime - lvl.beats[i].beatTime);
    expect(gaps[gaps.length - 1]).toBeLessThan(gaps[0]);
  });
});

describe("LEVELS", () => {
  it("provides a non-empty level for each mode with matching mode tag", () => {
    expect(LEVELS.upper.beats.length).toBeGreaterThan(0);
    expect(LEVELS.full.beats.length).toBeGreaterThan(0);
    expect(LEVELS.upper.mode).toBe("upper");
    expect(LEVELS.full.mode).toBe("full");
  });
});
