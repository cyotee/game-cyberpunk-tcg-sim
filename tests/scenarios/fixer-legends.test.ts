import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  field,
  power,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { card } from "../../packages/catalog/index";
const fixers = [
  ["dexter-deshawn-off-the-grid", "Red", ["Fixer"]],
  ["muamar-reyes-el-capita-n", "Yellow", ["Fixer"]],
  ["padre-man-of-the-cross", "Green", ["Fixer", "Ganger", "Valentino"]],
  ["wakako-okada-peace-and-harmony", "Blue", ["Fixer", "Tyger Claws"]],
] as const;
for (const [id, color, tags] of fixers) {
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Legend",
      cost: null,
      power: 0,
      ram: 2,
      sell: true,
      color,
      tags,
      keywords: [],
    }));
  it(`${id}: Call may draw one or choose an ineffective Unit mode`, () => {
    const g = scenario(id, "call"),
      n = own(g, "a", "hand").length;
    advance(g);
    answer(g, "a", g.choice!.id, ["1"]);
    expect(own(g, "a", "hand")).toHaveLength(n + 1);
    const empty = scenario(id, "call");
    field(empty).forEach((p) => (p.zone = "trash"));
    advance(empty);
    answer(empty, "a", empty.choice!.id, ["0"]);
    expect(empty.choice).toBeUndefined();
  });
}
for (const [slug, controller, amount] of [
  ["dexter-deshawn-off-the-grid", "a", 2],
  ["wakako-okada-peace-and-harmony", "c", -2],
] as const)
  it(`${slug}: its Call applies the power change only to an eligible Unit`, () => {
    const g = scenario(slug, "call"),
      target = own(g, controller, "field")[0],
      before = power(g, target);
    advance(g);
    answer(g, "a", g.choice!.id, ["0"]);
    expect(
      g.choice!.options.every(
        (o) =>
          (g.pieces.find((p) => p.id === o.id)!.controller === "a") ===
          (controller === "a"),
      ),
    ).toBe(true);
    answer(g, "a", g.choice!.id, [target.id]);
    expect(power(g, target)).toBe(Math.max(0, before + amount));
  });
it("Padre's Call can spend a Unit controlled by a third player", () => {
  const g = scenario("padre-man-of-the-cross", "call"),
    target = own(g, "c", "field")[0];
  advance(g);
  answer(g, "a", g.choice!.id, ["0"]);
  answer(g, "a", g.choice!.id, [target.id]);
  expect(target.ready).toBe(false);
});
it("Muamar protects a friendly Unit from multiple fight defeats during the turn", () => {
  let g = scenario("muamar-reyes-el-capita-n", "call");
  const target = own(g, "a", "field")[1];
  advance(g);
  answer(g, "a", g.choice!.id, ["0"]);
  answer(g, "a", g.choice!.id, [target.id]);
  for (const id of ["b", "c"]) {
    g.turnPlayer = id;
    g = applyCommand(g, id, {
      type: "attack",
      piece: own(g, id, "field")[0].id,
      target: target.id,
    });
    g = applyCommand(g, "a", { type: "endReaction" });
    expect(g.pieces.find((p) => p.id === target.id)!.zone).toBe("field");
  }
});
for (const [slug, value, expected] of [
  ["dexter-deshawn-off-the-grid", 2, ["2", "3", "4"]],
  ["wakako-okada-peace-and-harmony", 1, ["1"]],
  ["muamar-reyes-el-capita-n", 2, ["1", "3"]],
] as const)
  it(`${slug}: spending the Legend offers only the printed adjustment amounts on a third player's Gig`, () => {
    let g = scenario(slug, "unused");
    g.pending = [];
    const source = own(g, "a", "legends").find((p) => p.cardId === slug)!,
      die = g.gigs.find((d) => d.controller === "c" && d.sides === 6)!;
    die.value = value;
    g = applyCommand(g, "a", { type: "activate", piece: source.id });
    expect(g.pieces.find((p) => p.id === source.id)!.ready).toBe(false);
    g = applyCommand(g, "a", {
      type: "choose",
      choice: g.choice!.id,
      values: [die.id],
    });
    expect(g.choice!.options.map((o) => o.id)).toEqual(expected);
    g = applyCommand(g, "a", {
      type: "choose",
      choice: g.choice!.id,
      values: [expected.at(-1)!],
    });
    expect(g.gigs.find((d) => d.id === die.id)!.value).toBe(
      Number(expected.at(-1)),
    );
  });
it("Padre sets between different controllers, including two Rivals, and permits an already equal value", () => {
  let g = scenario("padre-man-of-the-cross", "unused");
  g.pending = [];
  const source = own(g, "a", "legends").find(
      (p) => p.cardId === "padre-man-of-the-cross",
    )!,
    b = g.gigs.find((d) => d.controller === "b" && d.sides === 6)!,
    c = g.gigs.find((d) => d.controller === "c" && d.sides === 6)!;
  b.value = c.value = 2;
  g = applyCommand(g, "a", { type: "activate", piece: source.id });
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [b.id],
  });
  expect(
    g.choice!.options.every(
      (o) => g.gigs.find((d) => d.id === o.id)!.controller !== "b",
    ),
  ).toBe(true);
  expect(g.choice!.options.map((o) => o.id)).toContain(c.id);
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [c.id],
  });
  expect(g.gigs.find((d) => d.id === b.id)!.value).toBe(2);
});
