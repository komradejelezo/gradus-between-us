import { allCards, cards, finales } from "./cards";
import type { Card, Game, Player, Settings } from "./types";
export const stages = ["Искра", "Притяжение", "Химия", "Жар", "Между нами"];
export const defaultSettings: Settings = {
  duration: 30,
  level: 3,
  touch: true,
  reduced: false,
  sound: false,
};
export const totalEvents = (settings: Settings) =>
  settings.duration === 15 ? 8 : settings.duration === 45 ? 24 : 16;
export const stageOf = (g: Game) =>
  Math.min(5, Math.floor(g.completed / (totalEvents(g.settings) / 4)) + 1);
export const currentCard = (g: Game) =>
  allCards.find((c) => c.id === g.current)!;
export const eligible = (g: Game) =>
  cards.filter(
    (c) =>
      c.stage <= stageOf(g) &&
      c.level <= g.settings.level &&
      (!c.touch || g.settings.touch) &&
      !g.used.includes(c.id),
  );
function randomItem<T>(items: T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}
export function selectCard(
  g: Game,
  random = Math.random,
  history: string[] = [],
): Card | undefined {
  if (stageOf(g) === 5) {
    const fresh = finales.filter((c) => !history.includes(c.id));
    return randomItem(
      fresh.length ? fresh : finales.filter((c) => c.id !== history.at(-1)),
      random,
    );
  }
  // Cycle categories, but remain playable if a category's available pool is exhausted.
  const pool = eligible(g);
  const kinds = ["confess", "guess", "tempt", "duel", "moment", "surprise"];
  const preferred = pool.filter((c) => c.category === kinds[g.completed % 6]);
  return preferred.length || pool.length
    ? randomItem(preferred.length ? preferred : pool, random)
    : undefined;
}
export function newGame(
  players: [Player, Player],
  settings: Settings,
  random = Math.random,
): Game {
  const game: Game = {
    version: 1,
    players,
    settings,
    completed: 0,
    turn: 0,
    used: [],
    current: "",
    effects: [],
    done: false,
    skipped: 0,
    started: Date.now(),
    roll: null,
    bonus: null,
  };
  const card = selectCard(game, random)!;
  return { ...game, current: card.id, used: [card.id] };
}
export function replaceCard(g: Game, random = Math.random): Game {
  if (g.done || stageOf(g) === 5) return g;
  const perStage = totalEvents(g.settings) / 4;
  // Keep enough unseen cards to finish this stage even after repeated replacements.
  const reserve = perStage - (g.completed % perStage) - 1;
  if (eligible(g).length <= reserve) return g;
  const card = selectCard(g, random);
  return card
    ? {
        ...g,
        current: card.id,
        used: [...g.used, card.id],
        roll: null,
        bonus: null,
      }
    : g;
}
export function advance(
  g: Game,
  skip = false,
  history: string[] = [],
  random = Math.random,
): Game {
  if (g.done) return g;
  if (stageOf(g) === 5)
    return { ...g, done: true, effects: [], roll: null, bonus: null };
  const completed = g.completed + 1;
  let effects = g.effects.filter((e) => e.until > completed);
  const eventCards = [
    currentCard(g),
    allCards.find((c) => c.id === g.bonus),
  ].filter((c): c is Card => Boolean(c));
  for (const card of eventCards)
    if (!skip && card.modifier)
      effects = [
        ...effects,
        {
          id: `${card.id}-${completed}`,
          text: card.text,
          until:
            card.modifier === "stage"
              ? Math.ceil(completed / (totalEvents(g.settings) / 4)) *
                (totalEvents(g.settings) / 4)
              : completed + 1,
        },
      ].filter((e) => e.until > completed);
  const next: Game = {
    ...g,
    completed,
    turn: g.turn === 0 ? 1 : 0,
    skipped: g.skipped + (skip ? 1 : 0),
    effects,
    roll: null,
    bonus: null,
  };
  const selected = selectCard(next, random, history)!;
  return { ...next, current: selected.id, used: [...g.used, selected.id] };
}
export const diceLabels = [
  "Обычный вариант",
  "Поменяйтесь ролями",
  "Ещё один вопрос",
  "Выбор за вами",
  "Особое условие",
  "Карта-сюрприз",
];
export const diceText = [
  "Выполните задание так, как оно написано.",
  "Пусть партнёр начнёт первым и прочитает задание.",
  "После задания спросите друг друга: «Что сделало бы этот момент ещё приятнее?»",
  "Вместе выберите: ответить словами или разыграть короткую сцену по теме карточки.",
  "Добавьте к заданию по одному искреннему комплименту.",
  "Бонус: придумайте друг другу приятное прозвище на этот ход. Оба должны его одобрить.",
];
export function compatibleRoll(card: Card, face: number) {
  return card.dice && card.diceEffects.includes(face) ? face : 1;
}
export function applyRoll(g: Game, face: number, random = Math.random): Game {
  if (g.roll !== null || !currentCard(g).dice || g.done) return g;
  const result = compatibleRoll(currentCard(g), face);
  if (result !== 6) return { ...g, roll: result };
  const pool = eligible(g).filter((c) => c.category === "surprise");
  const perStage = totalEvents(g.settings) / 4;
  if (
    !pool.length ||
    eligible(g).length <= perStage - (g.completed % perStage) - 1
  )
    return { ...g, roll: 1 };
  const bonus = randomItem(pool, random);
  return { ...g, roll: 6, bonus: bonus.id, used: [...g.used, bonus.id] };
}
export const SAVE_KEY = "gradus-between-us:v1";
export function restore(raw: string | null): Game | null {
  try {
    const g = JSON.parse(raw || "null") as Game;
    if (
      !g ||
      g.version !== 1 ||
      !Array.isArray(g.players) ||
      g.players.length !== 2 ||
      g.players.some(
        (p) =>
          !p ||
          typeof p.name !== "string" ||
          !p.name.trim() ||
          p.name.length > 32 ||
          typeof p.avatar !== "string" ||
          !/^#[0-9a-f]{6}$/i.test(p.color),
      )
    )
      return null;
    if (
      !g.settings ||
      ![15, 30, 45].includes(g.settings.duration) ||
      ![1, 2, 3].includes(g.settings.level) ||
      ["touch", "reduced", "sound"].some(
        (k) => typeof g.settings[k as keyof Settings] !== "boolean",
      )
    )
      return null;
    if (
      !Number.isInteger(g.completed) ||
      g.completed < 0 ||
      g.completed > totalEvents(g.settings) ||
      ![0, 1].includes(g.turn) ||
      typeof g.done !== "boolean" ||
      !Number.isFinite(g.started) ||
      !Number.isInteger(g.skipped) ||
      g.skipped < 0 ||
      g.skipped > g.completed
    )
      return null;
    if (
      !Array.isArray(g.used) ||
      g.used.some(
        (id) => typeof id !== "string" || !allCards.some((c) => c.id === id),
      ) ||
      new Set(g.used).size !== g.used.length ||
      !g.used.includes(g.current)
    )
      return null;
    const card = allCards.find((c) => c.id === g.current);
    if (
      !card ||
      card.stage > stageOf(g) ||
      card.level > g.settings.level ||
      (card.touch && !g.settings.touch) ||
      (stageOf(g) === 5) !== (card.category === "final") ||
      (g.done && stageOf(g) !== 5)
    )
      return null;
    if (
      g.roll !== null &&
      (!Number.isInteger(g.roll) ||
        g.roll < 1 ||
        g.roll > 6 ||
        !card.dice ||
        !card.diceEffects.includes(g.roll))
    )
      return null;
    if (g.bonus !== null) {
      const bonus = cards.find((c) => c.id === g.bonus);
      if (
        g.roll !== 6 ||
        !bonus ||
        bonus.category !== "surprise" ||
        !g.used.includes(bonus.id) ||
        bonus.stage > stageOf(g) ||
        bonus.level > g.settings.level
      )
        return null;
    }
    if (
      !Array.isArray(g.effects) ||
      g.effects.some(
        (e) =>
          !e ||
          typeof e.id !== "string" ||
          typeof e.text !== "string" ||
          !Number.isInteger(e.until) ||
          e.until <= g.completed ||
          e.until > totalEvents(g.settings),
      )
    )
      return null;
    return g;
  } catch {
    return null;
  }
}
