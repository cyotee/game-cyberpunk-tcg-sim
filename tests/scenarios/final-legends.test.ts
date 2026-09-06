import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  emit,
  defeat,
  move,
  uid,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { mayAttack } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
for (const [id, cost, power, color, tags, keywords] of [
  [
    "kerry-eurodyne-axe-attitude-audience",
    null,
    0,
    "Yellow",
    ["Rocker", "Samurai"],
    [],
  ],
  [
    "panam-palmer-nomad-cavalry",
    null,
    0,
    "Green",
    ["Aldecado", "Merc", "Nomad"],
    [],
  ],
  ["rogue-amendiares-preem-solo", 7, 7, "Yellow", ["Merc"], ["Go Solo"]],
  ["jackie-welles-mama-s-favorite", 6, 8, "Green", ["Merc"], ["Go Solo"]],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Legend",
      cost,
      power,
      ram: 2,
      color,
      tags,
      keywords,
      sell: true,
    }));
for (const sides of [6, 20])
  for (const reroll of [false, true])
    it(`Kerry may reroll once and uses only the accepted result for a d${sides} (${reroll})`, () => {
      const g = scenario("kerry-eurodyne-axe-attitude-audience", "unused"),
        d = g.gigs.find((d) => d.controller === "a" && d.sides === sides)!,
        n = own(g, "a", "hand").length;
      g.pending = [];
      d.value = 2;
      g.random[0] = 0;
      emit(g, { type: "roll", actor: "a", gig: { ...d } });
      advance(g);
      answer(g, "a", g.choice!.id, [reroll ? "yes" : "no"]);
      expect(d.value).toBe(reroll ? 1 : 2);
      expect(g.choice).toBeUndefined();
      expect(own(g, "a", "hand")).toHaveLength(
        n + (reroll ? (sides === 20 ? 3 : 1) : 0),
      );
      expect(g.randomCursor).toBe(reroll ? 1 : 0);
    });
it("Kerry ignores a rejected maximum and does not react to Rival rolls", () => {
  const g = scenario("kerry-eurodyne-axe-attitude-audience", "unused"),
    d = g.gigs.find((d) => d.controller === "a" && d.sides === 20)!,
    n = own(g, "a", "hand").length;
  g.pending = [];
  d.value = 20;
  emit(g, { type: "roll", actor: "b", gig: { ...d } });
  advance(g);
  expect(g.choice).toBeUndefined();
  emit(g, { type: "roll", actor: "a", gig: { ...d } });
  advance(g);
  answer(g, "a", g.choice!.id, ["yes"]);
  expect(d.value).toBeGreaterThan(1);
  expect(d.value).toBeLessThan(20);
  expect(own(g, "a", "hand")).toHaveLength(n);
});
it("Panam moves only her Gear to an unequipped friendly Unit, readying the recipient", () => {
  const g = scenario("panam-palmer-nomad-cavalry", "activate"),
    src = g.pieces.find((p) => p.id === g.pending[0].source)!,
    gear = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!,
    target = own(g, "a", "field")[1];
  gear.zone = "legends";
  gear.faceUp = true;
  gear.host = src.id;
  advance(g);
  answer(
    g,
    "a",
    g.choice!.id,
    own(g, "a", "eddies")
      .slice(0, 2)
      .map((p) => p.id),
  );
  expect(g.choice!.options.map((o) => o.id)).toEqual([gear.id]);
  answer(g, "a", g.choice!.id, [gear.id]);
  answer(g, "a", g.choice!.id, [target.id]);
  expect(gear.host).toBe(target.id);
  expect(gear.zone).toBe("field");
  expect(target.ready).toBe(true);
  expect(src.ready).toBe(false);
});
for (const n of [4, 5])
  it(`Panam requires five equipped friendly pieces and readies only them (${n})`, () => {
    const g = scenario("panam-palmer-nomad-cavalry", "unused");
    g.pending = [];
    const ps = [...own(g, "a", "field"), ...own(g, "a", "legends")];
    ps.forEach((p, i) => {
      p.ready = false;
      p.faceUp = true;
      if (i < n)
        g.pieces.push({
          id: uid(g),
          cardId: "mantis-blades",
          owner: "a",
          controller: "a",
          zone: p.zone,
          host: p.id,
          ready: true,
          faceUp: true,
          entered: 0,
          marks: {},
        });
    });
    emit(g, { type: "end", actor: "b" });
    advance(g);
    expect(ps.some((p) => p.ready)).toBe(false);
    emit(g, { type: "end", actor: "a" });
    advance(g);
    expect(ps.filter((p) => p.ready)).toHaveLength(n === 5 ? 5 : 0);
  });
for (const value of [1, 2])
  it(`Rogue triggers for a friendly Legend's theft with value ${value}`, () => {
    const g = scenario("rogue-amendiares-preem-solo", "unused"),
      p = own(g, "a", "legends")[0],
      n = own(g, "a", "hand").length;
    g.pending = [];
    p.zone = "field";
    p.faceUp = true;
    emit(g, {
      type: "steal",
      actor: "a",
      piece: { ...p },
      gig: { ...g.gigs[0], value },
    });
    advance(g);
    if (value === 2) {
      expect(own(g, "a", "hand")).toHaveLength(n + 1);
      expect(g.choice).toBeUndefined();
    } else {
      answer(g, "a", g.choice!.id, ["c"]);
      const discarded = own(g, "c", "hand")[0];
      answer(g, "c", g.choice!.id, [discarded.id]);
      expect(discarded.zone).toBe("trash");
    }
  });
for (const id of [
  "rogue-amendiares-preem-solo",
  "jackie-welles-mama-s-favorite",
])
  it(`${id} goes Solo at printed cost and leaves play permanently`, () => {
    let g = scenario(id, "unused");
    g.pending = [];
    const p = own(g, "a", "legends").find((p) => p.cardId === id)!;
    p.ready = false;
    g = applyCommand(g, "a", { type: "solo", piece: p.id });
    g = applyCommand(g, "a", {
      type: "choose",
      choice: g.choice!.id,
      values: own(g, "a", "eddies")
        .slice(0, card(id).cost!)
        .map((p) => p.id),
    });
    const played = g.pieces.find((x) => x.id === p.id)!;
    expect(played.zone).toBe("field");
    expect(played.ready).toBe(true);
    expect(mayAttack(g, played, "b")).toBe(true);
    move(g, played, "hand");
    expect(played.zone).toBe("removed");
  });
for (const replace of [false, true])
  it(`Jackie optionally substitutes his defeat for a friendly Unit at a one-Eddie cost (${replace})`, () => {
    const g = scenario("jackie-welles-mama-s-favorite", "unused"),
      jackie = own(g, "a", "legends").find(
        (p) => p.cardId === "jackie-welles-mama-s-favorite",
      )!,
      p = own(g, "a", "field")[0],
      n = own(g, "a", "eddies").filter((p) => p.ready).length;
    g.pending = [];
    defeat(g, p, "b");
    advance(g);
    answer(g, "a", g.choice!.id, [replace ? jackie.id : "none"]);
    if (replace) answer(g, "a", g.choice!.id, [own(g, "a", "eddies")[0].id]);
    expect(p.zone).toBe(replace ? "field" : "trash");
    expect(jackie.zone).toBe(replace ? "removed" : "legends");
    expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(
      n - (replace ? 1 : 0),
    );
  });
