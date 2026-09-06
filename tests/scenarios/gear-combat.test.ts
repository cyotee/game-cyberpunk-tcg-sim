import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  move,
  defeat,
  job,
  modifier,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { mayAttack, cost } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";

it("Adrenaline Converter checks the attacked Rival and updates immediately when Gig control changes", () => {
  const g = scenario("adrenaline-converter", "unused");
  g.pending = [];
  const unit = own(g, "a", "field")[0];
  unit.entered = g.turn;
  const remove = [
    ...g.gigs.filter((d) => d.controller === "a").slice(0, 2),
    g.gigs.find((d) => d.controller === "b")!,
  ];
  g.gigs = g.gigs.filter((d) => !remove.includes(d));
  expect(mayAttack(g, unit, "b")).toBe(false); // five versus four
  expect(mayAttack(g, unit, "c")).toBe(true); // six versus four
  own(g, "b", "field")[0].cardId = "maxtac-suppression-team";
  expect(mayAttack(g, unit, "c")).toBe(false);
  own(g, "b", "field")[0].cardId = "animals-wrecker";
  g.gigs.find((d) => d.controller === "c")!.controller = "a";
  expect(mayAttack(g, unit, "c")).toBe(false);
});
for (const slug of ["mandibular-upgrade", "riot-shield"])
  it(`${slug}: only the defending player may use the bearer's Blocker, spending it and redirecting the attack`, () => {
    let g = scenario(slug, "unused");
    g.pending = [];
    g.turnPlayer = "b";
    const blocker = own(g, "a", "field")[0];
    g = applyCommand(g, "b", {
      type: "attack",
      piece: own(g, "b", "field")[0].id,
      target: "a",
    });
    expect(() =>
      applyCommand(g, "c", { type: "block", piece: blocker.id }),
    ).toThrow();
    g = applyCommand(g, "a", { type: "block", piece: blocker.id });
    expect(g.attack!.target).toBe(blocker.id);
    expect(g.pieces.find((p) => p.id === blocker.id)!.ready).toBe(false);
    expect(() =>
      applyCommand(g, "a", { type: "block", piece: blocker.id }),
    ).toThrow();
  });
