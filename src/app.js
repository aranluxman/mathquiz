import {
  ACHIEVEMENTS,
  DIFFICULTIES,
  GAME_MODES,
  ROUND_MODES,
  calculateScore,
  createQuestion,
  createRng,
  getGame,
  gradeFor,
  todaySeed
} from "./games.js";
import {
  evaluateAchievements,
  getDeviceId,
  getMeta,
  loadSessions,
  loadSettings,
  saveSession,
  setMeta,
  summarizeProgress
} from "./storage.js";
import { loadLeaderboard } from "./supabase.js";

const app = document.querySelector("#app");
const state = {
  screen: "home",
  selectedGame: "math-sprint",
  selectedDifficulty: "medium",
  selectedRoundMode: "timed",
  operations: ["add", "sub", "mul", "div"],
  sound: true,
  theme: "dark",
  progress: { sessions: [], totalSolved: 0, totalScore: 0, bestScore: 0, bestStreak: 0, gamesPlayed: 0, level: 1, xp: 0 },
  leaderboard: [],
  leaderboardFilter: { game: "math-sprint", difficulty: "medium" },
  active: null,
  feedback: null,
  achievements: [],
  installPrompt: null,
  hideInstall: localStorage.getItem("mathflow-hide-install") === "true"
};

let timerId;
let audioContext;

const icons = {
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 10-13h-7l1-7Z"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><path d="M6 7h3v3H6V7Zm5 0h3v3h-3V7Zm5 0h3v3h-3V7ZM6 14h3v3H6v-3Zm5 0h3v3h-3v-3Zm5 0h3v3h-3v-3Z"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"/></svg>',
  az: '<svg viewBox="0 0 24 24"><path d="M5 18 9 6h2l4 12h-2l-.8-2.5H7.8L7 18H5Zm3.3-4.3h3.4L10 8.4l-1.7 5.3ZM15 18v-1.5l3.8-5H15V10h6v1.5l-3.8 5H21V18h-6Z"/></svg>',
  tap: '<svg viewBox="0 0 24 24"><path d="M9 11V4a2 2 0 1 1 4 0v7l1.2-1.2a2 2 0 0 1 2.8 0l2.8 2.8-5.2 7.4H8.5L5 14a2 2 0 0 1 3.4-2.1L9 13v-2Z"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M7 4h10v3h3a3 3 0 0 1-3 3h-.4A5 5 0 0 1 13 14.9V18h4v2H7v-2h4v-3.1A5 5 0 0 1 7.4 10H7a3 3 0 0 1-3-3h3V4Z"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M5 20V9h3v11H5Zm6 0V4h3v16h-3Zm6 0v-7h3v7h-3Z"/></svg>',
  user: '<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 1 1 16 0H4Z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5Z"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M11 4h2v8l3-3 1.4 1.4L12 16l-5.4-5.6L8 9l3 3V4ZM5 18h14v2H5v-2Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="m10 6-6 6 6 6 1.4-1.4L7.8 13H20v-2H7.8l3.6-3.6L10 6Z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m9 16.2-3.5-3.5L4 14.2 9 19 20.5 7.5 19 6 9 16.2Z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm12.6 1.4L6.4 19 5 17.6 17.6 5 19 6.4Z"/></svg>'
};

function icon(name) {
  return `<span class="icon">${icons[name] || icons.bolt}</span>`;
}

function vibrate(pattern) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

