import { describe, it, expect } from "vitest";
import { matchScore, smoothCredit, FIT_THRESHOLD } from "../src/scoring";
import { LM, type Pose, type Signature } from "../src/types";

const pose: Pose = {
  id: "t", name: "T", mode: "upper",
  targets: {
    [LM.leftWrist]: [-2, 0], [LM.rightWrist]: [2, 0],
    [LM.leftElbow]: [-1.25, 0], [LM.rightElbow]: [1.25, 0],
  },
};

function sigAt(pts: Record<number, [number, number]>): Signature {
  return { pts, scale: 200, origin: [0, 0] };
}

describe("smoothCredit", () => {
  it("is 1 at zero distance and 0 past 1.6 units", () => {
    expect(smoothCredit(0)).toBeCloseTo(1, 5);
    expect(smoothCredit(2)).toBe(0);
  });
  it("is monotonically non-increasing", () => {
    expect(smoothCredit(0.2)).toBeGreaterThan(smoothCredit(0.8));
  });
});

describe("matchScore", () => {
  it("returns 0 for a null signature", () => {
    expect(matchScore(null, pose)).toBe(0);
  });
  it("scores a perfect match near 1", () => {
    const s = matchScore(sigAt({
      [LM.leftWrist]: [-2, 0], [LM.rightWrist]: [2, 0],
      [LM.leftElbow]: [-1.25, 0], [LM.rightElbow]: [1.25, 0],
    }), pose);
    expect(s).toBeGreaterThan(0.95);
    expect(s).toBeGreaterThan(FIT_THRESHOLD);
  });
  it("scores a far-off pose near 0", () => {
    const s = matchScore(sigAt({
      [LM.leftWrist]: [2, 0], [LM.rightWrist]: [-2, 0],
      [LM.leftElbow]: [1.25, 0], [LM.rightElbow]: [-1.25, 0],
    }), pose);
    expect(s).toBeLessThan(FIT_THRESHOLD);
  });
  it("treats missing joints as zero credit", () => {
    const s = matchScore(sigAt({ [LM.leftWrist]: [-2, 0] }), pose); // only one of four joints
    expect(s).toBeLessThan(0.5);
  });
});
