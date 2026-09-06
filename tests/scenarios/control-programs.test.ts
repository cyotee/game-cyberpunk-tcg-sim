import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import { advance, answer, own, ready, job } from "../../packages/engine/kernel";
import { applyCommand, type Game } from "../../packages/engine/index";
import { mayAttack } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
const baselines = [
  ["chrome-reverie", 3, 1, "Blue", "Braindance", false],
  ["memory-relapse", 4, 2, "Green", "Braindance", false],
  ["synapse-burnout", 1, 1, "Green", "Quickhack", true],
  ["reboot-optics", 2, 2, "Blue", "Quickhack", true],
  ["take-control", 2, 2, "Green", "Quickhack", true],
  ["appetite-for-destruction", 3, 4, "Red", "Ganger", false],
] as const;
for (const [id, cost, ram, color, tag, quick] of baselines)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Program",
      cost,
      ram,
      color,
      power: null,
      sell: true,
      tags: [tag],
      keywords: quick ? ["Quick"] : [],
    }));
function start(g: Game, player: string) {
  g.turnPlayer = player;
  g.frames.push(job(g, "start-turn", player));
  advance(g);
  while (g.choice)
    answer(
      g,
      g.choice.player,
      g.choice.id,
      g.choice.options.slice(0, g.choice.min).map((o) => o.id),
    );
}
function select(g: Game, id: string) {
  advance(g);
  answer(g, "a", g.choice!.id, [id]);
}
it("Chrome Reverie restricts one selected Rival until the caster's next turn and offers an immediate optional free Call", () => {
  const g = scenario("chrome-reverie", "program"),
    b = own(g, "b", "field")[0],
    c = own(g, "c", "field")[0];
  const eddies = own(g, "a", "eddies").filter((p) => p.ready).length;
  select(g, b.id);
  g.turnPlayer = "b";
  expect(mayAttack(g, b, "c")).toBe(false);
  g.turnPlayer = "c";
  expect(mayAttack(g, c, "b")).toBe(true);
  g.turnPlayer = "a";
  expect(g.choice!.min).toBe(0);
  const legend = own(g, "a", "legends")[1];
  answer(g, "a", g.choice!.id, [legend.id]);
  expect(legend.faceUp).toBe(true);
  expect(g.players[0].called).toBe(true);
  expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(eddies);
  start(g, "b");
  expect(mayAttack(g, b, "c")).toBe(false);
  start(g, "a");
  g.turnPlayer = "b";
  expect(mayAttack(g, b, "c")).toBe(true);
});
for (const reason of ["no minimum", "already called"])
  it(`Chrome Reverie does not offer a free Call with ${reason}`, () => {
    const g = scenario("chrome-reverie", "program");
    if (reason === "no minimum")
      g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 2));
    else g.players[0].called = true;
    select(g, own(g, "c", "field")[0].id);
    expect(g.choice).toBeUndefined();
  });
for (const spent of [false, true])
  it(`Memory Relapse can freeze an ${spent ? "already spent" : "initially ready"} rival Unit, draws for even Cred, and expires on caster's next turn`, () => {
    const g = scenario("memory-relapse", "program"),
      b = own(g, "b", "field")[0];
    b.ready = !spent;
    g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 2));
    const hand = own(g, "a", "hand").length;
    select(g, b.id);
    expect(own(g, "a", "hand")).toHaveLength(hand + 1);
    expect(b.ready).toBe(false);
    ready(g, b);
    expect(b.ready).toBe(false);
    start(g, "b");
    expect(b.ready).toBe(false);
    start(g, "a");
    ready(g, b);
    expect(b.ready).toBe(true);
  });
it("Memory Relapse does not draw for odd Cred", () => {
  const g = scenario("memory-relapse", "program"),
    n = own(g, "a", "hand").length;
  select(g, own(g, "c", "field")[0].id);
  expect(own(g, "a", "hand")).toHaveLength(n);
});
for (const defender of ["a", "c"])
  it(`Reboot Optics preserves only the caster's friendly opponent, against ${defender}`, () => {
    let g = scenario("reboot-optics", "program");
    const b = own(g, "b", "field")[0],
      t = own(g, defender, "field")[0];
    b.cardId = "animals-wrecker";
    t.cardId = "emergency-atlus";
    t.ready = false;
    select(g, b.id);
    g.turnPlayer = "b";
    g = applyCommand(g, "b", { type: "attack", piece: b.id, target: t.id });
    g = applyCommand(g, defender, { type: "endReaction" });
    expect(g.pieces.find((p) => p.id === t.id)!.zone).toBe(
      defender === "a" ? "field" : "trash",
    );
    expect(g.mods.some((m) => m.kind === "noDefeat")).toBe(false);
  });
