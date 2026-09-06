import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import { advance, answer, own, emit, uid } from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { playPiece } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
it("Goro checks all Legends face-up when the attack is declared", () => {
  const g = scenario("goro-takemura-losing-his-way", "unused");
  g.pending = [];
  const p = own(g, "a", "field").find(
    (p) => p.cardId === "goro-takemura-losing-his-way",
  )!;
  emit(g, { type: "attack", actor: "a", piece: { ...p } });
  expect(g.pending).toEqual([]);
  own(g, "a", "legends").forEach((p) => (p.faceUp = true));
  advance(g);
  expect(g.mods).toEqual([]);
  emit(g, { type: "attack", actor: "a", piece: { ...p } });
  advance(g);
  expect(g.mods.some((m) => m.target === p.id && m.amount === 5)).toBe(true);
});
it("Jackie remembers the first Blue play even while face-down", () => {
  const g = scenario("jackie-welles-pour-one-out-for-me", "unused");
  g.pending = [];
  const jackie = own(g, "a", "legends").find(
    (p) => p.cardId === "jackie-welles-pour-one-out-for-me",
  )!;
  jackie.faceUp = false;
  const blue = own(g, "a", "hand").filter(
    (p) => card(p.cardId).color === "Blue" && card(p.cardId).type === "Unit",
  );
  playPiece(g, blue[0]);
  jackie.faceUp = true;
  playPiece(g, blue[1]);
  expect(g.players[0].played.BlueUnitOrGear).toBe(2);
  expect(g.pending.some((j) => j.cardId === jackie.cardId)).toBe(false);
});
it("a Blue Legend going Solo counts as a Blue Unit play for Jackie", () => {
  const g = scenario("jackie-welles-pour-one-out-for-me", "unused");
  g.pending = [];
  const v = own(g, "a", "legends").find(
    (p) => p.cardId === "v-corporate-exile",
  )!;
  v.faceUp = true;
  playPiece(g, v, undefined, true);
  expect(
    g.pending.some((j) => j.cardId === "jackie-welles-pour-one-out-for-me"),
  ).toBe(true);
});
it("per-turn Call and play counters reset for every player, including the defender", () => {
  let g = scenario("animals-wrecker", "unused");
  g.pending = [];
  for (const p of g.players) {
    p.called = true;
    p.programs = 3;
    p.played.BlueUnitOrGear = 2;
  }
  g = applyCommand(g, "a", { type: "endTurn" });
  expect(
    g.players.every(
      (p) => !p.called && p.programs === 0 && !p.played.BlueUnitOrGear,
    ),
  ).toBe(true);
});
it("Yorinobu does not trigger on a later ARASAKA attack after being Called", () => {
  let g = scenario("yorinobu-arasaka-embracing-destruction", "unused");
  g.pending = [];
  const yori = own(g, "a", "legends").find(
    (p) => p.cardId === "yorinobu-arasaka-embracing-destruction",
  )!;
  yori.faceUp = false;
  const attackers = own(g, "a", "field").slice(0, 2);
  attackers.forEach((p) => {
    p.cardId = "goro-takemura-losing-his-way";
    p.ready = true;
  });
  g = applyCommand(g, "a", {
    type: "attack",
    piece: attackers[0].id,
    target: "b",
  });
  g = applyCommand(g, "b", { type: "endReaction" });
  while (g.choice)
    g = applyCommand(g, g.choice.player, {
      type: "choose",
      choice: g.choice.id,
      values: g.choice.options.slice(0, g.choice.min).map((o) => o.id),
    });
  g.pieces.find((p) => p.id === yori.id)!.faceUp = true;
  const hand = own(g, "a", "hand").length;
  g = applyCommand(g, "a", {
    type: "attack",
    piece: attackers[1].id,
    target: "b",
  });
  expect(g.players[0].played.ARASAKAattack).toBe(2);
  expect(own(g, "a", "hand")).toHaveLength(hand);
});
it("adjusting by zero does not trigger Meredith", () => {
  const g = scenario("afterparty-at-lizzie-s", "program");
  const m = own(g, "b", "field")[0];
  m.cardId = "meredith-stout-stone-cold-corpo";
  advance(g);
  const die = g.gigs.find((d) => d.controller === "b")!;
  answer(g, "a", g.choice!.id, [die.id]);
  answer(g, "a", g.choice!.id, [String(die.value)]);
  expect(g.choice).toBeUndefined();
  expect(g.pending).toEqual([]);
});
it("one swap creates one Meredith effect, rather than one effect per die", () => {
  const g = scenario("hanako-arasaka-daughter-of-the-emperor", "activate");
  own(g, "b", "field")[0].cardId = "meredith-stout-stone-cold-corpo";
  advance(g);
  answer(g, "a", g.choice!.id, [g.gigs.find((d) => d.controller === "a")!.id]);
  answer(g, "a", g.choice!.id, [g.gigs.find((d) => d.controller === "b")!.id]);
  expect(g.choice!.player).toBe("b");
  expect(g.choice!.key).toBe("target");
  expect(g.choice!.label).toContain("return a card");
});
it("mandatory Eddie readiness never discloses face-down Eddie identities", () => {
  const g = scenario("rogue-amendiares-queen-of-the-afterlife", "steal");
  advance(g);
  expect(g.choice!.min).toBe(2);
  expect(g.choice!.max).toBe(2);
  expect(
    g.choice!.options.every((o) => !o.cardId && o.label.startsWith("Eddie ")),
  ).toBe(true);
});
it("Radioport may decline looking while Kiroshi must look if possible", () => {
  const radio = scenario("arasaka-emergency-radioport", "spent");
  advance(radio);
  expect(radio.choice!.min).toBe(0);
  const kiroshi = scenario("kiroshi-optics", "attack");
  advance(kiroshi);
  expect(kiroshi.choice!.min).toBe(1);
});
