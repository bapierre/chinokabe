import { LM, type Mode, type Pose, type Vec2 } from "../types";

// Upper-body templates ported from the prototype (units = shoulder width,
// origin = shoulder midpoint, +x selfie-right, -y up).
const upper = (
  id: string, name: string,
  le: Vec2, re: Vec2, lw: Vec2, rw: Vec2,
): Pose => ({
  id, name, mode: "upper",
  targets: {
    [LM.leftElbow]: le, [LM.rightElbow]: re,
    [LM.leftWrist]: lw, [LM.rightWrist]: rw,
  },
});

const UPPER: Pose[] = [
  upper("t-pose",   "T-POSE",     [-1.25, 0],     [1.25, 0],      [-2.0, 0],      [2.0, 0]),
  upper("hands-up", "HANDS UP",   [-0.5, -0.75],  [0.5, -0.75],   [-0.5, -1.5],   [0.5, -1.5]),
  upper("victory",  "VICTORY V",  [-1.03, -0.53], [1.03, -0.53],  [-1.56, -1.06], [1.56, -1.06]),
  upper("cactus",   "CACTUS",     [-1.25, 0],     [1.25, 0],      [-1.25, -0.75], [1.25, -0.75]),
  upper("arms-down","ARMS DOWN",  [-0.72, 0.72],  [0.72, 0.72],   [-0.94, 1.44],  [0.94, 1.44]),
  upper("diag-r",   "DIAGONAL ↗", [-1.02, 0.53],  [1.03, -0.53],  [-1.55, 1.06],  [1.56, -1.06]),
  upper("diag-l",   "DIAGONAL ↖", [-1.03, -0.53], [1.02, 0.53],   [-1.56, -1.06], [1.55, 1.06]),
];

// Full-body templates: arms as above plus legs. Hips sit ~1.35 below shoulders.
const full = (
  id: string, name: string,
  le: Vec2, re: Vec2, lw: Vec2, rw: Vec2,
  lk: Vec2, rk: Vec2, la: Vec2, ra: Vec2,
): Pose => ({
  id, name, mode: "full",
  targets: {
    [LM.leftElbow]: le, [LM.rightElbow]: re,
    [LM.leftWrist]: lw, [LM.rightWrist]: rw,
    [LM.leftKnee]: lk, [LM.rightKnee]: rk,
    [LM.leftAnkle]: la, [LM.rightAnkle]: ra,
  },
});

const FULL: Pose[] = [
  full("star",      "STAR JUMP",  [-1.25, -0.4], [1.25, -0.4], [-2.0, -0.9], [2.0, -0.9],
                                  [-0.9, 2.4],   [0.9, 2.4],   [-1.4, 3.3],  [1.4, 3.3]),
  full("stand-t",   "T STANCE",   [-1.25, 0],    [1.25, 0],    [-2.0, 0],    [2.0, 0],
                                  [-0.35, 2.4],  [0.35, 2.4],  [-0.35, 3.4], [0.35, 3.4]),
  full("left-kick", "LEFT KICK",  [-0.6, 0.6],   [0.6, 0.6],   [-0.9, 1.3],  [0.9, 1.3],
                                  [-1.1, 1.9],   [0.35, 2.4],  [-1.7, 1.4],  [0.35, 3.4]),
  full("right-kick","RIGHT KICK", [-0.6, 0.6],   [0.6, 0.6],   [-0.9, 1.3],  [0.9, 1.3],
                                  [-0.35, 2.4],  [1.1, 1.9],   [-0.35, 3.4], [1.7, 1.4]),
  full("lunge",     "LUNGE",      [-1.25, 0],    [1.25, 0],    [-1.6, -0.6], [1.6, -0.6],
                                  [-1.1, 2.3],   [0.7, 2.6],   [-1.6, 3.3],  [0.9, 3.4]),
  full("hands-up-f","REACH UP",   [-0.5, -0.75], [0.5, -0.75], [-0.5, -1.5], [0.5, -1.5],
                                  [-0.35, 2.4],  [0.35, 2.4],  [-0.35, 3.4], [0.35, 3.4]),
];

export const POSES: Pose[] = [...UPPER, ...FULL];

export function posesForMode(mode: Mode): Pose[] {
  return POSES.filter((p) => p.mode === mode);
}

export function poseById(id: string): Pose {
  const p = POSES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown pose id: ${id}`);
  return p;
}
