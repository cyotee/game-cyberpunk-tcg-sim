import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  emit,
  job,
  move,
  power,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { mayAttack } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
for (const [id, n, power, ram, color, tags, keywords] of [
  ["chrome-fang", 5, 6, 1, "Red", ["Ganger", "Netrunner", "Tyger Claws"], []],
  ["delamain-cab", 4, 4, 2, "Blue", ["Vehicle"], []],
  [
    "kerry-eurodyne-the-last-rockerboy",
    4,
    5,
    1,
    "Red",
    ["Rocker", "Samurai"],
    [],
  ],
  ["maxtac-squadron", 3, 4, 3, "Green", ["NCPD"], []],
  [
    "modded-kusanagi",
    6,
    8,
    2,
    "Blue",
    ["Tyger Claws", "Vehicle"],
    ["Adrenaline"],
  ],
  ["modded-muramasa", 5, 4, 2, "Blue", ["Vehicle"], []],
  ["secondhand-bombus", 2, 0, 2, "Yellow", ["Drone", "Zetatech"], ["Blocker"]],
  ["tyger-s-whisper", 2, 0, 1, "Green", ["Fixer", "Tyger Claws"], []],
  ["westbrook-netrunner", 4, 5, 2, "Blue", ["Netrunner"], []],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Unit",
      cost: n,
      power,
      ram,
      color,
      tags,
      keywords,
      sell: false,
    }));
for (const gone of [false, true])
  it(`Delamain readies one Eddie only if its theft-bearing copy remains at turn end (${gone})`, () => {
    const g = scenario("delamain-cab", "unused");
    g.pending = [];
    const p = own(g, "a", "field").find((p) => p.cardId === "delamain-cab")!,
      eddie = own(g, "a", "eddies")[0];
    eddie.ready = false;
    const die = g.gigs.find((d) => d.controller === "b")!;
    g.frames.push(
      job(g, "steal-gigs", "a", p.id, undefined, { ids: [die.id] }),
    );
    advance(g);
    if (gone) move(g, p, "trash");
    emit(g, { type: "end", actor: "a" });
    advance(g);
    if (gone) expect(g.choice).toBeUndefined();
    else {
      expect(g.choice!.min).toBe(1);
      answer(g, "a", g.choice!.id, [eddie.id]);
      expect(eddie.ready).toBe(true);
    }
  });
it("Delamain does not ready an Eddie without this turn's theft or at a Rival's end", () => {
  const g = scenario("delamain-cab", "unused");
  g.pending = [];
  emit(g, { type: "end", actor: "a" });
  advance(g);
  expect(g.choice).toBeUndefined();
  own(g, "a", "field").find((p) => p.cardId === "delamain-cab")!.marks.stole =
    g.turn;
  emit(g, { type: "end", actor: "b" });
  advance(g);
  expect(g.choice).toBeUndefined();
});
for (const gone of [false, true])
  it(`Kusanagi has Adrenaline and returns only from the field at its owner's end (${gone})`, () => {
    const g = scenario("modded-kusanagi", "unused");
    g.pending = [];
    const p = own(g, "a", "field").find((p) => p.cardId === "modded-kusanagi")!;
    p.entered = g.turn;
    expect(mayAttack(g, p, "b")).toBe(true);
    if (gone) move(g, p, "trash");
    emit(g, { type: "end", actor: "b" });
    advance(g);
    expect(p.zone).toBe(gone ? "trash" : "field");
    emit(g, { type: "end", actor: "a" });
    advance(g);
    expect(p.zone).toBe(gone ? "trash" : "hand");
  });
for (const behind of [false, true])
  it(`Muramasa's readiness is mandatory when any Rival has higher Cred (${behind})`, () => {
    const g = scenario("modded-muramasa", "unused");
    g.pending = [];
    const p = own(g, "a", "field").find((p) => p.cardId === "modded-muramasa")!;
    p.ready = false;
    if (behind)
      g.gigs.filter((d) => d.controller === "c").forEach((d) => (d.value = 20));
    emit(g, { type: "end", actor: "a" });
    advance(g);
    expect(p.ready).toBe(behind);
    expect(g.choice).toBeUndefined();
  });
