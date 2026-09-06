import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  field,
  modifier,
} from "../../packages/engine/kernel";
import { card } from "../../packages/catalog/index";
const rows = [
  ["adam-smasher-metal-over-meat", 9, 15, 6, "Yellow", ["Arasaka", "Merc"]],
  ["caliber-totentanz-s-top-dog", 5, 5, 2, "Yellow", ["Ganger", "Maelstrom"]],
  ["gilded-mato-n", 4, 3, 2, "Yellow", ["Ganger", "Valentino"]],
  ["heywood-ripperdoc", 6, 8, 1, "Yellow", ["Ripperdoc"]],
  [
    "maman-brigitte-spirit-of-death",
    5,
    3,
    4,
    "Blue",
    ["Mystic", "Netrunner", "Voodoo Boys"],
  ],
  ["minotaur", 7, 9, 2, "Red", ["Arasaka", "Drone", "Militech"]],
  [
    "placide-voodoo-sentinel",
    8,
    10,
    2,
    "Blue",
    ["Ganger", "Netrunner", "Voodoo Boys"],
  ],
  ["royce-don-t-call-me-simon", 5, 4, 2, "Red", ["Ganger", "Maelstrom"]],
] as const;
for (const [id, cost, power, ram, color, tags] of rows)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Unit",
      cost,
      power,
      ram,
      color,
      tags,
      sell: false,
      keywords: [],
    }));
for (const turn of ["a", "b"])
  it(`Adam Smasher defeats all other Units, including friendly ones and field Legends, on ${turn}'s turn`, () => {
    const g = scenario("adam-smasher-metal-over-meat", "play");
    g.turnPlayer = turn;
    const source = g.pending[0].source,
      legend = own(g, "c", "field")[0];
    legend.cardId = "goro-takemura-hands-unclean";
    advance(g);
    expect(field(g).map((p) => p.id)).toEqual([source]);
    expect(legend.zone).toBe("removed");
    expect(own(g, "a", "legends")).toHaveLength(2);
  });
it("Caliber must defeat a rival Unit costing at most two, independent of current power", () => {
  const g = scenario("caliber-totentanz-s-top-dog", "play"),
    c = own(g, "c", "field")[2];
  modifier(g, "a", c.id, "power", 10);
  advance(g);
  expect(g.choice!.min).toBe(1);
  expect(g.choice!.options.map((o) => o.id)).toContain(c.id);
  expect(g.choice!.options.map((o) => o.id)).not.toContain(
    own(g, "b", "field")[0].id,
  );
  answer(g, "a", g.choice!.id, [c.id]);
  expect(c.zone).toBe("trash");
});
for (const match of [false, true])
  it(`Caliber binds both discards to one Rival and never demands a third discard (${match})`, () => {
    const g = scenario("caliber-totentanz-s-top-dog", "defeated"),
      cards = own(g, "c", "hand")
        .filter((p) => card(p.cardId).cost === 2)
        .slice(0, 2);
    g.gigs
      .filter((d) => d.controller === "a")
      .forEach((d) => (d.value = match ? 2 : 20));
    advance(g);
    answer(g, "a", g.choice!.id, ["c"]);
    answer(g, "c", g.choice!.id, [cards[0].id]);
    if (match) {
      expect(g.choice!.player).toBe("c");
      answer(g, "c", g.choice!.id, [cards[1].id]);
    }
    expect(g.choice).toBeUndefined();
    expect(cards.filter((p) => p.zone === "trash")).toHaveLength(match ? 2 : 1);
  });
for (const sacrifice of [false, true])
  it(`Gilded Maton defeats a cheap rival Unit only after its optional friendly Gear sacrifice (${sacrifice})`, () => {
    const g = scenario("gilded-mato-n", "play"),
      gear = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!;
    gear.zone = "field";
    gear.host = own(g, "a", "field")[0].id;
    gear.faceUp = true;
    advance(g);
    answer(g, "a", g.choice!.id, sacrifice ? [gear.id] : []);
    if (sacrifice) {
      const target = own(g, "c", "field")[1];
      expect(g.choice!.min).toBe(1);
      answer(g, "a", g.choice!.id, [target.id]);
      expect(target.zone).toBe("trash");
    }
    expect(gear.zone).toBe(sacrifice ? "trash" : "field");
    expect(g.choice).toBeUndefined();
  });
