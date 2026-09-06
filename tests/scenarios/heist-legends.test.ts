import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  move,
  power,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { playPiece, mayAttack, resources } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
for (const [id, cost, power, color, tags, keywords] of [
  ["v-corporate-exile", 5, 8, "Blue", ["Corpo", "Merc"], ["Go Solo"]],
  ["viktor-vektor-sit-down-and-relax", null, 0, "Yellow", ["Ripperdoc"], []],
  ["jackie-welles-pour-one-out-for-me", null, 0, "Blue", ["Merc"], []],
] as const)
  it(`${id}: printed Legend baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Legend",
      cost,
      power,
      color,
      tags,
      keywords,
      sell: true,
      ram: 2,
    }));
it("V pays five for Go Solo, enters ready from a spent Legend, attacks immediately, and is removed on leaving", () => {
  let g = scenario("v-corporate-exile", "unused");
  g.pending = [];
  const v = own(g, "a", "legends").find(
    (p) => p.cardId === "v-corporate-exile" && p.faceUp,
  )!;
  v.ready = false;
  const before = resources(g, "a").length;
  g = applyCommand(g, "a", { type: "solo", piece: v.id });
  expect(g.choice!.min).toBe(5);
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: g.choice!.options.slice(0, 5).map((o) => o.id),
  });
  const unit = g.pieces.find((p) => p.id === v.id)!;
  expect(unit.zone).toBe("field");
  expect(unit.ready).toBe(true);
  expect(power(g, unit)).toBe(8);
  expect(resources(g, "a")).toHaveLength(before - 5);
  expect(mayAttack(g, unit, "b")).toBe(true);
  move(g, unit, "hand");
  expect(unit.zone).toBe("removed");
});
for (const keep of [0, 2])
  it(`Viktor's Call privately searches five, reveals ${keep} qualifying Gears and bottom-decks the rest`, () => {
    const g = scenario("viktor-vektor-sit-down-and-relax", "call"),
      top = own(g, "a", "deck").slice(0, 5);
    const ids = [
      "adrenaline-converter",
      "mantis-blades",
      "overwatch-panam-s-gift",
      "animals-wrecker",
      "floor-it",
    ];
    top.forEach((p, i) => (p.cardId = ids[i]));
    const before = own(g, "a", "hand").length;
    advance(g);
    expect(g.choice!.private).toBe(true);
    expect(g.choice!.min).toBe(0);
    expect(g.choice!.max).toBe(2);
    expect(g.choice!.options.map((o) => o.id)).toEqual(
      top.slice(0, 2).map((p) => p.id),
    );
    expect(top.every((p) => p.zone === "deck")).toBe(true);
    answer(
      g,
      "a",
      g.choice!.id,
      top.slice(0, keep).map((p) => p.id),
    );
    expect(own(g, "a", "hand")).toHaveLength(before + keep);
    expect(
      new Set(
        own(g, "a", "deck")
          .slice(-(5 - keep))
          .map((p) => p.id),
      ),
    ).toEqual(new Set(top.slice(keep).map((p) => p.id)));
    for (const p of top.slice(0, keep))
      expect(
        g.log.some(
          (e) =>
            !e.privateTo &&
            e.text.includes("reveals " + card(p.cardId).nameFull),
        ),
      ).toBe(true);
  });
for (const initial of [1, 2, 3])
  it(`Jackie draws only when a chosen friendly Gig changes from ${initial} to minimum`, () => {
    const g = scenario("jackie-welles-pour-one-out-for-me", "unused");
    g.pending = [];
    const blue = own(g, "a", "hand").find(
        (p) => p.cardId === "modded-muramasa",
      )!,
      die = g.gigs.find((d) => d.controller === "a")!,
      n = own(g, "a", "hand").length;
    die.value = initial;
    playPiece(g, blue);
    advance(g);
    answer(g, "a", g.choice!.id, ["yes"]);
    expect(
      g.choice!.options.every(
        (o) => g.gigs.find((d) => d.id === o.id)!.controller === "a",
      ),
    ).toBe(true);
    answer(g, "a", g.choice!.id, [die.id]);
    answer(g, "a", g.choice!.id, ["1"]);
    expect(die.value).toBe(1);
    expect(own(g, "a", "hand")).toHaveLength(n - 1 + (initial > 1 ? 1 : 0));
    const second = own(g, "a", "hand").find(
      (p) => p.cardId === "jacked-in-voodoo-boy",
    )!;
    playPiece(g, second);
    advance(g);
    expect(g.choice).toBeUndefined();
  });
