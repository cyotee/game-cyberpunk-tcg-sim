import type { Deck } from "../decks/index";
export type Zone =
  | "deck"
  | "hand"
  | "legends"
  | "field"
  | "trash"
  | "eddies"
  | "resolving"
  | "removed";
export interface Piece {
  id: string;
  cardId: string;
  owner: string;
  controller: string;
  zone: Zone;
  ready: boolean;
  faceUp: boolean;
  entered: number;
  host?: string;
  known?: boolean;
  marks: Record<string, number>;
}
export interface Gig {
  id: string;
  owner: string;
  controller: string;
  sides: number;
  value: number;
}
export interface Player {
  id: string;
  name: string;
  eliminated: boolean;
  fixer: number[];
  called: boolean;
  sold: boolean;
  programs: number;
  played: Record<string, number>;
  opening: boolean;
}
export interface Modifier {
  id: string;
  kind: string;
  target: string;
  amount: number;
  controller: string;
  expires: "turn" | "attack" | "next" | "targetEnd";
  turn: number;
}
export interface GameEvent {
  type: string;
  actor: string;
  piece?: Piece;
  target?: string;
  gig?: Gig;
  gigs?: Gig[];
  amount?: number;
  cards?: string[];
  opponent?: string;
  won?: boolean;
  first?: boolean;
}
export interface Job {
  id: string;
  key: string;
  controller: string;
  source: string;
  cardId: string;
  event: GameEvent;
  step: number;
  vars: Record<string, unknown>;
}
export interface Option {
  id: string;
  label: string;
  cardId?: string;
}
export interface Choice {
  id: string;
  player: string;
  label: string;
  options: Option[];
  min: number;
  max: number;
  key: string;
  jobId: string;
  allowedCounts?: number[];
  private?: boolean;
}
export interface LogEntry {
  event?: import("./log").ActionRecord;
  visibility?: import("./log").LogVisibility;
  turn?: number;
  id: number;
  text: string;
  privateTo?: string;
}
export interface Attack {
  attacker: string;
  defender: string;
  target: string;
  stage: "effects" | "react" | "fight" | "steal";
  losers?: string[];
  winners?: string[];
  selected?: string[];
  prevented?: string[];
  unblocked?: boolean;
}
export interface Game {
  version: string;
  id: string;
  players: Player[];
  pieces: Piece[];
  gigs: Gig[];
  turnPlayer: string;
  turn: number;
  phase: "setup" | "start" | "main" | "end" | "finished";
  target: number;
  pending: Job[];
  delayed?: { event: string; actor: string; job: Job }[];
  frames: Job[];
  choice?: Choice;
  batch?: string;
  attack?: Attack;
  mods: Modifier[];
  log: LogEntry[];
  serial: number;
  random: number[];
  randomCursor: number;
  emptyCycle: string[];
  overtime: boolean;
  sudden?: { eligible: string[]; remaining: string[]; enteredTurn?: number };
  winner?: string;
  draw?: boolean;
  openingPlayer: string;
}
export interface Command {
  type: string;
  piece?: string;
  target?: string;
  payment?: string[];
  choice?: string;
  values?: string[];
  ability?: string;
  sides?: number;
}
export interface SeatDeck {
  id: string;
  name: string;
  deck: Deck;
}
