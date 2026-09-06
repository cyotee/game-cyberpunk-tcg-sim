import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  emit,
  power,
  move,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { card } from "../../packages/catalog/index";
for (const [id, color, tags, keywords] of [
  [
    "dum-dum-maelstrom-triggerman",
    "Yellow",
    ["Ganger", "Maelstrom"],
    ["Quick"],
  ],
  [
    "hanako-arasaka-daughter-of-the-emperor",
    "Green",
    ["Arasaka", "Corpo", "Netrunner"],
    [],
  ],
  ["judy-a-lvarez-braindance-maestro", "Blue", ["Ganger", "Mox", "Techie"], []],
  ["yorinobu-arasaka-embracing-destruction", "Red", ["Arasaka", "Corpo"], []],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Legend",
      cost: null,
      power: 0,
      ram: 2,
      sell: true,
      color,
      tags,
      keywords,
    }));
it("Hanako's controller chooses both Gigs, preserving their values and not counting the swap as theft", () => {
  let g = scenario("hanako-arasaka-daughter-of-the-emperor", "unused");
  g.pending = [];
  const p = own(g, "a", "legends").find(
      (p) => p.cardId === "hanako-arasaka-daughter-of-the-emperor",
    )!,
    a = g.gigs.find((d) => d.controller === "a")!,
    c = g.gigs.find((d) => d.controller === "c" && d.sides === 6)!;
  g = applyCommand(g, "a", { type: "activate", piece: p.id });
  expect(g.choice!.player).toBe("a");
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [a.id],
  });
  expect(g.choice!.player).toBe("a");
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [c.id],
  });
  expect(g.gigs.find((d) => d.id === a.id)).toMatchObject({
    controller: "c",
    value: a.value,
  });
  expect(g.gigs.find((d) => d.id === c.id)).toMatchObject({
    controller: "a",
    value: c.value,
  });
  expect(g.pieces.every((p) => p.marks.stole === undefined)).toBe(true);
});
it("Hanako draws for disjoint friendly pairs at her owner's start only", () => {
  const g = scenario("hanako-arasaka-daughter-of-the-emperor", "unused");
  g.pending = [];
  const vals = [1, 1, 1, 1, 2, 3];
  g.gigs
    .filter((d) => d.controller === "a")
    .forEach((d, i) => (d.value = vals[i]));
  const n = own(g, "a", "hand").length;
  emit(g, { type: "start", actor: "c" });
  advance(g);
  expect(own(g, "a", "hand")).toHaveLength(n);
  emit(g, { type: "start", actor: "a" });
  advance(g);
  expect(own(g, "a", "hand")).toHaveLength(n + 2);
});
for (const keep of [false, true])
  it(`Judy spends to trash one, then may ${keep ? "keep" : "decline"} that newly trashed Program`, () => {
    let g = scenario("judy-a-lvarez-braindance-maestro", "unused");
    g.pending = [];
    const p = own(g, "a", "legends").find(
        (p) => p.cardId === "judy-a-lvarez-braindance-maestro",
      )!,
      top = own(g, "a", "deck")[0];
    top.cardId = "floor-it";
    g = applyCommand(g, "a", { type: "activate", piece: p.id });
    expect(g.pieces.find((p) => p.id === top.id)!.zone).toBe("trash");
    expect(g.choice!.options.map((o) => o.id)).toEqual([top.id]);
    g = applyCommand(g, "a", {
      type: "choose",
      choice: g.choice!.id,
      values: keep ? [top.id] : [],
    });
    expect(g.pieces.find((p) => p.id === top.id)!.zone).toBe(
      keep ? "hand" : "trash",
    );
  });
