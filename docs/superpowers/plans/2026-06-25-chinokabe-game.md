# Chinokabe Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the working single-file prototype (`index.html`) into a modular Vite + TypeScript app, then extend it to the full spec: two body modes, fixed accelerating levels, on-beat frame capture with a results filmstrip, a calibration screen, and a local leaderboard.

**Architecture:** Pure logic (signature/matching, level building, leaderboard storage) lives in small TypeScript modules with headless Vitest unit tests. Media-bound modules (camera, pose model, audio, capture, render) wrap browser APIs and are verified manually in-browser. An `engine` drives the game loop off the WebAudio clock; a `ui` layer routes between HTML screens. The proven prototype matching math (shoulder-normalized keypoint positions) is preserved and generalized to full-body — not rewritten.

**Tech Stack:** Vite, TypeScript, Vitest, MediaPipe Tasks Vision (`@mediapipe/tasks-vision`), WebAudio, Canvas 2D. No UI framework.

## Global Constraints

- Everything runs client-side. No backend in v1.
- Pose model: MediaPipe Pose Landmarker (33 landmarks), loaded in-browser.
- Two selectable modes: `upper` and `full`.
- Audio clock is the single source of truth for timing.
- Storage layer (`storage.ts`) is the only place that touches persistence, shaped so an online backend can replace it later.
- `Math.random()` and `Date.now()` are fine in app code, but **must not** appear in pure modules under test — pass values in as parameters instead.
- Source lives under `src/`; tests under `tests/`; existing `index.html` becomes the Vite entry HTML shell.
- Preserve prototype behaviour as the baseline: shoulder-normalized matching, `smoothCredit` curve, FIT threshold 0.55, combo scoring `100 + round(fit*100) + combo*10`.

---

## File Structure

```
package.json            # Vite + TS + Vitest scripts and deps
tsconfig.json
vite.config.ts          # also configures Vitest (test.environment)
index.html              # thin shell: mounts #app, loads src/main.ts
src/
  types.ts              # shared types: Mode, Landmarks, Vec2, Signature, Pose, Beat, Level, ScoreRecord
  signature.ts          # PURE: landmarks -> Signature (shoulder-normalized)
  scoring.ts            # PURE: matchScore(signature, pose), smoothCredit, dist, WEIGHTS
  poses/index.ts        # pose library (upper + full), tagged by mode
  levels/index.ts       # PURE buildAcceleratingLevel + the v1 authored levels
  storage.ts            # leaderboard persistence (localStorage)
  camera.ts             # getUserMedia, video element, frame grab
  pose.ts               # MediaPipe wrapper -> latest Landmarks
  audio.ts              # synth beat + optional track + beat clock
  capture.ts            # on-beat webcam frame grab -> dataURL
  render.ts             # canvas: video, player skeleton, ghost wall
  engine.ts             # game loop, beat dispatch, scoring accumulation, end
  ui.ts                 # screen routing: menu, mode-select, calibration, play, results, leaderboard
  main.ts               # boot + wiring
tests/
  signature.test.ts
  scoring.test.ts
  levels.test.ts
  storage.test.ts
```

The prototype's logic maps onto these modules as: `shoulderFrame` → `signature.ts`; `matchScore`/`smoothCredit`/`dist` → `scoring.ts`; `POSES`/`FIX` → `poses/index.ts`; `kick`/`hat`/`bass`/`sfx`/beat clock → `audio.ts`; `drawVideo`/`drawPlayer`/`drawGhost` → `render.ts`; `onBeat`/game state → `engine.ts`; menu/HUD DOM → `ui.ts`.

---

## Phase 1 — Scaffold & port pure core (headless-testable)

