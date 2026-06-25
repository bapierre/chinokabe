import { LM, type Landmarks, type Mode, type Signature, type Vec2 } from "./types";

const UPPER_INDICES = [
  LM.nose, LM.leftShoulder, LM.rightShoulder,
  LM.leftElbow, LM.rightElbow, LM.leftWrist, LM.rightWrist,
  LM.leftHip, LM.rightHip,
];
const FULL_EXTRA = [LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle];

export function toSignature(lm: Landmarks, width: number, height: number, mode: Mode): Signature | null {
  const vis = (i: number) => lm[i]?.visibility ?? 1;
  // mirror x for selfie space, matching the prototype
  const px = (i: number): Vec2 => [(1 - lm[i].x) * width, lm[i].y * height];

  if (vis(LM.leftShoulder) < 0.4 || vis(LM.rightShoulder) < 0.4) return null;

  const ls = px(LM.leftShoulder);
  const rs = px(LM.rightShoulder);
  const origin: Vec2 = [(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2];
  const scale = Math.hypot(ls[0] - rs[0], ls[1] - rs[1]) || 1;

  const indices = mode === "full" ? [...UPPER_INDICES, ...FULL_EXTRA] : UPPER_INDICES;
  const pts: Record<number, Vec2> = {};
  for (const i of indices) {
    if (vis(i) < 0.4) continue; // skip joints we can't see
    const p = px(i);
    pts[i] = [(p[0] - origin[0]) / scale, (p[1] - origin[1]) / scale];
  }
  return { pts, scale, origin };
}
