import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import { advance, answer, own } from "../../packages/engine/kernel";
import { card } from "../../packages/catalog/index";

for (const [slug, event, wanted, stats] of [
  [
    "all-is-lost",
    "program",
    "Unit",
    {
      type: "Program",
      color: "Red",
      cost: 1,
      power: null,
      ram: 2,
      sell: true,
      tags: ["Zetatech"],
    },
  ],
  [
    "hacked-corpo",
    "play",
    "Program",
    {
      type: "Unit",
      color: "Blue",
      cost: 4,
      power: 3,
      ram: 1,
      sell: false,
      tags: ["AI", "Corpo"],
    },
  ],
] as const) {
  it(`${slug}: printed baseline and mandatory retrieval only from the three trashed cards`, () => {
    expect(card(slug)).toMatchObject({ ...stats, keywords: [] });
    const g = scenario(slug, event);
    const top = own(g, "a", "deck").slice(0, 3);
    top[0].cardId = "animals-wrecker";
    top[1].cardId = "floor-it";
    top[2].cardId = wanted === "Unit" ? "psycho-squad" : "peace-offering";
    const remainder = own(g, "a", "deck")
      .slice(3)
      .map((p) => p.id);
    const rivalDeck = own(g, "b", "deck").map((p) => p.id);
    advance(g);
    const candidates = top.filter((p) => card(p.cardId).type === wanted);
    expect(g.choice!.options.map((o) => o.id)).toEqual(
      candidates.map((p) => p.id),
    );
    expect(g.choice!.min).toBe(1);
    expect(g.choice!.max).toBe(1);
    const before = structuredClone(g);
    expect(() => answer(g, "a", g.choice!.id, [])).toThrow();
    expect(g).toEqual(before);
    const selected = candidates[0];
    answer(g, "a", g.choice!.id, [selected.id]);
    expect(selected.zone).toBe("hand");
    expect(
      top
        .filter((p) => p !== selected)
        .every((p) => p.zone === "trash" && p.faceUp),
    ).toBe(true);
    expect(own(g, "a", "deck").map((p) => p.id)).toEqual(remainder);
    expect(own(g, "b", "deck").map((p) => p.id)).toEqual(rivalDeck);
    for (const p of top)
      expect(
        g.log.some(
          (e) =>
            !e.privateTo &&
            e.text.includes(card(p.cardId).nameFull) &&
            e.text.includes("trash"),
        ),
      ).toBe(true);
  });
  it(`${slug}: no matching card does not retrieve an older trash card`, () => {
    const g = scenario(slug, event);
    const before = own(g, "a", "hand").length;
    own(g, "a", "deck")
      .slice(0, 3)
      .forEach(
        (p) => (p.cardId = wanted === "Unit" ? "floor-it" : "animals-wrecker"),
      );
    advance(g);
    expect(g.choice).toBeUndefined();
    expect(g.frames).toHaveLength(0);
    expect(own(g, "a", "hand")).toHaveLength(before);
  });
  it(`${slug}: a short or empty deck trashes only the available cards without drawing`, () => {
    for (const count of [0, 1, 2]) {
      const g = scenario(slug, event);
      const keep = own(g, "a", "deck").slice(0, count);
      g.pieces = g.pieces.filter(
        (p) => p.controller !== "a" || p.zone !== "deck" || keep.includes(p),
      );
      keep.forEach(
        (p) => (p.cardId = wanted === "Unit" ? "animals-wrecker" : "floor-it"),
      );
      advance(g);
      if (count) answer(g, "a", g.choice!.id, [keep[0].id]);
      expect(g.choice).toBeUndefined();
      expect(own(g, "a", "deck")).toHaveLength(0);
      expect(g.players.find((p) => p.id === "a")!.eliminated).toBe(false);
    }
  });
}
