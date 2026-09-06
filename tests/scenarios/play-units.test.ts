import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  keyword,
  ready,
  job,
  emit,
  pairs,
} from "../../packages/engine/kernel";
import { applyCommand, type Game } from "../../packages/engine/index";
import { mayAttack } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
for (const [id, cost, power, ram, color, tags, keywords] of [
  ["lizzy-wizzy-delicate-weapon", 5, 2, 2, "Blue", ["Rocker"], ["Blocker"]],
  [
    "viktor-vektor-you-might-feel-a-little-pinch",
    3,
    3,
    2,
    "Yellow",
    ["Ripperdoc"],
    [],
  ],
  ["yorinobu-arasaka-steel-dragon", 7, 9, 3, "Red", ["Arasaka", "Corpo"], []],
  ["valentino-street-racer", 3, 3, 2, "Green", ["Valentino", "Vehicle"], []],
  ["sandayu-oda-hanako-s-guardian", 7, 8, 2, "Green", ["Arasaka", "Corpo"], []],
  ["pacifica-netrunner", 4, 1, 2, "Green", ["Netrunner"], []],
  ["mox-inciters", 3, 2, 2, "Blue", ["Ganger", "Mox"], ["Blocker"]],
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
function start(g: Game, id: string) {
  g.turnPlayer = id;
  g.frames.push(job(g, "start-turn", id));
  advance(g);
  while (g.choice)
    answer(
      g,
      g.choice.player,
      g.choice.id,
      g.choice.options.slice(0, g.choice.min).map((o) => o.id),
    );
}
for (const zone of ["hand", "trash"] as const)
  it(`Lizzy plays a cheap Program from ${zone} and bottom-decks after resolving`, () => {
    const g = scenario("lizzy-wizzy-delicate-weapon", "play"),
      p = own(g, "a", zone).find((p) => p.cardId === "afterparty-at-lizzie-s")!,
      n = own(g, "a", "eddies").filter((p) => p.ready).length;
    advance(g);
    expect(g.choice!.min).toBe(0);
    expect(
      g.choice!.options.every((o) => {
        const p = g.pieces.find((p) => p.id === o.id)!;
        return (
          p.controller === "a" &&
          card(p.cardId).type === "Program" &&
          card(p.cardId).cost! <= 3
        );
      }),
    ).toBe(true);
    answer(g, "a", g.choice!.id, [p.id]);
    expect(p.zone).toBe("resolving");
    const die = g.gigs[0];
    answer(g, "a", g.choice!.id, [die.id]);
    answer(g, "a", g.choice!.id, [String(die.value)]);
    expect(own(g, "a", "deck").at(-1)!.id).toBe(p.id);
    expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(n);
  });
it("Viktor must play eligible Cyberware from trash onto another friendly Unit", () => {
  const g = scenario("viktor-vektor-you-might-feel-a-little-pinch", "play"),
    src = g.pending[0].source;
  advance(g);
  expect(g.choice!.min).toBe(1);
  expect(
    g.choice!.options.every((o) => {
      const p = g.pieces.find((p) => p.id === o.id)!;
      return (
        p.zone === "trash" &&
        p.controller === "a" &&
        card(p.cardId).tags.includes("Cyberware") &&
        card(p.cardId).cost! <= 2
      );
    }),
  ).toBe(true);
  const gear = own(g, "a", "trash").find((p) => p.cardId === "mantis-blades")!;
  answer(g, "a", g.choice!.id, [gear.id]);
  expect(g.choice!.options.some((o) => o.id === src)).toBe(false);
  const host = own(g, "a", "field")[0];
  answer(g, "a", g.choice!.id, [host.id]);
  expect(gear.host).toBe(host.id);
  expect(gear.zone).toBe("field");
});
for (const zone of ["hand", "trash"] as const)
  it(`Yorinobu free-plays a Unit from ${zone} with early attacks only against spent Units`, () => {
    const g = scenario("yorinobu-arasaka-steel-dragon", "play"),
      p = own(g, "a", zone).find((p) => p.cardId === "emergency-atlus")!;
    advance(g);
    expect(g.choice!.min).toBe(0);
    answer(g, "a", g.choice!.id, [p.id]);
    expect(p.zone).toBe("field");
    expect(p.entered).toBe(g.turn);
    expect(mayAttack(g, p, own(g, "b", "field")[1].id)).toBe(true);
    expect(mayAttack(g, p, own(g, "b", "field")[0].id)).toBe(false);
    expect(mayAttack(g, p, "b")).toBe(false);
  });
it("Yorinobu draws on the first Arasaka defeat even if it belongs to a Rival, only once", () => {
  const g = scenario("yorinobu-arasaka-steel-dragon", "unused"),
    rival = own(g, "b", "field")[0],
    n = own(g, "a", "hand").length;
  g.pending = [];
  rival.cardId = "hanako-arasaka-in-a-gilded-cage";
  for (let i = 0; i < 2; i++) {
    emit(g, { type: "defeated", actor: "b", piece: { ...rival } });
    advance(g);
  }
  expect(own(g, "a", "hand")).toHaveLength(n + 1);
});
it("Valentino grants Adrenaline to another cheap friendly Unit for this turn", () => {
  const g = scenario("valentino-street-racer", "play"),
    src = g.pending[0].source,
    p = own(g, "a", "field")[2];
  p.entered = g.turn;
  advance(g);
  expect(g.choice!.options.some((o) => o.id === src)).toBe(false);
  expect(
    g.choice!.options.every((o) => {
      const p = g.pieces.find((p) => p.id === o.id)!;
      return p.controller === "a" && card(p.cardId).cost! <= 5;
    }),
  ).toBe(true);
  answer(g, "a", g.choice!.id, [p.id]);
  expect(keyword(g, p, "Adrenaline")).toBe(true);
  expect(mayAttack(g, p, "b")).toBe(true);
  const next = applyCommand(g, "a", { type: "endTurn" });
  expect(
    keyword(
      next,
      next.pieces.find((x) => x.id === p.id)!,
      "Adrenaline",
    ),
  ).toBe(false);
});
for (const n of [0, 2])
  it(`Sandayu requires ${n} distinct targets for ${n} pairs, spanning Rivals`, () => {
    const g = scenario("sandayu-oda-hanako-s-guardian", "play"),
      values = n ? [1, 1, 2, 2, 3, 4] : [1, 2, 3, 4, 5, 6];
    g.gigs
      .filter((d) => d.controller === "a")
      .forEach((d, i) => (d.value = values[i]));
    expect(pairs(g, "a")).toBe(n);
    advance(g);
    if (!n) expect(g.choice).toBeUndefined();
    else {
      expect(g.choice!.min).toBe(n);
      expect(g.choice!.max).toBe(n);
      const ps = [own(g, "b", "field")[0], own(g, "c", "field")[0]];
      expect(() => answer(g, "a", g.choice!.id, [ps[0].id])).toThrow();
      answer(
        g,
        "a",
        g.choice!.id,
        ps.map((p) => p.id),
      );
      expect(ps.every((p) => !p.ready)).toBe(true);
    }
    const src = own(g, "a", "field").find(
      (p) => p.cardId === "sandayu-oda-hanako-s-guardian",
    )!;
    src.entered = g.turn;
    expect(mayAttack(g, src, own(g, "b", "field")[1].id)).toBe(true);
    expect(mayAttack(g, src, "b")).toBe(false);
  });
for (const even of [false, true])
  it(`Pacifica freezes a Rival only for even Street Cred (${even})`, () => {
    const g = scenario("pacifica-netrunner", "play"),
      p = own(g, "c", "field")[1];
    g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 2));
    if (!even) g.gigs[0].value = 1;
    advance(g);
    if (!even) {
      expect(g.choice).toBeUndefined();
      return;
    }
    answer(g, "a", g.choice!.id, [p.id]);
    ready(g, p);
    expect(p.ready).toBe(false);
    start(g, "b");
    ready(g, p);
    expect(p.ready).toBe(false);
    start(g, "a");
    ready(g, p);
    expect(p.ready).toBe(true);
  });