it("Riot Shields increase opposing Go Solo payment per copy without changing printed cost or forcing the action", () => {
  const g = scenario("riot-shield", "unused");
  g.pending = [];
  const legend = own(g, "a", "legends")[0];
  legend.cardId = "jackie-welles-mama-s-favorite";
  legend.faceUp = true;
  const printed = card(legend.cardId).cost!;
  expect(cost(g, legend, true)).toBe(printed);
  for (const id of ["b", "c"]) {
    const gear = own(g, id, "hand").find((p) => p.cardId === "riot-shield")!;
    gear.zone = "field";
    gear.host = own(g, id, "field")[0].id;
  }
  expect(cost(g, legend, true)).toBe(printed + 4);
  move(
    g,
    g.pieces.find(
      (p) => p.controller === "b" && p.cardId === "riot-shield" && p.host,
    )!,
    "trash",
  );
  expect(cost(g, legend, true)).toBe(printed + 2);
  expect(card(legend.cardId).cost).toBe(printed);
  expect(() => applyCommand(g, "a", { type: "endTurn" })).not.toThrow();
});
it("Deadman uses exactly one of multiple mandatory replacements and leaves its bearer on the field", () => {
  const g = scenario("deadman-transmitter", "unused");
  g.pending = [];
  const bearer = own(g, "a", "field")[0];
  const first = g.pieces.find(
    (p) => p.cardId === "deadman-transmitter" && p.host,
  )!;
  const second = own(g, "a", "hand").find(
    (p) => p.cardId === "deadman-transmitter",
  )!;
  second.zone = "field";
  second.host = bearer.id;
  defeat(g, bearer, "b");
  advance(g);
  expect(g.choice!.options.map((o) => o.id)).toEqual([second.id, first.id]);
  answer(g, "a", g.choice!.id, [first.id]);
  expect(bearer.zone).toBe("field");
  expect(first.zone).toBe("trash");
  expect(second.host).toBe(bearer.id);
});
it("Gorilla Arms steals one new-valued rival Gig with its bearer and cannot trigger again that turn", () => {
  const g = scenario("gorilla-arms", "unused");
  g.pending = [];
  const bearer = own(g, "a", "field")[0];
  const initial = g.gigs.find((d) => d.controller === "b")!;
  const extra = g.gigs.find((d) => d.controller === "c" && d.sides === 6)!;
  extra.value = 3;
  g.frames.push(
    job(g, "steal-gigs", "a", bearer.id, undefined, { ids: [initial.id] }),
  );
  advance(g);
  expect(g.choice!.options.map((o) => o.id)).toEqual([extra.id]);
  expect(g.frames.at(-1)!.source).toBe(bearer.id);
  answer(g, "a", g.choice!.id, [extra.id]);
  expect(extra.controller).toBe("a");
  expect(g.choice).toBeUndefined();
  const later = g.gigs.find((d) => d.controller === "c" && d.sides === 8)!;
  later.value = 4;
  const second = g.gigs.find((d) => d.controller === "b")!;
  g.frames.push(
    job(g, "steal-gigs", "a", bearer.id, undefined, { ids: [second.id] }),
  );
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(later.controller).toBe("c");
});
it("Overwatch pays one, spends its bearer, discards, and defeats only a spent rival within the discarded cost", () => {
  let g = scenario("overwatch-panam-s-gift", "unused");
  g.pending = [];
  const gear = g.pieces.find(
    (p) => p.cardId === "overwatch-panam-s-gift" && p.host,
  )!;
  const bearer = g.pieces.find((p) => p.id === gear.host)!;
  const discard = own(g, "a", "hand").find(
    (p) => p.cardId === "wild-in-the-streets",
  )!;
  const target = own(g, "c", "field")[1];
  target.cardId = "hacked-corpo";
  const high = own(g, "b", "field")[0];
  high.ready = false;
  g = applyCommand(g, "a", {
    type: "activate",
    piece: bearer.id,
    ability: gear.id,
  });
  expect(
    g.frames.find((j) => j.key === "overwatch-panam-s-gift:activate")!.cardId,
  ).toBe(gear.cardId);
  expect(g.choice!.min).toBe(1);
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [g.choice!.options[0].id],
  });
  expect(g.pieces.find((p) => p.id === bearer.id)!.ready).toBe(false);
  expect(g.choice!.private).toBe(true);
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [discard.id],
  });
  expect(g.choice!.options.some((o) => o.id === high.id)).toBe(false);
  expect(
    g.choice!.options.every(
      (o) => g.pieces.find((p) => p.id === o.id)!.controller !== "a",
    ),
  ).toBe(true);
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [target.id],
  });
  expect(g.pieces.find((p) => p.id === target.id)!.zone).toBe("trash");
  expect(g.pieces.find((p) => p.id === discard.id)!.zone).toBe("trash");
});
it("Overwatch's Quick defeat of an attacker ends reactions automatically", () => {
  let g = scenario("overwatch-panam-s-gift", "unused");
  g.pending = [];
  g.turnPlayer = "b";
  const gear = g.pieces.find(
    (p) => p.cardId === "overwatch-panam-s-gift" && p.host,
  )!;
  const bearer = g.pieces.find((p) => p.id === gear.host)!;
  const attacker = own(g, "b", "field")[0];
  g = applyCommand(g, "b", { type: "attack", piece: attacker.id, target: "a" });
  g = applyCommand(g, "a", {
    type: "activate",
    piece: bearer.id,
    ability: gear.id,
  });
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [g.choice!.options[0].id],
  });
  const discard = own(g, "a", "hand").find(
    (p) => p.cardId === "animals-wrecker",
  )!;
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [discard.id],
  });
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [attacker.id],
  });
  expect(g.attack).toBeUndefined();
  expect(g.phase).toBe("main");
  expect(() => applyCommand(g, "a", { type: "endReaction" })).toThrow();
});
it("Overwatch cannot defeat a Unit when there is no card to discard", () => {
  const g = scenario("overwatch-panam-s-gift", "activate");
  own(g, "a", "hand").forEach((p) => (p.zone = "deck"));
  advance(g);
  answer(g, "a", g.choice!.id, [g.choice!.options[0].id]);
  expect(g.choice).toBeUndefined();
  expect(own(g, "b", "field")).toHaveLength(3);
});
for (const legend of [false, true])
  it(`Relic plays another trash Unit for free, leaving all Gear behind: Legend bearer=${legend}`, () => {
    const g = scenario("the-relic-experimental-biochip", "unused");
    g.pending = [];
    const bearer = own(g, "a", "field")[0];
    if (legend) bearer.cardId = "adam-smasher-ender-of-legends";
    const gear = g.pieces.find(
      (p) => p.cardId === "the-relic-experimental-biochip" && p.host,
    )!;
    const replacement = own(g, "a", "trash").find(
      (p) => p.cardId === "psycho-squad",
    )!;
    defeat(g, bearer, "b");
    advance(g);
    expect(g.choice!.min).toBe(1);
    expect(g.choice!.options.some((o) => o.id === bearer.id)).toBe(false);
    answer(g, "a", g.choice!.id, [replacement.id]);
    expect(replacement.zone).toBe("field");
    expect(replacement.ready).toBe(true);
    expect(own(g, "a", "eddies").every((p) => p.ready)).toBe(true);
    expect(bearer.zone).toBe(legend ? "removed" : "deck");
    expect(gear.zone).toBe("trash");
    if (!legend) expect(own(g, "a", "deck").at(-1)!.id).toBe(bearer.id);
  });
