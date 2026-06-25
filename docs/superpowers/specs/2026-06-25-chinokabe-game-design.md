# Chinokabe — Design Spec

**Date:** 2026-06-25
**Status:** Approved (design); ready for implementation planning

## Summary

Chinokabe is a browser-based rhythm game inspired by the "human-shaped wall" /
"Brain Wall" (Nokabe) format. A choreographed sequence of target poses arrives
on the beat of a music track, with the tempo accelerating over the run. The
player's webcam pose is detected on-device and scored live against each target
pose. At the end of the run the player gets a total score and accuracy, sees a
filmstrip of the frames captured on each beat, and can save the score to a
local leaderboard.

Everything runs client-side. There is no backend in v1.

## Goals

- Fun, fair, low-latency pose-matching rhythm gameplay in the browser.
- Works on a normal laptop with a webcam, no install.
- Two play modes so anyone can play regardless of their available space:
  - **Upper-body** — head, torso, arms only; sit or stand close to the camera.
  - **Full-body** — includes legs; player stands back so the whole body is in frame.
- A score model and storage layer shaped so an online leaderboard can be added
  later without reworking gameplay.

## Non-Goals (v1)

- Online leaderboard / accounts (designed-for, not built — see Future Work).
- End-of-run vision-AI commentary on the player's best pose (easy add later).
- Multiple tracks.
- Procedural / randomly generated poses.

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Form factor | Web app (browser, webcam) | Easiest to share via URL; online leaderboard natural later. |
| Scoring engine | On-device pose detection | Instant, free, private, no network lag on the beat. |
| Pose model | MediaPipe Pose Landmarker (33 landmarks) | Current Google model, in-browser via WebGL, rich signal for both modes. |
| Shape definition | Hand-authored pose set | Predictable difficulty, easy to tune. |
| Body coverage | Two selectable modes (upper / full) | Players pick what fits their space. |
| Game loop | Fixed choreographed level/song, accelerating | Authored sequence; tempo acceleration baked into beat timing. |
| Leaderboard | Local-only (localStorage) v1 | Lean; storage layer shaped for online swap later. |
| Stack | Vite + TypeScript + MediaPipe | Leanest, lowest latency, full control of the frame loop. No UI framework. |
| Rendering | Single `<canvas>` for gameplay; HTML for screens | Tight hot loop, simple menus. |

## Architecture

All client-side. The **audio track is the single source of truth for timing**
(the beat clock), so scoring and rendering stay in sync with the music even if
the frame rate dips.

### Modules

Each module has one responsibility and a clean interface.

| Module | Responsibility | Depends on |
|---|---|---|
| `camera` | Acquire webcam stream; expose video element + frame grabs | browser MediaDevices |
| `pose` | Wrap MediaPipe Pose Landmarker; per frame → normalized 33-keypoint pose | camera |
| `poses/` (content) | Hand-authored target poses as reference signatures, tagged `upper`/`full` | — |
| `levels/` (content) | A level = ordered list of `{ poseId, beatTime }`, accelerating; one per mode | poses |
| `scoring` | Compare a live pose signature to a target signature → 0–100 fit | pose, poses |
| `audio` | Play track; expose precise playback time as the beat clock | browser Audio |
| `capture` | On each beat, grab the current webcam frame ("screenshot on the beat") | camera |
| `engine` | Game loop: audio clock drives beats, requests captures, scores, accumulates, ends run | level, scoring, pose, audio, capture |
| `render` | Draw webcam, target-pose overlay/ghost, countdown, score popups on canvas | engine, pose |
| `ui` | HTML screens: menu, mode select, calibration, results, leaderboard | engine, storage |
| `storage` | Read/write local scores (localStorage); shaped for easy online swap later | — |

## Data Model

### Pose signature (scale- & position-invariant)

Raw landmark coordinates depend on where the player stands and on body size, so
they are **not** compared directly. Instead, both the live pose and every
authored target pose are reduced to the same **signature**:

- A set of **joint angles** (e.g. left/right elbow, shoulders, hips, knees).
- **Normalized limb directions** (unit vectors for each tracked limb).