it("Judy does not retrieve a non-Program or an older Program", () => {
  let g = scenario("judy-a-lvarez-braindance-maestro", "unused");
  g.pending = [];
  const p = own(g, "a", "legends").find(
      (p) => p.cardId === "judy-a-lvarez-braindance-maestro",
    )!,
    top = own(g, "a", "deck")[0];
  top.cardId = "animals-wrecker";
  g = applyCommand(g, "a", { type: "activate", piece: p.id });
  expect(g.choice).toBeUndefined();
  expect(g.pieces.find((p) => p.id === top.id)!.zone).toBe("trash");
});
it("Judy's Braindance trigger is repeatable on a Rival's turn and may strengthen the same friendly Unit", () => {
  const g = scenario("judy-a-lvarez-braindance-maestro", "unused");
  g.pending = [];
  g.turnPlayer = "b";
  const target = own(g, "a", "field")[0],
    n = power(g, target),
    program = own(g, "a", "trash").find((p) => p.cardId === "memory-relapse")!;
  for (let i = 1; i <= 2; i++) {
    program.zone = "resolving";
    emit(g, { type: "play", actor: "a", piece: { ...program } });
    advance(g);
    expect(g.choice!.min).toBe(1);
    answer(g, "a", g.choice!.id, [target.id]);
    expect(power(g, target)).toBe(n + i);
    program.zone = "trash";
  }
  emit(g, { type: "play", actor: "c", piece: { ...program, controller: "c" } });
  advance(g);
  expect(g.choice).toBeUndefined();
});
for (const sacrifice of [false, true])
  it(`Dum Dum's Call draws ${sacrifice ? 2 : 1} depending on sacrificing a friendly Gear`, () => {
    const g = scenario("dum-dum-maelstrom-triggerman", "call"),
      gear = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!;
    gear.zone = "field";
    gear.host = own(g, "a", "field")[0].id;
    const n = own(g, "a", "hand").length;
    advance(g);
    answer(g, "a", g.choice!.id, sacrifice ? [gear.id] : []);
    expect(gear.zone).toBe(sacrifice ? "trash" : "field");
    expect(own(g, "a", "hand")).toHaveLength(n + (sacrifice ? 2 : 1));
  });
for (const equipped of [false, true])
  it(`Dum Dum's Quick boost pays one and counts equipment at resolution (${equipped})`, () => {
    let g = scenario("dum-dum-maelstrom-triggerman", "unused");
    g.pending = [];
    g.turnPlayer = "b";
    const source = own(g, "a", "legends").find(
        (p) => p.cardId === "dum-dum-maelstrom-triggerman",
      )!,
      target = own(g, "a", "field")[0],
      gear = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!;
    if (equipped) {
      gear.zone = "field";
      gear.host = target.id;
    }
    g = applyCommand(g, "b", {
      type: "attack",
      piece: own(g, "b", "field")[0].id,
      target: "a",
    });
    g = applyCommand(g, "a", { type: "activate", piece: source.id });
    expect(g.choice!.min).toBe(1);
    g = applyCommand(g, "a", {
      type: "choose",
      choice: g.choice!.id,
      values: [g.choice!.options[0].id],
    });
    g = applyCommand(g, "a", {
      type: "choose",
      choice: g.choice!.id,
      values: [target.id],
    });
    const unit = g.pieces.find((p) => p.id === target.id)!,
      attached = g.pieces.find((p) => p.id === gear.id)!;
    expect(power(g, unit)).toBe(
      card(unit.cardId).power! + (equipped ? card(gear.cardId).power! + 1 : 0),
    );
    if (equipped) move(g, attached, "trash");
    expect(power(g, unit)).toBe(card(unit.cardId).power! + (equipped ? 1 : 0));
  });
for (const low of [false, true])
  it(`Yorinobu draws on the first friendly Arasaka attack, then discards only below twenty Cred (${low})`, () => {
    let g = scenario("yorinobu-arasaka-embracing-destruction", "unused");
    g.pending = [];
    const p = own(g, "a", "field")[0];
    p.cardId = "goro-takemura-hands-unclean";
    if (low)
      g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 1));
    const n = own(g, "a", "hand").length;
    g = applyCommand(g, "a", { type: "attack", piece: p.id, target: "b" });
    expect(own(g, "a", "hand")).toHaveLength(n + 1);
    if (low) {
      expect(g.choice!.player).toBe("a");
      g = applyCommand(g, "a", {
        type: "choose",
        choice: g.choice!.id,
        values: [g.choice!.options[0].id],
      });
      expect(own(g, "a", "hand")).toHaveLength(n);
    } else expect(g.choice).toBeUndefined();
  });
