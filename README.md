# CHINOKABE — Beat the Wall 🧱

Hole-in-the-wall, but it's your webcam. A pose-shaped "wall" flies at you to the
beat — strike the pose before it locks, and the AI judges your fit. Global
leaderboard included.

Single-page game + a tiny Cloudflare serverless backend. No VPS.

## Run locally (game only)

The camera needs `https` or `localhost`, so serve the folder (don't open `file://`):

```bash
python3 -m http.server 5173   # → http://localhost:5173
```

The leaderboard will show "offline" locally unless you run the Cloudflare dev
server (below).

## How it works

| Piece | Tech |
|---|---|
| Pose detection (the "AI judge") | [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe) `PoseLandmarker`, lite model, **on-device** in the browser. No key, no quota, no cost. |
| Beat / music | WebAudio synth loop (kick/hat/bass) + optional track upload |
| Render | Canvas (mirrored selfie video + skeleton + incoming wall) |
| Leaderboard | Cloudflare **Pages Function** (`functions/api/scores.js`) + **D1** (SQLite at the edge) |

**Matching is upper-body only.** Player landmarks are normalized to a shoulder
frame (origin = shoulder midpoint, scale = shoulder width), so only torso + arms
need to be in frame. Each pose is a template of target **elbow/wrist** positions
in shoulder-width units. Score = weighted smooth-distance credit (wrists 0.7,
elbows 0.3). `FIT` if score ≥ 0.55. A round = N poses, then the score is submitted.

## Deploy to Cloudflare (static + leaderboard, no VPS)

Prereqs: a Cloudflare account. One-time auth is interactive.

```bash
npm install                                   # gets wrangler
npx wrangler login                            # opens browser (interactive)

# 1. create the leaderboard DB, then paste the printed database_id into wrangler.toml
npx wrangler d1 create chinokabe-scores

# 2. create the tables on the REMOTE db
npx wrangler d1 execute chinokabe-scores --remote --file=schema.sql

# 3. deploy (static files + the /api function)
npx wrangler pages deploy . --project-name chinokabe
```

Then in the Cloudflare dashboard → **Pages → chinokabe → Settings**:
- **Functions → D1 bindings**: add binding `DB` → `chinokabe-scores` (if not already
  picked up from `wrangler.toml`).

### Connect chinokabe.com

The domain must be a **zone on this same Cloudflare account** (so Pages can manage the
apex record):

1. Cloudflare dashboard → **Add a site** → `chinokabe.com` → it shows two nameservers.
2. At your registrar, set the domain's **nameservers** to those two. Wait for it to go
   "Active" (minutes to a few hours).
3. **Pages → chinokabe → Custom domains → Set up a domain** → add `chinokabe.com`
   **and** `www.chinokabe.com`. Cloudflare creates the records and TLS cert automatically.
4. Optional: a redirect rule `www.chinokabe.com/*` → `https://chinokabe.com/$1` (or vice
   versa) so there's one canonical host.

HTTPS is automatic — no cert work. After this, the game + leaderboard are live at
`https://chinokabe.com`, including the camera (secure context) and `/api/scores`.

### Recommended: auto-deploy from GitHub
In the dashboard, **Pages → Create → Connect to Git → `bapierre/chinokabe`**. Every
push to `main` redeploys. Add the D1 binding + custom domain once, same as above.

### Local full-stack dev (with the leaderboard)
```bash
npx wrangler d1 execute chinokabe-scores --local --file=schema.sql
npx wrangler pages dev .                       # serves game + /api on localhost
```

## API

`functions/api/scores.js` (bound to D1 as `DB`):

- `GET /api/scores` → top 20 `[{name, score, fits, total, created_at}]`
- `POST /api/scores` `{name, score, fits, total}` → `{ok, rank, players}`
  - name sanitized to ≤12 safe chars; score validated `0..5,000,000`.

## Tuning / extending (`index.html`)

- **Poses** → `POSES[]` — add one with `le/re/lw/rw` in shoulder units
  (origin = shoulder midpoint, +x right, −y up, 1 unit = shoulder width).
- **Difficulty** → pass threshold `liveScore >= 0.55`; tolerance in `smoothCredit()`.
- **Timing / round length** → tempo, beats-per-pose, poses-per-round sliders; logic in `onBeat()`.

### Production note
The MediaPipe model + wasm currently load from Google's CDN / jsDelivr. To remove the
third-party dependency (and survive networks that block googleapis), self-host the
`.task` model and the `tasks-vision/wasm` folder in this repo and point
`FilesetResolver` / `modelAssetPath` at the local paths.

### Ideas not yet built
- Real silhouette hole-fill judging via `outputSegmentationMasks: true`.
- 2-player versus (`numPoses: 2`, split screen).
- Anti-cheat: server-side rate limiting per IP; signed score tokens.
