import { card } from "../catalog/index";
import type { Game, Piece, Job, GameEvent } from "./types";
import {
  scripts,
  triggers,
  player,
  piece,
  own,
  field,
  faceUpLegends,
  gears,
  gigs,
  rivals,
  cred,
  even,
  pairs,
  minGig,
  highGigs,
  has,
  tag,
  log,
  logActor,
  logCard,
  power,
  keyword,
  modifier,
  job,
  emit,
  spend,
  ready,
  move,
  moveMany,
  defeat,
  draw,
  order,
  shuffle,
  random,
  choose,
  selected,
  target,
  options,
  yes,
  when,
  type Step,
  type Context,
  type Trigger,
} from "./kernel";
import { pay, playPiece, resources, cost, barrier } from "./actions";
const friendly = (c: Context) =>
  field(c.g).filter((p) => p.controller === c.j.controller);
const enemy = (c: Context) =>
  field(c.g).filter(
    (p) =>
      p.controller !== c.j.controller && !player(c.g, p.controller).eliminated,
  );
const all = (c: Context) => field(c.g);
const source = (c: Context) => piece(c.g, c.j.source);
const unit = (
  label = "Choose a Unit",
  list: (c: Context) => Piece[] = all,
  key = "target",
  optional = false,
  max = 1,
) => choose(label, (c) => options(list(c), c.g), key, optional ? 0 : 1, max);
const chosen = (c: Context, key = "target") =>
  selected(c.j, key)
    .map((id) => c.g.pieces.find((p) => p.id === id))
    .filter((p): p is Piece => !!p);
const discard = (
  n = 1,
  who: (c: Context) => string = (c) => c.j.controller,
  key = "discard",
): Step[] => [
  choose(
    `Discard ${n} card(s)`,
    (c) => options(own(c.g, who(c), "hand")),
    key,
    n,
    n,
    who,
    true,
  ),
  (c) => {
    for (const p of chosen(c, key)) move(c.g, p, "trash");
    log(c.g, {
      kind: "discard",
      actor: logActor(c.g, who(c)),
      count: selected(c.j, key).length,
    });
  },
];
const rival = (
  label = "Choose a Rival",
  test: (c: Context, id: string) => boolean = () => true,
  key = "rival",
) =>
  choose(
    label,
    (c) =>
      rivals(c.g, c.j.controller)
        .filter((r) => test(c, r.id))
        .map((r) => ({ id: r.id, label: r.name })),
    key,
  );
const rivalId = (c: Context) => selected(c.j, "rival")[0];
const boost =
  (
    amount: number | ((c: Context) => number),
    kind = "power",
    key = "target",
    expires: "turn" | "next" | "attack" | "targetEnd" = "turn",
  ): Step =>
  (c) => {
    for (const p of chosen(c, key))
      modifier(
        c.g,
        c.j.controller,
        p.id,
        kind,
        typeof amount === "number" ? amount : amount(c),
        expires,
      );
  };
const kill =
  (key = "target"): Step =>
  (c) => {
    for (const p of chosen(c, key)) defeat(c.g, p, c.j.controller);
  };
const relocate =
  (zone: "trash" | "deck" | "hand", key = "target"): Step =>
  (c) => {
    moveMany(c.g, chosen(c, key), zone);
  };
const draws =
  (n: number | ((c: Context) => number) = 1): Step =>
  (c) =>
    draw(c.g, c.j.controller, typeof n === "number" ? n : n(c));
const adjust = (
  n: number,
  mode: "adjust" | "increase" | "decrease" = "adjust",
  friendlyOnly = false,
  key = "gig",
  exact = false,
): Step[] => [
  choose(
    "Choose a Gig",
    (c) =>
      c.g.gigs
        .filter((d) => !friendlyOnly || d.controller === c.j.controller)
        .map((d) => ({
          id: d.id,
          label: `${player(c.g, d.controller).name} · d${d.sides} · ${d.value}`,
        })),
    key,
  ),
  (c) => {
    const d = c.g.gigs.find((d) => d.id === selected(c.j, key)[0]);
    if (!d) return;
    const lower = mode === "increase" ? d.value : Math.max(1, d.value - n),
      upper = mode === "decrease" ? d.value : Math.min(d.sides, d.value + n);
    return {
      player: c.j.controller,
      label: "Choose its new value",
      options: Array.from({ length: upper - lower + 1 }, (_, i) => ({
        id: String(lower + i),
        label: String(lower + i),
      })).filter((o) => !exact || Math.abs(Number(o.id) - d.value) === n),
      min: 1,
      max: 1,
      key: "value",
    };
  },
  (c) => {
    const d = c.g.gigs.find((d) => d.id === selected(c.j, key)[0]);
    if (d) {
      const value = Number(selected(c.j, "value")[0]);
      c.j.vars["changed:" + key] = value !== d.value;
      d.value = value;
      if (c.j.vars["changed:" + key])
        emit(c.g, { type: "adjust", actor: c.j.controller, gig: { ...d } });
      log(c.g, {
        kind: "adjust",
        actor: logActor(c.g, c.j.controller),
        gig: d.id,
        sides: d.sides,
        value: d.value,
      });
    }
  },
];
const swap: Step[] = [
  choose(
    "Choose a friendly Gig",
    (c) =>
      gigs(c.g, c.j.controller).map((d) => ({
        id: d.id,
        label: `d${d.sides} · ${d.value}`,
      })),
    "ownGig",
  ),
  choose(
    "Choose a rival Gig",
    (c) =>
      c.g.gigs
        .filter(
          (d) =>
            d.controller !== c.j.controller &&
            (!rivalId(c) || d.controller === rivalId(c)),
        )
        .map((d) => ({
          id: d.id,
          label: `${player(c.g, d.controller).name} · d${d.sides} · ${d.value}`,
        })),
    "otherGig",
  ),
  (c) => {
    const a = c.g.gigs.find((d) => d.id === selected(c.j, "ownGig")[0]),
      b = c.g.gigs.find((d) => d.id === selected(c.j, "otherGig")[0]);
    if (a && b) {
      [a.controller, b.controller] = [b.controller, a.controller];
      emit(c.g, {
        type: "adjust",
        actor: c.j.controller,
        gigs: [{ ...a }, { ...b }],
      });
    }
  },
];
const setEqual: Step[] = [
  choose(
    "Choose the Gig to change",
    (c) =>
      c.g.gigs.map((d) => ({
        id: d.id,
        label: `${player(c.g, d.controller).name} · d${d.sides} · ${d.value}`,
      })),
    "from",
  ),
  (c) => {
    const a = c.g.gigs.find((d) => d.id === selected(c.j, "from")[0]);
    if (a)
      return choose(
        "Choose the value to copy",
        (c) =>
          c.g.gigs
            .filter(
              (d) =>
                d.id !== a.id &&
                d.value <= a.sides &&
                (c.j.cardId !== "padre-man-of-the-cross" ||
                  d.controller !== a.controller),
            )
            .map((d) => ({ id: d.id, label: `d${d.sides} · ${d.value}` })),
        "to",
      )(c);
  },
  (c) => {
    const a = c.g.gigs.find((d) => d.id === selected(c.j, "from")[0]),
      b = c.g.gigs.find((d) => d.id === selected(c.j, "to")[0]);
    if (a && b && a.value !== b.value) {
      a.value = b.value;
      emit(c.g, { type: "adjust", actor: c.j.controller, gig: { ...a } });
    }
  },
];
const trash =
  (n: number): Step =>
  (c) => {
    const ps = own(c.g, c.j.controller, "deck").slice(0, n);
    c.j.vars.trashed = ps.map((p) => p.id);
    ps.forEach((p) => move(c.g, p, "trash"));
  };
