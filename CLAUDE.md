# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CHINOKABE ("Beat the Wall") — a browser game where a pose-shaped wall flies at you to a beat and you strike the pose before it locks. Pose detection is done in-browser via MediaPipe; the webcam is judged live. No UI framework — Vite + TypeScript, Canvas 2D, WebAudio.

The repo is mid-migration: a working single-file prototype (`prototype.html.bak`) is being ported into modular TypeScript per `docs/superpowers/plans/2026-06-25-chinokabe-game.md`. Read that plan and `docs/superpowers/specs/2026-06-25-chinokabe-game-design.md` before extending the game — they define the target architecture, module boundaries, and authored levels.

## Commands

```bash
npm run dev          # Vite dev server (camera needs https or localhost — never open via file://)
npm run build        # tsc typecheck + vite build
npm run preview      # serve the production build
npm test             # vitest run (headless, one-shot)
npm run test:watch   # vitest in watch mode
npx vitest run tests/scoring.test.ts        # single test file
npx vitest run -t "smoothCredit"            # single test by name
```

## Architecture

Code is split by **testability**, and that split is the most important convention to preserve:

- **Pure modules** (`signature.ts`, `scoring.ts`, `poses/`, `levels/`, `storage.ts` logic) — no browser APIs, no I/O. These have headless Vitest unit tests (`environment: "node"`). **`Math.random()` and `Date.now()` must not appear here** — pass timestamps/random values in as parameters (see `ScoreRecord.createdAt` in `types.ts`).
- **Media-bound modules** (`camera.ts`, `pose.ts`, `audio.ts`, `capture.ts`, `render.ts`) — thin wrappers over getUserMedia / MediaPipe / WebAudio / Canvas. Verified manually in-browser, not unit-tested.
- **`engine.ts`** drives the game loop and scoring; **`ui.ts`** routes between HTML screens; **`main.ts`** wires it together.

`types.ts` is the shared vocabulary — `LM` maps the MediaPipe landmark indices the game uses; `Signature`/`Pose`/`Beat`/`Level`/`ScoreRecord` are the core shapes.

### Pose matching (the core math — preserve it)

Player landmarks are normalized into a **shoulder frame**: origin = shoulder midpoint, scale = shoulder width, x mirrored for selfie view (`toSignature` in `signature.ts`). A `Pose` is target keypoint positions in those shoulder-width units, so matching is position- and scale-invariant. Two modes: `upper` (torso + arms) and `full` (adds knees/ankles). Joints below 0.4 visibility are dropped.

Scoring baseline carried over from the prototype — do not silently change these without intent: weighted smooth-distance credit (wrists 0.7, elbows 0.3), FIT threshold `score >= 0.55`, combo score `100 + round(fit*100) + combo*10`. The **WebAudio clock is the single source of truth for timing** — beat dispatch keys off it, not `requestAnimationFrame` or wall-clock.

## Deployment context

- Target domain: **chinokabe.com**, hosted on Cloudflare.
- v1 is **fully client-side, no backend.** The leaderboard lives in `localStorage` behind `storage.ts`, which is deliberately the *only* module that touches persistence — shaped so a remote backend can replace it later.
- **Cloudflare D1** (SQLite) is the intended future home for the online leaderboard. When that lands, it should sit behind the existing `storage.ts` seam (or a sibling that implements the same interface) — keep persistence out of `engine.ts`/`ui.ts`.