it("Relic still bottom-decks its bearer if no other Unit is available in the trash", () => {
  const g = scenario("the-relic-experimental-biochip", "unused");
  g.pending = [];
  own(g, "a", "trash").forEach((p) => (p.zone = "deck"));
  const bearer = own(g, "a", "field")[0];
  defeat(g, bearer, "b");
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(own(g, "a", "deck").at(-1)!.id).toBe(bearer.id);
});

it("equipping Gorilla Arms after a Unit already stole this turn does not grant another first theft", () => {
  const g = scenario("gorilla-arms", "unused");
  g.pending = [];
  const bearer = own(g, "a", "field")[0];
  const gear = g.pieces.find((p) => p.cardId === "gorilla-arms" && p.host)!;
  delete gear.host;
  gear.zone = "hand";
  const first = g.gigs.find((d) => d.controller === "b")!;
  g.frames.push(
    job(g, "steal-gigs", "a", bearer.id, undefined, { ids: [first.id] }),
  );
  advance(g);
  gear.host = bearer.id;
  gear.zone = "field";
  const novel = g.gigs.find((d) => d.controller === "c")!;
  novel.value = 3;
  const second = g.gigs.find((d) => d.controller === "b")!;
  g.frames.push(
    job(g, "steal-gigs", "a", bearer.id, undefined, { ids: [second.id] }),
  );
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(novel.controller).toBe("c");
});
it("moving Gorilla Arms to a different Unit preserves that Unit's own first-theft opportunity", () => {
  const g = scenario("gorilla-arms", "unused");
  g.pending = [];
  const bearer = own(g, "a", "field")[0],
    other = own(g, "a", "field")[1];
  const gear = g.pieces.find((p) => p.cardId === "gorilla-arms" && p.host)!;
  const novel = g.gigs.find((d) => d.controller === "c")!;
  novel.value = 3;
  const first = g.gigs.find((d) => d.controller === "b")!;
  g.frames.push(
    job(g, "steal-gigs", "a", bearer.id, undefined, { ids: [first.id] }),
  );
  advance(g);
  answer(g, "a", g.choice!.id, [novel.id]);
  gear.host = other.id;
  const next = g.gigs.find((d) => d.controller === "c")!;
  next.value = 4;
  const second = g.gigs.find((d) => d.controller === "b")!;
  g.frames.push(
    job(g, "steal-gigs", "a", other.id, undefined, { ids: [second.id] }),
  );
  advance(g);
  expect(g.choice!.options.map((o) => o.id)).toEqual([next.id]);
  answer(g, "a", g.choice!.id, [next.id]);
  expect(next.controller).toBe("a");
});