const search = (
  n: number,
  filter: (p: Piece, c: Context) => boolean = () => true,
  max = 1,
  bottom = true,
): Step[] => [
  (c) => {
    c.j.vars.searched = own(c.g, c.j.controller, "deck")
      .slice(0, n)
      .map((p) => p.id);
  },
  choose(
    "Search your deck — select cards to keep",
    (c) => options(chosen(c, "searched").filter((p) => filter(p, c))),
    "found",
    0,
    max,
    undefined,
    true,
  ),
  (c) => {
    for (const p of chosen(c, "found")) {
      p.zone = "hand";
      log(c.g, {
        kind: "reveal",
        actor: logActor(c.g, c.j.controller),
        cards: [logCard(p)],
      });
    }
    if (bottom) {
      moveMany(
        c.g,
        chosen(c, "searched").filter((p) => p.zone === "deck"),
        "deck",
      );
    }
  },
];
const retrieve = (type: string, fromTrashed = false): Step[] => [
  unit(
    `Add a ${type} from your trash`,
    (c) =>
      (fromTrashed
        ? chosen(c, "trashed")
        : own(c.g, c.j.controller, "trash")
      ).filter((p) => card(p.cardId).type === type),
    "retrieve",
    false,
  ),
  relocate("hand", "retrieve"),
];
const readyEddies = (n: number): Step[] => [
  choose(
    `Ready ${n} Eddie(s)`,
    (c) =>
      own(c.g, c.j.controller, "eddies").map((p, i) => ({
        id: p.id,
        label: `Eddie ${i + 1} · ${p.ready ? "ready" : "spent"}`,
      })),
    "eddies",
    n,
    n,
  ),
  (c) => chosen(c, "eddies").forEach((p) => ready(c.g, p)),
];
const freeCall: Step[] = [
  choose(
    "You may Call a Legend for free",
    (c) =>
      player(c.g, c.j.controller).called
        ? []
        : own(c.g, c.j.controller, "legends")
            .filter((p) => !p.faceUp)
            .map((p, i) => ({ id: p.id, label: `Face-down Legend ${i + 1}` })),
    "legend",
    0,
  ),
  (c) => {
    const id = selected(c.j, "legend")[0];
    if (id)
      c.g.frames.push(
        job(c.g, "call", c.j.controller, id, undefined, { free: true }),
      );
  },
];
const freePlay = (
  filter: (p: Piece, c: Context) => boolean,
  zones: ("hand" | "trash")[] = ["hand"],
  key = "free",
  bottom = false,
  equipFilter: (p: Piece, c: Context) => boolean = () => true,
  optional = true,
): Step[] => [
  unit(
    optional ? "You may play a card for free" : "Play a card for free",
    (c) =>
      zones
        .flatMap((z) => own(c.g, c.j.controller, z))
        .filter(
          (p) =>
            filter(p, c) &&
            (card(p.cardId).type !== "Gear" ||
              [
                ...friendly(c),
                ...own(c.g, c.j.controller, "legends").filter(
                  (p) => !p.host && p.faceUp,
                ),
              ].some((p) => equipFilter(p, c))),
        ),
    key,
    optional,
  ),
  (c) => {
    const p = target(c.g, c.j, key);
    if (p && card(p.cardId).type === "Gear")
      return unit(
        "Equip the Gear",
        (c) =>
          [
            ...friendly(c),
            ...own(c.g, c.j.controller, "legends").filter(
              (p) => !p.host && p.faceUp,
            ),
          ].filter((p) => equipFilter(p, c)),
        "equip",
      )(c);
  },
  (c) => {
    const p = target(c.g, c.j, key);
    if (p) {
      playPiece(c.g, p, selected(c.j, "equip")[0]);
      if (bottom) {
        const finish = c.g.frames.findLast(
          (j) => j.key === "program-finish" && j.source === p.id,
        );
        if (finish) finish.vars.bottom = true;
      }
    }
  },
];
const activateCost = (n = 0): Step[] => [
  (c) => {
    if (n) pay(c.g, c.j.controller, n, c.j.source);
  },
  (c) => spend(c.g, source(c)),
];
function define(
  id: string,
  event: string,
  steps: Step[],
  test?: Trigger["test"],
  once = false,
) {
  const key = id + ":" + event;
  scripts[key] = steps;
  if (["program", "activate"].includes(event)) return;
  (triggers[id] ??= []).push({
    event,
    key,
    once,
    test: test ?? ((_g, p, e) => e.piece?.id === p.id),
  });
}
const same = (g: Game, p: Piece, e: GameEvent) => e.actor === p.controller;
const self = (_g: Game, p: Piece, e: GameEvent) => e.piece?.id === p.id;
const friendlyEvent = (_g: Game, p: Piece, e: GameEvent) =>
  e.piece?.controller === p.controller;

