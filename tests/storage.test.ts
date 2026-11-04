import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newGame, defaultSettings, advance, SAVE_KEY } from "../src/engine";
import {
  clearStorage,
  finishHistory,
  readHistory,
  readMemories,
  readSave,
  remember,
  writeSave,
} from "../src/storage";
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());
const game = () =>
  newGame(
    [
      { name: "Private name", avatar: "☀", color: "#E94B80" },
      { name: "Another name", avatar: "☾", color: "#F4C78B" },
    ],
    { ...defaultSettings, duration: 15 },
  );
it("round trips progress and fails closed on corrupt storage", () => {
  const g = game();
  expect(writeSave(g)).toBe(true);
  expect(readSave()).toEqual(g);
  values.set(SAVE_KEY, '{"version":1}');
  expect(readSave()).toBeNull();
});
it("keeps only anonymous summary, deduplicates memory, tracks finale", () => {
  let g = game();
  for (let i = 0; i < 9; i++) g = advance(g);
  finishHistory(g);
  expect(readHistory()).toEqual([g.current]);
  remember(g);
  remember(g);
  expect(readMemories()).toHaveLength(1);
  const memory = JSON.stringify(readMemories());
  expect(memory).not.toContain("Private name");
  expect(memory).not.toContain("answers");
  expect(Object.keys(readMemories()[0]).sort()).toEqual([
    "date",
    "events",
    "finalId",
    "skipped",
  ]);
});
it("deletion preserves unrelated browser data", () => {
  writeSave(game());
  values.set("another-app", "keep");
  expect(clearStorage()).toBe(true);
  expect(readSave()).toBeNull();
  expect(values.get("another-app")).toBe("keep");
});
it("storage denied never breaks gameplay helpers", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error("denied");
    },
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {
      throw Error("denied");
    },
  });
  expect(readSave()).toBeNull();
  expect(writeSave(game())).toBe(false);
  expect(remember(game())).toBe(false);
  expect(clearStorage()).toBe(false);
  expect(readHistory()).toEqual([]);
  expect(() => finishHistory(game())).not.toThrow();
});
