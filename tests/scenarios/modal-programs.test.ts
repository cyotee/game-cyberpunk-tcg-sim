import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import { advance, answer, own, power } from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { cost, mayAttack } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
for (const [id, n, ram, color, tags] of [
  ["gunpoint-diplomacy", 4, 3, "Red", ["Ganger", "Plan"]],
  ["nocturne-op55-n1", 3, 2, "Blue", ["Arasaka", "Plan"]],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Program",
      cost: n,
      ram,
      color,
      tags,
      keywords: [],
      power: null,
      sell: true,
    }));
it("Gunpoint gives both benefits without a stronger Rival and consumes ready-attack permission on its next attack", () => {
  let g = scenario("gunpoint-diplomacy", "program"),
    a = own(g, "a", "field")[0],
    target = own(g, "b", "field")[0];
  const before = power(g, a);
  advance(g);
  answer(g, "a", g.choice!.id, [a.id]);
  expect(g.choice).toBeUndefined();
  expect(power(g, a)).toBe(before + 3);
  expect(mayAttack(g, a, target.id)).toBe(true);
  g = applyCommand(g, "a", { type: "attack", piece: a.id, target: target.id });
  g = applyCommand(g, "b", { type: "endReaction" });
  const fresh = g.pieces.find((p) => p.id === a.id)!;
  fresh.ready = true;
  expect(mayAttack(g, fresh, own(g, "c", "field")[0].id)).toBe(false);
  expect(power(g, fresh)).toBe(before + 3);
});
for (const mode of ["0", "1"])
  it(`Gunpoint gives one qualifying Rival the mode decision (${mode}) but keeps the caster's Unit selection`, () => {
    const g = scenario("gunpoint-diplomacy", "program"),
      a = own(g, "a", "field")[0],
      before = power(g, a);
    g.gigs.filter((d) => d.controller === "c").forEach((d) => (d.value = 20));
    advance(g);
    answer(g, "a", g.choice!.id, [a.id]);
    expect(g.choice!.options.map((o) => o.id)).toEqual(["c"]);
    answer(g, "a", g.choice!.id, ["c"]);
    expect(g.choice!.player).toBe("c");
    expect(g.choice!.options.map((o) => o.id)).toEqual(["0", "1"]);
    answer(g, "c", g.choice!.id, [mode]);
    expect(power(g, a)).toBe(before + (mode === "1" ? 3 : 0));
    expect(mayAttack(g, a, own(g, "b", "field")[0].id)).toBe(mode === "0");
  });
it("Nocturne replaces its payment with one when the fixer area is empty", () => {
  const g = scenario("nocturne-op55-n1", "program"),
    p = g.pieces.find((p) => p.zone === "resolving")!;
  expect(cost(g, p)).toBe(3);
  g.players[0].fixer = [];
  expect(cost(g, p)).toBe(1);
  expect(card(p.cardId).cost).toBe(3);
});
it("Nocturne draws two when that mode is chosen", () => {
  const g = scenario("nocturne-op55-n1", "program"),
    n = own(g, "a", "hand").length;
  advance(g);
  answer(g, "a", g.choice!.id, ["0"]);
  expect(own(g, "a", "hand")).toHaveLength(n + 2);
  expect(g.mods).toHaveLength(0);
});
it("Nocturne may prevent even a friendly Unit from attacking, without changing other Units", () => {
  const g = scenario("nocturne-op55-n1", "program"),
    a = own(g, "a", "field")[0];
  advance(g);
  answer(g, "a", g.choice!.id, ["1"]);
  answer(g, "a", g.choice!.id, [a.id]);
  expect(mayAttack(g, a, "b")).toBe(false);
  expect(mayAttack(g, own(g, "a", "field")[2], "b")).toBe(true);
});
it("Nocturne may choose a mode with no eligible target", () => {
  const g = scenario("nocturne-op55-n1", "program");
  own(g, "a", "legends").forEach((p) => (p.zone = "removed"));
  advance(g);
  answer(g, "a", g.choice!.id, ["2"]);
  expect(g.choice).toBeUndefined();
});
it("Nocturne can discount an anonymous face-down Legend, retaining the effect when it is Called", () => {
  let g = scenario("nocturne-op55-n1", "program");
  const legend = own(g, "a", "legends")[0];
  legend.cardId = "jackie-welles-mama-s-favorite";
  advance(g);
  answer(g, "a", g.choice!.id, ["2"]);
  expect(
    g.choice!.options.every((o) => !o.cardId && !o.label.includes("Jackie")),
  ).toBe(true);
  answer(g, "a", g.choice!.id, [legend.id]);
  expect(legend.faceUp).toBe(false);
  expect(() =>
    applyCommand(g, "a", { type: "solo", piece: legend.id }),
  ).toThrow();
  g = applyCommand(g, "a", { type: "call", piece: legend.id });
  while (g.choice)
    g = applyCommand(g, g.choice.player, {
      type: "choose",
      choice: g.choice.id,
      values: g.choice.options.slice(0, g.choice.min).map((o) => o.id),
    });
  const called = g.pieces.find((p) => p.id === legend.id)!;
  expect(called.faceUp).toBe(true);
  expect(cost(g, called, true)).toBe(
    Math.max(1, card(called.cardId).cost! - 2),
  );
});