// Programs: each behavior is explicitly registered; card text is never executed as code.
define("afterparty-at-lizzie-s", "program", [
  ...adjust(1),
  ...when(
    (c) => new Set(gigs(c.g, c.j.controller).map((d) => d.value)).size >= 2,
    draws(),
  ),
]);
define("industrial-assembly", "program", [
  ...adjust(4, "increase"),
  ...when((c) => highGigs(c.g, c.j.controller) > 0, draws()),
]);
define("trust-no-one", "program", [
  ...adjust(3, "decrease"),
  ...when((c) => minGig(c.g, c.j.controller), draws()),
]);
define("peace-offering", "program", [
  yes("Set a Gig to another Gig’s value?"),
  ...when((c) => selected(c.j, "yes")[0] === "yes", ...setEqual),
  ...when((c) => pairs(c.g, c.j.controller) > 0, draws()),
]);
define("floor-it", "program", [
  unit("Give a rival Unit −1 power", enemy),
  boost(-1),
  draws(),
]);
define("corporate-surveillance", "program", [
  unit("Spend a rival Unit costing 4 or less", (c) =>
    enemy(c).filter((p) => (card(p.cardId).cost ?? Infinity) <= 4),
  ),
  (c) =>
    chosen(c).forEach((p) => {
      if (p.ready) spend(c.g, p);
    }),
]);
define("wild-in-the-streets", "program", [
  unit("Defeat a spent Unit", (c) => all(c).filter((p) => !p.ready)),
  kill(),
]);
define("detonate", "program", [
  unit("Defeat rival Gear with power 2 or less", (c) =>
    c.g.pieces.filter(
      (p) =>
        p.host &&
        p.controller !== c.j.controller &&
        (card(p.cardId).power ?? 0) <= 2,
    ),
  ),
  kill(),
]);
define("over-the-edge", "program", [
  unit("Defeat a Unit no stronger than your d20", (c) =>
    all(c).filter((p) =>
      gigs(c.g, c.j.controller).some(
        (d) => d.sides === 20 && power(c.g, p) <= d.value,
      ),
    ),
  ),
  kill(),
]);
define("all-is-lost", "program", [trash(3), ...retrieve("Unit", true)]);
define("bootleg-black-sapphire-show", "program", [
  (c) => {
    const p = own(c.g, c.j.controller, "deck")[0];
    if (p) {
      p.zone = "eddies";
      p.ready = true;
      p.faceUp = false;
    }
  },
  ...when(
    (c) =>
      gigs(c.g, c.j.controller).some((d) => d.value % 2 === 0) &&
      gigs(c.g, c.j.controller).some((d) => d.value % 2 === 1),
    draws(2),
  ),
]);
define("chrome-reverie", "program", [
  unit("A rival Unit cannot attack until your next turn", enemy),
  boost(0, "noAttack", "target", "next"),
  ...when((c) => minGig(c.g, c.j.controller), ...freeCall),
]);
define("memory-relapse", "program", [
  unit("Spend a rival Unit; it cannot ready until your next turn", enemy),
  (c) =>
    chosen(c).forEach((p) => {
      if (p.ready) spend(c.g, p);
    }),
  boost(0, "noReady", "target", "next"),
  ...when((c) => even(c.g, c.j.controller), draws()),
]);
define("synapse-burnout", "program", [
  unit("Give a friendly Unit power while fighting", friendly),
  boost(1, "fightLegendPower"),
]);
define("reboot-optics", "program", [
  unit("A rival Unit cannot defeat its next fight opponent", enemy),
  boost(0, "noDefeat"),
]);
define("safety-override", "program", [
  (c) => modifier(c.g, c.j.controller, c.j.controller, "safety"),
]);
define("take-control", "program", [
  unit("A rival Unit steals one fewer Gig", enemy),
  boost(-1, "steal"),
  ...when(
    (c) =>
      chosen(c).some((p) => ["AI", "DRONE", "VEHICLE"].some((t) => tag(p, t))),
    draws(),
  ),
]);
define("appetite-for-destruction", "program", [
  (c) => modifier(c.g, c.j.controller, c.j.controller, "appetite"),
]);
define("cyberpsychosis", "program", [
  unit("Give an equipped Unit extra power", (c) =>
    all(c).filter((p) => gears(c.g, p.id).length > 0),
  ),
  boost((c) => {
    const p = target(c.g, c.j);
    return p ? 3 * gears(c.g, p.id).length : 0;
  }),
  boost(0, "cyberpsychosis"),
]);
define("don-t-fear-the-reaper", "program", [
  (c) =>
    enemy(c)
      .filter((p) => p.ready)
      .forEach((p) => spend(c.g, p)),
  unit("Defeat a spent Unit", (c) => all(c).filter((p) => !p.ready)),
  kill(),
]);
define("carnage-at-the-colosseum", "program", [
  unit("Choose your stronger Unit", friendly, "friendly"),
  unit("Defeat a weaker rival Unit", (c) => {
    const p = target(c.g, c.j, "friendly");
    return p ? enemy(c).filter((t) => power(c.g, t) < power(c.g, p)) : [];
  }),
  kill(),
]);
define("bonnie-and-clyde", "program", [
  (c) => {
    const max = rivals(c.g, c.j.controller).some(
      (r) => gigs(c.g, r.id).length >= gigs(c.g, c.j.controller).length + 2,
    )
      ? 2
      : 1;
    return unit(
      "Defeat up to " + max + " rival Units with power 4 or less",
      (c) => enemy(c).filter((p) => power(c.g, p) <= 4),
      "target",
      false,
      max,
    )(c);
  },
  kill(),
]);
define("les-e-le-mens", "program", [
  rival(),
  unit("Bottom-deck that Rival’s lowest-power Unit", (c) => {
    const ps = enemy(c).filter((p) => p.controller === rivalId(c)),
      min = Math.min(...ps.map((p) => power(c.g, p)));
    return ps.filter((p) => power(c.g, p) === min);
  }),
  relocate("deck"),
]);
define("unlikely-bond", "program", [
  unit(
    "Bottom-deck a ready friendly Unit",
    (c) => friendly(c).filter((p) => p.ready),
    "friendly",
  ),
  relocate("deck", "friendly"),
  ...when(
    (c) => selected(c.j, "friendly").length > 0,
    unit("Bottom-deck a spent rival Unit", (c) =>
      enemy(c).filter((p) => !p.ready),
    ),
    relocate("deck"),
  ),
]);
define("three-mouths-one-desire", "program", [
  (c) => {
    c.j.vars.searched = own(c.g, c.j.controller, "deck")
      .slice(0, 3)
      .map((p) => p.id);
  },
  (c) =>
    choose(
      "Choose cards to add to your hand",
      (c) => options(chosen(c, "searched")),
      "found",
      1,
      1 + gigs(c.g, c.j.controller).filter((d) => d.value === 1).length,
      undefined,
      true,
    )(c),
  relocate("hand", "found"),
  (c) =>
    moveMany(
      c.g,
      chosen(c, "searched").filter((p) => p.zone === "deck"),
      "deck",
    ),
]);
define("the-heist", "program", [
  trash(4),
  unit(
    "Choose a Gear from the trashed cards",
    (c) => chosen(c, "trashed").filter((p) => card(p.cardId).type === "Gear"),
    "retrieved",
    false,
  ),
  (c) => {
    const p = target(c.g, c.j, "retrieved");
    if (p) {
      p.zone = "hand";
      c.j.vars.freeEligible = gigs(c.g, c.j.controller).some(
        (d) => d.value === card(p.cardId).cost,
      );
    }
  },
  ...when(
    (c) => !!c.j.vars.freeEligible,
    ...freePlay((p, c) => p.id === selected(c.j, "retrieved")[0]),
  ),
]);
define("we-gotta-live-together", "program", [
  ...freePlay(
    (p) =>
      card(p.cardId).type === "Unit" && (card(p.cardId).cost ?? Infinity) <= 3,
    ["trash"],
    "free1",
  ),
  ...freePlay(
    (p) =>
      card(p.cardId).type === "Unit" && (card(p.cardId).cost ?? Infinity) <= 3,
    ["trash"],
    "free2",
  ),
]);
define("live-with-the-aftermath", "program", [
  (c) => {
    for (const id of order(c.g).reverse())
      c.g.frames.push(job(c.g, "global-defeat", id, c.j.source));
  },
]);
scripts["global-defeat"] = [unit("Defeat one of your Units", friendly), kill()];
define("shattered-memories", "program", [
  (c) => {
    c.j.vars.discardCount = c.g.players
      .filter((p) => !p.eliminated)
      .reduce((n, p) => n + own(c.g, p.id, "hand").length, 0);
    for (const id of order(c.g).reverse())
      c.g.frames.push(job(c.g, "global-redraw", id, c.j.source));
  },
  ...when(
    (c) =>
      gigs(c.g, c.j.controller).some((d) => d.value === c.j.vars.discardCount),
    draws(2),
  ),
]);
scripts["global-redraw"] = [
  (c) => own(c.g, c.j.controller, "hand").forEach((p) => move(c.g, p, "trash")),
  yes("Draw five cards?"),
  ...when((c) => selected(c.j, "yes")[0] === "yes", draws(5)),
];
define("fool-on-the-hill", "program", [
  (c) => {
    c.j.vars.revealed = own(c.g, c.j.controller, "deck")
      .slice(0, 2)
      .map((p) => p.id);
    log(c.g, {
      kind: "reveal",
      actor: logActor(c.g, c.j.controller),
      cards: chosen(c, "revealed").map(logCard),
    });
  },
  rival(),
  choose(
    "Choose what happens to the revealed cards",
    () => [
      { id: "hand", label: "Add them to their hand" },
      { id: "trash", label: "Trash them; they draw two" },
    ],
    "destination",
    1,
    1,
    rivalId,
  ),
  (c) =>
    chosen(c, "revealed").forEach((p) =>
      move(
        c.g,
        p,
        selected(c.j, "destination")[0] === "hand" ? "hand" : "trash",
      ),
    ),
  ...when((c) => selected(c.j, "destination")[0] === "trash", draws(2)),
]);
const modes = (labels: string[]) =>
  choose(
    "Choose an effect",
    () => labels.map((label, i) => ({ id: String(i), label })),
    "mode",
  );
