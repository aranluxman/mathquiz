export const GAME_MODES = [
  {
    id: "math-sprint",
    name: "Math Sprint",
    shortName: "Sprint",
    icon: "bolt",
    accent: "#31d6c6",
    description: "Solve as many as you can",
    bestUnit: "pts"
  },
  {
    id: "pattern-match",
    name: "Pattern Match",
    shortName: "Pattern",
    icon: "dots",
    accent: "#ff715f",
    description: "Find the next number",
    bestUnit: "pts"
  },
  {
    id: "memory-grid",
    name: "Memory Grid",
    shortName: "Memory",
    icon: "grid",
    accent: "#9de24f",
    description: "Remember. Flip. Match.",
    bestUnit: "pts"
  },
  {
    id: "word-scramble",
    name: "Word Scramble",
    shortName: "Words",
    icon: "az",
    accent: "#ffbd30",
    description: "Unscramble brain words",
    bestUnit: "pts"
  },
  {
    id: "reaction-tap",
    name: "Reaction Tap",
    shortName: "React",
    icon: "tap",
    accent: "#39d7c8",
    description: "Tap when the target hits",
    bestUnit: "sec"
  }
];

export const DIFFICULTIES = [
  { id: "easy", name: "Easy", note: "single-digit warmups" },
  { id: "medium", name: "Medium", note: "mixed two-digit flow" },
  { id: "hard", name: "Hard", note: "parentheses and negatives" },
  { id: "sudden", name: "Sudden", note: "one miss ends it" },
  { id: "custom", name: "Custom", note: "your ranges" }
];

export const ROUND_MODES = [
  { id: "timed", name: "Timed", label: "90 sec", timeLimit: 90, target: null },
  { id: "blitz", name: "Blitz", label: "20 q", timeLimit: null, target: 20 },
  { id: "practice", name: "Practice", label: "no timer", timeLimit: null, target: null },
  { id: "daily", name: "Daily", label: "daily", timeLimit: 90, target: 15 }
];

export const ACHIEVEMENTS = [
  { id: "first-run", title: "First Run", detail: "Finish your first arcade session." },
  { id: "ten-solved", title: "First 10", detail: "Solve 10 problems in one session." },
  { id: "streak-10", title: "10-Streak", detail: "Hit a streak of 10 correct answers." },
  { id: "perfect-round", title: "Perfect Flow", detail: "Finish a round at 100% accuracy." },
  { id: "hundred-total", title: "Century Brain", detail: "Solve 100 total problems." },
  { id: "daily-player", title: "Daily Spark", detail: "Complete a daily challenge." },
  { id: "multi-arcade", title: "Arcade Sampler", detail: "Play three different game modes." }
];

const WORDS = [
  "fraction",
  "integer",
  "triangle",
  "equation",
  "decimal",
  "percent",
  "multiply",
  "sequence",
  "variable",
  "geometry",
  "average",
  "pattern"
];

export function getGame(id) {
  return GAME_MODES.find((game) => game.id === id) || GAME_MODES[0];
}

export function todaySeed(date = new Date()) {
  return Number(
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
  );
}

export function createRng(seed = Date.now()) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function integer(min, max, rng) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function shuffle(list, rng) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function uniqueOptions(answer, rng, spread = 8) {
  const options = new Set([answer]);
  let guard = 0;
  while (options.size < 4 && guard < 80) {
    const delta = integer(1, spread, rng) * (rng() > 0.5 ? 1 : -1);
    const candidate = answer + delta;
    if (candidate !== answer) options.add(candidate);
    guard += 1;
  }
  return shuffle([...options], rng).map(String);
}

function mathQuestion(config, index, rng) {
  const progress = Math.min(5, Math.floor(index / 5));
  const diff = config.difficulty;
  const hard = diff === "hard" || diff === "sudden";
  const medium = diff === "medium" || hard;
  const max = diff === "easy" ? 9 + progress : medium ? 24 + progress * 7 : 50 + progress * 12;
  const min = hard ? -8 - progress : 1;
  const ops = config.operations?.length ? config.operations : ["add", "sub", "mul", "div"];
  const op = pick(ops, rng);

  if (hard && rng() > 0.62) {
    const a = integer(2, 9 + progress, rng);
    const b = integer(2, 9 + progress, rng);
    const c = integer(2, 14 + progress, rng);
    const add = rng() > 0.5;
    const answer = add ? (a + b) * c : a * b - c;
    return {
      prompt: add ? `(${a} + ${b}) x ${c}` : `${a} x ${b} - ${c}`,
      answer,
      options: uniqueOptions(answer, rng, 16 + progress * 4)
    };
  }

  if (op === "mul") {
    const a = integer(2, medium ? 12 + progress : 9, rng);
    const b = integer(2, hard ? 15 + progress : 10, rng);
    const answer = a * b;
    return { prompt: `${a} x ${b}`, answer, options: uniqueOptions(answer, rng, 14) };
  }

  if (op === "div") {
    const answer = integer(2, hard ? 16 + progress : 12, rng);
    const divisor = integer(2, hard ? 12 : 9, rng);
    return { prompt: `${answer * divisor} / ${divisor}`, answer, options: uniqueOptions(answer, rng, 10) };
  }

  const a = integer(min, max, rng);
  const b = integer(diff === "easy" ? 1 : min, max, rng);
  if (op === "sub") {
    const answer = hard ? a - b : Math.max(a, b) - Math.min(a, b);
    const prompt = hard ? `${a} - ${b}` : `${Math.max(a, b)} - ${Math.min(a, b)}`;
    return { prompt, answer, options: uniqueOptions(answer, rng, 12 + progress * 3) };
  }

  const answer = a + b;
  return { prompt: `${a} + ${b}`, answer, options: uniqueOptions(answer, rng, 12 + progress * 3) };
}

