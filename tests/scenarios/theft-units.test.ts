import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  emit,
  modifier,
  power,
} from "../../packages/engine/kernel";
import { card } from "../../packages/catalog/index";
for (const [id, cost, power, ram, color, tags, keywords] of [
  ["6th-street-recruits", 4, 6, 1, "Red", ["6th Street", "Ganger"], []],
  ["maelstrom-goons", 3, 3, 2, "Yellow", ["Ganger", "Maelstrom"], []],
  [
    "wraith-marauders",
    5,
    4,
    2,
    "Green",
    ["Ganger", "Nomad", "Raffen Shiv"],
    [],
  ],
  ["v-roamer-of-the-badlands", 5, 6, 2, "Red", ["Merc", "Nomad"], []],
  [
    "rogue-amendiares-queen-of-the-afterlife",
    5,
    4,
    2,
    "Blue",
    ["Fixer", "Merc"],
    ["Quick"],
  ],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Unit",
      cost,
      power,
      ram,
      color,
      tags,
      keywords,
      sell: false,
    }));
for (const sides of [4, 6])
  it(`6th Street triggers only for friendly d6 theft (${sides})`, () => {
    const g = scenario("6th-street-recruits", "unused"),
      p = own(g, "a", "field")[0];
    g.pending = [];
    emit(g, {
      type: "steal",
      actor: "b",
      piece: own(g, "b", "field")[0],
      gig: g.gigs.find((d) => d.sides === 6)!,
    });
    advance(g);
    expect(g.choice).toBeUndefined();
    emit(g, {
      type: "steal",
      actor: "a",
      piece: { ...p },
      gig: g.gigs.find((d) => d.sides === sides)!,
    });
    advance(g);
    if (sides === 4) {
      expect(g.choice).toBeUndefined();
      return;
    }
    const d = g.gigs.find((d) => d.controller === "c" && d.sides === 12)!;
    d.value = 2;
    answer(g, "a", g.choice!.id, [d.id]);
    expect(g.choice!.options.map((o) => o.id)).toEqual([
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);
    answer(g, "a", g.choice!.id, ["8"]);
    expect(d.value).toBe(8);
  });
for (const equipped of [false, true])
  it(`Maelstrom's own theft lets one chosen Rival discard only if equipped (${equipped})`, () => {
    const g = scenario("maelstrom-goons", "unused"),
      p = own(g, "a", "field").find((p) => p.cardId === "maelstrom-goons")!;
    g.pending = [];
    if (equipped) {
      const gear = own(g, "a", "hand").find(
        (p) => p.cardId === "mantis-blades",
      )!;
      gear.zone = "field";
      gear.faceUp = true;
      gear.host = p.id;
    }
    emit(g, { type: "steal", actor: "a", piece: { ...p }, gig: g.gigs[0] });
    advance(g);
    if (!equipped) {
      expect(g.choice).toBeUndefined();
      return;
    }
    answer(g, "a", g.choice!.id, ["c"]);
    expect(g.choice!.player).toBe("c");
    expect(g.choice!.private).toBe(true);
    const discard = own(g, "c", "hand")[0];
    answer(g, "c", g.choice!.id, [discard.id]);
    expect(discard.zone).toBe("trash");
  });
it("Wraith readies another friendly Unit using current power, and cannot target itself", () => {
  const g = scenario("wraith-marauders", "steal"),
    src = g.pending[0].source,
    p = own(g, "a", "field")[1];
  modifier(g, "a", p.id, "power", 1);
  const value = power(g, p);
  g.pending[0].event.gig = { ...g.gigs[0], value };
  advance(g);
  expect(g.choice!.min).toBe(1);
  expect(g.choice!.options.some((o) => o.id === src)).toBe(false);
  expect(g.choice!.options.map((o) => o.id)).toContain(p.id);
  answer(g, "a", g.choice!.id, [p.id]);
  expect(p.ready).toBe(true);
});
it("V increases only its stolen Gig, within five and the die's maximum", () => {
  const g = scenario("v-roamer-of-the-badlands", "steal"),
    d = g.gigs[0];
  d.value = 2;
  g.pending[0].event.gig = { ...d };
  advance(g);
  expect(g.choice!.key).toBe("value");
  expect(g.choice!.options.map((o) => o.id)).toEqual(["2", "3", "4"]);
  answer(g, "a", g.choice!.id, ["4"]);
  expect(d.value).toBe(4);
});
for (const n of [1, 2])
  it(`V draws at its own end with at least two high Gigs (${n})`, () => {
    const g = scenario("v-roamer-of-the-badlands", "unused"),
      before = own(g, "a", "hand").length;
    g.pending = [];
    g.gigs
      .filter((d) => d.controller === "a")
      .forEach((d, i) => (d.value = i < n ? 8 : 2));
    emit(g, { type: "end", actor: "b" });
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(before);
    emit(g, { type: "end", actor: "a" });
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(before + (n === 2 ? 1 : 0));
  });
it("Rogue readies exactly two Eddies on the first qualifying other friendly theft, excluding equality", () => {
  const g = scenario("rogue-amendiares-queen-of-the-afterlife", "unused"),
    p = own(g, "a", "field")[0],
    src = own(g, "a", "field").find(
      (p) => p.cardId === "rogue-amendiares-queen-of-the-afterlife",
    )!;
  g.pending = [];
  for (const thief of [src, p]) {
    emit(g, {
      type: "steal",
      actor: "a",
      piece: { ...thief },
      gig: { ...g.gigs[0], value: power(g, thief) },
    });
    advance(g);
    expect(g.choice).toBeUndefined();
  }
  for (let i = 0; i < 2; i++) {
    emit(g, {
      type: "steal",
      actor: "a",
      piece: { ...p },
      gig: { ...g.gigs[0], value: 1 },
    });
    advance(g);
    if (!i) {
      expect(g.choice!.min).toBe(2);
      answer(
        g,
        "a",
        g.choice!.id,
        own(g, "a", "eddies")
          .slice(0, 2)
          .map((p) => p.id),
      );
    } else expect(g.choice).toBeUndefined();
  }
});
it("Rogue pays two and spends to reduce a chosen Rival by her current power", () => {
  const g = scenario("rogue-amendiares-queen-of-the-afterlife", "activate"),
    p = g.pieces.find((p) => p.id === g.pending[0].source)!,
    target = own(g, "c", "field")[0],
    before = power(g, target);
  modifier(g, "a", p.id, "power", 2);
  advance(g);
  answer(
    g,
    "a",
    g.choice!.id,
    own(g, "a", "eddies")
      .slice(0, 2)
      .map((p) => p.id),
  );
  expect(p.ready).toBe(false);
  answer(g, "a", g.choice!.id, [target.id]);
  expect(power(g, target)).toBe(Math.max(0, before - 6));
});
