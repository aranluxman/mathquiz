export async function syncSession(session) {
  try {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(session)
    });
    if (!response.ok) throw new Error(`Remote save failed: ${response.status}`);
    return await response.json();
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function loadLeaderboard({ game = "math-sprint", difficulty = "medium", limit = 20 } = {}) {
  try {
    const params = new URLSearchParams({ game, difficulty, limit: String(limit) });
    const response = await fetch(`/api/sessions?${params}`);
    if (!response.ok) throw new Error(`Remote leaderboard failed: ${response.status}`);
    const payload = await response.json();
    return payload.data || [];
  } catch {
    return [];
  }
}
