export type Mode = "upper" | "full";

export type Vec2 = [number, number];

export interface Landmark {
  x: number; // 0..1, normalized to image width
  y: number; // 0..1, normalized to image height
  z: number;
  visibility?: number;
}
export type Landmarks = Landmark[]; // MediaPipe gives 33 entries

/** Scale- and position-invariant pose, anchored at shoulder midpoint, sized by shoulder width.
 *  x is mirrored for selfie view. pts maps a landmark index to its normalized position. */
export interface Signature {
  pts: Record<number, Vec2>;
  scale: number;   // shoulder width in pixels (for reference / debugging)
  origin: Vec2;    // shoulder midpoint in pixels
}

export interface Pose {
  id: string;
  name: string;
  mode: Mode;
  /** target normalized positions keyed by MediaPipe landmark index */
  targets: Record<number, Vec2>;
}

export interface Beat {
  poseId: string;
  beatTime: number; // seconds from level start
}

export interface Level {
  id: string;
  mode: Mode;
  trackId: string;
  beats: Beat[];
}

export interface ScoreRecord {
  name: string;
  mode: Mode;
  score: number;
  accuracy: number; // 0..1
  bestCombo: number;
  createdAt: number; // epoch ms (passed in, never generated inside pure code)
}

/** MediaPipe landmark indices we use. */
export const LM = {
  nose: 0,
  leftShoulder: 11, rightShoulder: 12,
  leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16,
  leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28,
} as const;