function patternQuestion(config, index, rng) {
  const start = integer(1, 12, rng);
  const step = integer(2, 6 + Math.floor(index / 6), rng);
  const multiplier = config.difficulty === "hard" || config.difficulty === "sudden" ? pick([2, 3], rng) : null;
  const values = [start];
  for (let i = 1; i < 5; i += 1) {
    values.push(multiplier && i > 2 ? values[i - 1] * multiplier : values[i - 1] + step + (i > 2 ? 1 : 0));
  }
  const answer = multiplier ? values[4] * multiplier : values[4] + step + 1;
  return {
    prompt: `${values.join(", ")}, ?`,
    answer,
    options: uniqueOptions(answer, rng, 18)
  };
}

function memoryQuestion(config, index, rng) {
  const count = config.difficulty === "easy" ? 3 : config.difficulty === "medium" ? 4 : 5;
  const cells = shuffle(Array.from({ length: 9 }, (_, cell) => cell + 1), rng).slice(0, count);
  const answer = cells[cells.length - 1];
  return {
    prompt: `Remember: ${cells.join(" - ")}`,
    answer,
    options: shuffle([answer, ...shuffle(Array.from({ length: 9 }, (_, cell) => cell + 1), rng).filter((cell) => cell !== answer).slice(0, 3)], rng).map(String),
    metadata: { cells }
  };
}

function scramble(word, rng) {
  let letters = word.split("");
  let mixed = word;
  while (mixed === word) {
    letters = shuffle(letters, rng);
    mixed = letters.join("");
  }
  return mixed;
}

function wordQuestion(config, index, rng) {
  const answer = pick(WORDS, rng);
  const options = shuffle([answer, ...shuffle(WORDS.filter((word) => word !== answer), rng).slice(0, 3)], rng);
  return {
    prompt: scramble(answer, rng).toUpperCase(),
    answer,
    options,
    helper: "Unscramble the word"
  };
}

function reactionQuestion(config, index, rng) {
  const target = integer(1, 9, rng);
  const distractors = shuffle(Array.from({ length: 9 }, (_, cell) => cell + 1).filter((cell) => cell !== target), rng).slice(0, 3);
  return {
    prompt: `Tap ${target}`,
    answer: target,
    options: shuffle([target, ...distractors], rng).map(String),
    helper: "Hit the matching target fast"
  };
}

export function createQuestion(config, index, rng) {
  if (config.gameId === "pattern-match") return patternQuestion(config, index, rng);
  if (config.gameId === "memory-grid") return memoryQuestion(config, index, rng);
  if (config.gameId === "word-scramble") return wordQuestion(config, index, rng);
  if (config.gameId === "reaction-tap") return reactionQuestion(config, index, rng);
  return mathQuestion(config, index, rng);
}

export function gradeFor(session) {
  const accuracy = session.attempts ? session.solved / session.attempts : 0;
  const speed = session.duration_secs && session.solved ? session.duration_secs / session.solved : 99;
  if (accuracy === 1 && speed < 2.4) return "S";
  if (accuracy >= 0.9 && speed < 3.5) return "A";
  if (accuracy >= 0.75 && speed < 5) return "B";
  if (accuracy >= 0.55) return "C";
  return "D";
}

export function calculateScore({ solved, attempts, maxStreak, mode, duration_secs }) {
  const accuracy = attempts ? solved / attempts : 0;
  const accuracyMultiplier = accuracy === 1 ? 1.5 : accuracy >= 0.8 ? 1 : accuracy >= 0.5 ? 0.5 : 0.25;
  const streakBonus = 1 + Math.floor(maxStreak / 5) * 0.12;
  const speedBonus = mode === "blitz" && duration_secs ? Math.max(0, Math.round(400 - duration_secs * 8)) : 0;
  return Math.round(solved * 100 * accuracyMultiplier * streakBonus + speedBonus);
}
