import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  field,
  power,
  modifier,
  move,
  uid,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { cost } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
for (const [id, n, ram, color, tags, quick] of [
  ["carnage-at-the-colosseum", 6, 3, "Red", ["Braindance", "Extreme"], false],
  ["cyberpsychosis", 3, 2, "Yellow", ["Quickhack"], true],
  ["don-t-fear-the-reaper", 7, 3, "Green", ["Samurai"], false],
  ["les-e-le-mens", 5, 4, "Blue", ["Corpo"], false],
  ["live-with-the-aftermath", 3, 3, "Yellow", ["Plan"], false],
  ["unlikely-bond", 4, 2, "Blue", ["Maelstrom", "Mox"], false],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Program",
      cost: n,
      ram,
      color,
      tags,
      keywords: quick ? ["Quick"] : [],
      power: null,
      sell: true,
    }));
it("Carnage discounts only controlled Gigs showing eight or more, to one, and leaves printed cost unchanged", () => {
  const g = scenario("carnage-at-the-colosseum", "program"),
    p = g.pieces.find((p) => p.zone === "resolving")!;
  expect(cost(g, p)).toBe(3);
  g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 8));
  expect(cost(g, p)).toBe(1);
  expect(card(p.cardId).cost).toBe(6);
  g.gigs
    .filter((d) => d.controller === "a")
    .forEach((d) => (d.controller = "b"));
  expect(cost(g, p)).toBe(6);
});
it("Carnage compares current power and excludes equal-power rivals", () => {
  const g = scenario("carnage-at-the-colosseum", "program"),
    a = own(g, "a", "field")[0];
  advance(g);
  answer(g, "a", g.choice!.id, [a.id]);
  const choices = g.choice!.options.map((o) => o.id);
  expect(choices).not.toContain(own(g, "b", "field")[0].id);
  const c = own(g, "c", "field")[1];
  expect(choices).toContain(c.id);
  answer(g, "a", g.choice!.id, [c.id]);
  expect(c.zone).toBe("trash");
  expect(a.zone).toBe("field");
});
for (const initiallySpent of [false, true])
  it(`Reaper spends every Rival and can defeat a previously spent friendly Unit (${initiallySpent})`, () => {
    const g = scenario("don-t-fear-the-reaper", "program");
    if (initiallySpent)
      field(g)
        .filter((p) => p.controller !== "a")
        .forEach((p) => (p.ready = false));
    advance(g);
    expect(
      field(g)
        .filter((p) => p.controller !== "a")
        .every((p) => !p.ready),
    ).toBe(true);
    expect(own(g, "a", "field")[0].ready).toBe(true);
    const friendly = own(g, "a", "field")[1];
    expect(g.choice!.options.map((o) => o.id)).toContain(friendly.id);
    answer(g, "a", g.choice!.id, [friendly.id]);
    expect(friendly.zone).toBe("trash");
  });
it("Les Elemens binds one Rival and lets the caster break a lowest-current-power tie", () => {
  const g = scenario("les-e-le-mens", "program"),
    units = own(g, "c", "field");
  units.forEach((p) => (p.cardId = "animals-wrecker"));
  modifier(g, "a", units[1].id, "power", -2);
  modifier(g, "a", units[2].id, "power", -2);
  advance(g);
  answer(g, "a", g.choice!.id, ["c"]);
  expect(g.choice!.player).toBe("a");
  expect(g.choice!.options.map((o) => o.id)).toEqual([
    units[1].id,
    units[2].id,
  ]);
  answer(g, "a", g.choice!.id, [units[2].id]);
  expect(own(g, "c", "deck").at(-1)!.id).toBe(units[2].id);
  expect(units[1].zone).toBe("field");
});
for (const absent of ["rivals", "friendly"])
  it(`Unlikely Bond honors its mandatory first instruction and if-you-do gate with no ${absent}`, () => {
    const g = scenario("unlikely-bond", "program");
    field(g)
      .filter((p) =>
        absent === "rivals" ? p.controller !== "a" : p.controller === "a",
      )
      .forEach((p) => (p.zone = "trash"));
    advance(g);
    if (absent === "rivals") {
      const a = own(g, "a", "field")[0];
      expect(g.choice!.min).toBe(1);
      answer(g, "a", g.choice!.id, [a.id]);
      expect(own(g, "a", "deck").at(-1)!.id).toBe(a.id);
    }
    expect(g.choice).toBeUndefined();
    expect(own(g, "b", "field").length).toBe(absent === "friendly" ? 3 : 0);
  });
it("Unlikely Bond requires ready friendly and spent rival Units, including a third player", () => {
  const g = scenario("unlikely-bond", "program"),
    a = own(g, "a", "field")[0],
    c = own(g, "c", "field")[1];
  advance(g);
  expect(g.choice!.options.map((o) => o.id)).not.toContain(
    own(g, "a", "field")[1].id,
  );
  answer(g, "a", g.choice!.id, [a.id]);
  expect(g.choice!.options.map((o) => o.id)).toEqual([
    own(g, "b", "field")[1].id,
    c.id,
  ]);
  answer(g, "a", g.choice!.id, [c.id]);
  expect(own(g, "c", "deck").at(-1)!.id).toBe(c.id);
});
it("Aftermath gives each player their own mandatory choice, skipping players with no Units", () => {
  const g = scenario("live-with-the-aftermath", "program");
  own(g, "b", "field").forEach((p) => (p.zone = "trash"));
  advance(g);
  expect(g.choice!.player).toBe("a");
  const a = own(g, "a", "field")[0];
  answer(g, "a", g.choice!.id, [a.id]);
  expect(a.zone).toBe("trash");
  expect(g.choice!.player).toBe("c");
  const c = own(g, "c", "field")[0];
  expect(() => answer(g, "a", g.choice!.id, [c.id])).toThrow();
  answer(g, "c", g.choice!.id, [c.id]);
  expect(c.zone).toBe("trash");
  expect(g.choice).toBeUndefined();
});
for (const fight of [false, true])
  it(`Cyberpsychosis can enhance an equipped Rival and only defeats it at turn end if it fought (${fight})`, () => {
    let g = scenario("cyberpsychosis", "program");
    const b = own(g, "b", "field")[0];
    for (let i = 0; i < 2; i++)
      g.pieces.push({
        id: uid(g),
        cardId: "mantis-blades",
        owner: "b",
        controller: "b",
        zone: "field",
        ready: true,
        faceUp: true,
        entered: 0,
        marks: {},
        host: b.id,
      });
    const original = power(g, b);
    advance(g);
    expect(g.choice!.options.map((o) => o.id)).toEqual([b.id]);
    answer(g, "a", g.choice!.id, [b.id]);
    expect(power(g, b)).toBe(original + 6);
    if (fight) {
      g.turnPlayer = "b";
      const t = own(g, "c", "field")[1];
      g = applyCommand(g, "b", { type: "attack", piece: b.id, target: t.id });
      g = applyCommand(g, "c", { type: "endReaction" });
    }
    g = applyCommand(g, g.turnPlayer, { type: "endTurn" });
    expect(g.pieces.find((p) => p.id === b.id)!.zone).toBe(
      fight ? "trash" : "field",
    );
  });
