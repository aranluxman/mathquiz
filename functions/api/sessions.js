const FALLBACK_SUPABASE_URL = "https://zciulgqkqusjxomyapcz.supabase.co";
const FALLBACK_SUPABASE_KEY = "sb_publishable_t3LKmsyqW22dT4ZMlKWQkg_UIyTziIe";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });

const cleanSession = (payload) => ({
  device_id: String(payload.device_id || "anonymous").slice(0, 80),
  game_id: String(payload.game_id || "math-sprint").slice(0, 40),
  mode: String(payload.mode || "timed").slice(0, 40),
  difficulty: String(payload.difficulty || "medium").slice(0, 40),
  time_limit: Number.isFinite(payload.time_limit) ? payload.time_limit : null,
  score: Math.max(0, Math.round(Number(payload.score || 0))),
  solved: Math.max(0, Math.round(Number(payload.solved || 0))),
  attempts: Math.max(0, Math.round(Number(payload.attempts || 0))),
  accuracy_pct: Math.max(0, Math.min(100, Number(payload.accuracy_pct || 0))),
  avg_time_secs: payload.avg_time_secs == null ? null : Number(payload.avg_time_secs),
  fastest_time_secs: payload.fastest_time_secs == null ? null : Number(payload.fastest_time_secs),
  max_streak: Math.max(0, Math.round(Number(payload.max_streak || 0))),
  duration_secs: payload.duration_secs == null ? null : Number(payload.duration_secs),
  metadata: typeof payload.metadata === "object" && payload.metadata ? payload.metadata : {}
});

export async function onRequestOptions() {
  return json({});
}

export async function onRequestPost({ request, env }) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_KEY;

  try {
    const payload = cleanSession(await request.json());
    const response = await fetch(`${url}/rest/v1/arcade_sessions`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    if (!response.ok) {
      return json({ ok: false, error: text || "Supabase insert failed" }, 502);
    }

    return json({ ok: true, data: text ? JSON.parse(text) : null });
  } catch (error) {
    return json({ ok: false, error: error.message }, 400);
  }
}

export async function onRequestGet({ request, env }) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_KEY;
  const params = new URL(request.url).searchParams;
  const game = params.get("game") || "math-sprint";
  const difficulty = params.get("difficulty") || "medium";
  const limit = Math.min(50, Math.max(5, Number(params.get("limit") || 20)));
  const query = new URLSearchParams({
    select: "created_at,device_id,game_id,mode,difficulty,time_limit,score,solved,accuracy_pct,max_streak",
    game_id: `eq.${game}`,
    difficulty: `eq.${difficulty}`,
    order: "score.desc,created_at.desc",
    limit: String(limit)
  });

  try {
    const response = await fetch(`${url}/rest/v1/arcade_sessions?${query}`, {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`
      }
    });
    const text = await response.text();
    if (!response.ok) return json({ ok: false, error: text || "Supabase read failed" }, 502);
    return json({ ok: true, data: JSON.parse(text || "[]") });
  } catch (error) {
    return json({ ok: false, error: error.message }, 400);
  }
}
