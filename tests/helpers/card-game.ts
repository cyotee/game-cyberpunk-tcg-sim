import { cards, card } from "../../packages/catalog/index";
import { job, uid } from "../../packages/engine/kernel";
import { VERSION, type Game, type Piece } from "../../packages/engine/index";
export function scenario(slug: string, event: string): Game {
  const g: Game = {
    version: VERSION,
    id: "cards",
    players: ["a", "b", "c"].map((id) => ({
      id,
      name: id,
      eliminated: false,
      fixer: [20],
      called: false,
      sold: false,
      programs: 1,
      played: {},
      opening: false,
    })),
    pieces: [],
    gigs: [],
    turnPlayer: "a",
    turn: 2,
    phase: "main",
    target: 100,
    pending: [],
    frames: [],
    mods: [],
    log: [],
    serial: 0,
    random: Array(20000).fill(0.4),
    randomCursor: 0,
    emptyCycle: [],
    overtime: false,
    openingPlayer: "a",
  };
  const add = (
    cardId: string,
    id: string,
    zone: Piece["zone"],
    extra: Partial<Piece> = {},
  ) => {
    const p: Piece = {
      id: uid(g),
      cardId,
      owner: id,
      controller: id,
      zone,
      ready: true,
      faceUp: !["deck", "hand", "eddies"].includes(zone),
      entered: 0,
      marks: {},
      ...extra,
    };
    g.pieces.push(p);
    return p;
  };
  for (const id of ["a", "b", "c"]) {
    for (const c of cards.filter((c) => c.type !== "Legend")) {
      add(c.id, id, "deck");
      add(c.id, id, "hand");
      add(c.id, id, "trash");
    }
    add("animals-wrecker", id, "field");
    add("emergency-atlus", id, "field", { ready: false });
    add("secondhand-bombus", id, "field");
    for (let i = 0; i < 12; i++) add("emergency-atlus", id, "eddies");
    add("v-corporate-exile", id, "legends", { faceUp: false });
    add("viktor-vektor-sit-down-and-relax", id, "legends", { faceUp: false });
    for (const [sides, value] of [
      [4, 1],
      [6, 2],
      [8, 2],
      [10, 8],
      [12, 8],
      [20, 20],
    ])
      g.gigs.push({ id: uid(g), owner: id, controller: id, sides, value });
  }
  const c = card(slug);
  const source = add(
    slug,
    "a",
    c.type === "Program"
      ? "resolving"
      : c.type === "Legend"
        ? "legends"
        : "field",
  );
  if (c.type === "Gear") {
    const bearer = g.pieces.find(
      (p) => p.controller === "a" && p.zone === "field" && !p.host,
    )!;
    source.host = bearer.id;
  }
  const sourceId = source.host ?? source.id;
  const e = {
    type: event,
    actor: "a",
    piece: { ...g.pieces.find((p) => p.id === sourceId)! },
    gig: g.gigs[0],
    opponent: g.pieces.find((p) => p.controller === "b" && p.zone === "field")!
      .id,
    amount: 3,
    won: true,
  };
  const j = job(g, slug + ":" + event, "a", sourceId, e);
  j.cardId = slug;
  g.pending = [j];
  return g;
}