function playTone(type) {
  if (!state.sound) return;
  audioContext ||= new AudioContext();
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const map = {
    correct: [660, 880, 0.12],
    wrong: [150, 90, 0.16],
    streak: [520, 980, 0.22],
    complete: [440, 880, 0.34],
    toggle: [360, 480, 0.08]
  };
  const [start, end, duration] = map[type] || map.correct;
  oscillator.frequency.setValueAtTime(start, now);
  oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function formatTime(seconds) {
  if (seconds == null) return "--";
  const safe = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return mins ? `${mins}:${String(secs).padStart(2, "0")}` : `0:${String(secs).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function screenFrame(content, { header = true, back = false, title = "" } = {}) {
  return `
    <main class="phone" data-theme="${state.theme}">
      <div class="status-bar"><span>9:41</span><span class="status-icons">▰ ▰ ▰</span></div>
      ${header ? `
        <header class="topbar">
          ${back ? `<button class="icon-button ghost" data-action="go-home" aria-label="Back">${icon("back")}</button>` : `<div class="brand">${icon("grid")} <strong>MathFlow <span>Arcade</span></strong></div>`}
          <h1 class="screen-title">${title}</h1>
          <button class="flame" data-action="toggle-sound" aria-label="Toggle theme and sound">🔥 ${state.progress.bestStreak || 0}</button>
        </header>` : ""}
      ${content}
    </main>
  `;
}

function bottomNav(active = "home") {
  const items = [
    ["home", "Home", "home"],
    ["leaderboard", "Challenges", "trophy"],
    ["stats", "Stats", "chart"],
    ["profile", "Profile", "user"]
  ];
  return `
    <nav class="bottom-nav" aria-label="Main">
      ${items.map(([screen, label, glyph]) => `
        <button class="${active === screen ? "active" : ""}" data-action="nav" data-screen="${screen}">
          ${icon(glyph)}<span>${label}</span>
        </button>`).join("")}
    </nav>
  `;
}

function bestFor(gameId) {
  const sessions = state.progress.sessions.filter((session) => session.game_id === gameId);
  if (!sessions.length) return "--";
  const game = getGame(gameId);
  if (gameId === "reaction-tap") {
    const fastest = sessions.reduce((best, session) => Math.min(best, Number(session.avg_time_secs || 99)), 99);
    return `${fastest.toFixed(2)}s`;
  }
  return Math.max(...sessions.map((session) => Number(session.score || 0))).toLocaleString();
}

function renderHome() {
  const dailyDone = state.progress.sessions.some((session) => session.mode === "daily" && session.metadata?.daily === todaySeed());
  const content = `
    ${!state.hideInstall ? `
      <section class="install-card">
        <div class="install-icon">${icon("download")}</div>
        <div><strong>Install MathFlow Arcade</strong><span>Add to your home screen for the best experience.</span></div>
        <button class="primary small" data-action="install">Install</button>
        <button class="mini-close" data-action="hide-install" aria-label="Hide install prompt">${icon("close")}</button>
      </section>` : ""}

    <section class="daily-card">
      <div class="card-meta"><span>Daily Challenge</span><span>${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>
      <div class="daily-layout">
        <div>
          <h2>Number Flow</h2>
          <p>Solve 15 problems in 90 seconds</p>
          <div class="progress-row"><strong>${dailyDone ? "15" : "9"} / 15</strong><span><i style="width:${dailyDone ? 100 : 60}%"></i></span></div>
        </div>
        <div class="timer-ring"><strong>90</strong><span>sec</span></div>
      </div>
      <div class="split-actions">
        <button class="primary" data-action="start-daily">${dailyDone ? "Replay Challenge" : "Continue Challenge"}</button>
        <button class="secondary" data-action="new-challenge">New Challenge</button>
      </div>
    </section>

    <section class="section-head"><h2>Game Modes</h2><button data-action="nav" data-screen="leaderboard">See All</button></section>
    <section class="game-list">
      ${GAME_MODES.map((game) => `
        <article class="game-row" style="--accent:${game.accent}">
          <div class="game-icon">${icon(game.icon)}</div>
          <div class="game-copy"><strong>${game.name}</strong><span>${game.description}</span></div>
          <div class="best"><span>Best</span><strong>${bestFor(game.id)}</strong></div>
          <button class="play-button" data-action="select-game" data-game="${game.id}" aria-label="Play ${game.name}">${icon("play")}</button>
        </article>
      `).join("")}
    </section>

    <section class="section-head"><h2>Your Progress</h2><span class="sync-label">◆ Supabase</span></section>
    <section class="progress-cards">
      <article><span>🔥 Streak</span><strong>${state.progress.bestStreak}</strong><small>Best combo</small></article>
      <article><span>🏆 Total Score</span><strong>${state.progress.totalScore.toLocaleString()}</strong><small>All time</small></article>
      <article><span>🎮 Games Played</span><strong>${state.progress.sessions.length}</strong><small>Sessions</small></article>
    </section>
    ${bottomNav("home")}
  `;
  app.innerHTML = screenFrame(content);
}

function renderSetup() {
  const game = getGame(state.selectedGame);
  const content = `
    <section class="setup-hero" style="--accent:${game.accent}">
      <div class="game-icon large">${icon(game.icon)}</div>
      <h2>${game.name}</h2>
      <p>${game.description}. Tuned for quick phone sessions.</p>
    </section>
    <section class="control-block">
      <h3>Mode</h3>
      <div class="segmented">
        ${ROUND_MODES.map((mode) => `<button class="${state.selectedRoundMode === mode.id ? "active" : ""}" data-action="set-round-mode" data-mode="${mode.id}"><strong>${mode.name}</strong><span>${mode.label}</span></button>`).join("")}
      </div>
    </section>
    <section class="control-block">
      <h3>Difficulty</h3>
      <div class="difficulty-list">
        ${DIFFICULTIES.map((difficulty) => `<button class="${state.selectedDifficulty === difficulty.id ? "active" : ""}" data-action="set-difficulty" data-difficulty="${difficulty.id}"><strong>${difficulty.name}</strong><span>${difficulty.note}</span></button>`).join("")}
      </div>
    </section>
    ${state.selectedGame === "math-sprint" ? `
      <section class="control-block">
        <h3>Operations</h3>
        <div class="operation-grid">
          ${[["add", "Addition", "+"], ["sub", "Subtract", "-"], ["mul", "Multiply", "x"], ["div", "Divide", "/"]].map(([id, label, mark]) => `
            <button class="${state.operations.includes(id) ? "active" : ""}" data-action="toggle-operation" data-op="${id}">
              <strong>${mark}</strong><span>${label}</span>
            </button>`).join("")}
        </div>
      </section>` : ""}
    <button class="primary start" data-action="start-game">Start ${game.shortName}</button>
  `;
  app.innerHTML = screenFrame(content, { back: true, title: game.name });
}

function activeRemaining() {
  const round = state.active;
  if (!round || round.paused || !round.deadline) return round?.remaining ?? null;
  return Math.max(0, (round.deadline - Date.now()) / 1000);
}

function renderGame() {
  const round = state.active;
  const game = getGame(round.config.gameId);
  const remaining = activeRemaining();
  const progress = round.config.target ? Math.min(100, (round.solved / round.config.target) * 100) : round.config.timeLimit ? Math.max(0, (remaining / round.config.timeLimit) * 100) : 100;
  const urgent = remaining != null && remaining < 12 ? "urgent" : remaining != null && remaining < 30 ? "warning" : "";
  const score = calculateScore({ solved: round.solved, attempts: round.attempts, maxStreak: round.maxStreak, mode: round.config.roundMode, duration_secs: elapsedSeconds(round) });
  const feedback = state.feedback ? `<div class="feedback ${state.feedback.type}">${icon(state.feedback.type === "correct" ? "check" : "close")} <strong>${state.feedback.message}</strong><span>${state.feedback.points}</span></div>` : "";

  const content = `
    <header class="game-header">
      <button class="icon-button ghost" data-action="quit-round" aria-label="Quit round">${icon("back")}</button>
      <strong>${game.name}</strong>
      <button class="icon-button" data-action="pause-round" aria-label="Pause">${icon("pause")}</button>
    </header>
    <section class="game-metrics">
      <article class="${urgent}"><span>Time</span><strong>${remaining == null ? "--:--" : formatTime(remaining)}</strong><i style="width:${remaining == null ? 100 : progress}%"></i></article>
      <article><span>Score</span><strong>${score.toLocaleString()}</strong></article>
      <article class="${round.streak >= 8 ? "hot" : ""}"><span>Streak</span><strong>x${Math.max(1, Math.floor(round.streak / 3) + 1)}</strong><small>${round.streak}</small></article>
    </section>
    <div class="question-progress"><span>${round.config.target ? `Question ${round.solved + 1} of ${round.config.target}` : `${round.solved} solved`}</span><span>${Math.round(progress)}%</span></div>
    <section class="problem-card ${state.feedback?.type || ""}">
      <span>${round.question.helper || "Solve:"}</span>
      <strong>${escapeHtml(round.question.prompt)}</strong>
    </section>
    <section class="answer-grid">
      ${round.question.options.map((option) => `<button data-action="answer" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}
    </section>
    <section class="power-row">
      <button data-action="power-time">◷ +10s <b>2</b></button>
      <button data-action="power-fifty">◎ 50/50 <b>2</b></button>
      <button data-action="skip-question">≫ Skip <b>1</b></button>
    </section>
    ${feedback}
    ${round.paused ? `
      <div class="pause-overlay">
        <div>
          <h2>Paused</h2>
          <p>Your timer is frozen.</p>
          <button class="primary" data-action="resume-round">Resume</button>
          <button class="secondary" data-action="quit-round">Quit Round</button>
        </div>
      </div>` : ""}
  `;
  app.innerHTML = screenFrame(content, { header: false });
}

function renderStats() {
  const sessions = state.progress.sessions;
  const average = sessions.length ? Math.round(sessions.reduce((sum, session) => sum + Number(session.score || 0), 0) / sessions.length) : 0;
  const content = `
    <section class="stats-summary">
      <article><span>Level</span><strong>${state.progress.level}</strong><small>${state.progress.xp}/50 XP</small></article>
      <article><span>Best</span><strong>${state.progress.bestScore.toLocaleString()}</strong><small>Score</small></article>
      <article><span>Average</span><strong>${average.toLocaleString()}</strong><small>Score</small></article>
    </section>
    <section class="chart-card">
      <div class="section-head"><h2>Over time</h2><span>${sessions.length} sessions</span></div>
      <canvas id="progressChart" width="340" height="180" aria-label="Progress chart"></canvas>
    </section>
    <section class="history">
      <h2>Recent Sessions</h2>
      ${sessions.slice(0, 10).map((session) => `
        <article>
          <div><strong>${getGame(session.game_id).name}</strong><span>${new Date(session.created_at).toLocaleString()}</span></div>
          <div><strong>${Number(session.score || 0).toLocaleString()}</strong><span>${Math.round(session.accuracy_pct || 0)}% · ${session.max_streak} streak</span></div>
        </article>`).join("") || `<p class="empty">Play a round and your chart will light up here.</p>`}
    </section>
    ${bottomNav("stats")}
  `;
  app.innerHTML = screenFrame(content, { title: "Stats" });
  requestAnimationFrame(drawChart);
}

function renderLeaderboard() {
  const content = `
    <section class="control-block">
      <h3>Game</h3>
      <div class="segmented compact">
        ${GAME_MODES.map((game) => `<button class="${state.leaderboardFilter.game === game.id ? "active" : ""}" data-action="leader-game" data-game="${game.id}">${game.shortName}</button>`).join("")}
      </div>
      <h3>Difficulty</h3>
      <div class="segmented compact">
        ${DIFFICULTIES.slice(0, 4).map((difficulty) => `<button class="${state.leaderboardFilter.difficulty === difficulty.id ? "active" : ""}" data-action="leader-difficulty" data-difficulty="${difficulty.id}">${difficulty.name}</button>`).join("")}
      </div>
    </section>
    <section class="leaderboard-list">
      ${state.leaderboard.map((row, index) => `
        <article>
          <span class="rank">${index + 1}</span>
          <div><strong>${row.device_id === getDeviceId() ? "You" : `Player ${String(row.device_id || "").slice(0, 4)}`}</strong><span>${new Date(row.created_at).toLocaleDateString()}</span></div>
          <strong>${Number(row.score || 0).toLocaleString()}</strong>
        </article>`).join("") || `<p class="empty">No global scores yet. Your local scores still save instantly.</p>`}
    </section>
    ${bottomNav("leaderboard")}
  `;
  app.innerHTML = screenFrame(content, { title: "Challenges" });
}

function renderProfile() {
  const unlocked = new Set(state.achievements);
  const content = `
    <section class="profile-card">
      <div class="avatar">${state.progress.level}</div>
      <div><h2>Level ${state.progress.level}</h2><p>${state.progress.totalSolved} problems solved · ${state.progress.totalScore.toLocaleString()} total score</p></div>
    </section>
    <section class="achievement-list">
      <h2>Achievements</h2>
      ${ACHIEVEMENTS.map((achievement) => `
        <article class="${unlocked.has(achievement.id) ? "unlocked" : ""}">
          <span>${unlocked.has(achievement.id) ? "✓" : "•"}</span>
          <div><strong>${achievement.title}</strong><small>${achievement.detail}</small></div>
        </article>`).join("")}
    </section>
    <section class="control-block">
      <h3>Settings</h3>
      <button class="settings-row" data-action="toggle-theme">Toggle theme <strong>${state.theme}</strong></button>
      <button class="settings-row" data-action="toggle-sound">Toggle sound <strong>${state.sound ? "on" : "off"}</strong></button>
    </section>
    ${bottomNav("profile")}
  `;
  app.innerHTML = screenFrame(content, { title: "Profile" });
}

function renderComplete(session, earned) {
  const game = getGame(session.game_id);
  const grade = gradeFor(session);
  const content = `
    <section class="complete-card">
      <div class="grade">${grade}</div>
      <h2>${game.name} Complete</h2>
      <p>${earned.length ? `Unlocked: ${earned.map((item) => item.title).join(", ")}` : "Saved locally. Syncs when Supabase is available."}</p>
      <div class="result-grid">
        <article><span>Score</span><strong>${Number(session.score || 0).toLocaleString()}</strong></article>
        <article><span>Solved</span><strong>${session.solved}</strong></article>
        <article><span>Accuracy</span><strong>${Math.round(session.accuracy_pct)}%</strong></article>
        <article><span>Best Streak</span><strong>${session.max_streak}</strong></article>
      </div>
      <button class="primary start" data-action="play-again">Play Again</button>
      <button class="secondary wide" data-action="nav" data-screen="home">Home</button>
    </section>
  `;
  app.innerHTML = screenFrame(content, { title: "Results" });
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  if (state.screen === "setup") renderSetup();
  else if (state.screen === "game") renderGame();
  else if (state.screen === "stats") renderStats();
  else if (state.screen === "leaderboard") renderLeaderboard();
  else if (state.screen === "profile") renderProfile();
  else renderHome();
}

function elapsedSeconds(round) {
  const paused = round.pauseStarted ? Date.now() - round.pauseStarted : 0;
  return Math.max(0, (Date.now() - round.startedAt - round.pausedMs - paused) / 1000);
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    const round = state.active;
    if (!round || round.paused) return;
    if (round.deadline && Date.now() >= round.deadline) endRound("time");
    else if (state.screen === "game") renderGame();
  }, 350);
}

function startGame(overrides = {}) {
  const roundMode = ROUND_MODES.find((mode) => mode.id === (overrides.roundMode || state.selectedRoundMode)) || ROUND_MODES[0];
  const config = {
    gameId: overrides.gameId || state.selectedGame,
    difficulty: overrides.difficulty || state.selectedDifficulty,
    roundMode: roundMode.id,
    timeLimit: roundMode.timeLimit,
    target: roundMode.target,
    operations: [...state.operations],
    seed: roundMode.id === "daily" ? todaySeed() : Date.now()
  };
  const rng = createRng(config.seed);
  state.active = {
    config,
    rng,
    startedAt: Date.now(),
    pausedMs: 0,
    pauseStarted: null,
    paused: false,
    deadline: config.timeLimit ? Date.now() + config.timeLimit * 1000 : null,
    remaining: config.timeLimit,
    questionIndex: 0,
    solved: 0,
    attempts: 0,
    streak: 0,
    maxStreak: 0,
    answerTimes: [],
    questionStartedAt: Date.now(),
    question: createQuestion(config, 0, rng)
  };
  state.feedback = null;
  state.screen = "game";
  playTone("toggle");
  startTimer();
  render();
}

function nextQuestion() {
  const round = state.active;
  round.questionIndex += 1;
  round.question = createQuestion(round.config, round.questionIndex, round.rng);
  round.questionStartedAt = Date.now();
  state.feedback = null;
  renderGame();
}

function answer(value) {
  const round = state.active;
  if (!round || round.paused || state.feedback) return;
  const correct = String(value).trim().toLowerCase() === String(round.question.answer).trim().toLowerCase();
  round.attempts += 1;
  round.answerTimes.push((Date.now() - round.questionStartedAt) / 1000);

  if (correct) {
    round.solved += 1;
    round.streak += 1;
    round.maxStreak = Math.max(round.maxStreak, round.streak);
    const multiplier = Math.max(1, Math.floor(round.streak / 3) + 1);
    state.feedback = { type: "correct", message: "Correct!", points: `+${80 * multiplier}` };
    playTone(round.streak && round.streak % 5 === 0 ? "streak" : "correct");
    vibrate(20);
  } else {
    state.feedback = { type: "wrong", message: `Answer: ${round.question.answer}`, points: "reset" };
    round.streak = 0;
    playTone("wrong");
    vibrate([40, 30, 40]);
    if (round.config.difficulty === "sudden") {
      renderGame();
      setTimeout(() => endRound("sudden"), 700);
      return;
    }
  }

  renderGame();
  if (round.config.target && round.solved >= round.config.target) {
    setTimeout(() => endRound("target"), 500);
  } else if (round.config.roundMode === "practice") {
    setTimeout(nextQuestion, correct ? 360 : 720);
  } else {
    setTimeout(nextQuestion, correct ? 360 : 720);
  }
}

async function endRound(reason = "complete") {
  const round = state.active;
  if (!round) return;
  clearInterval(timerId);
  const duration = elapsedSeconds(round);
  const accuracy = round.attempts ? (round.solved / round.attempts) * 100 : 0;
  const fastest = round.answerTimes.length ? Math.min(...round.answerTimes) : null;
  const avg = round.answerTimes.length ? round.answerTimes.reduce((sum, item) => sum + item, 0) / round.answerTimes.length : null;
  const session = {
    game_id: round.config.gameId,
    mode: round.config.roundMode,
    difficulty: round.config.difficulty,
    time_limit: round.config.timeLimit,
    score: calculateScore({ solved: round.solved, attempts: round.attempts, maxStreak: round.maxStreak, mode: round.config.roundMode, duration_secs: duration }),
    solved: round.solved,
    attempts: round.attempts,
    accuracy_pct: Number(accuracy.toFixed(2)),
    avg_time_secs: avg == null ? null : Number(avg.toFixed(2)),
    fastest_time_secs: fastest == null ? null : Number(fastest.toFixed(2)),
    max_streak: round.maxStreak,
    duration_secs: Number(duration.toFixed(2)),
    metadata: { reason, daily: round.config.roundMode === "daily" ? todaySeed() : null }
  };
  const { record } = await saveSession(session);
  const earned = await evaluateAchievements(record);
  state.progress = await summarizeProgress();
  state.achievements = await getMeta("achievements", []);
  state.active = null;
  state.feedback = null;
  playTone("complete");
  renderComplete(record, earned);
}

function pauseRound() {
  const round = state.active;
  if (!round || round.paused) return;
  round.paused = true;
  round.pauseStarted = Date.now();
  round.remaining = activeRemaining();
  renderGame();
}

function resumeRound() {
  const round = state.active;
  if (!round || !round.paused) return;
  const pausedFor = Date.now() - round.pauseStarted;
  round.pausedMs += pausedFor;
  if (round.deadline) round.deadline += pausedFor;
  round.pauseStarted = null;
  round.paused = false;
  renderGame();
}

function drawChart() {
  const canvas = document.querySelector("#progressChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const sessions = [...state.progress.sessions].reverse().slice(-12);
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#101a22";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  for (let row = 1; row < 4; row += 1) {
    const y = (height / 4) * row;
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(width - 16, y);
    ctx.stroke();
  }
  if (!sessions.length) {
    ctx.fillStyle = "#8b98a6";
    ctx.font = "14px system-ui";
    ctx.fillText("No sessions yet", 112, 92);
    return;
  }
  const max = Math.max(...sessions.map((session) => Number(session.score || 0)), 100);
  ctx.beginPath();
  sessions.forEach((session, index) => {
    const x = 22 + (index / Math.max(1, sessions.length - 1)) * (width - 44);
    const y = height - 24 - (Number(session.score || 0) / max) * (height - 48);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#31d6c6";
  ctx.lineWidth = 4;
  ctx.stroke();
  sessions.forEach((session, index) => {
    const x = 22 + (index / Math.max(1, sessions.length - 1)) * (width - 44);
    const y = height - 24 - (Number(session.score || 0) / max) * (height - 48);
    ctx.fillStyle = "#c8ff47";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

async function refreshLeaderboard() {
  const remote = await loadLeaderboard(state.leaderboardFilter);
  if (remote.length) {
    state.leaderboard = remote;
  } else {
    state.leaderboard = state.progress.sessions
      .filter((session) => session.game_id === state.leaderboardFilter.game && session.difficulty === state.leaderboardFilter.difficulty)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 20);
  }
}

async function navigate(screen) {
  state.screen = screen;
  if (screen === "leaderboard") await refreshLeaderboard();
  render();
}

async function handleClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  if (!action) return;

  if (action === "select-game") {
    state.selectedGame = button.dataset.game;
    state.screen = "setup";
  } else if (action === "start-game") {
    startGame();
    return;
  } else if (action === "start-daily" || action === "new-challenge") {
    state.selectedGame = "math-sprint";
    state.selectedDifficulty = action === "new-challenge" ? "hard" : "medium";
    startGame({ roundMode: "daily", gameId: "math-sprint", difficulty: state.selectedDifficulty });
    return;
  } else if (action === "set-round-mode") {
    state.selectedRoundMode = button.dataset.mode;
  } else if (action === "set-difficulty") {
    state.selectedDifficulty = button.dataset.difficulty;
  } else if (action === "toggle-operation") {
    const op = button.dataset.op;
    state.operations = state.operations.includes(op) ? state.operations.filter((item) => item !== op) : [...state.operations, op];
    if (!state.operations.length) state.operations = [op];
    await setMeta("operations", state.operations);
  } else if (action === "answer") {
    answer(button.dataset.answer);
    return;
  } else if (action === "pause-round") {
    pauseRound();
    return;
  } else if (action === "resume-round") {
    resumeRound();
    return;
  } else if (action === "quit-round") {
    if (state.active) await endRound("quit");
    state.screen = "home";
  } else if (action === "play-again") {
    startGame();
    return;
  } else if (action === "nav") {
    await navigate(button.dataset.screen);
    return;
  } else if (action === "go-home") {
    state.screen = "home";
  } else if (action === "toggle-theme") {
    state.theme = state.theme === "dark" ? "light" : "dark";
    await setMeta("theme", state.theme);
    playTone("toggle");
  } else if (action === "toggle-sound") {
    state.sound = !state.sound;
    await setMeta("sound", state.sound);
    playTone("toggle");
  } else if (action === "hide-install") {
    state.hideInstall = true;
    localStorage.setItem("mathflow-hide-install", "true");
  } else if (action === "install") {
    if (state.installPrompt) {
      state.installPrompt.prompt();
      await state.installPrompt.userChoice;
      state.installPrompt = null;
    }
  } else if (action === "leader-game") {
    state.leaderboardFilter.game = button.dataset.game;
    await refreshLeaderboard();
  } else if (action === "leader-difficulty") {
    state.leaderboardFilter.difficulty = button.dataset.difficulty;
    await refreshLeaderboard();
  } else if (action === "power-time") {
    if (state.active?.deadline) state.active.deadline += 10000;
  } else if (action === "power-fifty") {
    const q = state.active?.question;
    if (q) q.options = [String(q.answer), ...q.options.filter((item) => String(item) !== String(q.answer)).slice(0, 1)];
  } else if (action === "skip-question") {
    nextQuestion();
    return;
  }
  render();
}

function handleKey(event) {
  if (event.key === "Escape") {
    if (state.screen === "game") pauseRound();
    else {
      state.screen = "home";
      render();
    }
  }
}

async function init() {
  const settings = await loadSettings();
  state.theme = settings.theme;
  state.sound = settings.sound;
  state.operations = settings.operations;
  state.progress = await summarizeProgress();
  state.achievements = await getMeta("achievements", []);
  getDeviceId();
  app.addEventListener("click", handleClick);
  window.addEventListener("keydown", handleKey);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    render();
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }
  render();
}

init();