for (const high of [false, true])
  it(`Kerry may activate without a high Gig, drawing only when qualified (${high}), and can activate again after readying`, () => {
    let g = scenario("kerry-eurodyne-the-last-rockerboy", "unused");
    g.pending = [];
    const p = own(g, "a", "field").find(
      (p) => p.cardId === "kerry-eurodyne-the-last-rockerboy",
    )!;
    if (!high)
      g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 1));
    const n = own(g, "a", "hand").length;
    p.entered = g.turn;
    expect(() =>
      applyCommand(g, "a", { type: "activate", piece: p.id }),
    ).toThrow();
    p.entered = 0;
    for (let i = 1; i <= 2; i++) {
      g = applyCommand(g, "a", { type: "activate", piece: p.id });
      expect(own(g, "a", "hand")).toHaveLength(n + (high ? 2 * i : 0));
      const used = g.pieces.find((x) => x.id === p.id)!;
      expect(used.ready).toBe(false);
      used.ready = true;
    }
  });
for (const turn of ["a", "b"])
  it(`Tyger's Whisper may Call for free on ${turn}'s turn but never a second time that turn`, () => {
    const g = scenario("tyger-s-whisper", "play");
    g.turnPlayer = turn;
    advance(g);
    const legend = own(g, "a", "legends")[1];
    expect(g.choice!.min).toBe(0);
    answer(g, "a", g.choice!.id, [legend.id]);
    expect(legend.faceUp).toBe(true);
    expect(g.players[0].called).toBe(true);
    while (g.choice)
      answer(
        g,
        g.choice.player,
        g.choice.id,
        g.choice.options.slice(0, g.choice.min).map((o) => o.id),
      );
    g.pending.push(
      job(
        g,
        "tyger-s-whisper:play",
        "a",
        g.pieces.find(
          (p) => p.cardId === "tyger-s-whisper" && p.zone === "field",
        )!.id,
      ),
    );
    advance(g);
    expect(g.choice).toBeUndefined();
  });
it("Bombus can Block despite zero power and an unblocked attack steals no Gigs", () => {
  let g = scenario("secondhand-bombus", "unused");
  g.pending = [];
  const p = own(g, "a", "field").find((p) => p.cardId === "secondhand-bombus")!;
  g = applyCommand(g, "a", { type: "attack", piece: p.id, target: "b" });
  g = applyCommand(g, "b", { type: "endReaction" });
  expect(g.gigs.filter((d) => d.controller === "a")).toHaveLength(6);
  expect(g.choice).toBeUndefined();
  g.pieces.find((x) => x.id === p.id)!.ready = true;
  g.turnPlayer = "b";
  g = applyCommand(g, "b", {
    type: "attack",
    piece: own(g, "b", "field")[0].id,
    target: "a",
  });
  g = applyCommand(g, "a", { type: "block", piece: p.id });
  expect(g.attack!.target).toBe(p.id);
});
for (const slug of ["chrome-fang", "westbrook-netrunner"])
  it(`${slug}: the play effect survives its source, applies to later Units, and protects only friendly Gigs`, () => {
    const g = scenario(slug, "play");
    advance(g);
    const source = own(g, "a", "field").find((p) => p.cardId === slug)!;
    move(g, source, "trash");
    const thief = own(g, "b", "field")[0];
    if (slug === "westbrook-netrunner")
      thief.cardId = "jackie-welles-mama-s-favorite";
    thief.entered = g.turn;
    const value = power(g, thief),
      delta = slug === "chrome-fang" ? 1 : -1;
    const dice = [
      ...g.gigs.filter((d) => d.controller === "a").slice(0, 2),
      g.gigs.find((d) => d.controller === "c")!,
    ];
    dice[0].value = value + delta;
    dice[1].value = value;
    dice[2].value = value + delta;
    g.frames.push(
      job(g, "steal-gigs", "b", thief.id, undefined, {
        ids: dice.map((d) => d.id),
      }),
    );
    advance(g);
    expect(dice.map((d) => d.controller)).toEqual(["a", "b", "b"]);
  });
