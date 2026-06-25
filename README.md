# CHINOKABE — Beat the Wall 🧱

Hole-in-the-wall, but it's your webcam. A pose-shaped "wall" flies at you to the
beat — strike the pose before it locks, and the AI judges your fit.

Built at a 50-min hackathon. **Single file, zero build.** Open `index.html` and play.

## Run it

Camera needs `https` or `localhost`, so serve the folder (don't open via `file://`):

```bash
python3 -m http.server 5173
# then open http://localhost:5173 in Chrome
```

Phone: same network won't get camera over plain http — use a tunnel
(`ngrok http 5173`, `cloudflared tunnel --url http://localhost:5173`) or any https host.

## How it works

| Piece | Tech |
|---|---|
| Pose detection (the "AI judge") | [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe) `PoseLandmarker`, lite model, GPU, in-browser. No key, no cost. |
| Beat / music | WebAudio synth loop (kick/hat/bass) + optional track upload |
| Render | Canvas (mirrored selfie video + skeleton + incoming wall) |

**Matching is upper-body only.** Player landmarks are normalized to a shoulder
frame (origin = shoulder midpoint, scale = shoulder width), so only your torso +
arms need to be in frame. Each pose is a template of target **elbow/wrist**
positions in shoulder-width units. Score = weighted smooth-distance credit
(wrists 0.7, elbows 0.3). `FIT` if score ≥ 0.55.

## Where to tune / extend (`index.html`)

- **Poses** → `POSES[]` — add a pose by giving `le/re/lw/rw` in shoulder units
  (origin = shoulder midpoint, +x right, −y up, 1 unit = shoulder width).
- **Difficulty** → pass threshold `liveScore >= 0.55`; tolerance in `smoothCredit()`.
- **Timing** → tempo + beats-per-pose sliders; logic in `onBeat()`.
- **Scoring** → `matchScore()` weights and the score formula in `onBeat()`.

### Ideas not yet built
- Real silhouette hole-fill judging via `outputSegmentationMasks: true` (score =
  % of body mask inside the hole — more authentic chinokabe).
- 2-player versus (`numPoses: 2`, split screen).
- Beat-synced juice, song BPM detection, leaderboard.
