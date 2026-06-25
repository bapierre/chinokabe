import { describe, it, expect } from "vitest";
import { toSignature } from "../src/signature";
import { LM, type Landmarks } from "../src/types";

function lm(width = 1000, height = 1000): Landmarks {
  const arr: Landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  // shoulders at y=0.5, separated by 0.2 of width => shoulder width = 200px
  arr[LM.leftShoulder]  = { x: 0.6, y: 0.5, z: 0, visibility: 1 }; // mirrored later
  arr[LM.rightShoulder] = { x: 0.4, y: 0.5, z: 0, visibility: 1 };
  // a wrist straight out to the (selfie) left at one shoulder-width above
  arr[LM.leftWrist]     = { x: 0.7, y: 0.5, z: 0, visibility: 1 };
  return arr;
}

describe("toSignature", () => {
  it("returns null when a shoulder is not visible", () => {
    const arr = lm();
    arr[LM.leftShoulder].visibility = 0.1;
    expect(toSignature(arr, 1000, 1000, "upper")).toBeNull();
  });

  it("places the shoulder midpoint at the origin (normalized ~0)", () => {
    const sig = toSignature(lm(), 1000, 1000, "upper")!;
    const [mx, my] = sig.pts[LM.leftShoulder];
    // left shoulder is half a shoulder-width from midpoint on the x axis
    expect(Math.abs(Math.abs(mx) - 0.5)).toBeLessThan(0.05);
    expect(Math.abs(my)).toBeLessThan(0.05);
  });

  it("normalizes distances in shoulder-width units", () => {
    const sig = toSignature(lm(), 1000, 1000, "upper")!;
    expect(sig.scale).toBeCloseTo(200, 0); // 0.2 * 1000
  });

  it("omits leg points in upper mode and includes them in full mode", () => {
    const arr = lm();
    arr[LM.leftAnkle] = { x: 0.55, y: 0.9, z: 0, visibility: 1 };
    expect(toSignature(arr, 1000, 1000, "upper")!.pts[LM.leftAnkle]).toBeUndefined();
    expect(toSignature(arr, 1000, 1000, "full")!.pts[LM.leftAnkle]).toBeDefined();
  });
});
