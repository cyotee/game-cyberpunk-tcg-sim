import { PROTOCOL_VERSION } from "./version";
export { PROTOCOL_VERSION } from "./version";
import { z } from "zod";
import type { Deck } from "../decks/index";
import type { Game, Command } from "../engine/types";
export interface Seat {
  id: string;
  name: string;
  deck?: Deck;
  deckError?: string;
  ready: boolean;
  joined: number;
  seen: number;
  connection: string;
}
export interface Room {
  format: 1;
  code: string;
  name: string;
  private: boolean;
  capacity: number;
  host: string;
  seats: Seat[];
  revision: number;
  generation: number;
  targetMode: "majority" | "seven" | "custom";
  customTarget: number;
  game?: Game;
  restoring: boolean;
  created: number;
  dedupe: Record<string, string>;
}
export const deckSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(120),
  legends: z
    .array(
      z.object({
        cardId: z.string().max(120),
        quantity: z.number().int().min(1).max(1000),
        number: z.string().max(30).optional(),
      }),
    )
    .max(100),
  main: z
    .array(
      z.object({
        cardId: z.string().max(120),
        quantity: z.number().int().min(1).max(1000),
        number: z.string().max(30).optional(),
      }),
    )
    .max(200),
  unresolved: z.array(z.string().max(500)).max(300),
  updatedAt: z.string().max(50),
});
export const commandSchema = z.object({
  type: z.string().max(40),
  piece: z.string().max(100).optional(),
  target: z.string().max(100).optional(),
  payment: z.array(z.string().max(100)).max(100).optional(),
  choice: z.string().max(100).optional(),
  values: z.array(z.string().max(200)).max(100).optional(),
  ability: z.string().max(100).optional(),
  sides: z.number().int().optional(),
});

export interface ActionRequest {
  protocolVersion: 1;
  commandId: string;
  revision: number;
  generation: number;
  command: Command;
}
export const actionSchema = z.object({
  // Omitted only by clients from the original local playtest.
  protocolVersion: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
  commandId: z.string().min(8).max(100),
  revision: z.number().int().nonnegative(),
  generation: z.number().int().positive(),
  command: commandSchema,
});
export const targetCount = (r: Room) =>
  r.targetMode === "majority"
    ? Math.floor((6 * r.seats.length) / 2) + 1
    : r.targetMode === "seven"
      ? 7
      : r.customTarget;
