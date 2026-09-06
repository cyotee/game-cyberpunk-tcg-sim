import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  emit,
  spend,
  keyword,
  power,
  job,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { cost, playPiece } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
for (const [id, color, tags, keywords] of [
  ["alt-cunningham-soulkiller-architect", "Blue", ["Merc", "Netrunner"], []],
  ["evelyn-parker-beautiful-enigma", "Blue", ["Doll"], []],
  [
    "goro-takemura-vengeful-bodyguard",
    "Green",
    ["Arasaka", "Corpo"],
    ["Quick"],
  ],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Legend",
      cost: null,
      power: 0,
      ram: 2,
      color,
      tags,
      keywords,
      sell: true,
    }));
it("Mother of Daemons: printed baseline", () =>
  expect(card("alt-cunningham-mother-of-daemons")).toMatchObject({
    type: "Unit",
    cost: 7,
    power: 8,
    ram: 3,
    color: "Yellow",
    tags: ["Merc", "Netrunner"],
    keywords: [],
    sell: false,
  }));
for (const zone of ["field", "legends"] as const)
  it(`Alt draws for spending an equipped friendly ${zone} card, not its Gear`, () => {
    const g = scenario("alt-cunningham-mother-of-daemons", "unused"),
      p = own(g, "a", zone)[0],
      gear = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!,
      n = own(g, "a", "hand").length;
    g.pending = [];
    p.faceUp = true;
    gear.zone = zone;
    gear.faceUp = true;
    gear.host = p.id;
    spend(g, p);
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(n);
    spend(g, gear);
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(n);
  });
it("Alt can decline prevention and only eligible printed-cost cards can pay", () => {
  const g = scenario("alt-cunningham-mother-of-daemons", "unused"),
    unit = own(g, "b", "field")[0],
    die = g.gigs.find((d) => d.controller === "c" && d.value === 2)!;
  g.pending = [];
  g.frames.push(
    job(g, "steal-gigs", "b", unit.id, undefined, { ids: [die.id] }),
  );
  advance(g);
  expect(g.choice!.player).toBe("a");
  expect(g.choice!.min).toBe(0);
  expect(
    g.choice!.options.every(
      (o) => card(g.pieces.find((p) => p.id === o.id)!.cardId).cost === 2,
    ),
  ).toBe(true);
  answer(g, "a", g.choice!.id, []);
  expect(die.controller).toBe("b");
});
it("Soulkiller's first activation snapshots minimum Gigs and discounts only the next Program", () => {
  const g = scenario("alt-cunningham-soulkiller-architect", "activate"),
    src = g.pieces.find((p) => p.id === g.pending[0].source)!,
    p = own(g, "a", "hand").find((p) => p.cardId === "cyberpsychosis")!;
  g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 1));
  advance(g);
  answer(g, "a", g.choice!.id, ["0"]);
  expect(src.ready).toBe(false);
  g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 2));
  expect(cost(g, p)).toBe(1);
  const cheap = own(g, "a", "hand").find(
    (p) => p.cardId === "afterparty-at-lizzie-s",
  )!;
  playPiece(g, cheap);
  expect(cost(g, p)).toBe(3);
});
it("Soulkiller's replay pays the activation and Program separately then bottom-decks it", () => {
  const g = scenario("alt-cunningham-soulkiller-architect", "activate"),
    p = own(g, "a", "trash").find(
      (p) => p.cardId === "afterparty-at-lizzie-s",
    )!,
    n = own(g, "a", "eddies").filter((p) => p.ready).length;
  advance(g);
  answer(g, "a", g.choice!.id, ["1"]);
  answer(g, "a", g.choice!.id, [own(g, "a", "eddies")[0].id]);
  expect(g.choice!.min).toBe(1);
  answer(g, "a", g.choice!.id, [p.id]);
  answer(
    g,
    "a",
    g.choice!.id,
    own(g, "a", "eddies")
      .filter((p) => p.ready)
      .slice(0, card(p.cardId).cost!)
      .map((p) => p.id),
  );
  const die = g.gigs[0];
  answer(g, "a", g.choice!.id, [die.id]);
  answer(g, "a", g.choice!.id, [String(die.value)]);
  expect(own(g, "a", "deck").at(-1)!.id).toBe(p.id);
  expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(
    n - 1 - card(p.cardId).cost!,
  );
});
for (const amount of [0, 1, 3])
  it(`Evelyn readies only one Eddie for a batch of ${amount} qualifying thefts`, () => {
    const g = scenario("evelyn-parker-beautiful-enigma", "unused"),
      p = own(g, "a", "field")[0];
    g.pending = [];
    p.cardId = "royce-don-t-call-me-simon";
    emit(g, { type: "stoleMany", actor: "a", piece: { ...p }, amount });
    advance(g);
    if (!amount) {
      expect(g.choice).toBeUndefined();
      return;
    }
    expect(g.choice!.min).toBe(1);
    expect(g.choice!.max).toBe(1);
    answer(g, "a", g.choice!.id, [own(g, "a", "eddies")[0].id]);
    expect(g.choice).toBeUndefined();
  });
it("Evelyn pays and spends to force the selected rival's next attack", () => {
  const g = scenario("evelyn-parker-beautiful-enigma", "activate"),
    p = own(g, "c", "field")[0];
  advance(g);
  answer(g, "a", g.choice!.id, [own(g, "a", "eddies")[0].id]);
  answer(g, "a", g.choice!.id, [p.id]);
  g.turnPlayer = "c";
  expect(() => applyCommand(g, "c", { type: "endTurn" })).toThrow(
    "must attack",
  );
});
for (const paired of [false, true])
  it(`Goro grants Blocker to a cheap friendly Unit and a conditional power bonus (${paired})`, () => {
    const g = scenario("goro-takemura-vengeful-bodyguard", "activate"),
      p = own(g, "a", "field")[1],
      n = power(g, p);
    if (!paired)
      g.gigs
        .filter((d) => d.controller === "a")
        .forEach((d, i) => (d.value = i + 1));
    advance(g);
    answer(g, "a", g.choice!.id, [own(g, "a", "eddies")[0].id]);
    expect(
      g.choice!.options.every((o) => {
        const p = g.pieces.find((p) => p.id === o.id)!;
        return p.controller === "a" && card(p.cardId).cost! <= 4;
      }),
    ).toBe(true);
    answer(g, "a", g.choice!.id, [p.id]);
    expect(keyword(g, p, "Blocker")).toBe(true);
    expect(power(g, p)).toBe(n + (paired ? 1 : 0));
  });
for (const discard of [false, true])
  it(`Goro may discard to draw when a friendly Unit blocks (${discard})`, () => {
    const g = scenario("goro-takemura-vengeful-bodyguard", "unused"),
      p = own(g, "a", "field")[0],
      n = own(g, "a", "hand").length;
    g.pending = [];
    emit(g, { type: "block", actor: "a", piece: { ...p } });
    advance(g);
    answer(g, "a", g.choice!.id, [discard ? "yes" : "no"]);
    if (discard) {
      const p = own(g, "a", "hand")[0];
      answer(g, "a", g.choice!.id, [p.id]);
      expect(p.zone).toBe("trash");
    }
    expect(own(g, "a", "hand")).toHaveLength(n);
  });