it("Mox forces its chosen Rival Unit to attack before ending that player's next turn, if able", () => {
  const g = scenario("mox-inciters", "play"),
    p = own(g, "c", "field")[0];
  advance(g);
  answer(g, "a", g.choice!.id, [p.id]);
  g.turnPlayer = "c";
  expect(() => applyCommand(g, "c", { type: "endTurn" })).toThrow(
    "must attack",
  );
  p.ready = false;
  expect(() => applyCommand(g, "c", { type: "endTurn" })).not.toThrow();
});

it("Yorinobu entering after the first Arasaka defeat cannot trigger on a later defeat", () => {
  const g = scenario("yorinobu-arasaka-steel-dragon", "unused"),
    src = own(g, "a", "field").find(
      (p) => p.cardId === "yorinobu-arasaka-steel-dragon",
    )!,
    rival = own(g, "b", "field")[0];
  g.pending = [];
  src.zone = "hand";
  rival.cardId = "hanako-arasaka-in-a-gilded-cage";
  emit(g, { type: "defeated", actor: "b", piece: { ...rival } });
  advance(g);
  const n = own(g, "a", "hand").length;
  src.zone = "field";
  emit(g, { type: "defeated", actor: "b", piece: { ...rival } });
  advance(g);
  expect(own(g, "a", "hand")).toHaveLength(n - 1);
});
