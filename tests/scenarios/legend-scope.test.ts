import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import { advance, answer, own, power } from "../../packages/engine/kernel";
import { card } from "../../packages/catalog/index";
it("Synapse Burnout counts a Go Solo Legend itself and other friendly face-up Legends in either play area", () => {
  const g = scenario("synapse-burnout", "program");
  const target = own(g, "a", "field")[0];
  target.cardId = "goro-takemura-hands-unclean";
  const base = card(target.cardId).power!;
  advance(g);
  answer(g, "a", g.choice!.id, [target.id]);
  expect(power(g, target)).toBe(base);
  g.attack = {
    attacker: own(g, "b", "field")[0].id,
    target: target.id,
    defender: "a",
    stage: "fight",
  };
  expect(power(g, target)).toBe(base + 1);
  const second = own(g, "a", "legends")[0];
  second.faceUp = true;
  expect(power(g, target)).toBe(base + 2);
  second.zone = "field";
  expect(power(g, target)).toBe(base + 2);
  own(g, "b", "legends").forEach((p) => (p.faceUp = true));
  expect(power(g, target)).toBe(base + 2);
  second.zone = "removed";
  expect(power(g, target)).toBe(base + 1);
  g.attack.stage = "react";
  expect(power(g, target)).toBe(base);
});
it("Panam's attack draw includes friendly face-up Go Solo Legends", () => {
  const g = scenario("panam-palmer-strength-through-family", "attack");
  own(g, "a", "field")[0].cardId = "goro-takemura-hands-unclean";
  own(g, "a", "legends")[0].faceUp = true;
  const before = own(g, "a", "hand").length;
  advance(g);
  answer(g, "a", g.choice!.id, [g.choice!.options[0].id]);
  expect(own(g, "a", "hand")).toHaveLength(before + 1); // discard one, draw two
});
it("a spent MaxTac Squadron can ready a friendly Go Solo Legend", () => {
  const g = scenario("maxtac-squadron", "end");
  const squadron = g.pieces.find((p) => p.id === g.pending[0].source)!;
  squadron.ready = false;
  const target = own(g, "a", "field")[0];
  target.cardId = "goro-takemura-hands-unclean";
  target.ready = false;
  advance(g);
  expect(g.choice!.options.map((o) => o.id)).toEqual([target.id]);
  answer(g, "a", g.choice!.id, [target.id]);
  expect(target.ready).toBe(true);
});
it("MaxTac Squadron must still be spent when its end effect resolves", () => {
  const g = scenario("maxtac-squadron", "end");
  own(g, "a", "legends").forEach((p) => (p.faceUp = true));
  advance(g);
  expect(g.choice).toBeUndefined();
});