it("Gilded Maton may still sacrifice a Gear without any rival Unit", () => {
  const g = scenario("gilded-mato-n", "play");
  field(g)
    .filter((p) => p.controller !== "a")
    .forEach((p) => (p.zone = "trash"));
  const gear = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!;
  gear.zone = "field";
  gear.host = own(g, "a", "field")[0].id;
  advance(g);
  answer(g, "a", g.choice!.id, [gear.id]);
  expect(gear.zone).toBe("trash");
  expect(g.choice).toBeUndefined();
});
for (const match of [false, true])
  it(`Heywood can defeat a third player's Gear without a matching Gig, drawing only on a match (${match})`, () => {
    const g = scenario("heywood-ripperdoc", "play"),
      gear = own(g, "c", "hand").find((p) => p.cardId === "mantis-blades")!;
    gear.zone = "field";
    gear.host = own(g, "c", "field")[0].id;
    g.gigs
      .filter((d) => d.controller === "a")
      .forEach((d) => (d.value = match ? card(gear.cardId).cost! : 20));
    const n = own(g, "a", "hand").length;
    advance(g);
    answer(g, "a", g.choice!.id, [gear.id]);
    expect(gear.zone).toBe("trash");
    expect(own(g, "a", "hand")).toHaveLength(n + (match ? 1 : 0));
  });
for (const event of ["play", "attack"])
  it(`Placide's ${event} may discard a Program even without a rival Unit`, () => {
    const g = scenario("placide-voodoo-sentinel", event);
    field(g)
      .filter((p) => p.controller !== "a")
      .forEach((p) => (p.zone = "trash"));
    advance(g);
    expect(
      g.choice!.options.every(
        (o) =>
          card(g.pieces.find((p) => p.id === o.id)!.cardId).type === "Program",
      ),
    ).toBe(true);
    const p = own(g, "a", "hand").find((p) => p.cardId === "floor-it")!;
    answer(g, "a", g.choice!.id, [p.id]);
    expect(p.zone).toBe("trash");
    expect(g.choice).toBeUndefined();
  });
it("Placide bottom-decks the selected rival Unit only after discarding", () => {
  const g = scenario("placide-voodoo-sentinel", "play"),
    p = own(g, "a", "hand").find((p) => p.cardId === "floor-it")!,
    c = own(g, "c", "field")[0];
  advance(g);
  answer(g, "a", g.choice!.id, [p.id]);
  answer(g, "a", g.choice!.id, [c.id]);
  expect(own(g, "c", "deck").at(-1)!.id).toBe(c.id);
});
it("Maman accepts zero or exactly two Programs and excludes equipped rival Units", () => {
  const g = scenario("maman-brigitte-spirit-of-death", "play"),
    ps = own(g, "a", "hand")
      .filter((p) => card(p.cardId).type === "Program")
      .slice(0, 2),
    target = own(g, "c", "field")[0],
    gear = own(g, "b", "hand").find((p) => p.cardId === "mantis-blades")!;
  gear.zone = "field";
  gear.host = own(g, "b", "field")[0].id;
  advance(g);
  expect(() => answer(g, "a", g.choice!.id, [ps[0].id])).toThrow();
  answer(
    g,
    "a",
    g.choice!.id,
    ps.map((p) => p.id),
  );
  expect(g.choice!.options.map((o) => o.id)).not.toContain(gear.host);
  answer(g, "a", g.choice!.id, [target.id]);
  expect(own(g, "c", "deck").at(-1)!.id).toBe(target.id);
  expect(ps.every((p) => p.zone === "trash")).toBe(true);
});
it("Minotaur's Street Cred qualification cannot authorize a target from a different Rival", () => {
  const g = scenario("minotaur", "play");
  g.gigs.filter((d) => d.controller === "c").forEach((d) => (d.value = 1));
  advance(g);
  expect(g.choice!.options.map((o) => o.id)).toEqual(["c"]);
  answer(g, "a", g.choice!.id, ["c"]);
  expect(g.choice!.min).toBe(1);
  expect(
    g.choice!.options.every(
      (o) => g.pieces.find((p) => p.id === o.id)!.controller === "c",
    ),
  ).toBe(true);
  const target = own(g, "c", "field")[1];
  answer(g, "a", g.choice!.id, [target.id]);
  expect(target.zone).toBe("trash");
});
it("Minotaur's Play resolves without removal when no Rival has lower Cred", () => {
  const g = scenario("minotaur", "play");
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(field(g)).toHaveLength(10);
});
for (const rival of ["b", "c"])
  it(`Royce uses the chosen Rival's Cred for its two-or-three current-power cutoff (${rival})`, () => {
    const g = scenario("royce-don-t-call-me-simon", "play");
    g.gigs.filter((d) => d.controller === "c").forEach((d) => (d.value = 1));
    const targets = own(g, rival, "field");
    targets[0].cardId = "gilded-mato-n";
    modifier(g, "a", targets[1].id, "power", 1);
    advance(g);
    answer(g, "a", g.choice!.id, [rival]);
    expect(g.choice!.options.map((o) => o.id).includes(targets[0].id)).toBe(
      rival === "c",
    );
    expect(
      g.choice!.options.every(
        (o) => g.pieces.find((p) => p.id === o.id)!.controller === rival,
      ),
    ).toBe(true);
    answer(g, "a", g.choice!.id, [targets[2].id]);
    expect(targets[2].zone).toBe("trash");
  });
