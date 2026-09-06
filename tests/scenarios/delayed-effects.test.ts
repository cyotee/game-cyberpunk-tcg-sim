import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  emit,
  own,
  defeat,
  eliminate,
} from "../../packages/engine/kernel";
import { seal, unseal } from "../../packages/saves/server";
import type { Game } from "../../packages/engine/index";
function setup(namedV = true) {
  const g = scenario("dying-night-v-s-pistol", "unused");
  g.pending = [];
  const bearer = own(g, "a", "field")[0];
  if (namedV) bearer.cardId = "v-streetkid";
  own(g, "a", "eddies").forEach((p) => (p.ready = false));
  return { g, bearer };
}
function attack(g: Game, bearer: Game["pieces"][number]) {
  emit(g, { type: "attack", actor: "a", piece: { ...bearer } });
  advance(g);
  const die = g.gigs.find((d) => d.controller === "c" && d.sides === 6)!;
  die.value = 3;
  answer(g, "a", g.choice!.id, [die.id]);
  expect(g.choice!.options.map((o) => Number(o.id))).toEqual([1, 2, 3]);
  answer(g, "a", g.choice!.id, ["3"]); // zero decrease is permitted
}
it("Dying Night does not ready Eddies at end of turn without an attack", () => {
  const { g } = setup();
  emit(g, { type: "end", actor: "a" });
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(own(g, "a", "eddies").some((p) => p.ready)).toBe(false);
});
it("Dying Night's delayed readiness survives its bearer being defeated and an encrypted save/restore", () => {
  const initial = setup();
  let g = initial.g;
  attack(g, initial.bearer);
  expect(g.delayed).toHaveLength(1);
  defeat(g, initial.bearer, "b");
  advance(g);
  g = unseal<Game>(seal(g));
  emit(g, { type: "end", actor: "b" });
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(g.delayed).toHaveLength(1);
  emit(g, { type: "end", actor: "a" });
  advance(g);
  expect(g.choice!.min).toBe(2);
  expect(
    g.choice!.options.every((o) => !o.cardId && o.label.startsWith("Eddie ")),
  ).toBe(true);
  answer(
    g,
    "a",
    g.choice!.id,
    g.choice!.options.slice(0, 2).map((o) => o.id),
  );
  expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(2);
  expect(g.delayed).toHaveLength(0);
  emit(g, { type: "end", actor: "a" });
  advance(g);
  expect(g.choice).toBeUndefined();
});
it("Dying Night does not ready Eddies for an attacking Unit with a different name", () => {
  const { g, bearer } = setup(false);
  attack(g, bearer);
  emit(g, { type: "end", actor: "a" });
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(own(g, "a", "eddies").some((p) => p.ready)).toBe(false);
});
it("repeated Dying Night attacks schedule independent end effects in the owner's batch", () => {
  const { g, bearer } = setup();
  attack(g, bearer);
  attack(g, bearer);
  expect(g.delayed).toHaveLength(2);
  emit(g, { type: "end", actor: "a" });
  advance(g);
  expect(g.choice!.key).toBe("batch");
  answer(g, "a", g.choice!.id, [g.choice!.options[0].id]);
  for (let i = 0; i < 2; i++)
    answer(
      g,
      "a",
      g.choice!.id,
      own(g, "a", "eddies")
        .filter((p) => !p.ready)
        .slice(0, 2)
        .map((p) => p.id),
    );
  expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(4);
});
it("eliminating the controller cancels Dying Night's delayed effects without triggering them", () => {
  const { g, bearer } = setup();
  attack(g, bearer);
  eliminate(g, "a", "concedes");
  expect(g.delayed).toHaveLength(0);
  expect(g.pending).toHaveLength(0);
});
