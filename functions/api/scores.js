// Cloudflare Pages Function — global leaderboard API
// GET  /api/scores        -> top 20 scores
// POST /api/scores  {name, score, fits, total} -> { ok, rank, players }
// Bind a D1 database as `DB` (see wrangler.toml).

const MAX_SCORE = 5_000_000;        // sanity ceiling, rejects garbage submissions
const TOP_N = 20;

function cleanName(n) {
  return (n ?? 'ANON')
    .toString()
    .replace(/[^\p{L}\p{N} _\-!?.]/gu, '')   // letters/numbers + a few symbols
    .trim()
    .slice(0, 12) || 'ANON';
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
  });

export function onRequestOptions() {
  return new Response(null, { headers: cors });
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT name, score, fits, total, created_at
         FROM scores
        ORDER BY score DESC, created_at ASC
        LIMIT ?`
    ).bind(TOP_N).all();
    return json(results ?? []);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid json' }, 400); }

  const name = cleanName(body.name);
  const score = Math.floor(Number(body.score));
  let total = Math.max(0, Math.floor(Number(body.total) || 0));
  let fits = Math.max(0, Math.floor(Number(body.fits) || 0));
  if (fits > total) fits = total;

  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
    return json({ error: 'invalid score' }, 400);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO scores (name, score, fits, total, created_at) VALUES (?,?,?,?,?)`
    ).bind(name, score, fits, total, Date.now()).run();

    const rankRow = await env.DB.prepare(
      `SELECT COUNT(*) + 1 AS rank FROM scores WHERE score > ?`
    ).bind(score).first();
    const playersRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM scores`
    ).first();

    return json({ ok: true, rank: rankRow.rank, players: playersRow.n });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
