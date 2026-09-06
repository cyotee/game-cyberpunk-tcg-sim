import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  job,
  modifier,
  power,
  triggers,
  own,
  uid,
} from "../../packages/engine/kernel";
import { card } from "../../packages/catalog/index";
function theft() {
  const g = scenario("animals-wrecker", "unused");
  g.pending = [];
  const unit = g.pieces.find(
    (p) => p.controller === "a" && p.zone === "field" && !p.host,
  )!;
  return { g, unit };
}
it("moves all selected Gigs before testing each theft trigger (rule 9.23.5.1)", () => {
  const { g, unit } = theft();
  const dice = g.gigs.filter((d) => d.controller === "b").slice(0, 2);
  const counts: number[] = [];
  const prior = triggers[unit.cardId];
  triggers[unit.cardId] = [
    {
      event: "steal",
      key: "unused",
      test: (g, p, e) => {
        if (p.id === unit.id)
          counts.push(dice.filter((d) => d.controller === "a").length);
        return false;
      },
    },
  ];
  try {
    g.frames = [
      job(g, "steal-gigs", "a", unit.id, undefined, {
        ids: dice.map((d) => d.id),
      }),
    ];
    advance(g);
    expect(counts).toEqual([2, 2]);
  } finally {
    if (prior) triggers[unit.cardId] = prior;
    else delete triggers[unit.cardId];
  }
});
it("Chrome Fang prevents additional effect-based theft from its controller only", () => {
  const { g, unit } = theft();
  const b = g.gigs.find((d) => d.controller === "b")!,
    c = g.gigs.find((d) => d.controller === "c")!;
  b.value = c.value = 20;
  modifier(g, "b", "b", "chrome", 0, "next");
  g.frames = [
    job(g, "steal-gigs", "a", unit.id, undefined, { ids: [b.id, c.id] }),
  ];
  advance(g);
  expect(b.controller).toBe("b");
  expect(c.controller).toBe("a");
});
it("a third-party Alt may prevent an effect theft and the choice survives serialization", () => {
  const { g, unit } = theft();
  g.pieces.push({
    id: uid(g),
    cardId: "alt-cunningham-mother-of-daemons",
    owner: "c",
    controller: "c",
    zone: "legends",
    faceUp: true,
    ready: true,
    entered: 0,
    marks: {},
  });
  const die = g.gigs.find((d) => d.controller === "b" && d.value === 2)!;
  g.frames = [job(g, "steal-gigs", "a", unit.id, undefined, { ids: [die.id] })];
  advance(g);
  expect(g.choice!.player).toBe("c");
  expect(g.choice!.private).toBe(true);
  const restored = JSON.parse(JSON.stringify(g));
  const chosen = restored.choice.options[0].id;
  answer(restored, "c", restored.choice.id, [chosen]);
  expect(restored.gigs.find((d: any) => d.id === die.id).controller).toBe("b");
  expect(restored.pieces.find((p: any) => p.id === chosen).zone).toBe("trash");
  expect(restored.choice).toBeUndefined();
});
it("mandatory theft restriction does not charge an optional Alt discard", () => {
  const { g, unit } = theft();
  g.pieces.push({
    id: uid(g),
    cardId: "alt-cunningham-mother-of-daemons",
    owner: "c",
    controller: "c",
    zone: "legends",
    faceUp: true,
    ready: true,
    entered: 0,
    marks: {},
  });
  const die = g.gigs.find((d) => d.controller === "b")!;
  die.value = 20;
  modifier(g, "b", "b", "chrome", 0, "next");
  const before = own(g, "c", "hand").length;
  g.frames = [job(g, "steal-gigs", "a", unit.id, undefined, { ids: [die.id] })];
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(own(g, "c", "hand").length).toBe(before);
});
it("Gorilla Arms extra theft uses prevention rather than directly changing control", () => {
  const g = scenario("gorilla-arms", "stoleMany");
  const die = g.gigs.find((d) => d.controller === "b")!;
  die.value = 19;
  modifier(g, "b", "b", "chrome", 0, "next");
  advance(g);
  expect(g.choice!.key).toBe("extra");
  answer(g, "a", g.choice!.id, [die.id]);
  expect(die.controller).toBe("b");
});
it("Appetite theft emits the Unit attribution needed by Gorilla Arms", () => {
  const { g, unit } = theft();
  g.pieces.push({
    id: uid(g),
    cardId: "gorilla-arms",
    owner: "a",
    controller: "a",
    zone: "field",
    host: unit.id,
    faceUp: true,
    ready: true,
    entered: 0,
    marks: {},
  });
  const die = g.gigs.find((d) => d.controller === "b")!;
  die.value = 7;
  const other = g.gigs.find((d) => d.controller === "c")!;
  other.value = 9;
  g.pending = [job(g, "appetite-trigger", "a", unit.id)];
  advance(g);
  answer(g, "a", g.choice!.id, [die.id]);
  expect(die.controller).toBe("a");
  expect(g.choice!.key).toBe("extra");
  expect(g.choice!.options.map((o) => o.id)).toContain(other.id);
});
