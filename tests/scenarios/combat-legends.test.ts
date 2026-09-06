import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  own,
  power,
  advance,
  answer,
  move,
  defeat,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { mayAttack } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
for (const [id, n, power, color, tags, keywords] of [
  [
    "adam-smasher-ender-of-legends",
    9,
    9,
    "Red",
    ["Arasaka", "Merc"],
    ["Go Solo"],
  ],
  [
    "goro-takemura-hands-unclean",
    5,
    7,
    "Green",
    ["Arasaka", "Corpo"],
    ["Go Solo", "Blocker"],
  ],
  [
    "royce-psycho-on-the-edge",
    6,
    6,
    "Red",
    ["Maelstrom", "Ganger"],
    ["Go Solo"],
  ],
  [
    "saburo-arasaka-stubborn-patriarch",
    null,
    0,
    "Green",
    ["Arasaka", "Corpo"],
    [],
  ],
  [
    "sasha-yakovleva-won-t-let-you-down",
    5,
    0,
    "Blue",
    ["Maine's Crew", "Merc", "Netrunner"],
    ["Go Solo"],
  ],
] as const)
  it(`${id}: printed Legend baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Legend",
      cost: n,
      power,
      color,
      tags,
      keywords,
      sell: true,
      ram: 2,
    }));
for (const slug of [
  "adam-smasher-ender-of-legends",
  "goro-takemura-hands-unclean",
  "royce-psycho-on-the-edge",
  "sasha-yakovleva-won-t-let-you-down",
])
  it(`${slug}: Go Solo pays its printed cost, readies it, allows an attack, and removes it on leaving`, () => {
    let g = scenario(slug, "unused");
    g.pending = [];
    const p = own(g, "a", "legends").find((p) => p.cardId === slug)!;
    p.ready = false;
    g = applyCommand(g, "a", { type: "solo", piece: p.id });
    const n = card(slug).cost!;
    expect(g.choice!.min).toBe(n);
    g = applyCommand(g, "a", {
      type: "choose",
      choice: g.choice!.id,
      values: g.choice!.options.slice(0, n).map((o) => o.id),
    });
    if (slug === "adam-smasher-ender-of-legends") {
      const target = own(g, "c", "field")[0];
      g = applyCommand(g, "a", {
        type: "choose",
        choice: g.choice!.id,
        values: [target.id],
      });
      expect(g.pieces.find((p) => p.id === target.id)!.zone).toBe("trash");
    }
    const unit = g.pieces.find((x) => x.id === p.id)!;
    expect(unit.ready).toBe(true);
    expect(unit.zone).toBe("field");
    expect(mayAttack(g, unit, "b")).toBe(true);
    move(g, unit, "trash");
    expect(unit.zone).toBe("removed");
  });
it("Calling Adam Smasher does not trigger his Play defeat", () => {
  let g = scenario("adam-smasher-ender-of-legends", "unused");
  g.pending = [];
  const p = own(g, "a", "legends").find(
    (p) => p.cardId === "adam-smasher-ender-of-legends",
  )!;
  p.faceUp = false;
  g = applyCommand(g, "a", { type: "call", piece: p.id });
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [g.choice!.options[0].id],
  });
  expect(g.choice).toBeUndefined();
  expect(own(g, "b", "field")).toHaveLength(3);
});
it("Goro's Blocker works in the field but cannot be used from the Legends area", () => {
  let g = scenario("goro-takemura-hands-unclean", "unused");
  g.pending = [];
  const p = own(g, "a", "legends").find(
    (p) => p.cardId === "goro-takemura-hands-unclean",
  )!;
  g.turnPlayer = "b";
  g = applyCommand(g, "b", {
    type: "attack",
    piece: own(g, "b", "field")[0].id,
    target: "a",
  });
  expect(() => applyCommand(g, "a", { type: "block", piece: p.id })).toThrow();
  g.pieces.find((x) => x.id === p.id)!.zone = "field";
  g = applyCommand(g, "a", { type: "block", piece: p.id });
  expect(g.attack!.target).toBe(p.id);
});
it("Royce's equipment bonus applies in either area during only its controller's turn, and Gear follows its removal destination", () => {
  const g = scenario("royce-psycho-on-the-edge", "unused");
  g.pending = [];
  const p = own(g, "a", "legends").find(
      (p) => p.cardId === "royce-psycho-on-the-edge",
    )!,
    gear = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!;
  gear.zone = "legends";
  gear.host = p.id;
  gear.faceUp = true;
  expect(power(g, p)).toBe(6 + 2 + 2);
  g.turnPlayer = "b";
  expect(power(g, p)).toBe(6 + 2);
  p.zone = "field";
  gear.zone = "field";
  g.turnPlayer = "a";
  expect(power(g, p)).toBe(10);
  move(g, p, "hand");
  expect(p.zone).toBe("removed");
  expect(gear.zone).toBe("hand");
  expect(gear.host).toBeUndefined();
});
it("Saburo adds one through fight and steal steps only to a friendly attacking Arasaka", () => {
  const g = scenario("saburo-arasaka-stubborn-patriarch", "unused");
  g.pending = [];
  const a = own(g, "a", "field")[0];
  a.cardId = "goro-takemura-hands-unclean";
  const base = card(a.cardId).power!;
  expect(power(g, a)).toBe(base);
  for (const stage of ["effects", "react", "fight", "steal"] as const) {
    g.attack = {
      attacker: a.id,
      target: own(g, "b", "field")[1].id,
      defender: "b",
      stage,
    };
    expect(power(g, a)).toBe(base + 1);
  }
  g.attack!.attacker = own(g, "b", "field")[0].id;
  g.attack!.target = a.id;
  expect(power(g, a)).toBe(base);
  g.attack!.attacker = a.id;
  a.cardId = "animals-wrecker";
  expect(power(g, a)).toBe(card(a.cardId).power);
});
it("Sasha reveals and keeps the top card only after attack declaration, then gains its printed cost", () => {
  let g = scenario("sasha-yakovleva-won-t-let-you-down", "unused");
  g.pending = [];
  const p = own(g, "a", "legends").find(
    (p) => p.cardId === "sasha-yakovleva-won-t-let-you-down",
  )!;
  p.zone = "field";
  p.entered = 0;
  const top = own(g, "a", "deck")[0];
  top.cardId = "animals-wrecker";
  g = applyCommand(g, "a", { type: "attack", piece: p.id, target: "c" });
  expect(g.attack!.defender).toBe("c");
  expect(g.pieces.find((p) => p.id === top.id)!.zone).toBe("hand");
  expect(
    power(
      g,
      g.pieces.find((x) => x.id === p.id)!,
    ),
  ).toBe(card(top.cardId).cost);
  expect(
    g.log.some(
      (e) => !e.privateTo && e.text.includes("reveals Animals Wrecker"),
    ),
  ).toBe(true);
});
it("Sasha does not draw from an empty deck and its zero-power attack steals nothing", () => {
  let g = scenario("sasha-yakovleva-won-t-let-you-down", "unused");
  g.pending = [];
  const p = own(g, "a", "legends").find(
    (p) => p.cardId === "sasha-yakovleva-won-t-let-you-down",
  )!;
  p.zone = "field";
  own(g, "a", "deck").forEach((p) => (p.zone = "removed"));
  g = applyCommand(g, "a", { type: "attack", piece: p.id, target: "b" });
  g = applyCommand(g, "b", { type: "endReaction" });
  expect(g.players[0].eliminated).toBe(false);
  expect(g.gigs.filter((d) => d.controller === "a")).toHaveLength(6);
});
it("Sasha's defeat lets its controller select one Rival, who chooses their own discard", () => {
  const g = scenario("sasha-yakovleva-won-t-let-you-down", "unused");
  g.pending = [];
  const p = own(g, "a", "legends").find(
    (p) => p.cardId === "sasha-yakovleva-won-t-let-you-down",
  )!;
  p.zone = "field";
  defeat(g, p, "b");
  advance(g);
  expect(g.choice!.player).toBe("a");
  answer(g, "a", g.choice!.id, ["c"]);
  expect(g.choice!.player).toBe("c");
  const discard = own(g, "c", "hand")[0];
  answer(g, "c", g.choice!.id, [discard.id]);
  expect(discard.zone).toBe("trash");
  expect(p.zone).toBe("removed");
});