define("pyramid-song", "program", [
  (c) => {
    if (gigs(c.g, c.j.controller).some((d) => d.sides === 4 && d.value === 1)) {
      c.j.vars.mode = ["0", "1"];
      return;
    }
    return modes([
      "Give a rival Unit −5 power",
      "Bottom-deck a rival Unit with 0 power",
    ])(c);
  },
  ...when(
    (c) => selected(c.j, "mode").includes("0"),
    unit("Give a rival Unit −5 power", enemy),
    boost(-5),
  ),
  ...when(
    (c) => selected(c.j, "mode").includes("1"),
    unit("Bottom-deck a rival Unit with 0 power", (c) =>
      enemy(c).filter((p) => power(c.g, p) === 0),
    ),
    relocate("deck"),
  ),
]);
define("towerfall", "program", [
  (c) => {
    if (
      rivals(c.g, c.j.controller).some(
        (r) => cred(c.g, c.j.controller) < cred(c.g, r.id),
      )
    ) {
      c.j.vars.mode = ["0", "1"];
      return;
    }
    return modes([
      "All rival Units get −5 power",
      "Bottom-deck all rival Units with 0 power",
    ])(c);
  },
  ...when(
    (c) => selected(c.j, "mode").includes("0"),
    (c) =>
      enemy(c).forEach((p) => modifier(c.g, c.j.controller, p.id, "power", -5)),
  ),
  ...when(
    (c) => selected(c.j, "mode").includes("1"),
    (c) =>
      moveMany(
        c.g,
        enemy(c).filter((p) => power(c.g, p) === 0),
        "deck",
      ),
  ),
]);
define("nocturne-op55-n1", "program", [
  modes([
    "Draw two",
    "A Unit cannot attack until your next turn",
    "Discount a friendly Legend’s Go Solo by 2",
  ]),
  ...when((c) => selected(c.j, "mode")[0] === "0", draws(2)),
  ...when(
    (c) => selected(c.j, "mode")[0] === "1",
    unit(),
    boost(0, "noAttack", "target", "next"),
  ),
  ...when(
    (c) => selected(c.j, "mode")[0] === "2",
    choose(
      "Choose a friendly Legend",
      (c) =>
        own(c.g, c.j.controller)
          .filter(
            (p) =>
              !p.host &&
              ["legends", "field"].includes(p.zone) &&
              card(p.cardId).type === "Legend",
          )
          .map((p, i) =>
            p.faceUp
              ? { id: p.id, label: card(p.cardId).nameFull, cardId: p.cardId }
              : { id: p.id, label: `Face-down Legend ${i + 1}` },
          ),
      "target",
    ),
    boost(-2, "soloDiscount"),
  ),
]);
define("gunpoint-diplomacy", "program", [
  unit("Choose a friendly Unit", friendly),
  (c) => {
    const rs = rivals(c.g, c.j.controller).filter(
      (r) => cred(c.g, c.j.controller) < cred(c.g, r.id),
    );
    if (rs.length)
      return rival("Choose a qualifying Rival", (_c, id) =>
        rs.some((r) => r.id === id),
      )(c);
    c.j.vars.mode = ["0", "1"];
  },
  ...when(
    (c) => !!rivalId(c),
    choose(
      "Choose the benefit for that Unit",
      () => [
        { id: "0", label: "May attack ready Units on its next attack" },
        { id: "1", label: "+3 power this turn" },
      ],
      "mode",
      1,
      1,
      rivalId,
    ),
  ),
  ...when((c) => selected(c.j, "mode").includes("0"), boost(0, "attackReady")),
  ...when((c) => selected(c.j, "mode").includes("1"), boost(3)),
]);

// Common enters-play and combat triggers.
define("adam-smasher-ender-of-legends", "play", [
  unit("Defeat a rival Unit", enemy),
  kill(),
]);
define("adam-smasher-metal-over-meat", "play", [
  (c) =>
    all(c)
      .filter((p) => p.id !== c.j.source)
      .forEach((p) => defeat(c.g, p, c.j.controller)),
]);
define("delamain-rideshare-ai", "play", [draws(2)]);
define("field-operator", "play", [
  ...when((c) => even(c.g, c.j.controller), draws()),
]);
define("hacked-corpo", "play", [trash(3), ...retrieve("Program", true)]);
define("japantown-jonin", "play", [
  unit("Give a friendly Unit +2 power", friendly),
  boost(2),
]);
define("offduty-malfini", "play", [
  (c) => {
    const p = source(c);
    if (p.ready) spend(c.g, p);
  },
  unit("Spend a rival Unit", enemy),
  (c) =>
    chosen(c)
      .filter((p) => p.ready)
      .forEach((p) => spend(c.g, p)),
]);
define("maxtac-av", "play", [
  yes("Swap a friendly Gig with a rival Gig?"),
  ...when((c) => selected(c.j, "yes")[0] === "yes", ...swap),
]);
define("heywood-ripperdoc", "play", [
  unit(
    "You may defeat a Gear",
    (c) => c.g.pieces.filter((p) => p.host),
    "target",
    true,
  ),
  (c) => {
    const p = target(c.g, c.j);
    c.j.vars.draw =
      !!p &&
      gigs(c.g, c.j.controller).some((d) => d.value === card(p.cardId).cost);
  },
  kill(),
  ...when((c) => !!c.j.vars.draw, draws()),
]);
define("gilded-mato-n", "play", [
  unit(
    "You may defeat a friendly Gear",
    (c) => c.g.pieces.filter((p) => p.host && p.controller === c.j.controller),
    "sacrifice",
    true,
  ),
  kill("sacrifice"),
  ...when(
    (c) => selected(c.j, "sacrifice").length > 0,
    unit("Defeat a rival Unit costing 3 or less", (c) =>
      enemy(c).filter((p) => (card(p.cardId).cost ?? Infinity) <= 3),
    ),
    kill(),
  ),
]);
define("caliber-totentanz-s-top-dog", "play", [
  unit("Defeat a rival Unit costing 2 or less", (c) =>
    enemy(c).filter((p) => (card(p.cardId).cost ?? Infinity) <= 2),
  ),
  kill(),
]);
define("caliber-totentanz-s-top-dog", "defeated", [
  rival(),
  ...discard(1, rivalId),
  ...when(
    (c) =>
      chosen(c, "discard").some((p) =>
        gigs(c.g, c.j.controller).some((d) => d.value === card(p.cardId).cost),
      ),
    ...discard(1, rivalId, "discard2"),
  ),
]);
define("minotaur", "play", [
  rival(
    "Choose a Rival with less Street Cred",
    (c, id) => cred(c.g, c.j.controller) > cred(c.g, id),
  ),
  unit("Defeat their Unit with power 5 or less", (c) =>
    enemy(c).filter((p) => p.controller === rivalId(c) && power(c.g, p) <= 5),
  ),
  kill(),
]);
define("royce-don-t-call-me-simon", "play", [
  rival(),
  unit("Defeat a qualifying Unit", (c) =>
    enemy(c).filter(
      (p) =>
        p.controller === rivalId(c) &&
        power(c.g, p) <=
          (cred(c.g, c.j.controller) > cred(c.g, rivalId(c)) ? 3 : 2),
    ),
  ),
  kill(),
]);
define("mox-inciters", "play", [
  unit("A rival Unit must attack next turn", enemy),
  boost(0, "forced", "target", "targetEnd"),
]);
define("valentino-street-racer", "play", [
  unit("Give another friendly Unit Adrenaline", (c) =>
    friendly(c).filter(
      (p) => p.id !== c.j.source && (card(p.cardId).cost ?? Infinity) <= 5,
    ),
  ),
  boost(0, "Adrenaline"),
]);
define("pacifica-netrunner", "play", [
  ...when(
    (c) => even(c.g, c.j.controller),
    unit("A rival Unit cannot ready until your next turn", enemy),
    boost(0, "noReady", "target", "next"),
  ),
]);
define("chrome-fang", "play", [
  (c) => modifier(c.g, c.j.controller, c.j.controller, "chrome", 0, "next"),
]);
define("westbrook-netrunner", "play", [
  (c) => modifier(c.g, c.j.controller, c.j.controller, "westbrook", 0, "next"),
]);
define("tyger-s-whisper", "play", freeCall);
define("sandayu-oda-hanako-s-guardian", "play", [
  (c) =>
    choose(
      "Spend rival Units for your value-pairs",
      (c) => options(enemy(c), c.g),
      "target",
      pairs(c.g, c.j.controller),
      pairs(c.g, c.j.controller),
    )(c),
  (c) =>
    chosen(c)
      .filter((p) => p.ready)
      .forEach((p) => spend(c.g, p)),
]);
define(
  "hanako-arasaka-in-a-gilded-cage",
  "play",
  search(
    4,
    (p, c) =>
      gigs(c.g, c.j.controller).some((d) => d.value === card(p.cardId).cost),
    4,
  ),
);
define(
  "lizzy-wizzy-delicate-weapon",
  "play",
  freePlay(
    (p) =>
      card(p.cardId).type === "Program" &&
      (card(p.cardId).cost ?? Infinity) <= 3,
    ["hand", "trash"],
    "free",
    true,
  ),
);
define(
  "viktor-vektor-you-might-feel-a-little-pinch",
  "play",
  freePlay(
    (p) =>
      card(p.cardId).type === "Gear" &&
      tag(p, "CYBERWARE") &&
      (card(p.cardId).cost ?? Infinity) <= 2,
    ["trash"],
    "free",
    false,
    (p, c) => p.zone === "field" && !p.host && p.id !== c.j.source,
    false,
  ),
);
define("yorinobu-arasaka-steel-dragon", "play", [
  ...freePlay(
    (p) =>
      card(p.cardId).type === "Unit" && (card(p.cardId).cost ?? Infinity) <= 4,
    ["hand", "trash"],
  ),
  boost(0, "attackUnits", "free"),
]);
define(
  "yorinobu-arasaka-steel-dragon",
  "defeated",
  [draws()],
  (g, p, e) =>
    !!e.piece &&
    e.piece.zone === "field" &&
    !e.piece.host &&
    tag(e.piece, "ARASAKA") &&
    player(g, p.controller).played.ARASAKAdefeated === 1,
  true,
);
define("maman-brigitte-spirit-of-death", "play", [
  (c) => {
    const ps = own(c.g, c.j.controller, "hand").filter(
      (p) => card(p.cardId).type === "Program",
    );
    if (ps.length < 2) {
      c.j.vars.programs = [];
      return;
    }
    return {
      player: c.j.controller,
      label: "You may discard exactly two Programs",
      options: options(ps),
      key: "programs",
      min: 0,
      max: 2,
      allowedCounts: [0, 2],
      private: true,
    };
  },
  relocate("trash", "programs"),
  ...when(
    (c) => selected(c.j, "programs").length === 2,
    unit("Bottom-deck an unequipped rival Unit", (c) =>
      enemy(c).filter((p) => !gears(c.g, p.id).length),
    ),
    relocate("deck"),
  ),
]);
for (const event of ["play", "attack"])
  define("placide-voodoo-sentinel", event, [
    unit(
      "You may discard a Program",
      (c) =>
        own(c.g, c.j.controller, "hand").filter(
          (p) => card(p.cardId).type === "Program",
        ),
      "program",
      true,
    ),
    relocate("trash", "program"),
    ...when(
      (c) => selected(c.j, "program").length > 0,
      unit("Bottom-deck a rival Unit", enemy),
      relocate("deck"),
    ),
  ]);
