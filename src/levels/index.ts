import { type Beat, type Level, type Mode } from "../types";
import { posesForMode } from "../poses";

interface BuildOpts {
  id: string;
  mode: Mode;
  trackId: string;
  poseIds: string[];
  holdBeats: number;
  startSecPerBeat: number;
  endSecPerBeat: number;
  leadInSeconds?: number;
}

export function buildAcceleratingLevel(opts: BuildOpts): Level {
  const { poseIds, holdBeats, startSecPerBeat, endSecPerBeat } = opts;
  const n = poseIds.length;
  const beats: Beat[] = [];
  let t = opts.leadInSeconds ?? startSecPerBeat * 2;
  for (let i = 0; i < n; i++) {
    beats.push({ poseId: poseIds[i], beatTime: t });
    const frac = n <= 1 ? 0 : i / (n - 1);
    const secPerBeat = startSecPerBeat + (endSecPerBeat - startSecPerBeat) * frac;
    t += holdBeats * secPerBeat;
  }
  return { id: opts.id, mode: opts.mode, trackId: opts.trackId, beats };
}

// Repeat the mode's pose list to a fixed length so the authored level has a clear arc.
function sequence(mode: Mode, length: number): string[] {
  const ids = posesForMode(mode).map((p) => p.id);
  return Array.from({ length }, (_, i) => ids[i % ids.length]);
}

export const LEVELS: Record<Mode, Level> = {
  upper: buildAcceleratingLevel({
    id: "upper-default", mode: "upper", trackId: "default",
    poseIds: sequence("upper", 16),
    holdBeats: 4, startSecPerBeat: 0.63, endSecPerBeat: 0.4, // ~95 -> ~150 BPM
  }),
  full: buildAcceleratingLevel({
    id: "full-default", mode: "full", trackId: "default",
    poseIds: sequence("full", 14),
    holdBeats: 4, startSecPerBeat: 0.7, endSecPerBeat: 0.46, // ~85 -> ~130 BPM
  }),
};
