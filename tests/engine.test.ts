import { describe, expect, it } from "vitest";
import { allCards, cards, finales } from "../src/cards";
import {
  advance,
  applyRoll,
  compatibleRoll,
  currentCard,
  defaultSettings,
  eligible,
  newGame,
  replaceCard,
  restore,
  stageOf,
  totalEvents,
} from "../src/engine";
import type { Level, Player } from "../src/types";
const players: [Player, Player] = [
  { name: "Аня", avatar: "☾", color: "#E94B80" },
  { name: "Саша", avatar: "☀", color: "#F4C78B" },
];
describe("authored catalogue", () => {
  it("has 15 unique, complete cards per category and 12 finals", () => {
    expect(cards).toHaveLength(90);
    expect(finales).toHaveLength(12);
    expect(new Set(allCards.map((c) => c.id)).size).toBe(102);
    expect(new Set(allCards.map((c) => c.text)).size).toBe(102);
    for (const category of [
      "confess",
      "guess",
      "tempt",
      "duel",
      "moment",
      "surprise",
    ])
      expect(cards.filter((c) => c.category === category)).toHaveLength(15);
    for (const c of allCards) {
      expect(c.title.length).toBeGreaterThan(3);
      expect(c.text.trim().length).toBeGreaterThan(15);
      expect(c.completion).toBeTruthy();
      if (c.interaction === "secret" || c.interaction === "choice")
        expect(c.options.length).toBeGreaterThanOrEqual(2);
    }
  });
});
describe("complete game matrix", () => {
  for (const duration of [15, 30, 45] as const)
    for (const level of [1, 2, 3] as Level[])
      for (const touch of [false, true])
        it(`${duration} min, level ${level}, touch ${touch}`, () => {
          let g = newGame(
            players,
            { ...defaultSettings, duration, level, touch },
            () => 0.3,
          );
          const categories = new Set<string>();
          for (let event = 0; event < totalEvents(g.settings); event++) {
            const c = currentCard(g);
            categories.add(c.category);
            expect(c.level).toBeLessThanOrEqual(level);
            expect(c.stage).toBeLessThanOrEqual(stageOf(g));
            if (!touch) expect(c.touch).toBe(false);
            expect(g.turn).toBe(event % 2);
            expect(restore(JSON.stringify(g))).toEqual(g);
            g = advance(g, event % 3 === 0, [], () => 0.3);
          }
          expect(categories.size).toBe(6);
          expect(stageOf(g)).toBe(5);
          expect(currentCard(g).category).toBe("final");
          expect(new Set(g.used).size).toBe(g.used.length);
          g = advance(g);
          expect(g.done).toBe(true);
          expect(advance(g)).toEqual(g);
          expect(restore(JSON.stringify(g))).toEqual(g);
        });
});
it("replacement does not advance or repeat; pool exhaustion is safe", () => {
  let g = newGame(players, { ...defaultSettings, level: 1, touch: false });
  const initial = g.current;
  g = replaceCard(g);
  expect(g.completed).toBe(0);
  expect(g.current).not.toBe(initial);
  for (let i = 0; i < 100; i++) g = replaceCard(g);
  expect(new Set(g.used).size).toBe(g.used.length);
  expect(eligible(g).length).toBeGreaterThan(0);
  expect(replaceCard(g)).toBe(g);
  expect(advance(g, true).completed).toBe(1);
});
it("dice always produce an allowed effect or safe fallback", () => {
  for (const c of allCards)
    for (let face = 1; face <= 6; face++) {
      const actual = compatibleRoll(c, face);
      expect(c.diceEffects).toContain(actual);
      if (!c.dice) expect(actual).toBe(1);
    }
});
it("stage effects and next-turn effects expire, and skipping adds no effect", () => {
  let g = newGame(players, defaultSettings);
  g = { ...g, current: "surprise-1", used: [...g.used, "surprise-1"] };
  g = advance(g);
  expect(g.effects).toHaveLength(1);
  while (g.completed < 4) g = advance(g, true);
  expect(g.effects).toHaveLength(0);
  g = { ...g, current: "surprise-2", used: [...g.used, "surprise-2"] };
  g = advance(g);
  expect(g.effects[0].until).toBe(g.completed + 1);
  g = advance(g, true);
  expect(g.effects).toHaveLength(0);
});
it("final selection avoids remembered finales", () => {
  let g = newGame(players, { ...defaultSettings, duration: 15 });
  for (let i = 0; i < 8; i++)
    g = advance(g, false, ["final-1", "final-2"], () => 0);
  expect(g.current).toBe("final-3");
});
it("rejects corrupt or incompatible saves", () => {
  expect(restore("{broken")).toBeNull();
  const g = newGame(players, defaultSettings);
  for (const patch of [
    { completed: 999 },
    { current: "missing" },
    { players: [] },
    { effects: [{}] },
    { roll: 7 },
    { used: [g.current, g.current] },
    { settings: { ...defaultSettings, level: 9 } },
    { turn: 3 },
    { done: true },
  ])
    expect(restore(JSON.stringify({ ...g, ...patch }))).toBeNull();
});

it("repeated replacements never prevent completing any settings combination", () => {
  for (const duration of [15, 30, 45] as const)
    for (const level of [1, 2, 3] as Level[])
      for (const touch of [true, false]) {
        let g = newGame(players, {
          ...defaultSettings,
          duration,
          level,
          touch,
        });
        for (let i = 0; i < totalEvents(g.settings); i++) {
          for (let j = 0; j < 30; j++) g = replaceCard(g);
          g = advance(g, true);
        }
        expect(stageOf(g)).toBe(5);
        expect(new Set(g.used).size).toBe(g.used.length);
        expect(advance(g).done).toBe(true);
      }
});

it("dice surprise is an unseen real card and its modifier survives the turn", () => {
  let g = newGame(players, defaultSettings, () => 0);
  g = applyRoll(g, 6, () => 0);
  expect(g.roll).toBe(6);
  expect(g.bonus).toBe("surprise-1");
  expect(g.used).toContain(g.bonus);
  expect(restore(JSON.stringify(g))).toEqual(g);
  expect(applyRoll(g, 2)).toBe(g);
  g = advance(g);
  expect(g.effects).toHaveLength(1);
  expect(g.bonus).toBeNull();
});
it("no surprise available falls back safely", () => {
  let g = newGame(players, defaultSettings, () => 0);
  g = {
    ...g,
    used: [
      ...g.used,
      ...cards.filter((c) => c.category === "surprise").map((c) => c.id),
    ],
  };
  expect(applyRoll(g, 6).roll).toBe(1);
});