for (const event of ["play", "attack"])
  define("dexter-deshawn-one-last-chance", event, adjust(1));
define("dexter-deshawn-one-last-chance", "defeated", [
  ...when(
    (c) =>
      rivals(c.g, c.j.controller).some(
        (r) =>
          Number.isFinite(cred(c.g, r.id)) &&
          Number.isFinite(cred(c.g, c.j.controller)) &&
          Math.abs(cred(c.g, c.j.controller) - cred(c.g, r.id)) >= 10,
      ),
    draws(2),
  ),
]);
define("evelyn-parker-scheming-siren", "attack", [
  draws(),
  ...when(
    (c) =>
      rivals(c.g, c.j.controller).some(
        (r) => cred(c.g, c.j.controller) > cred(c.g, r.id),
      ),
    ...discard(),
  ),
]);
define(
  "goro-takemura-losing-his-way",
  "attack",
  [(c) => modifier(c.g, c.j.controller, c.j.source, "power", 5)],
  (g, p, e) =>
    self(g, p, e) && own(g, p.controller, "legends").every((p) => p.faceUp),
);
define("jackie-welles-ride-or-die-choom", "attack", [
  (c) =>
    modifier(
      c.g,
      c.j.controller,
      c.j.source,
      "power",
      2 * gigs(c.g, c.j.controller).filter((d) => d.value % 2 === 0).length,
    ),
]);
define("jackie-welles-ride-or-die-choom", "defeated", [
  draws(
    (c) => gigs(c.g, c.j.controller).filter((d) => d.value % 2 === 1).length,
  ),
]);
define(
  "swordwise-huscle",
  "attack",
  [...when((c) => power(c.g, source(c)) >= 5, draws())],
  (g, p, e) => self(g, p, e) && power(g, p) >= 5,
);
define(
  "sketchy-ripper",
  "attack",
  search(3, (p) => card(p.cardId).type === "Gear"),
);
define("sasha-yakovleva-won-t-let-you-down", "attack", [
  (c) => {
    const p = own(c.g, c.j.controller, "deck")[0];
    if (p) {
      p.zone = "hand";
      modifier(
        c.g,
        c.j.controller,
        c.j.source,
        "power",
        card(p.cardId).cost ?? 0,
      );
      log(c.g, {
        kind: "reveal",
        actor: logActor(c.g, c.j.controller),
        cards: [logCard(p)],
      });
    }
  },
]);
define("sasha-yakovleva-won-t-let-you-down", "defeated", [
  rival(),
  ...discard(1, rivalId),
]);
define("pepe-najarro-working-doubles", "attack", [
  ...when(
    (c) => pairs(c.g, c.j.controller) > 0,
    unit(
      "Ready up to two MERC Legends",
      (c) =>
        own(c.g, c.j.controller, "legends").filter(
          (p) => !p.host && p.faceUp && tag(p, "MERC"),
        ),
      "target",
      true,
      2,
    ),
    (c) => chosen(c).forEach((p) => ready(c.g, p)),
  ),
]);
define("panam-palmer-strength-through-family", "attack", [
  ...discard(),
  ...when(
    (c) => selected(c.j, "discard").length > 0,
    draws((c) => faceUpLegends(c.g, c.j.controller).length),
  ),
]);
define("el-sombrero-n-la-venganza-lenta", "attack", [
  yes("Pay 2 €$ to gain a friendly max Gig’s value in power?"),
  ...when(
    (c) => selected(c.j, "yes")[0] === "yes",
    (c) => pay(c.g, c.j.controller, 2),
    choose(
      "Choose a friendly max Gig",
      (c) =>
        gigs(c.g, c.j.controller)
          .filter((d) => d.value === d.sides)
          .map((d) => ({ id: d.id, label: `d${d.sides} · ${d.value}` })),
      "maxgig",
    ),
    (c) =>
      modifier(
        c.g,
        c.j.controller,
        c.j.source,
        "power",
        c.g.gigs.find((d) => d.id === selected(c.j, "maxgig")[0])?.value ?? 0,
      ),
  ),
]);
// End-of-turn and inherited Gear effects.
define(
  "delamain-cab",
  "end",
  [...when((c) => source(c).marks.stole === c.g.turn, ...readyEddies(1))],
  same,
);
define(
  "maxtac-squadron",
  "end",
  [
    ...when(
      (c) => !source(c).ready,
      unit("Ready a friendly face-up Legend", (c) =>
        faceUpLegends(c.g, c.j.controller),
      ),
      (c) => chosen(c).forEach((p) => ready(c.g, p)),
    ),
  ],
  same,
);
define(
  "modded-kusanagi",
  "end",
  [
    (c) => {
      const p = source(c);
      if (p.zone === "field") move(c.g, p, "hand");
    },
  ],
  same,
);
define(
  "modded-muramasa",
  "end",
  [
    ...when(
      (c) =>
        rivals(c.g, c.j.controller).some(
          (r) => cred(c.g, c.j.controller) < cred(c.g, r.id),
        ),
      (c) => ready(c.g, source(c)),
    ),
  ],
  same,
);
define(
  "saul-bright-stormrider",
  "end",
  [
    unit("Ready up to three friendly Units", friendly, "target", true, 3),
    (c) => chosen(c).forEach((p) => ready(c.g, p)),
  ],
  same,
);
define(
  "v-roamer-of-the-badlands",
  "end",
  [...when((c) => highGigs(c.g, c.j.controller) >= 2, draws())],
  same,
);
define(
  "misty-olszewski-mender-of-broken-spirits",
  "end",
  [
    choose(
      "Predict the top card’s type",
      () =>
        ["Unit", "Gear", "Program", "Legend"].map((t) => ({ id: t, label: t })),
      "type",
    ),
    (c) => {
      const p = own(c.g, c.j.controller, "deck")[0];
      if (!p) return;
      log(c.g, {
        kind: "reveal",
        actor: logActor(c.g, c.j.controller),
        cards: [logCard(p)],
        sourceName: "Misty",
      });
      c.j.vars.correct = card(p.cardId).type === selected(c.j, "type")[0];
      move(c.g, p, c.j.vars.correct ? "hand" : "trash");
    },
    ...when((c) => !!c.j.vars.correct, ...readyEddies(1)),
  ],
  same,
);
define("sandevistan", "end", [(c) => ready(c.g, source(c))], same);
define("dying-night-v-s-pistol", "attack", [
  ...adjust(2, "decrease"),
  (c) => {
    const delayed = job(
      c.g,
      "dying-night-v-s-pistol:delayed-end",
      c.j.controller,
      c.j.source,
      c.j.event,
      {
        namedV: card(c.j.event.piece?.cardId ?? source(c).cardId).name === "V",
      },
    );
    delayed.cardId = "dying-night-v-s-pistol";
    (c.g.delayed ??= []).push({
      event: "end",
      actor: c.j.controller,
      job: delayed,
    });
  },
]);
scripts["dying-night-v-s-pistol:delayed-end"] = when(
  (c) => c.j.vars.namedV === true,
  ...readyEddies(2),
);
const lookLegend: Step[] = [
  choose(
    "Look at one face-down Legend",
    (c) =>
      own(c.g, c.j.controller, "legends")
        .filter((p) => !p.faceUp)
        .map((p, i) => ({ id: p.id, label: `Face-down Legend ${i + 1}` })),
    "look",
  ),
  (c) => {
    const p = target(c.g, c.j, "look");
    if (p) {
      p.known = true;
      log(
        c.g,
        {
          kind: "look-legend",
          card: logCard(p),
          position: own(c.g, c.j.controller, "legends").indexOf(p) + 1,
        },
        c.j.controller,
      );
    }
  },
];
define("kiroshi-optics", "attack", lookLegend);
define("netwatch-netdriver", "spent", [draws()]);
define("zetatech-faceplate", "spent", [
  ...adjust(1),
  ...when(
    (c) => new Set(gigs(c.g, c.j.controller).map((d) => d.value)).size >= 3,
    draws(),
  ),
]);
define("tetratronic-rippler", "spent", [
  (c) => {
    c.j.vars.top = own(c.g, c.j.controller, "deck")
      .slice(0, 1)
      .map((p) => p.id);
  },
  choose(
    "You may trash this top card",
    (c) => options(chosen(c, "top")),
    "trashTop",
    0,
    1,
    undefined,
    true,
  ),
  relocate("trash", "trashTop"),
]);
define("satori-sword-of-saburo", "fight", [
  ...when((c) => !!c.j.event.won, draws()),
]);
define("the-relic-experimental-biochip", "defeated", [
  ...freePlay(
    (p, c) =>
      p.id !== c.j.source &&
      card(p.cardId).type === "Unit" &&
      (card(p.cardId).cost ?? Infinity) <= 9,
    ["trash"],
    "free",
    false,
    () => true,
    false,
  ),
  (c) => {
    const p = source(c);
    if (p.zone === "trash") move(c.g, p, "deck");
  },
]);
define("arasaka-emergency-radioport", "spent", [
  (c) => {
    const choice = lookLegend[0](c);
    if (choice) return { ...choice, min: 0 };
  },
  ...lookLegend.slice(1),
  ...when(
    (c) => {
      const p = target(c.g, c.j, "look");
      return (
        !!p &&
        (tag(p, "ARASAKA") || keyword(c.g, p, "Go Solo")) &&
        !player(c.g, c.j.controller).called
      );
    },
    yes("Call that Legend for free?"),
    ...when(
      (c) => selected(c.j, "yes")[0] === "yes",
      (c) => {
        c.g.frames.push(
          job(
            c.g,
            "call",
            c.j.controller,
            selected(c.j, "look")[0],
            undefined,
            { free: true },
          ),
        );
      },
    ),
  ),
]);
define("overwatch-panam-s-gift", "activate", [
  ...activateCost(1),
  ...discard(),
  unit("Defeat a spent rival Unit within the discarded cost", (c) => {
    const d = target(c.g, c.j, "discard");
    return d
      ? enemy(c).filter(
          (p) =>
            !p.ready &&
            (card(p.cardId).cost ?? Infinity) <= (card(d.cardId).cost ?? 0),
        )
      : [];
  }),
  kill(),
]);
// Steal, block, spend, and defeat triggers.
define(
  "6th-street-recruits",
  "steal",
  adjust(6, "increase"),
  (_g, p, e) => e.actor === p.controller && e.gig?.sides === 6,
);
define("v-roamer-of-the-badlands", "steal", [
  (c) => {
    c.j.vars.gig = c.j.event.gig ? [c.j.event.gig.id] : [];
  },
  ...adjust(5, "increase").slice(1),
]);
define(
  "maelstrom-goons",
  "steal",
  [rival(), ...discard(1, rivalId)],
  (g, p, e) => self(g, p, e) && gears(g, p.id).length > 0,
);
define("wraith-marauders", "steal", [
  unit("Ready another friendly Unit matching the Gig’s value", (c) =>
    friendly(c).filter(
      (p) => p.id !== c.j.source && power(c.g, p) === c.j.event.gig?.value,
    ),
  ),
  (c) => chosen(c).forEach((p) => ready(c.g, p)),
]);
define(
  "gorilla-arms",
  "stoleMany",
  [
    choose(
      "Steal an additional rival Gig with a new value",
      (c) =>
        c.g.gigs
          .filter(
            (d) =>
              d.controller !== c.j.controller &&
              !gigs(c.g, c.j.controller).some((x) => x.value === d.value),
          )
          .map((d) => ({
            id: d.id,
            label: `${player(c.g, d.controller).name} · d${d.sides} · ${d.value}`,
          })),
      "extra",
    ),
    (c) => {
      c.g.frames.push(
        job(c.g, "steal-gigs", c.j.controller, c.j.source, undefined, {
          ids: selected(c.j, "extra"),
        }),
      );
    },
  ],
  (g, p, e) => self(g, p, e) && e.first === true && (e.amount ?? 0) > 0,
);
define("augmented-negotiators", "block", [rival(), ...discard(1, rivalId)]);
define("la-llorona-ghost-of-the-past", "block", adjust(3, "increase"));
define(
  "rita-wheeler-no-stupid-questions",
  "spent",
  [draws(), ...discard()],
  self,
  true,
);
define("maelstrom-zealots", "fight", [
  ...when(
    (c) => !c.j.event.won,
    (c) => {
      const p = c.g.pieces.find((p) => p.id === c.j.event.opponent);
      if (p) defeat(c.g, p, c.j.controller);
    },
  ),
]);
define(
  "johnny-silverhand-never-stop-fighting",
  "fight",
  [(c) => ready(c.g, source(c))],
  (g, p, e) => self(g, p, e) && !!e.won,
  true,
);
define("screw-lovelorn-fool", "defeated", [
  unit("Add another Unit from your trash to your hand", (c) =>
    own(c.g, c.j.controller, "trash").filter(
      (p) => p.id !== c.j.source && card(p.cardId).type === "Unit",
    ),
  ),
  relocate("hand"),
]);
define("t-bug-amateur-philosopher", "defeated", [
  (c) => {
    for (const p of own(c.g, c.j.controller, "legends").filter(
      (p) => !p.faceUp,
    )) {
      p.known = true;
      log(
        c.g,
        {
          kind: "look-legend",
          card: logCard(p),
          position: own(c.g, c.j.controller, "legends").indexOf(p) + 1,
        },
        c.j.controller,
      );
    }
  },
  ...freeCall,
]);
define(
  "meredith-stout-stone-cold-corpo",
  "adjust",
  [
    unit(
      "You may return a card from your trash",
      (c) => own(c.g, c.j.controller, "trash"),
      "target",
      true,
    ),
    relocate("hand"),
  ],
  (_g, p, e) =>
    e.actor !== p.controller &&
    (e.gigs ?? (e.gig ? [e.gig] : [])).some(
      (d) => d.controller === p.controller,
    ),
);
// Legends: Call, activated, and persistent triggers.
define(
  "viktor-vektor-sit-down-and-relax",
  "call",
  search(
    5,
    (p) =>
      card(p.cardId).type === "Gear" && (card(p.cardId).cost ?? Infinity) <= 2,
    2,
  ),
);
define("v-streetkid", "call", [
  trash(3),
  unit("Return a BRAINDANCE Program from your trash", (c) =>
    own(c.g, c.j.controller, "trash").filter(
      (p) => card(p.cardId).type === "Program" && tag(p, "BRAINDANCE"),
    ),
  ),
  relocate("hand"),
]);
for (const [id, kind, n] of [
  ["dexter-deshawn-off-the-grid", "power", 2],
  ["wakako-okada-peace-and-harmony", "power", -2],
  ["muamar-reyes-el-capita-n", "fightSafe", 0],
  ["padre-man-of-the-cross", "spend", 0],
] as const) {
  define(id, "call", [
    modes(["Apply the card’s Unit effect", "Draw one"]),
    ...when(
      (c) => selected(c.j, "mode")[0] === "0",
      unit("Choose a Unit", n < 0 || kind === "spend" ? enemy : friendly),
      kind === "spend"
        ? (c) =>
            chosen(c)
              .filter((p) => p.ready)
              .forEach((p) => spend(c.g, p))
        : boost(n, kind),
    ),
    ...when((c) => selected(c.j, "mode")[0] === "1", draws()),
  ]);
}
define("dexter-deshawn-off-the-grid", "activate", [
  ...activateCost(),
  ...adjust(2, "increase"),
]);
define("wakako-okada-peace-and-harmony", "activate", [
  ...activateCost(),
  ...adjust(2, "decrease"),
]);
define("muamar-reyes-el-capita-n", "activate", [
  ...activateCost(),
  ...adjust(1, "adjust", false, "gig", true),
]);
define("padre-man-of-the-cross", "activate", [...activateCost(), ...setEqual]);
define("hanako-arasaka-daughter-of-the-emperor", "activate", [
  ...activateCost(),
  ...swap,
]);
define(
  "hanako-arasaka-daughter-of-the-emperor",
  "start",
  [draws((c) => pairs(c.g, c.j.controller))],
  same,
);
define("dum-dum-maelstrom-triggerman", "call", [
  unit(
    "You may defeat a friendly Gear",
    (c) => c.g.pieces.filter((p) => p.host && p.controller === c.j.controller),
    "sacrifice",
    true,
  ),
  kill("sacrifice"),
  draws((c) => (selected(c.j, "sacrifice").length ? 2 : 1)),
]);
define("dum-dum-maelstrom-triggerman", "activate", [
  ...activateCost(1),
  unit("Give a friendly Unit power for its Gear", friendly),
  boost((c) => {
    const p = target(c.g, c.j);
    return p ? gears(c.g, p.id).length : 0;
  }),
]);
define("goro-takemura-vengeful-bodyguard", "activate", [
  ...activateCost(1),
  unit("Give a friendly Unit costing 4 or less Blocker", (c) =>
    friendly(c).filter((p) => (card(p.cardId).cost ?? Infinity) <= 4),
  ),
  boost(0, "Blocker"),
  ...when((c) => pairs(c.g, c.j.controller) > 0, boost(1)),
]);
define(
  "goro-takemura-vengeful-bodyguard",
  "block",
  [
    yes("Discard one to draw one?"),
    ...when(
      (c) => selected(c.j, "yes")[0] === "yes",
      ...discard(),
      ...when((c) => selected(c.j, "discard").length > 0, draws()),
    ),
  ],
  friendlyEvent,
);
define("evelyn-parker-beautiful-enigma", "activate", [
  ...activateCost(1),
  unit("A rival Unit must attack next turn", enemy),
  boost(0, "forced", "target", "targetEnd"),
]);
define(
  "evelyn-parker-beautiful-enigma",
  "stoleMany",
  readyEddies(1),
  (_g, p, e) =>
    e.actor === p.controller &&
    (e.amount ?? 0) > 0 &&
    !!e.piece &&
    (tag(e.piece, "CORPO") || tag(e.piece, "GANGER")),
);
define(
  "jackie-welles-pour-one-out-for-me",
  "play",
  [
    yes("Decrease a friendly Gig by up to two?"),
    ...when(
      (c) => selected(c.j, "yes")[0] === "yes",
      ...adjust(2, "decrease", true),
      ...when(
        (c) =>
          !!c.j.vars["changed:gig"] &&
          c.g.gigs.find((d) => d.id === selected(c.j, "gig")[0])?.value === 1,
        draws(),
      ),
    ),
  ],
  (g, p, e) =>
    !!e.piece &&
    e.actor === p.controller &&
    card(e.piece.cardId).color === "Blue" &&
    (e.piece.zone === "field" || card(e.piece.cardId).type === "Gear") &&
    player(g, p.controller).played.BlueUnitOrGear === 1,
  true,
);
define("judy-a-lvarez-braindance-maestro", "activate", [
  ...activateCost(),
  trash(1),
  unit(
    "You may keep the trashed Program",
    (c) =>
      chosen(c, "trashed").filter((p) => card(p.cardId).type === "Program"),
    "target",
    true,
  ),
  relocate("hand"),
]);
define(
  "judy-a-lvarez-braindance-maestro",
  "play",
  [unit("Give a friendly Unit +1 power", friendly), boost(1)],
  (_g, p, e) =>
    e.actor === p.controller &&
    !!e.piece &&
    card(e.piece.cardId).type === "Program" &&
    tag(e.piece, "BRAINDANCE"),
);
define("kerry-eurodyne-the-last-rockerboy", "activate", [
  ...activateCost(),
  ...when((c) => highGigs(c.g, c.j.controller) > 0, draws(2)),
]);
define(
  "kerry-eurodyne-axe-attitude-audience",
  "roll",
  [
    yes("Ignore this roll and reroll once?"),
    ...when(
      (c) => selected(c.j, "yes")[0] === "yes",
      (c) => {
        const d = c.g.gigs.find((d) => d.id === c.j.event.gig?.id);
        if (d) {
          d.value = random(c.g, d.sides) + 1;
          log(c.g, {
            kind: "reroll",
            gig: d.id,
            sides: d.sides,
            value: d.value,
          });
        }
      },
    ),
    ...when(
      (c) => {
        const d = c.g.gigs.find((d) => d.id === c.j.event.gig?.id);
        return !!d && (d.value === 1 || d.value === d.sides);
      },
      draws((c) => (c.j.event.gig?.sides === 20 ? 3 : 1)),
    ),
  ],
  same,
);
define("johnny-silverhand-rocking-renegade", "activate", [
  (c) =>
    pay(
      c.g,
      c.j.controller,
      Math.max(0, 2 - highGigs(c.g, c.j.controller)),
      c.j.source,
    ),
  (c) => spend(c.g, source(c)),
  unit("Let a friendly Unit attack spent Units this turn", friendly),
  boost(0, "attackUnits"),
  ...when((c) => chosen(c).some((p) => tag(p, "ROCKER")), boost(2)),
]);
define(
  "rogue-amendiares-preem-solo",
  "steal",
  [
    ...when((c) => (c.j.event.gig?.value ?? 1) % 2 === 0, draws()),
    ...when(
      (c) => (c.j.event.gig?.value ?? 0) % 2 === 1,
      rival(),
      ...discard(1, rivalId),
    ),
  ],
  (_g, p, e) =>
    e.actor === p.controller &&
    !!e.piece &&
    card(e.piece.cardId).type === "Legend",
);
define(
  "rogue-amendiares-queen-of-the-afterlife",
  "steal",
  readyEddies(2),
  (g, p, e) =>
    e.actor === p.controller &&
    !!e.piece &&
    e.piece.id !== p.id &&
    (e.gig?.value ?? Infinity) < power(g, e.piece),
  true,
);
define("rogue-amendiares-queen-of-the-afterlife", "activate", [
  ...activateCost(2),
  unit("Reduce a rival Unit’s power", enemy),
  boost((c) => -power(c.g, source(c))),
]);
define(
  "yorinobu-arasaka-embracing-destruction",
  "attack",
  [draws(), ...when((c) => cred(c.g, c.j.controller) < 20, ...discard())],
  (g, p, e) =>
    e.actor === p.controller &&
    !!e.piece &&
    tag(e.piece, "ARASAKA") &&
    player(g, p.controller).played.ARASAKAattack === 1,
  true,
);
define(
  "alt-cunningham-mother-of-daemons",
  "spent",
  [draws()],
  (g, p, e) =>
    e.actor === p.controller && !!e.piece && gears(g, e.piece.id).length > 0,
);
define("river-ward-detective-on-the-hunt", "activate", [
  ...activateCost(),
  ...freePlay(
    (p) =>
      card(p.cardId).type === "Gear" && (card(p.cardId).cost ?? Infinity) <= 2,
  ),
]);
define(
  "river-ward-detective-on-the-hunt",
  "defeated",
  [
    (c) => {
      c.j.vars.searched = own(c.g, c.j.controller, "deck")
        .slice(0, 2)
        .map((p) => p.id);
    },
    choose(
      "Trash one of the top two cards",
      (c) => options(chosen(c, "searched")),
      "target",
      1,
      1,
      undefined,
      true,
    ),
    relocate("trash"),
  ],
  (g, p, e) =>
    e.piece?.controller === p.controller &&
    !!e.piece &&
    (gears(g, e.piece.id).length > 0 || !!e.piece.marks.wasEquipped),
);
define("panam-palmer-nomad-cavalry", "activate", [
  ...activateCost(2),
  unit(
    "Choose Gear attached to this Legend",
    (c) => gears(c.g, c.j.source),
    "gear",
  ),
  unit("Move it to an unequipped friendly Unit", (c) =>
    friendly(c).filter((p) => !gears(c.g, p.id).length),
  ),
  (c) => {
    const gear = target(c.g, c.j, "gear"),
      unit = target(c.g, c.j);
    if (gear && unit) {
      gear.host = unit.id;
      gear.zone = unit.zone;
      ready(c.g, unit);
    }
  },
]);
define(
  "panam-palmer-nomad-cavalry",
  "end",
  [
    (c) => {
      const equipped = [
        ...friendly(c),
        ...own(c.g, c.j.controller, "legends").filter(
          (p) => !p.host && p.faceUp,
        ),
      ].filter((p) => gears(c.g, p.id).length);
      if (equipped.length >= 5) equipped.forEach((p) => ready(c.g, p));
    },
  ],
  same,
);
define("judy-a-lvarez-nothing-to-doubt", "activate", [
  ...activateCost(1),
  (c) => {
    const p = own(c.g, c.j.controller, "deck")[0];
    if (p) {
      p.zone = "hand";
      c.j.vars.top = [p.id];
      log(c.g, {
        kind: "reveal",
        actor: logActor(c.g, c.j.controller),
        cards: [logCard(p)],
        sourceName: "Judy",
      });
    }
  },
  ...freePlay((p, c) => selected(c.j, "top").includes(p.id)),
]);
define("alt-cunningham-soulkiller-architect", "activate", [
  ...activateCost(1),
  unit(
    "Play a Program from your trash (pay its cost)",
    (c) =>
      own(c.g, c.j.controller, "trash").filter(
        (p) =>
          card(p.cardId).type === "Program" &&
          cost(c.g, p) <= resources(c.g, c.j.controller).length,
      ),
    "program",
  ),
  (c) => {
    const p = target(c.g, c.j, "program");
    if (p) pay(c.g, c.j.controller, cost(c.g, p));
  },
  (c) => {
    const p = target(c.g, c.j, "program");
    if (p) {
      playPiece(c.g, p);
      const f = c.g.frames.findLast(
        (j) => j.key === "program-finish" && j.source === p.id,
      );
      if (f) f.vars.bottom = true;
    }
  },
]);

