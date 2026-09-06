import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import { advance, answer, own, emit } from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { mayAttack } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
import { gameView } from "../../apps/service/rooms";
for (const [id, cost, power, ram, color, tags] of [
  [
    "hanako-arasaka-in-a-gilded-cage",
    4,
    1,
    2,
    "Yellow",
    ["Arasaka", "Corpo", "Netrunner"],
  ],
  ["sketchy-ripper", 2, 0, 2, "Yellow", ["Ganger", "Ripperdoc", "Scavenger"]],
  ["screw-lovelorn-fool", 5, 7, 2, "Red", ["Ganger", "Maelstrom"]],
  ["t-bug-amateur-philosopher", 4, 4, 2, "Yellow", ["Merc", "Netrunner"]],
  ["misty-olszewski-mender-of-broken-spirits", 3, 0, 2, "Blue", ["Mystic"]],
  [
    "judy-a-lvarez-nothing-to-doubt",
    6,
    6,
    5,
    "Blue",
    ["Ganger", "Mox", "Techie"],
  ],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Unit",
      cost,
      power,
      ram,
      color,
      tags,
      keywords: [],
      sell: false,
    }));
for (const take of [false, true])
  it(`Hanako searches only four and reveals any matching-cost cards (${take})`, () => {
    const g = scenario("hanako-arasaka-in-a-gilded-cage", "play"),
      top = own(g, "a", "deck").slice(0, 4);
    top.forEach(
      (p, i) => (p.cardId = i < 2 ? "mantis-blades" : "animals-wrecker"),
    );
    g.gigs
      .filter((d) => d.controller === "a")
      .forEach((d) => (d.value = card("mantis-blades").cost!));
    advance(g);
    expect(g.choice!.private).toBe(true);
    expect(gameView(g, "b").choice).not.toHaveProperty("options");
    expect(g.choice!.options.map((o) => o.id)).toEqual(
      top.slice(0, 2).map((p) => p.id),
    );
    answer(g, "a", g.choice!.id, take ? top.slice(0, 2).map((p) => p.id) : []);
    expect(top.filter((p) => p.zone === "hand")).toHaveLength(take ? 2 : 0);
    const bottom = top.filter((p) => p.zone === "deck");
    expect(
      new Set(
        own(g, "a", "deck")
          .slice(-bottom.length)
          .map((p) => p.id),
      ),
    ).toEqual(new Set(bottom.map((p) => p.id)));
    if (take)
      expect(
        g.log.some(
          (e) =>
            !e.privateTo && e.text.includes(card("mantis-blades").nameFull),
        ),
      ).toBe(true);
  });
for (const take of [false, true])
  it(`Sketchy can find one Gear or fail a hidden search (${take})`, () => {
    const g = scenario("sketchy-ripper", "attack"),
      top = own(g, "a", "deck").slice(0, 3);
    top.forEach(
      (p, i) => (p.cardId = i === 1 ? "mantis-blades" : "animals-wrecker"),
    );
    advance(g);
    expect(g.choice!.min).toBe(0);
    expect(g.choice!.max).toBe(1);
    expect(g.choice!.options.map((o) => o.id)).toEqual([top[1].id]);
    answer(g, "a", g.choice!.id, take ? [top[1].id] : []);
    expect(top[1].zone).toBe(take ? "hand" : "deck");
    expect(
      top
        .filter((p) => p.zone === "deck")
        .every((p) => own(g, "a", "deck").slice(-3).includes(p)),
    ).toBe(true);
  });
