export type Level = 1 | 2 | 3;
export type Category =
  | "confess"
  | "guess"
  | "tempt"
  | "duel"
  | "moment"
  | "surprise"
  | "final";
export interface Card {
  id: string;
  category: Category;
  stage: number;
  level: Level;
  title: string;
  text: string;
  interaction: "conversation" | "secret" | "choice" | "action";
  options: string[];
  touch: boolean;
  dice: boolean;
  diceEffects: number[];
  completion: string;
  modifier?: "stage" | "next";
}
export interface Player {
  name: string;
  avatar: string;
  color: string;
}
export interface Settings {
  duration: 15 | 30 | 45;
  level: Level;
  touch: boolean;
  reduced: boolean;
  sound: boolean;
}
export interface Effect {
  id: string;
  text: string;
  until: number;
}
export interface Game {
  version: 1;
  players: [Player, Player];
  settings: Settings;
  completed: number;
  turn: 0 | 1;
  used: string[];
  current: string;
  effects: Effect[];
  done: boolean;
  skipped: number;
  started: number;
  roll: number | null;
  bonus: string | null;
}