// Replacement choices stay inside the resolving effect, before pending triggers are drained.
scripts["defeat-replacement"] = [
  (c) => {
    const p = source(c);
    if (!["field", "legends"].includes(p.zone)) {
      c.j.vars.replacement = [];
      return;
    }
    const used = (c.j.vars.replacements ?? []) as string[];
    const dead = gears(c.g, p.id).filter(
      (x) => x.cardId === "deadman-transmitter" && !used.includes(x.id),
    );
    const jackies = c.g.pieces.filter(
      (x) =>
        !p.host &&
        p.zone === "field" &&
        x.controller === p.controller &&
        !used.includes(x.id) &&
        x.cardId === "jackie-welles-mama-s-favorite" &&
        (x.zone === "field" || (x.zone === "legends" && x.faceUp)) &&
        resources(c.g, p.controller).length >= 1,
    );
    const opts = (dead.length ? dead : jackies).map((x) => ({
      id: x.id,
      label: card(x.cardId).nameFull + " replaces this defeat",
    }));
    if (!dead.length)
      opts.push({ id: "none", label: "Allow the original defeat" });
    return {
      player: p.controller,
      label: "Choose a defeat replacement",
      options: opts,
      min: 1,
      max: 1,
      key: "replacement",
    };
  },
  (c) => {
    const chosenId = selected(c.j, "replacement")[0];
    const chosen =
      chosenId && chosenId !== "none" ? piece(c.g, chosenId) : undefined;
    if (chosen?.cardId === "jackie-welles-mama-s-favorite")
      pay(c.g, c.j.controller, 1);
  },
  (c) => {
    const id = selected(c.j, "replacement")[0];
    if (!id) return;
    defeat(
      c.g,
      id === "none" ? source(c) : piece(c.g, id),
      c.j.event.actor,
      id === "none",
      [...((c.j.vars.replacements ?? []) as string[]), id],
    );
  },
];
scripts["steal-prevention"] = [
  choose(
    "Alt Cunningham: you may discard a matching-cost card to prevent this Gig theft",
    (c) => {
      const parent = c.g.frames.find((j) => j.id === c.j.vars.parent);
      if (
        !parent ||
        (parent.vars.prevented as string[]).includes(c.j.vars.gigId as string)
      )
        return [];
      const d = c.g.gigs.find((d) => d.id === c.j.vars.gigId);
      return d
        ? options(
            own(c.g, c.j.controller, "hand").filter(
              (p) => card(p.cardId).cost === d.value,
            ),
          )
        : [];
    },
    "discard",
    0,
    1,
    undefined,
    true,
  ),
  (c) => {
    const p = target(c.g, c.j, "discard");
    const parent = c.g.frames.find((j) => j.id === c.j.vars.parent);
    if (p && parent) {
      move(c.g, p, "trash");
      (parent.vars.prevented as string[]).push(c.j.vars.gigId as string);
      log(c.g, { kind: "prevent-theft", actor: logActor(c.g, c.j.controller) });
    }
  },
];
// Alt's first ability was verified against its official image; retain both activations.
scripts["alt-cunningham-soulkiller-architect:replay"] =
  scripts["alt-cunningham-soulkiller-architect:activate"];