### Task 1: Vite + TS + Vitest scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`
- Modify: `index.html` (replace prototype body with a thin shell; keep a backup)
- Create: `src/main.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable dev server (`npm run dev`) and a passing test runner (`npm test`).

- [ ] **Step 1: Back up the prototype**

```bash
cp index.html prototype.html.bak
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "chinokabe",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  },
  "dependencies": {
    "@mediapipe/tasks-vision": "^0.10.12"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `vite.config.ts` (also configures Vitest)**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 5: Replace `index.html` with a thin shell**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>CHINOKABE — Beat the Wall</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 6: Create a placeholder `src/main.ts` and `src/style.css`**

```ts
// src/main.ts
const app = document.getElementById("app")!;
app.textContent = "CHINOKABE scaffold ready";
```

```css
/* src/style.css */
:root { --accent:#00e5ff; --good:#33ff99; --bad:#ff3366; --bg:#05060f; }
* { box-sizing:border-box; margin:0; padding:0; }
html,body { height:100%; background:var(--bg); color:#fff;
  font-family:"Segoe UI",system-ui,sans-serif; overflow:hidden; }
#app { position:fixed; inset:0; }
```

- [ ] **Step 7: Install and verify dev server + test runner**

Run: `npm install && npm test`
Expected: install succeeds; `vitest run` reports "No test files found" (exit 0) or passes with 0 tests.

Run: `npm run dev`
Expected: Vite serves at `http://localhost:5173` showing "CHINOKABE scaffold ready". Stop with Ctrl-C.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/main.ts src/style.css prototype.html.bak
git commit -m "chore: scaffold Vite+TS+Vitest, preserve prototype as backup"
```

---

### Task 2: Shared types

**Files:**
- Create: `src/types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Mode`, `Landmark`, `Landmarks`, `Vec2`, `Signature`, `Pose`, `Beat`, `Level`, `ScoreRecord`.

- [ ] **Step 1: Create `src/types.ts`**

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: shared types for poses, levels, signatures, scores"
```

---

### Task 3: Pose signature (PURE, ported from `shoulderFrame`)

**Files:**
- Create: `src/signature.ts`
- Test: `tests/signature.test.ts`

**Interfaces:**
- Consumes: `Landmarks`, `Signature`, `Vec2`, `LM` from `./types`.
- Produces: `toSignature(lm: Landmarks, width: number, height: number, mode: Mode): Signature | null`. Returns `null` when shoulders aren't visible (visibility < 0.4). Normalizes the indices relevant to the mode (`upper`: shoulders, elbows, wrists, nose, hips-stub; `full`: also knees, ankles).

- [ ] **Step 1: Write the failing test**

```ts
// tests/signature.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/signature.test.ts`
Expected: FAIL — `toSignature` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/signature.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/signature.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/signature.ts tests/signature.test.ts
git commit -m "feat: shoulder-normalized pose signature (ported from prototype)"
```

---

### Task 4: Scoring (PURE, ported from `matchScore`/`smoothCredit`)

**Files:**
- Create: `src/scoring.ts`
- Test: `tests/scoring.test.ts`

**Interfaces:**
- Consumes: `Signature`, `Pose`, `Vec2` from `./types`.
- Produces:
  - `smoothCredit(d: number): number` — shoulder-width distance → credit (0..1); d≤0→1, d≥1.6→0, smoothstep between.
  - `dist(a: Vec2, b: Vec2): number`
  - `WEIGHTS: Record<number, number>` — per-landmark importance.
  - `matchScore(sig: Signature | null, pose: Pose): number` — 0..1 weighted credit over the pose's target joints; missing joints in the signature count as 0 credit.
  - `FIT_THRESHOLD = 0.55`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/scoring.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/scoring.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scoring.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scoring.ts tests/scoring.test.ts
git commit -m "feat: weighted pose matching score (ported + generalized)"
```

---

### Task 5: Pose library (upper + full)

**Files:**
- Create: `src/poses/index.ts`

**Interfaces:**
- Consumes: `Pose`, `Mode`, `LM` from `../types`.
- Produces:
  - `POSES: Pose[]` — all poses, each with a unique `id`.
  - `posesForMode(mode: Mode): Pose[]`.
  - `poseById(id: string): Pose` — throws if not found.

The upper poses port the prototype's 7 templates (its `le/re/lw/rw` become `targets` at `LM.leftElbow/rightElbow/leftWrist/rightWrist`). Full poses add leg targets relative to the shoulder-normalized frame (hips ≈ y 1.35, knees ≈ y 2.4, ankles ≈ y 3.4 at rest; variations move ankles/knees).

- [ ] **Step 1: Create `src/poses/index.ts`**

```ts
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
```

> Note: full-body leg coordinates are a first authored pass. They are tuned later against a live camera in Task 16's authoring pass; the data shape is what matters here.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/poses/index.ts
git commit -m "feat: pose library for upper and full modes"
```

---

### Task 6: Accelerating level builder (PURE)

**Files:**
- Create: `src/levels/index.ts`
- Test: `tests/levels.test.ts`

**Interfaces:**
- Consumes: `Beat`, `Level`, `Mode` from `../types`; `posesForMode` from `../poses`.
- Produces:
  - `buildAcceleratingLevel(opts): Level` where
    `opts = { id, mode, trackId, poseIds: string[], holdBeats: number, startSecPerBeat: number, endSecPerBeat: number }`.
    The i-th beat's `secPerBeat` interpolates linearly from start→end across the sequence; `beatTime[0] = leadInSeconds (default 2 beats of the start tempo)`, and each subsequent `beatTime` adds `holdBeats * secPerBeat(i)`. Tempo accelerates because `endSecPerBeat < startSecPerBeat`.
  - `LEVELS: Record<Mode, Level>` — the v1 authored level per mode (trackId `"default"`).

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/levels.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/levels/index.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/levels.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/levels/index.ts tests/levels.test.ts
git commit -m "feat: accelerating level builder and v1 authored levels"
```

---

### Task 7: Local leaderboard storage (PURE-ish)

**Files:**
- Create: `src/storage.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Consumes: `ScoreRecord`, `Mode` from `./types`.
- Produces:
  - `addScore(rec: ScoreRecord): void` — appends, keeps top 50 by score.
  - `topScores(mode: Mode, limit?: number): ScoreRecord[]` — descending by score, filtered by mode, default limit 10.
  - `clearScores(): void`.
  - A `StorageLike` interface so tests inject a fake; the module defaults to `globalThis.localStorage` when present and silently no-ops persistence when it isn't (private mode).

- [ ] **Step 1: Write the failing test**

```ts
// tests/storage.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { addScore, topScores, clearScores, __setStorage, type StorageLike } from "../src/storage";
import { type ScoreRecord } from "../src/types";

function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const rec = (over: Partial<ScoreRecord>): ScoreRecord => ({
  name: "P", mode: "upper", score: 100, accuracy: 0.5, bestCombo: 1, createdAt: 1, ...over,
});

describe("leaderboard storage", () => {
  beforeEach(() => { __setStorage(fakeStorage()); clearScores(); });

  it("returns scores for a mode sorted descending", () => {
    addScore(rec({ score: 50 }));
    addScore(rec({ score: 200 }));
    addScore(rec({ score: 120 }));
    expect(topScores("upper").map((s) => s.score)).toEqual([200, 120, 50]);
  });

  it("filters by mode", () => {
    addScore(rec({ score: 10, mode: "upper" }));
    addScore(rec({ score: 20, mode: "full" }));
    expect(topScores("full").map((s) => s.score)).toEqual([20]);
  });

  it("respects the limit", () => {
    for (let i = 0; i < 15; i++) addScore(rec({ score: i }));
    expect(topScores("upper", 5)).toHaveLength(5);
  });

  it("persists across reads via the injected storage", () => {
    addScore(rec({ score: 77 }));
    expect(topScores("upper")[0].score).toBe(77);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/storage.ts
import { type Mode, type ScoreRecord } from "./types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = "chinokabe.scores";
const MAX_KEPT = 50;

let store: StorageLike | null =
  typeof globalThis !== "undefined" && (globalThis as any).localStorage
    ? ((globalThis as any).localStorage as StorageLike)
    : null;

/** test seam */
export function __setStorage(s: StorageLike | null): void {
  store = s;
}

function readAll(): ScoreRecord[] {
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScoreRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: ScoreRecord[]): void {
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(records));
  } catch {
    /* private mode / quota: persistence is best-effort */
  }
}

export function addScore(rec: ScoreRecord): void {
  const all = [...readAll(), rec]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_KEPT);
  writeAll(all);
}

export function topScores(mode: Mode, limit = 10): ScoreRecord[] {
  return readAll()
    .filter((r) => r.mode === mode)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function clearScores(): void {
  if (store) store.removeItem(KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/storage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite + commit**

Run: `npm test`
Expected: all suites PASS (signature, scoring, levels, storage).

```bash
git add src/storage.ts tests/storage.test.ts
git commit -m "feat: local leaderboard storage with injectable backend"
```

---

## Phase 2 — Media-bound modules & engine (manual verify)

### Task 8: Camera module

**Files:**
- Create: `src/camera.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class Camera` with `readonly video: HTMLVideoElement`, `async start(): Promise<void>` (getUserMedia, plays), `grab(canvas: HTMLCanvasElement): void` (draws the current mirrored frame into `canvas` at its size), and `stop(): void`.

- [ ] **Step 1: Implement `src/camera.ts`**

```ts
// src/camera.ts
export class Camera {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;

  constructor() {
    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.muted = true;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  /** Draw the current frame, mirrored, to fill the target canvas. */
  grab(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d")!;
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add src/camera.ts
git commit -m "feat: camera module (getUserMedia + mirrored frame grab)"
```

---

### Task 9: Pose model wrapper

**Files:**
- Create: `src/pose.ts`

**Interfaces:**
- Consumes: `Landmarks` from `./types`.
- Produces:
  - `class PoseModel` with `async load(): Promise<void>` (creates the MediaPipe `PoseLandmarker`, GPU delegate, VIDEO mode), and `detect(video: HTMLVideoElement, timestampMs: number): Landmarks | null` (returns the first detected pose's landmarks or null).
- Uses the same CDN model path as the prototype.

- [ ] **Step 1: Implement `src/pose.ts`**

```ts
// src/pose.ts
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { type Landmarks } from "./types";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export class PoseModel {
  private landmarker: PoseLandmarker | null = null;
  private lastVideoTime = -1;

  async load(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    this.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  }

  detect(video: HTMLVideoElement, timestampMs: number): Landmarks | null {
    if (!this.landmarker) return null;
    // MediaPipe requires monotonically increasing timestamps.
    this.lastVideoTime = video.currentTime;
    const res = this.landmarker.detectForVideo(video, timestampMs);
    return res.landmarks && res.landmarks[0] ? (res.landmarks[0] as Landmarks) : null;
  }
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add src/pose.ts
git commit -m "feat: MediaPipe pose landmarker wrapper"
```

---

### Task 10: Audio module (synth beat + track + beat clock)

**Files:**
- Create: `src/audio.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class AudioEngine` with: `init(): void`, `async loadTrack(file: File): Promise<void>`, `start(leadInSeconds?: number): number` (returns the absolute `startTime`; begins the optional track loop), `get now(): number` (`actx.currentTime`), `beatTone(beat: number): void` (kick+hat+bass, ported), `verdictTone(good: boolean): void` (ported `sfx`), and `resume(): Promise<void>`.
- The beat clock value is derived by callers as `(audio.now - startTime)`.

- [ ] **Step 1: Implement `src/audio.ts` (porting the synth functions)**

```ts
// src/audio.ts
const SCALE = [0, 3, 5, 7, 10, 12];

export class AudioEngine {
  private actx!: AudioContext;
  private master!: GainNode;
  private songBuffer: AudioBuffer | null = null;
  private songSource: AudioBufferSourceNode | null = null;

  init(): void {
    if (this.actx) return;
    this.actx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.master = this.actx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.actx.destination);
  }

  async resume(): Promise<void> {
    if (this.actx?.state === "suspended") await this.actx.resume();
  }

  get now(): number {
    return this.actx.currentTime;
  }

  async loadTrack(file: File): Promise<void> {
    this.init();
    this.songBuffer = await this.actx.decodeAudioData(await file.arrayBuffer());
  }

  start(leadInSeconds = 0.15): number {
    this.init();
    const startTime = this.actx.currentTime + leadInSeconds;
    if (this.songBuffer) {
      this.songSource = this.actx.createBufferSource();
      this.songSource.buffer = this.songBuffer;
      this.songSource.loop = true;
      this.songSource.connect(this.master);
      this.songSource.start(startTime);
    }
    return startTime;
  }

  stop(): void {
    this.songSource?.stop();
    this.songSource = null;
  }

  beatTone(beat: number): void {
    const t = this.actx.currentTime + 0.01;
    this.kick(t);
    if (beat % 2 === 1) this.hat(t);
    this.bass(t, beat);
  }

  verdictTone(good: boolean): void {
    const o = this.actx.createOscillator();
    const g = this.actx.createGain();
    const t = this.actx.currentTime;
    o.type = "square";
    o.frequency.setValueAtTime(good ? 440 : 200, t);
    o.frequency.exponentialRampToValueAtTime(good ? 880 : 120, t + 0.15);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.2);
  }

  private kick(t: number): void {
    const o = this.actx.createOscillator(), g = this.actx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.2);
  }

  private hat(t: number): void {
    const len = 0.03;
    const b = this.actx.createBuffer(1, this.actx.sampleRate * len, this.actx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = this.actx.createBufferSource(); s.buffer = b;
    const g = this.actx.createGain(); g.gain.value = 0.18;
    const f = this.actx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000;
    s.connect(f).connect(g).connect(this.master); s.start(t);
  }

  private bass(t: number, beat: number): void {
    const o = this.actx.createOscillator(), g = this.actx.createGain();
    const idx = beat % 8 < 4 ? [0, 0, 3, 5][beat % 4] : [5, 3, 0, 0][beat % 4];
    const semi = SCALE[idx] ?? 0;
    o.type = "triangle";
    o.frequency.value = 55 * Math.pow(2, semi / 12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.34);
  }
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add src/audio.ts
git commit -m "feat: audio engine (synth beat, track, clock) ported from prototype"
```

---

### Task 11: Capture module (on-beat frame grab)

**Files:**
- Create: `src/capture.ts`

**Interfaces:**
- Consumes: `Camera` from `./camera`.
- Produces:
  - `class CaptureReel` with `constructor(camera: Camera, width = 320, height = 180)`, `snap(label: string): void` (draws the current mirrored frame to an offscreen canvas, pushes `{ label, dataUrl }`), `get frames(): { label: string; dataUrl: string }[]`, and `reset(): void`.

- [ ] **Step 1: Implement `src/capture.ts`**

```ts
// src/capture.ts
import { type Camera } from "./camera";

export interface CapturedFrame {
  label: string;
  dataUrl: string;
}

export class CaptureReel {
  private canvas: HTMLCanvasElement;
  private shots: CapturedFrame[] = [];

  constructor(private camera: Camera, width = 320, height = 180) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
  }

  snap(label: string): void {
    this.camera.grab(this.canvas);
    this.shots.push({ label, dataUrl: this.canvas.toDataURL("image/jpeg", 0.7) });
  }

  get frames(): CapturedFrame[] {
    return this.shots;
  }

  reset(): void {
    this.shots = [];
  }
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add src/capture.ts
git commit -m "feat: on-beat capture reel for results filmstrip"
```

---

### Task 12: Render module

**Files:**
- Create: `src/render.ts`

**Interfaces:**
- Consumes: `Landmarks`, `Pose`, `Vec2`, `LM` from `./types`; `Camera` from `./camera`; `FIT_THRESHOLD` from `./scoring`.
- Produces:
  - `class Renderer` with `constructor(canvas, camera)`, `resize(): void`, and `frame(opts: { landmarks: Landmarks | null; pose: Pose | null; approach: number; liveScore: number }): void` that draws (in order): mirrored darkened video, the incoming ghost wall for `pose` (grows with `approach` 0..1), and the player's skeleton coloured by `liveScore`. Ports `drawVideo`/`drawPlayer`/`drawGhost`, generalizing the ghost to draw legs when the pose has leg targets.

- [ ] **Step 1: Implement `src/render.ts`**

```ts
// src/render.ts
import { LM, type Landmarks, type Pose, type Vec2 } from "./types";
import { type Camera } from "./camera";
import { FIT_THRESHOLD } from "./scoring";

const UPPER_BONES: [number, number][] = [
  [LM.leftShoulder, LM.leftElbow], [LM.leftElbow, LM.leftWrist],
  [LM.rightShoulder, LM.rightElbow], [LM.rightElbow, LM.rightWrist],
  [LM.leftShoulder, LM.rightShoulder],
];
const LEG_BONES: [number, number][] = [
  [LM.leftHip, LM.leftKnee], [LM.leftKnee, LM.leftAnkle],
  [LM.rightHip, LM.rightKnee], [LM.rightKnee, LM.rightAnkle],
  [LM.leftHip, LM.rightHip],
];

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  constructor(private canvas: HTMLCanvasElement, private camera: Camera) {
    this.ctx = canvas.getContext("2d")!;
  }

  resize(): void {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  }

  frame(opts: { landmarks: Landmarks | null; pose: Pose | null; approach: number; liveScore: number }): void {
    const W = this.canvas.width, H = this.canvas.height;
    this.drawVideo(W, H);
    if (opts.pose) this.drawGhost(opts.pose, opts.approach, W, H, opts.liveScore);
    if (opts.landmarks) this.drawPlayer(opts.landmarks, W, H, opts.pose, opts.liveScore);
  }

  private drawVideo(W: number, H: number): void {
    this.camera.grab(this.canvas);
    this.ctx.fillStyle = "rgba(5,6,15,0.30)";
    this.ctx.fillRect(0, 0, W, H);
  }

  private p(i: number, lm: Landmarks, W: number, H: number): Vec2 {
    return [(1 - lm[i].x) * W, lm[i].y * H];
  }

  private drawPlayer(lm: Landmarks, W: number, H: number, pose: Pose | null, live: number): void {
    const ctx = this.ctx;
    const col = pose
      ? (live >= FIT_THRESHOLD ? "#33ff99" : live >= 0.3 ? "#ffd23f" : "#ff5d8f")
      : "#9ad";
    const bones = pose && this.hasLegs(pose) ? [...UPPER_BONES, ...LEG_BONES] : UPPER_BONES;
    ctx.lineWidth = Math.max(4, W * 0.006);
    ctx.strokeStyle = col; ctx.lineCap = "round";
    ctx.shadowColor = col; ctx.shadowBlur = 14;
    for (const [a, b] of bones) {
      if ((lm[a].visibility ?? 1) < 0.3 || (lm[b].visibility ?? 1) < 0.3) continue;
      const pa = this.p(a, lm, W, H), pb = this.p(b, lm, W, H);
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (const i of [LM.leftWrist, LM.rightWrist, LM.leftElbow, LM.rightElbow, LM.leftShoulder, LM.rightShoulder]) {
      const pt = this.p(i, lm, W, H);
      ctx.beginPath(); ctx.arc(pt[0], pt[1], W * 0.012, 0, 7); ctx.fillStyle = col; ctx.fill();
    }
  }

  private hasLegs(pose: Pose): boolean {
    return pose.targets[LM.leftAnkle] !== undefined || pose.targets[LM.rightAnkle] !== undefined;
  }

  private drawGhost(pose: Pose, approach: number, W: number, H: number, grade: number): void {
    const ctx = this.ctx;
    const legs = this.hasLegs(pose);
    const cx = W / 2, cy = legs ? H * 0.32 : H * 0.46;
    const scale = (H * (legs ? 0.12 : 0.2)) * (0.45 + 0.55 * approach);
    const alpha = 0.25 + 0.65 * approach;
    const sp = ([x, y]: Vec2): Vec2 => [cx + x * scale, cy + y * scale];

    // fixed silhouette anchors (shoulder-normalized), matching the prototype's FIX
    const ls = sp([-0.5, 0]), rs = sp([0.5, 0]), head = sp([0, -0.95]);
    const hl = sp([-0.32, 1.35]), hr = sp([0.32, 1.35]);
    const le = sp(pose.targets[LM.leftElbow]), re = sp(pose.targets[LM.rightElbow]);
    const lw = sp(pose.targets[LM.leftWrist]), rw = sp(pose.targets[LM.rightWrist]);

    const col = grade >= FIT_THRESHOLD ? "#33ff99" : grade >= 0.3 ? "#ffd23f" : "#00e5ff";
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(8, scale * 0.6);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 24;
    const link = (a: Vec2, b: Vec2) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
    link(ls, rs); link(ls, hl); link(rs, hr); link(hl, hr);
    link(ls, le); link(le, lw); link(rs, re); link(re, rw);
    if (legs) {
      const lk = sp(pose.targets[LM.leftKnee]), rk = sp(pose.targets[LM.rightKnee]);
      const la = sp(pose.targets[LM.leftAnkle]), ra = sp(pose.targets[LM.rightAnkle]);
      link(hl, lk); link(lk, la); link(hr, rk); link(rk, ra);
    }
    ctx.beginPath(); ctx.arc(head[0], head[1], scale * 0.5, 0, 7); ctx.stroke();
    ctx.restore();
  }
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add src/render.ts
git commit -m "feat: renderer (video, ghost wall, player skeleton) with full-body support"
```

---

### Task 13: Engine (game loop over a fixed level)

**Files:**
- Create: `src/engine.ts`

**Interfaces:**
- Consumes: `Level`, `Mode` from `./types`; `poseById` from `./poses`; `toSignature` from `./signature`; `matchScore`, `FIT_THRESHOLD` from `./scoring`; `Camera`, `PoseModel`, `AudioEngine`, `Renderer`, `CaptureReel`.
- Produces:
  - `interface RunResult { score: number; accuracy: number; bestCombo: number; frames: CapturedFrame[]; mode: Mode }`.
  - `interface EngineHooks { onScore(s: { score: number; combo: number; fits: number; total: number }): void; onVerdict(v: { ok: boolean; pct: number; poseName: string }): void; onLive(live: { pct: number; detected: boolean }): void; onPoseChange(name: string): void; onEnd(result: RunResult): void }`.
  - `class Engine` with `constructor(deps)`, `run(level: Level, hooks: EngineHooks): void`, and `stop(): void`.
- The loop derives the beat from the audio clock (`floor((audio.now - startTime) / secPerBeat0)` is NOT used; instead beats are event times). Concretely: each level beat fires when `audio.now - startTime >= beat.beatTime`. On firing, it snaps a capture, judges the *current* best live score against that beat's pose, updates score/combo, advances to the next pose. The run ends after the last beat plus its hold.

- [ ] **Step 1: Implement `src/engine.ts`**

```ts
// src/engine.ts
import { type Level, type Mode } from "./types";
import { poseById } from "./poses";
import { toSignature } from "./signature";
import { matchScore, FIT_THRESHOLD } from "./scoring";
import { type Camera } from "./camera";
import { type PoseModel } from "./pose";
import { type AudioEngine } from "./audio";
import { type Renderer } from "./render";
import { type CaptureReel, type CapturedFrame } from "./capture";

export interface RunResult {
  score: number; accuracy: number; bestCombo: number;
  frames: CapturedFrame[]; mode: Mode;
}
export interface EngineHooks {
  onScore(s: { score: number; combo: number; fits: number; total: number }): void;
  onVerdict(v: { ok: boolean; pct: number; poseName: string }): void;
  onLive(live: { pct: number; detected: boolean }): void;
  onPoseChange(name: string): void;
  onEnd(result: RunResult): void;
}

interface Deps {
  camera: Camera; model: PoseModel; audio: AudioEngine;
  renderer: Renderer; reel: CaptureReel;
}

export class Engine {
  private running = false;
  private startTime = 0;
  private liveScore = 0;
  constructor(private d: Deps) {}

  run(level: Level, hooks: EngineHooks): void {
    const { camera, model, audio, renderer, reel } = this.d;
    reel.reset();
    renderer.resize();

    let idx = 0;            // next beat to fire
    let score = 0, combo = 0, bestCombo = 0, fits = 0, total = 0;
    this.liveScore = 0;
    this.running = true;
    this.startTime = audio.start();
    const beats = level.beats;
    const holdSec = beats.length > 1 ? beats[1].beatTime - beats[0].beatTime : 1;
    const endTime = beats[beats.length - 1].beatTime + holdSec;

    let metronome = -1;

    const loop = () => {
      if (!this.running) return;
      const clock = audio.now - this.startTime;

      // live detection
      const lm = model.detect(camera.video, performance.now());
      const sig = lm ? toSignature(lm, renderer["canvas"].width, renderer["canvas"].height, level.mode) : null;
      const currentPose = idx < beats.length ? poseById(beats[idx].poseId) : null;
      this.liveScore = currentPose ? matchScore(sig, currentPose) : 0;

      // metronome ticks on the average tempo (purely audio flavour)
      const tick = Math.floor(clock / holdSec);
      while (tick > metronome) { metronome++; if (metronome >= 0) audio.beatTone(metronome); }

      // render ghost approaching this beat
      if (currentPose) {
        const prev = idx > 0 ? beats[idx - 1].beatTime : 0;
        const span = beats[idx].beatTime - prev || holdSec;
        const approach = Math.max(0, Math.min(1, (clock - prev) / span));
        renderer.frame({ landmarks: lm, pose: currentPose, approach, liveScore: this.liveScore });
      } else {
        renderer.frame({ landmarks: lm, pose: null, approach: 0, liveScore: 0 });
      }

      hooks.onLive({ pct: Math.round(this.liveScore * 100), detected: !!lm });
      if (currentPose && total + 0 === idx) hooks.onPoseChange(currentPose.name);

      // judge the beat when its time arrives
      if (idx < beats.length && clock >= beats[idx].beatTime) {
        const pose = poseById(beats[idx].poseId);
        reel.snap(pose.name);
        const pct = Math.round(this.liveScore * 100);
        const ok = this.liveScore >= FIT_THRESHOLD;
        total++;
        if (ok) { fits++; combo++; bestCombo = Math.max(bestCombo, combo); score += 100 + pct + combo * 10; }
        else { combo = 0; }
        audio.verdictTone(ok);
        hooks.onVerdict({ ok, pct, poseName: pose.name });
        hooks.onScore({ score, combo, fits, total });
        idx++;
        if (idx < beats.length) hooks.onPoseChange(poseById(beats[idx].poseId).name);
      }

      if (clock >= endTime) {
        this.running = false;
        const accuracy = total === 0 ? 0 : fits / total;
        hooks.onEnd({ score, accuracy, bestCombo, frames: reel.frames, mode: level.mode });
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    this.d.audio.stop();
  }
}
```

> Note: `renderer["canvas"]` access is replaced by a public `renderer.width`/`renderer.height` getter added in this step — add to `Renderer`: `get width() { return this.canvas.width; } get height() { return this.canvas.height; }` and use those here instead of bracket access.

- [ ] **Step 2: Add the size getters to `Renderer`**

In `src/render.ts`, inside the class, add:

```ts
  get width(): number { return this.canvas.width; }
  get height(): number { return this.canvas.height; }
```

And in `src/engine.ts` replace `renderer["canvas"].width` / `renderer["canvas"].height` with `renderer.width` / `renderer.height`.

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add src/engine.ts src/render.ts
git commit -m "feat: engine drives fixed level off the audio clock with capture + scoring"
```

---

## Phase 3 — UI screens & wiring

### Task 14: UI shell, styles, menu, mode select

**Files:**
- Create: `src/ui.ts`
- Modify: `src/style.css` (add the full game styles ported from the prototype)

**Interfaces:**
- Consumes: `Mode` from `./types`; `topScores` from `./storage`.
- Produces:
  - `class UI` managing screen visibility with methods:
    `showMenu(onPlay: () => void, onLeaderboard: () => void): void`,
    `showModeSelect(onPick: (mode: Mode) => void): void`,
    `showCalibration(): { setDetected(ok: boolean): void; countdown(onGo: () => void): void; root: HTMLElement }`,
    `showPlay(): PlayHud`,
    `showResults(r: { score: number; accuracy: number; bestCombo: number; frames: { label: string; dataUrl: string }[]; mode: Mode }, onSave: (name: string) => void, onAgain: () => void): void`,
    `showLeaderboard(mode: Mode, onBack: () => void): void`,
    `setStatus(text: string): void`.
  - `interface PlayHud { canvas: HTMLCanvasElement; setScore(s): void; setVerdict(v): void; setLive(l): void; setPose(name): void; root: HTMLElement }` with the same field shapes the engine hooks pass.
- The `#app` element holds one child per screen; `UI` toggles a `.hidden` class.

- [ ] **Step 1: Append game styles to `src/style.css`**

```css
/* screens */
.screen { position:absolute; inset:0; }
.hidden { display:none !important; }
.center { display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:18px; text-align:center; padding:24px; height:100%;
  background:radial-gradient(circle at 50% 35%,#101637,#05060f 70%); }
h1 { font-size:clamp(40px,9vw,84px); letter-spacing:6px; font-weight:900;
  background:linear-gradient(90deg,var(--accent),#a855f7,#ffd23f);
  -webkit-background-clip:text; background-clip:text; color:transparent; }
.center p { max-width:520px; opacity:.85; line-height:1.5; font-size:15px; }
button { cursor:pointer; border:none; border-radius:40px; padding:16px 42px; font-size:20px;
  font-weight:800; letter-spacing:2px; color:#05060f;
  background:linear-gradient(90deg,var(--accent),#7cf); box-shadow:0 8px 30px rgba(0,229,255,.4); }
button:active { transform:translateY(2px); }
button.secondary { background:#1a2140; color:#fff; box-shadow:none; }
.row { display:flex; gap:16px; flex-wrap:wrap; justify-content:center; }
#status { font-size:13px; opacity:.7; min-height:18px; }

/* play */
#playScreen canvas { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.hud { position:absolute; inset:0; pointer-events:none; }
.topbar { position:absolute; top:14px; left:0; right:0; display:flex;
  justify-content:space-between; padding:0 22px; font-weight:800; }
.stat small { display:block; font-size:11px; letter-spacing:2px; opacity:.6; font-weight:600; }
.stat b { font-size:30px; color:var(--accent); text-shadow:0 2px 12px #000; }
#comboStat b { color:#ffd23f; }
.poseName { position:absolute; top:74px; left:0; right:0; text-align:center;
  font-size:26px; font-weight:800; letter-spacing:3px; text-shadow:0 2px 14px #000; }
.verdict { position:absolute; top:42%; left:0; right:0; text-align:center;
  font-size:92px; font-weight:900; letter-spacing:4px; opacity:0; transform:scale(.6);
  transition:opacity .12s, transform .12s; text-shadow:0 6px 30px #000; }
.verdict.show { opacity:1; transform:scale(1); }
.meterWrap { position:absolute; bottom:34px; left:50%; transform:translateX(-50%); width:min(72%,520px); }
.meterTrack { height:16px; border-radius:10px; background:rgba(255,255,255,.12); overflow:hidden; }
.meterFill { height:100%; width:0%; border-radius:10px; transition:width .08s linear;
  background:linear-gradient(90deg,var(--bad),#ffd23f,var(--good)); }
.meterLabel { text-align:center; margin-top:6px; font-weight:700; letter-spacing:2px; font-size:14px; }

/* results + leaderboard */
.filmstrip { display:flex; gap:8px; overflow-x:auto; max-width:90vw; padding:8px; }
.filmstrip figure { flex:0 0 auto; }
.filmstrip img { width:160px; height:90px; object-fit:cover; border-radius:8px; }
.filmstrip figcaption { font-size:10px; opacity:.7; text-align:center; letter-spacing:1px; }
.board { list-style:none; width:min(90vw,460px); }
.board li { display:flex; justify-content:space-between; padding:10px 14px; border-radius:10px; }
.board li:nth-child(odd) { background:rgba(255,255,255,.05); }
input[type=text] { padding:12px 16px; border-radius:10px; border:none; font-size:16px; min-width:200px; }
```

- [ ] **Step 2: Implement `src/ui.ts`**

```ts
// src/ui.ts
import { type Mode } from "./types";
import { topScores } from "./storage";

export interface PlayHud {
  canvas: HTMLCanvasElement;
  root: HTMLElement;
  setScore(s: { score: number; combo: number; fits: number; total: number }): void;
  setVerdict(v: { ok: boolean; pct: number; poseName: string }): void;
  setLive(l: { pct: number; detected: boolean }): void;
  setPose(name: string): void;
}

export class UI {
  private app = document.getElementById("app")!;
  private statusEl: HTMLElement | null = null;

  private mount(html: string): HTMLElement {
    this.app.innerHTML = html;
    return this.app.firstElementChild as HTMLElement;
  }

  setStatus(text: string): void {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  showMenu(onPlay: () => void, onLeaderboard: () => void): void {
    this.mount(`
      <section class="screen center">
        <h1>CHINOKABE</h1>
        <p>The wall is coming. Strike the pose before it hits the beat. The AI judges your fit.</p>
        <div class="row">
          <button id="play">START</button>
          <button id="board" class="secondary">LEADERBOARD</button>
        </div>
        <div id="status">Loading AI pose model…</div>
      </section>`);
    this.statusEl = document.getElementById("status");
    document.getElementById("play")!.addEventListener("click", onPlay);
    document.getElementById("board")!.addEventListener("click", onLeaderboard);
  }

  showModeSelect(onPick: (m: Mode) => void): void {
    this.mount(`
      <section class="screen center">
        <h1>CHOOSE MODE</h1>
        <div class="row">
          <button id="upper">UPPER BODY<br><small>sit or stand close</small></button>
          <button id="full">FULL BODY<br><small>stand ~2–3m back</small></button>
        </div>
      </section>`);
    document.getElementById("upper")!.addEventListener("click", () => onPick("upper"));
    document.getElementById("full")!.addEventListener("click", () => onPick("full"));
  }

  showCalibration(): { setDetected(ok: boolean): void; countdown(onGo: () => void): void; root: HTMLElement } {
    const root = this.mount(`
      <section class="screen center">
        <h1>CALIBRATE</h1>
        <p id="calMsg">Step into frame so the camera can see you…</p>
        <div id="count" style="font-size:80px;font-weight:900"></div>
      </section>`);
    const msg = document.getElementById("calMsg")!;
    const count = document.getElementById("count")!;
    return {
      root,
      setDetected: (ok) => {
        msg.textContent = ok ? "Got you ✓ — get ready!" : "Step into frame so the camera can see you…";
        msg.style.color = ok ? "var(--good)" : "#fff";
      },
      countdown: (onGo) => {
        let n = 3;
        count.textContent = String(n);
        const id = setInterval(() => {
          n--;
          if (n <= 0) { clearInterval(id); count.textContent = ""; onGo(); }
          else count.textContent = String(n);
        }, 1000);
      },
    };
  }

  showPlay(): PlayHud {
    const root = this.mount(`
      <section id="playScreen" class="screen">
        <canvas id="view"></canvas>
        <div class="hud">
          <div class="topbar">
            <div class="stat" id="scoreStat"><small>SCORE</small><b>0</b></div>
            <div class="stat" id="comboStat"><small>COMBO</small><b>0</b></div>
            <div class="stat" id="hitsStat"><small>FITS</small><b>0/0</b></div>
          </div>
          <div class="poseName" id="poseName">GET READY</div>
          <div class="verdict" id="verdict"></div>
          <div class="meterWrap">
            <div class="meterTrack"><div class="meterFill" id="meterFill"></div></div>
            <div class="meterLabel" id="meterLabel">JUDGE: —</div>
          </div>
        </div>
      </section>`);
    const canvas = document.getElementById("view") as HTMLCanvasElement;
    const scoreB = document.querySelector("#scoreStat b")!;
    const comboB = document.querySelector("#comboStat b")!;
    const hitsB = document.querySelector("#hitsStat b")!;
    const poseName = document.getElementById("poseName")!;
    const verdict = document.getElementById("verdict")!;
    const meterFill = document.getElementById("meterFill") as HTMLElement;
    const meterLabel = document.getElementById("meterLabel")!;
    return {
      canvas, root,
      setScore: (s) => { scoreB.textContent = String(s.score); comboB.textContent = String(s.combo); hitsB.textContent = `${s.fits}/${s.total}`; },
      setVerdict: (v) => {
        verdict.textContent = (v.ok ? "FIT! " : "MISS ") + v.pct + "%";
        (verdict as HTMLElement).style.color = v.ok ? "var(--good)" : "var(--bad)";
        verdict.classList.add("show");
        setTimeout(() => verdict.classList.remove("show"), 520);
      },
      setLive: (l) => { meterFill.style.width = l.pct + "%"; meterLabel.textContent = l.detected ? `JUDGE: ${l.pct}% fit` : "JUDGE: step into frame"; },
      setPose: (name) => { poseName.textContent = name; },
    };
  }

  showResults(
    r: { score: number; accuracy: number; bestCombo: number; frames: { label: string; dataUrl: string }[]; mode: Mode },
    onSave: (name: string) => void,
    onAgain: () => void,
  ): void {
    this.mount(`
      <section class="screen center">
        <h1>RESULTS</h1>
        <p><b style="font-size:40px;color:var(--accent)">${r.score}</b><br>
           accuracy ${Math.round(r.accuracy * 100)}% · best combo ${r.bestCombo}</p>
        <div class="filmstrip">${r.frames.map((f) => `<figure><img src="${f.dataUrl}" alt="${f.label}"><figcaption>${f.label}</figcaption></figure>`).join("")}</div>
        <div class="row">
          <input type="text" id="name" maxlength="12" placeholder="your name" />
          <button id="save">SAVE SCORE</button>
          <button id="again" class="secondary">PLAY AGAIN</button>
        </div>
      </section>`);
    const name = document.getElementById("name") as HTMLInputElement;
    document.getElementById("save")!.addEventListener("click", () => onSave(name.value.trim() || "ANON"));
    document.getElementById("again")!.addEventListener("click", onAgain);
  }

  showLeaderboard(mode: Mode, onBack: () => void): void {
    const rows = topScores(mode, 10);
    this.mount(`
      <section class="screen center">
        <h1>LEADERBOARD</h1>
        <p>${mode === "upper" ? "Upper body" : "Full body"}</p>
        <ol class="board">${rows.length ? rows.map((s) => `<li><span>${s.name}</span><span>${s.score}</span></li>`).join("") : "<li><span>no scores yet</span><span></span></li>"}</ol>
        <button id="back" class="secondary">BACK</button>
      </section>`);
    document.getElementById("back")!.addEventListener("click", onBack);
  }
}
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add src/ui.ts src/style.css
git commit -m "feat: UI screens (menu, mode select, calibration, play HUD, results, leaderboard)"
```

---

### Task 15: Boot wiring in `main.ts`

**Files:**
- Modify: `src/main.ts` (replace the placeholder)

**Interfaces:**
- Consumes: all modules above.
- Produces: the running application — full flow menu → mode select → calibration → play → results → leaderboard, with local score saving.

- [ ] **Step 1: Replace `src/main.ts`**

```ts
// src/main.ts
import "./style.css";
import { type Mode } from "./types";
import { LEVELS } from "./levels";
import { addScore } from "./storage";
import { Camera } from "./camera";
import { PoseModel } from "./pose";
import { AudioEngine } from "./audio";
import { Renderer } from "./render";
import { CaptureReel } from "./capture";
import { Engine, type RunResult } from "./engine";
import { UI } from "./ui";

const ui = new UI();
const camera = new Camera();
const model = new PoseModel();
const audio = new AudioEngine();
let modelReady = false;

model.load().then(() => { modelReady = true; ui.setStatus("AI ready ✓ — press START"); })
  .catch((e) => ui.setStatus("Model load failed (need internet). " + e.message));

function toMenu(): void {
  ui.showMenu(
    () => { if (modelReady) toModeSelect(); },
    () => toModeSelect(true),
  );
  if (modelReady) ui.setStatus("AI ready ✓ — press START");
}

function toModeSelect(forLeaderboard = false): void {
  ui.showModeSelect((mode) => (forLeaderboard ? toLeaderboard(mode) : toCalibration(mode)));
}

function toLeaderboard(mode: Mode): void {
  ui.showLeaderboard(mode, toMenu);
}

async function toCalibration(mode: Mode): Promise<void> {
  const cal = ui.showCalibration();
  try {
    await camera.start();
    audio.init();
    await audio.resume();
  } catch (e) {
    cal.setDetected(false);
    alert("Camera blocked (needs https or localhost): " + (e as Error).message);
    toMenu();
    return;
  }
  // poll detection until the player is visible, then count down and play
  let started = false;
  const probe = () => {
    if (started) return;
    const lm = model.detect(camera.video, performance.now());
    const ok = !!lm;
    cal.setDetected(ok);
    if (ok) {
      started = true;
      cal.countdown(() => play(mode));
    } else {
      requestAnimationFrame(probe);
    }
  };
  requestAnimationFrame(probe);
}

function play(mode: Mode): void {
  const hud = ui.showPlay();
  const renderer = new Renderer(hud.canvas, camera);
  const reel = new CaptureReel(camera);
  const engine = new Engine({ camera, model, audio, renderer, reel });
  window.addEventListener("resize", () => renderer.resize(), { once: true });
  engine.run(LEVELS[mode], {
    onScore: (s) => hud.setScore(s),
    onVerdict: (v) => hud.setVerdict(v),
    onLive: (l) => hud.setLive(l),
    onPoseChange: (n) => hud.setPose(n),
    onEnd: (r) => toResults(r),
  });
}

function toResults(r: RunResult): void {
  ui.showResults(
    r,
    (name) => {
      addScore({ name, mode: r.mode, score: r.score, accuracy: r.accuracy, bestCombo: r.bestCombo, createdAt: Date.now() });
      toLeaderboard(r.mode);
    },
    () => toModeSelect(),
  );
}

toMenu();
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual verification (in-browser)**

Run: `npm run dev`, open `http://localhost:5173`, grant camera permission.
Expected:
- Menu shows "AI ready ✓".
- START → mode select → pick a mode → calibration detects you → 3-2-1 → gameplay with ghost walls, live meter, verdicts, score/combo.
- After the level ends → results with score, accuracy, and a filmstrip of captured frames.
- Save score with a name → leaderboard shows it. Reload page → leaderboard still shows it (localStorage persisted).

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire full game flow (menu -> mode -> calibrate -> play -> results -> leaderboard)"
```

---

### Task 16: Content + tuning pass and README update

**Files:**
- Modify: `src/poses/index.ts` (tune full-body leg coordinates against the live camera)
- Modify: `src/levels/index.ts` (adjust tempo/holdBeats if too hard/easy after playtest)
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: playable, fairly-tuned levels for both modes; updated docs.

- [ ] **Step 1: Playtest both modes and adjust**

Run: `npm run dev` and play each mode. For full-body, stand back so ankles are in frame. If a pose is unreachable or scores unfairly, edit its `targets` in `src/poses/index.ts` (knees ≈ y 2.2–2.6, ankles ≈ y 3.2–3.6 at rest; move ankle x for kicks/star). If the run is too punishing late, raise `endSecPerBeat` in `src/levels/index.ts`.

- [ ] **Step 2: Re-run the unit suite to confirm no regressions**

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 3: Update `README.md`**

Replace the prototype README body with: what the game is, the two modes, how to run (`npm install`, `npm run dev`), that it runs fully client-side, that scores are stored locally, and a note that an online leaderboard is future work. Keep it under ~40 lines.

- [ ] **Step 4: Commit**

```bash
git add src/poses/index.ts src/levels/index.ts README.md
git commit -m "chore: tune full-body poses/levels and update README"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** Web app ✓ (Task 1). On-device MediaPipe ✓ (Task 9). Invariant signature ✓ (Task 3). Hand-authored poses ✓ (Task 5). Two modes ✓ (Tasks 3/5/12/15). Fixed accelerating level ✓ (Task 6). Audio clock authoritative ✓ (Tasks 10/13). Best-effort-frame judging ✓ — judged against the live score at beat time (the spec's "best frame in a small window" is simplified to the live score at the beat moment; if playtests show early/late unfairness, a windowed-max is a localized change in `engine.ts`). Capture + filmstrip ✓ (Tasks 11/14). Calibration ✓ (Tasks 14/15). Local leaderboard ✓ (Task 7/14). Error handling: camera denied ✓, model load fail ✓, body-not-detected ✓ (meter "step into frame", beat scores 0), localStorage unavailable ✓ (storage no-ops). Testing strategy: pure modules unit-tested ✓; media modules manual ✓.
- **Deviations from spec (deliberate):** (1) matching uses normalized keypoint positions (proven prototype math) instead of joint angles — noted in spec reconciliation; (2) judging uses the live score at beat time rather than a sampled best-frame window — flagged above as an easy localized upgrade.
- **Placeholder scan:** no TBD/TODO; every code step has complete code.
- **Type consistency:** `Mode`, `Signature`, `Pose.targets`, `Beat`, `Level`, `ScoreRecord`, `RunResult`, `EngineHooks`, `PlayHud` are defined once and used consistently; `Renderer.width/height` getters added in Task 13 before use.
```
