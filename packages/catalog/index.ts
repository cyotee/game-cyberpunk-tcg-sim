import data from "./cards.json" with { type: "json" };
export type Color = "Red" | "Blue" | "Green" | "Yellow";
export interface Card {
  id: string;
  sourceId: string;
  name: string;
  subtitle: string;
  nameFull: string;
  type: "Legend" | "Unit" | "Gear" | "Program";
  color: Color;
  cost: number | null;
  power: number | null;
  ram: number | null;
  sell: boolean;
  tags: string[];
  text: string;
  keywords: string[];
  gearText?: {
    intrinsic: string;
    inherited: string;
    reminder: string;
    flavor: string;
  };
  image: string;
  source: string;
  printings: { id: string; number: string; set: string; setName: string }[];
}
export const cards = data as Card[];
export const byId: Record<string, Card> = Object.assign(
  Object.create(null),
  Object.fromEntries(cards.map((c) => [c.id, c])),
);
export const colors: Color[] = ["Red", "Blue", "Green", "Yellow"];
export const CATALOG_VERSION = "2026-09-06.2";
export function card(id: string): Card {
  const c = byId[id];
  if (!c) throw new Error("Unknown card");
  return c;
}
