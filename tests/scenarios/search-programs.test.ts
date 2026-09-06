import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import { advance, answer, own } from "../../packages/engine/kernel";
import { card } from "../../packages/catalog/index";
import { cost } from "../../packages/engine/actions";
import { gameView } from "../../apps/service/rooms";
for (const [id, n, ram, color, tags] of [
  ["fool-on-the-hill", 2, 3, "Green", ["Merc"]],
  ["shattered-memories", 4, 2, "Red", ["Braindance"]],
  ["the-heist", 2, 2, "Yellow", ["Merc"]],
  ["three-mouths-one-desire", 2, 3, "Blue", ["Braindance", "Doll"]],
  ["we-gotta-live-together", 5, 2, "Green", ["Aldecado", "Nomad"]],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Program",
      cost: n,
      ram,
      color,
      tags,
      keywords: [],
      power: null,
      sell: true,
    }));
for (const minCount of [0, 1, 3])
  it(`Three Mouths privately searches three and may keep one plus ${minCount} minimum Gigs`, () => {
    const g = scenario("three-mouths-one-desire", "program"),
      top = own(g, "a", "deck").slice(0, 3),
      before = own(g, "a", "hand").length;
    g.gigs
      .filter((d) => d.controller === "a")
      .forEach((d, i) => (d.value = i < minCount ? 1 : 2));
    advance(g);
    expect(top.every((p) => p.zone === "deck")).toBe(true);
    expect(g.choice!.private).toBe(true);
    expect(g.choice!.min).toBe(1);
    expect(g.choice!.max).toBe(Math.min(3, 1 + minCount));
    expect(gameView(g, "b").choice).not.toHaveProperty("options");
    const n = g.choice!.max;
    answer(
      g,
      "a",
      g.choice!.id,
      top.slice(0, n).map((p) => p.id),
    );
    expect(own(g, "a", "hand")).toHaveLength(before + n);
    expect(
      new Set(
        own(g, "a", "deck")
          .slice(-(3 - n || 9999))
          .filter((p) => top.includes(p))
          .map((p) => p.id),
      ),
    ).toEqual(new Set(top.slice(n).map((p) => p.id)));
  });
it("Three Mouths does not deck out on an empty search", () => {
  const g = scenario("three-mouths-one-desire", "program");
  own(g, "a", "deck").forEach((p) => (p.zone = "removed"));
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(g.players[0].eliminated).toBe(false);
});
for (const play of [false, true])
  it(`The Heist must retrieve a newly trashed Gear and can ${play ? "play it free" : "keep it in hand"}`, () => {
    const g = scenario("the-heist", "program"),
      top = own(g, "a", "deck").slice(0, 4);
    top.forEach(
      (p, i) => (p.cardId = i === 0 ? "mantis-blades" : "animals-wrecker"),
    );
    g.gigs.find((d) => d.controller === "a")!.value =
      card("mantis-blades").cost!;
    const eddies = own(g, "a", "eddies").filter((p) => p.ready).length;
    advance(g);
    expect(g.choice!.min).toBe(1);
    expect(g.choice!.options.map((o) => o.id)).toEqual([top[0].id]);
    answer(g, "a", g.choice!.id, [top[0].id]);
    expect(g.choice!.min).toBe(0);
    answer(g, "a", g.choice!.id, play ? [top[0].id] : []);
    if (play) {
      const bearer = own(g, "a", "field")[0];
      answer(g, "a", g.choice!.id, [bearer.id]);
      expect(top[0].host).toBe(bearer.id);
      expect(top[0].zone).toBe("field");
    } else expect(top[0].zone).toBe("hand");
    expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(eddies);
    expect(top.slice(1).every((p) => p.zone === "trash")).toBe(true);
  });