This makes matching robust to camera distance and body proportions, which is
essential for fairness. Upper-body signatures use the arm/torso/head subset;
full-body signatures additionally include hips/knees/legs.

### Target pose

```
Pose {
  id: string
  mode: "upper" | "full"
  signature: Signature   // joint angles + normalized limb directions
  label: string          // e.g. "T-pose", "star", "one leg up"
}
```

Authored via a small dev-only **"record pose" tool**: stand in the pose, snap,
it writes the signature JSON into the pose library.

### Level

```
Level {
  mode: "upper" | "full"
  trackId: string
  beats: Array<{ poseId: string, beatTime: number }>  // beatTime in seconds
}
```

Accelerating tempo is expressed purely in the data: the gaps between
consecutive `beatTime` values shrink toward the end of the track. No special
runtime logic.

### Score record (storage)

```
ScoreRecord {
  name: string
  mode: "upper" | "full"
  score: number
  accuracy: number       // 0–1
  bestCombo: number
  createdAt: number       // epoch ms
}
```

Stored in localStorage. The `storage` interface (e.g. `addScore`,
`topScores(mode)`) is the seam where an online backend later swaps in.

## Game Flow (per beat)

1. Audio clock crosses a beat's `beatTime`.
2. `capture` grabs the current webcam frame (kept for the end-of-run recap).
3. `pose` reads the landmarks for the relevant frame(s) → live signature.
4. `scoring` compares live vs target signature → **0–100 fit**.
5. `engine` adds it to the running total; `render` shows a popup
   (Perfect / Good / Miss) and updates the score bar and combo.

### Scoring math

- Per relevant joint: angular error → similarity (small error ≈ 100, large
  error ≈ 0).
- Average across the joints that matter for that pose, **weighted** toward the
  pose's defining limbs.
- **Best-frame-in-window:** a short timing window around each beat is sampled
  and the player's best frame in that window is used, so honest hits a few ms
  early/late are not punished.
- **Final score** = sum of per-beat fits, plus an **accuracy %** and a
  **perfect-streak combo multiplier** for flair.

## Screens

1. **Menu** — title, Play, Leaderboard, How-to.
2. **Mode select** — Upper-body or Full-body, with a "stand back" hint for full-body.
3. **Calibration** — webcam preview; confirms the relevant body is detected and
   well-lit before the run; 3-2-1 countdown.
4. **Play** — webcam + target-pose ghost/silhouette overlay, beat indicators,
   live score, combo, music.
5. **Results** — final score, accuracy %, best combo, filmstrip of on-beat
   captures, save-score name field → local leaderboard, replay / change mode.
6. **Leaderboard** — top local scores per mode.

## Error Handling

- **Camera permission denied / no camera** → clear message + retry; cannot
  enter Play.
- **Pose model fails to load** (CDN/WASM) → friendly error + retry.
- **Body not detected / low visibility mid-run** → that beat scores 0 and a
  subtle "can't see you" warning shows; no crash.
- **Frame-rate dips** → audio clock stays authoritative; timing never drifts.
- **localStorage unavailable** (private mode) → game still plays; leaderboard
  doesn't persist, with a note shown.

## Content Scope (v1)

- One music track.
- Two authored levels (one per mode).
- Starter pose library of ~10–12 poses per mode.

More tracks/poses are pure content additions afterward.

## Testing Strategy

- **Unit (pure logic, headless, TDD):**
  - Signature derivation from landmarks.
  - Angular scoring (known poses → expected scores).
  - Best-frame-in-window selection.
  - Level timing / acceleration.
  - Leaderboard sort / insert / cap.
- **Manual / integration (in-browser):** camera + MediaPipe + audio sync;
  calibration; full run feel. Hard to automate meaningfully.
- Approach: TDD on the pure modules (`scoring`, `levels`, `storage`); manual
  verification for the media-bound modules (`camera`, `pose`, `audio`, `render`).

## Future Work

- Online leaderboard + optional accounts (swap `storage` for a backend, e.g.
  Supabase).
- End-of-run vision-AI commentary on the player's best captured pose.
- Additional tracks, larger pose libraries.
- Adaptive framing mode (auto-pick poses to whatever body is visible).
