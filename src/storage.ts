import { restore, SAVE_KEY } from "./engine";
import { finales } from "./cards";
import type { Game } from "./types";
export interface Memory {
  date: string;
  events: number;
  skipped: number;
  finalId: string;
}
const MEMORY_KEY = "gradus-between-us:memories";
const HISTORY_KEY = "gradus-between-us:finals";
export function readSave() {
  try {
    return restore(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}
export function writeSave(g: Game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(g));
    return true;
  } catch {
    return false;
  }
}
export function readList<T>(key: string, valid: (x: unknown) => x is T): T[] {
  try {
    const a: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(a) ? a.filter(valid) : [];
  } catch {
    return [];
  }
}
export const readHistory = () =>
  readList(
    HISTORY_KEY,
    (x): x is string =>
      typeof x === "string" && finales.some((c) => c.id === x),
  );
export const readMemories = () =>
  readList(
    MEMORY_KEY,
    (x): x is Memory =>
      typeof x === "object" &&
      x !== null &&
      "date" in x &&
      typeof x.date === "string" &&
      "finalId" in x &&
      typeof x.finalId === "string" &&
      "events" in x &&
      typeof x.events === "number" &&
      "skipped" in x &&
      typeof x.skipped === "number",
  );
export function remember(g: Game) {
  try {
    const memory: Memory = {
      date: new Date(g.started).toISOString(),
      events: g.completed,
      skipped: g.skipped,
      finalId: g.current,
    };
    const list = readMemories();
    if (!list.some((m) => m.date === memory.date))
      localStorage.setItem(
        MEMORY_KEY,
        JSON.stringify([...list, memory].slice(-20)),
      );
    return true;
  } catch {
    return false;
  }
}
export function finishHistory(g: Game) {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([...readHistory(), g.current].slice(-12)),
    );
  } catch {
    /* Current game remains usable without storage. */
  }
}
export function clearStorage() {
  try {
    [SAVE_KEY, MEMORY_KEY, HISTORY_KEY].forEach((k) =>
      localStorage.removeItem(k),
    );
    return true;
  } catch {
    return false;
  }
}