it("The Heist does not offer older Gear or free play without a matching friendly Gig", () => {
  const g = scenario("the-heist", "program"),
    top = own(g, "a", "deck").slice(0, 4);
  top.forEach(
    (p, i) => (p.cardId = i === 0 ? "mantis-blades" : "animals-wrecker"),
  );
  g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 20));
  advance(g);
  expect(g.choice!.options.map((o) => o.id)).toEqual([top[0].id]);
  answer(g, "a", g.choice!.id, [top[0].id]);
  expect(g.choice).toBeUndefined();
  expect(top[0].zone).toBe("hand");
});
for (const dest of ["hand", "trash"])
  it(`Fool reveals without moving its cards, then one chosen Rival sends them to ${dest}`, () => {
    const g = scenario("fool-on-the-hill", "program"),
      top = own(g, "a", "deck").slice(0, 2),
      n = own(g, "a", "hand").length;
    advance(g);
    expect(top.every((p) => p.zone === "deck")).toBe(true);
    expect(
      g.log.some(
        (e) =>
          !e.privateTo &&
          top.every((p) => e.text.includes(card(p.cardId).nameFull)),
      ),
    ).toBe(true);
    answer(g, "a", g.choice!.id, ["c"]);
    expect(g.choice!.player).toBe("c");
    expect(() => answer(g, "b", g.choice!.id, [dest])).toThrow();
    answer(g, "c", g.choice!.id, [dest]);
    expect(top.every((p) => p.zone === dest)).toBe(true);
    expect(own(g, "a", "hand")).toHaveLength(n + 2);
  });
for (const empty of [false, true])
  it(`Shattered Memories lets each player decline drawing even with ${empty ? "empty" : "nonempty"} hands`, () => {
    const g = scenario("shattered-memories", "program");
    for (const id of ["a", "b", "c"])
      own(g, id, "hand").forEach((p, i) => {
        if (empty || i > 0) p.zone = "removed";
      });
    g.gigs.find((d) => d.controller === "a")!.value = empty ? 1 : 3;
    const old = g.pieces.filter((p) => p.zone === "hand");
    advance(g);
    for (const id of ["a", "b", "c"]) {
      expect(g.choice!.player).toBe(id);
      answer(g, id, g.choice!.id, id === "c" ? ["yes"] : ["no"]);
    }
    expect(old.every((p) => p.zone === "trash")).toBe(true);
    expect(own(g, "a", "hand")).toHaveLength(empty ? 0 : 2);
    expect(own(g, "b", "hand")).toHaveLength(0);
    expect(own(g, "c", "hand")).toHaveLength(5);
  });
it("We Gotta Live Together applies its mandatory payment replacement when any Rival has two more Gigs", () => {
  const g = scenario("we-gotta-live-together", "program"),
    p = g.pieces.find((p) => p.zone === "resolving")!;
  expect(cost(g, p)).toBe(5);
  g.gigs
    .filter((d) => d.controller === "a")
    .slice(0, 2)
    .forEach((d) => (d.controller = "c"));
  expect(cost(g, p)).toBe(3);
  expect(card(p.cardId).cost).toBe(5);
});
for (const number of [0, 1, 2])
  it(`We Gotta Live Together can play ${number} legal Units free from its own trash`, () => {
    const g = scenario("we-gotta-live-together", "program"),
      eddies = own(g, "a", "eddies").filter((p) => p.ready).length;
    const targets = own(g, "a", "trash").filter((p) =>
      ["emergency-atlus", "secondhand-bombus"].includes(p.cardId),
    );
    advance(g);
    for (let i = 0; i < 2; i++) {
      expect(g.choice!.min).toBe(0);
      expect(
        g.choice!.options.every((o) => {
          const p = g.pieces.find((p) => p.id === o.id)!;
          return (
            p.zone === "trash" &&
            p.controller === "a" &&
            card(p.cardId).type === "Unit" &&
            card(p.cardId).cost! <= 3
          );
        }),
      ).toBe(true);
      answer(g, "a", g.choice!.id, i < number ? [targets[i].id] : []);
    }
    expect(targets.filter((p) => p.zone === "field")).toHaveLength(number);
    expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(eddies);
  });