it("Jackie's optional decrease can be declined without changing or drawing", () => {
  const g = scenario("jackie-welles-pour-one-out-for-me", "unused");
  g.pending = [];
  const blue = own(g, "a", "hand").find((p) => p.cardId === "modded-muramasa")!,
    n = own(g, "a", "hand").length;
  playPiece(g, blue);
  advance(g);
  answer(g, "a", g.choice!.id, ["no"]);
  expect(g.choice).toBeUndefined();
  expect(own(g, "a", "hand")).toHaveLength(n - 1);
});
for (const orientation of [false, true])
  it(`normal Legend play preserves orientation (${orientation}), has Lag, and carries its Gear to the field`, () => {
    let g = scenario("v-corporate-exile", "unused");
    g.pending = [];
    const v = own(g, "a", "legends").find(
      (p) => p.cardId === "v-corporate-exile" && p.faceUp,
    )!;
    v.ready = orientation;
    const gear = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!;
    gear.zone = "legends";
    gear.host = v.id;
    gear.faceUp = true;
    g = applyCommand(g, "a", { type: "play", piece: v.id });
    expect(g.choice!.min).toBe(5);
    g = applyCommand(g, "a", {
      type: "choose",
      choice: g.choice!.id,
      values: g
        .choice!.options.filter((o) => o.id !== v.id)
        .slice(0, 5)
        .map((o) => o.id),
    });
    const unit = g.pieces.find((p) => p.id === v.id)!;
    expect(unit.ready).toBe(orientation);
    expect(unit.zone).toBe("field");
    expect(mayAttack(g, unit, "b")).toBe(false);
    expect(g.pieces.find((p) => p.id === gear.id)).toMatchObject({
      zone: "field",
      host: v.id,
    });
  });
for (const slug of ["animals-wrecker", "mantis-blades", "floor-it"])
  it(`Go Solo cannot be used as a shortcut to play ${slug} from hand`, () => {
    const g = scenario("v-corporate-exile", "unused");
    g.pending = [];
    const p = own(g, "a", "hand").find((p) => p.cardId === slug)!;
    expect(() => applyCommand(g, "a", { type: "solo", piece: p.id })).toThrow(
      "Cannot play",
    );
  });
it("null-cost and face-down Legends cannot be played from the Legends area", () => {
  const g = scenario("viktor-vektor-sit-down-and-relax", "unused");
  g.pending = [];
  for (const p of own(g, "a", "legends"))
    expect(() => applyCommand(g, "a", { type: "play", piece: p.id })).toThrow(
      "Cannot play",
    );
});
it("free Gear play cannot equip onto Gear already attached to a Legend", () => {
  const g = scenario("the-heist", "program"),
    top = own(g, "a", "deck").slice(0, 4);
  top.forEach(
    (p, i) => (p.cardId = i === 0 ? "mantis-blades" : "animals-wrecker"),
  );
  const legend = own(g, "a", "legends")[0];
  legend.faceUp = true;
  const attached = own(g, "a", "hand").find(
    (p) => p.cardId === "adrenaline-converter",
  )!;
  attached.zone = "legends";
  attached.host = legend.id;
  attached.faceUp = true;
  advance(g);
  answer(g, "a", g.choice!.id, [top[0].id]);
  answer(g, "a", g.choice!.id, [top[0].id]);
  expect(g.choice!.options.map((o) => o.id)).toContain(legend.id);
  expect(g.choice!.options.map((o) => o.id)).not.toContain(attached.id);
  answer(g, "a", g.choice!.id, [legend.id]);
  expect(top[0].host).toBe(legend.id);
});
