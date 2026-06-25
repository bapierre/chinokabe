import { LM, type Pose, type Signature, type Vec2 } from "./types";

export const FIT_THRESHOLD = 0.55;

/** Default per-joint weights. Wrists dominate; elbows matter; legs count in full mode. */
export const WEIGHTS: Record<number, number> = {
  [LM.leftWrist]: 1.0, [LM.rightWrist]: 1.0,
  [LM.leftElbow]: 0.45, [LM.rightElbow]: 0.45,
  [LM.leftAnkle]: 0.9, [LM.rightAnkle]: 0.9,
  [LM.leftKnee]: 0.4, [LM.rightKnee]: 0.4,
};

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** shoulder-width units: 0 -> 1 credit, >= 1.6 -> 0, smoothstep between (ported from prototype). */
export function smoothCredit(d: number): number {
  const t = Math.max(0, Math.min(1, (1.6 - d) / 1.2));
  return t * t * (3 - 2 * t);
}

export function matchScore(sig: Signature | null, pose: Pose): number {
  if (!sig) return 0;
  let weighted = 0;
  let totalWeight = 0;
  for (const key of Object.keys(pose.targets)) {
    const i = Number(key);
    const w = WEIGHTS[i] ?? 0.5;
    totalWeight += w;
    const have = sig.pts[i];
    const credit = have ? smoothCredit(dist(have, pose.targets[i])) : 0;
    weighted += w * credit;
  }
  return totalWeight === 0 ? 0 : weighted / totalWeight;
}