it("Screw must retrieve another Unit, including another copy of itself", () => {
  const g = scenario("screw-lovelorn-fool", "defeated"),
    p = g.pieces.find((p) => p.id === g.pending[0].source)!,
    copy = own(g, "a", "trash").find(
      (p) => p.cardId === "screw-lovelorn-fool",
    )!;
  p.zone = "trash";
  advance(g);
  expect(g.choice!.min).toBe(1);
  expect(g.choice!.options.some((o) => o.id === p.id)).toBe(false);
  expect(
    g.choice!.options.every((o) => {
      const p = g.pieces.find((p) => p.id === o.id)!;
      return (
        p.controller === "a" &&
        p.zone === "trash" &&
        card(p.cardId).type === "Unit"
      );
    }),
  ).toBe(true);
  answer(g, "a", g.choice!.id, [copy.id]);
  expect(copy.zone).toBe("hand");
  expect(p.zone).toBe("trash");
});
for (const called of [false, true])
  it(`T-Bug privately looks at all friendly Legends and respects the Call limit (${called})`, () => {
    const g = scenario("t-bug-amateur-philosopher", "defeated"),
      legends = own(g, "a", "legends"),
      eddies = own(g, "a", "eddies").filter((p) => p.ready).length;
    g.players[0].called = called;
    advance(g);
    expect(legends.every((p) => p.known && !p.faceUp)).toBe(true);
    expect(own(g, "b", "legends").some((p) => p.known)).toBe(false);
    expect(
      g.log
        .filter((e) => e.text.startsWith("Looked at"))
        .every((e) => e.privateTo === "a"),
    ).toBe(true);
    if (called) expect(g.choice).toBeUndefined();
    else {
      expect(g.choice!.min).toBe(0);
      answer(g, "a", g.choice!.id, [legends[0].id]);
      expect(legends[0].faceUp).toBe(true);
      expect(g.players[0].called).toBe(true);
    }
    expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(eddies);
  });
for (const correct of [false, true])
  it(`Misty predicts a type and ${correct ? "keeps the card and readies an Eddie" : "trashes the mismatch"}`, () => {
    const g = scenario("misty-olszewski-mender-of-broken-spirits", "unused"),
      p = own(g, "a", "field").find(
        (p) => p.cardId === "misty-olszewski-mender-of-broken-spirits",
      )!,
      top = own(g, "a", "deck")[0],
      eddie = own(g, "a", "eddies")[0];
    g.pending = [];
    eddie.ready = false;
    expect(mayAttack(g, p, "b")).toBe(false);
    emit(g, { type: "end", actor: "b" });
    advance(g);
    expect(g.choice).toBeUndefined();
    emit(g, { type: "end", actor: "a" });
    advance(g);
    expect(g.choice!.options.map((o) => o.id)).toContain("Legend");
    answer(g, "a", g.choice!.id, [correct ? card(top.cardId).type : "Legend"]);
    expect(top.zone).toBe(correct ? "hand" : "trash");
    if (correct) {
      answer(g, "a", g.choice!.id, [eddie.id]);
      expect(eddie.ready).toBe(true);
    } else expect(eddie.ready).toBe(false);
  });
it("Misty revealing an empty deck is not a failed draw", () => {
  const g = scenario("misty-olszewski-mender-of-broken-spirits", "end");
  own(g, "a", "deck").forEach((p) => (p.zone = "removed"));
  advance(g);
  answer(g, "a", g.choice!.id, ["Legend"]);
  expect(g.players[0].eliminated).toBe(false);
  expect(g.choice).toBeUndefined();
});
for (const play of [false, true])
  it(`Judy pays and spends to reveal a Unit, then may play it free (${play})`, () => {
    let g = scenario("judy-a-lvarez-nothing-to-doubt", "unused");
    const p = own(g, "a", "field").find(
        (p) => p.cardId === "judy-a-lvarez-nothing-to-doubt",
      )!,
      top = own(g, "a", "deck")[0],
      n = own(g, "a", "eddies").filter((p) => p.ready).length;
    g.pending = [];
    top.cardId = "animals-wrecker";
    g = applyCommand(g, "a", { type: "activate", piece: p.id });
    answer(g, "a", g.choice!.id, [own(g, "a", "eddies")[0].id]);
    const currentTop = g.pieces.find((x) => x.id === top.id)!;
    expect(g.pieces.find((x) => x.id === p.id)!.ready).toBe(false);
    expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(n - 1);
    expect(currentTop.zone).toBe("hand");
    answer(g, "a", g.choice!.id, play ? [top.id] : []);
    expect(currentTop.zone).toBe(play ? "field" : "hand");
    expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(n - 1);
    if (play) expect(currentTop.entered).toBe(g.turn);
  });
it("Judy can activate with an empty deck and still pays without decking out", () => {
  const g = scenario("judy-a-lvarez-nothing-to-doubt", "activate"),
    p = g.pieces.find((p) => p.id === g.pending[0].source)!;
  own(g, "a", "deck").forEach((p) => (p.zone = "removed"));
  advance(g);
  answer(g, "a", g.choice!.id, [own(g, "a", "eddies")[0].id]);
  expect(p.ready).toBe(false);
  expect(g.players[0].eliminated).toBe(false);
  expect(g.choice).toBeUndefined();
});
