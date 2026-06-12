import test from "node:test";
import assert from "node:assert/strict";
import { calculateScore, createQuestion, createRng } from "../src/games.js";

test("math sprint generates clean integer division answers", () => {
  const rng = createRng(1234);
  for (let index = 0; index < 50; index += 1) {
    const question = createQuestion(
      { gameId: "math-sprint", difficulty: "hard", operations: ["div"], roundMode: "timed" },
      index,
      rng
    );
    assert.equal(Number.isInteger(question.answer), true);
    assert.equal(question.options.includes(String(question.answer)), true);
  }
});

test("all game modes include the answer in options", () => {
  const ids = ["math-sprint", "pattern-match", "memory-grid", "word-scramble", "reaction-tap"];
  for (const gameId of ids) {
    const question = createQuestion({ gameId, difficulty: "medium", operations: ["add"], roundMode: "timed" }, 1, createRng(44));
    assert.equal(question.options.includes(String(question.answer)), true);
  }
});

test("score rewards accuracy and streaks", () => {
  const plain = calculateScore({ solved: 10, attempts: 12, maxStreak: 3, mode: "timed" });
  const perfect = calculateScore({ solved: 10, attempts: 10, maxStreak: 10, mode: "timed" });
  assert.equal(perfect > plain, true);
});
