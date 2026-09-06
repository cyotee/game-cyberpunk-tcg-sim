import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  emit,
  spend,
} from "../../packages/engine/kernel";
import { gameView } from "../../apps/service/rooms";

it("Kiroshi's mandatory look reveals only the chosen friendly face-down Legend to its controller", () => {
  const g = scenario("kiroshi-optics", "unused");
  g.pending = [];
  const bearer = own(g, "a", "field")[0];
  emit(g, { type: "attack", actor: "a", piece: { ...bearer } });
  advance(g);
  const legends = own(g, "a", "legends");
  expect(g.choice!.options.map((o) => o.id)).toEqual(legends.map((p) => p.id));
  expect(g.choice!.min).toBe(1);
  expect(g.choice!.options.every((o) => !o.cardId)).toBe(true);
  answer(g, "a", g.choice!.id, [legends[0].id]);
  expect(legends[0].known).toBe(true);
  expect(legends[0].faceUp).toBe(false);
  expect(legends[1].known).toBeUndefined();
  expect(
    gameView(g, "a").pieces.find((p) => p.id === legends[0].id),
  ).toHaveProperty("cardId");
  expect(
    gameView(g, "b").pieces.find((p) => p.id === legends[0].id),
  ).not.toHaveProperty("cardId");
  for (const rival of ["b", "c"])
    expect(
      gameView(g, rival).pieces.find((p) => p.id === legends[0].id),
    ).toMatchObject({ known: true, faceUp: false });
  expect(
    g.log
      .filter((e) => e.text.startsWith("Looked at"))
      .every((e) => e.privateTo === "a"),
  ).toBe(true);
});
it("Kiroshi does nothing if all friendly Legends are already face-up", () => {
  const g = scenario("kiroshi-optics", "attack");
  own(g, "a", "legends").forEach((p) => (p.faceUp = true));
  advance(g);
  expect(g.choice).toBeUndefined();
});
for (const slug of [
  "hanako-arasaka-daughter-of-the-emperor",
  "jackie-welles-mama-s-favorite",
])
  it(`Radioport can freely Call a qualifying ${slug} without spending its orientation`, () => {
    const g = scenario("arasaka-emergency-radioport", "unused");
    g.pending = [];
    const legend = own(g, "a", "legends")[0];
    legend.cardId = slug;
    legend.ready = false;
    const eddies = own(g, "a", "eddies").filter((p) => p.ready).length;
    spend(g, own(g, "a", "field")[0]);
    advance(g);
    answer(g, "a", g.choice!.id, [legend.id]);
    expect(legend.faceUp).toBe(false);
    expect(legend.known).toBe(true);
    expect(g.choice!.label).toBe("Call that Legend for free?");
    answer(g, "a", g.choice!.id, ["yes"]);
    expect(legend.faceUp).toBe(true);
    expect(legend.ready).toBe(false);
    expect(g.players[0].called).toBe(true);
    expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(eddies);
  });
for (const mode of [
  "ineligible",
  "already-called",
  "decline-call",
  "decline-look",
])
  it(`Radioport respects optional choices and Call restrictions: ${mode}`, () => {
    const g = scenario("arasaka-emergency-radioport", "spent");
    const legend = own(g, "a", "legends")[0];
    legend.cardId =
      mode === "ineligible"
        ? "viktor-vektor-sit-down-and-relax"
        : "jackie-welles-mama-s-favorite";
    g.players[0].called = mode === "already-called";
    advance(g);
    answer(g, "a", g.choice!.id, mode === "decline-look" ? [] : [legend.id]);
    if (mode === "decline-call") answer(g, "a", g.choice!.id, ["no"]);
    expect(g.choice).toBeUndefined();
    expect(legend.faceUp).toBe(false);
    expect(!!legend.known).toBe(mode !== "decline-look");
  });
for (const qualifies of [true, false])
  it(`Faceplate checks distinct friendly values after adjustment: qualifies=${qualifies}`, () => {
    const g = scenario("zetatech-faceplate", "unused");
    g.pending = [];
    const friendly = g.gigs.filter((d) => d.controller === "a").slice(0, 3);
    g.gigs = g.gigs.filter((d) => d.controller !== "a" || friendly.includes(d));
    friendly.forEach((d, i) => (d.value = i === 0 ? 1 : 2));
    const before = own(g, "a", "hand").length;
    spend(g, own(g, "a", "field")[0]);
    advance(g);
    answer(g, "a", g.choice!.id, [friendly[2].id]);
    expect(g.choice!.options.map((o) => Number(o.id))).toEqual([1, 2, 3]);
    answer(g, "a", g.choice!.id, [qualifies ? "3" : "2"]);
    expect(own(g, "a", "hand")).toHaveLength(before + Number(qualifies));
  });
it("Faceplate may adjust a third player's Gig when its Legend bearer is spent", () => {
  const g = scenario("zetatech-faceplate", "unused");
  g.pending = [];
  const gear = g.pieces.find(
    (p) => p.cardId === "zetatech-faceplate" && p.host,
  )!;
  const bearer = own(g, "a", "legends")[0];
  bearer.faceUp = true;
  gear.host = bearer.id;
  gear.zone = "legends";
  spend(g, bearer);
  advance(g);
  const die = g.gigs.find((d) => d.controller === "c" && d.sides === 6)!;
  answer(g, "a", g.choice!.id, [die.id]);
  answer(g, "a", g.choice!.id, [String(die.value + 1)]);
  expect(die.value).toBe(3);
});