scripts["alt-cunningham-soulkiller-architect:activate"] = [
  modes([
    "Discount your next Program for each friendly min Gig",
    "Pay 1 and replay a Program from your trash",
  ]),
  ...when(
    (c) => selected(c.j, "mode")[0] === "0",
    ...activateCost(),
    (c) =>
      modifier(
        c.g,
        c.j.controller,
        c.j.controller,
        "programDiscount",
        -gigs(c.g, c.j.controller).filter((d) => d.value === 1).length,
      ),
  ),
  ...when(
    (c) => selected(c.j, "mode")[0] === "1",
    (c) => {
      c.g.frames.push(
        job(
          c.g,
          "alt-cunningham-soulkiller-architect:replay",
          c.j.controller,
          c.j.source,
        ),
      );
    },
  ),
];

scripts["safety-trigger"] = [
  (c) => {
    const opponent = c.g.pieces.find((p) => p.id === c.j.event.opponent);
    if (opponent) defeat(c.g, opponent, c.j.controller);
  },
];
scripts["appetite-trigger"] = [
  choose(
    "Steal an additional rival Gig",
    (c) =>
      c.g.gigs
        .filter((d) => d.controller !== c.j.controller)
        .map((d) => ({
          id: d.id,
          label: `${player(c.g, d.controller).name} · d${d.sides} · ${d.value}`,
        })),
    "extra",
  ),
  (c) => {
    c.g.frames.push(
      job(c.g, "steal-gigs", c.j.controller, c.j.source, undefined, {
        ids: selected(c.j, "extra"),
      }),
    );
  },
];