for (const slug of [
  "delamain-rideshare-ai",
  "secondhand-bombus",
  "emergency-atlus",
  "animals-wrecker",
])
  it(`Take Control reduces effect theft and draws only for a qualifying ${slug}`, () => {
    const g = scenario("take-control", "program"),
      b = own(g, "b", "field")[0];
    b.cardId = slug;
    const n = own(g, "a", "hand").length;
    select(g, b.id);
    expect(own(g, "a", "hand")).toHaveLength(
      n + (slug === "animals-wrecker" ? 0 : 1),
    );
    const dice = g.gigs.filter((d) => d.controller === "c").slice(0, 2);
    g.frames.push(
      job(g, "steal-gigs", "b", b.id, undefined, {
        ids: dice.map((d) => d.id),
      }),
    );
    advance(g);
    expect(dice.filter((d) => d.controller === "b")).toHaveLength(1);
  });
for (const margin of [2, 3])
  it(`Appetite checks the three-power margin and steals from a chosen Rival after winning by ${margin}`, () => {
    let g = scenario("appetite-for-destruction", "program");
    advance(g);
    const a = own(g, "a", "field")[0],
      b = own(g, "b", "field")[0];
    a.cardId = "animals-wrecker";
    b.cardId = "animals-wrecker";
    b.ready = false;
    // A 7-power printed Unit versus an otherwise identical Unit, with a stable fight modifier.
    g.mods.push({
      id: "margin",
      controller: "a",
      target: a.id,
      kind: "power",
      amount: margin,
      expires: "turn",
      turn: g.turn,
    });
    g = applyCommand(g, "a", { type: "attack", piece: a.id, target: b.id });
    g = applyCommand(g, "b", { type: "endReaction" });
    if (margin === 2) {
      expect(g.choice).toBeUndefined();
      expect(g.mods.some((m) => m.kind === "appetite")).toBe(true);
    } else {
      const die = g.gigs.find((d) => d.controller === "c")!;
      expect(g.choice!.min).toBe(1);
      expect(g.choice!.options.map((o) => o.id)).toContain(die.id);
      g = applyCommand(g, "a", {
        type: "choose",
        choice: g.choice!.id,
        values: [die.id],
      });
      expect(g.gigs.find((d) => d.id === die.id)!.controller).toBe("a");
      expect(g.pieces.find((p) => p.id === a.id)!.marks.stole).toBe(g.turn);
      expect(g.mods.some((m) => m.kind === "appetite")).toBe(false);
    }
    expect(g.pieces.find((p) => p.id === b.id)!.zone).toBe("trash");
  });
it("Appetite is consumed even if Take Control prevents its extra Gig theft", () => {
  let g = scenario("appetite-for-destruction", "program");
  advance(g);
  const a = own(g, "a", "field")[0],
    b = own(g, "b", "field")[0];
  b.cardId = "emergency-atlus";
  b.ready = false;
  g.mods.push({
    id: "reduce",
    controller: "b",
    target: a.id,
    kind: "steal",
    amount: -1,
    expires: "turn",
    turn: g.turn,
  });
  g = applyCommand(g, "a", { type: "attack", piece: a.id, target: b.id });
  g = applyCommand(g, "b", { type: "endReaction" });
  const die = g.gigs.find((d) => d.controller === "c")!;
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [die.id],
  });
  expect(g.gigs.find((d) => d.id === die.id)!.controller).toBe("c");
  expect(g.mods.some((m) => m.kind === "appetite")).toBe(false);
  expect(g.pieces.find((p) => p.id === a.id)!.marks.stole).toBeUndefined();
});
it("Appetite still steals when its winning Unit is prevented from defeating the loser", () => {
  let g = scenario("appetite-for-destruction", "program");
  advance(g);
  const a = own(g, "a", "field")[0],
    b = own(g, "b", "field")[0];
  b.cardId = "emergency-atlus";
  b.ready = false;
  g.mods.push({
    id: "reboot",
    controller: "b",
    target: a.id,
    kind: "noDefeat",
    amount: 0,
    expires: "turn",
    turn: g.turn,
  });
  g = applyCommand(g, "a", { type: "attack", piece: a.id, target: b.id });
  g = applyCommand(g, "b", { type: "endReaction" });
  const die = g.gigs.find((d) => d.controller === "b")!;
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [die.id],
  });
  expect(g.pieces.find((p) => p.id === b.id)!.zone).toBe("field");
  expect(g.gigs.find((d) => d.id === die.id)!.controller).toBe("a");
});
