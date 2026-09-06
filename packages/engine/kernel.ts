import { renderAction, type ActionRecord } from "./log";
import { card } from "../catalog/index";
import type {
  Game,
  Piece,
  Player,
  GameEvent,
  Job,
  Choice,
  Option,
  Modifier,
  Zone,
} from "./types";
export type Context = { g: Game; j: Job };
export type Step = (c: Context) => void | Omit<Choice, "id" | "jobId">;
export const scripts: Record<string, Step[]> = {};
export type Trigger = {
  event: string;
  test: (g: Game, p: Piece, e: GameEvent) => boolean;
  key: string;
  once?: boolean;
};
export const triggers: Record<string, Trigger[]> = {};
export const uid = (g: Game) => `i${++g.serial}`;
export const player = (g: Game, id: string) => {
  const p = g.players.find((p) => p.id === id);
  if (!p) throw Error("Unknown player");
  return p;
};
export const piece = (g: Game, id: string) => {
  const p = g.pieces.find((p) => p.id === id);
  if (!p) throw Error("Card is no longer available");
  return p;
};
export const own = (g: Game, id: string, zone?: Zone) =>
  g.pieces.filter(
    (p) =>
      p.controller === id &&
      (!zone || p.zone === zone) &&
      !(zone === "legends" && p.host),
  );
export const field = (g: Game) =>
  g.pieces.filter((p) => p.zone === "field" && !p.host);
export const legends = (g: Game) =>
  g.pieces.filter((p) => p.zone === "legends");
export const faceUpLegends = (g: Game, id: string) =>
  own(g, id).filter(
    (p) =>
      !p.host &&
      p.faceUp &&
      ["field", "legends"].includes(p.zone) &&
      card(p.cardId).type === "Legend",
  );
export const gears = (g: Game, id: string) =>
  g.pieces.filter((p) => p.host === id);
export const gigs = (g: Game, id: string) =>
  g.gigs.filter((d) => d.controller === id);
export const rivals = (g: Game, id: string) =>
  g.players.filter((p) => p.id !== id && !p.eliminated);
export const cred = (g: Game, id: string): number =>
  gigs(g, id).length ? gigs(g, id).reduce((n, d) => n + d.value, 0) : -Infinity;
export const even = (g: Game, id: string) =>
  Number.isFinite(cred(g, id)) && cred(g, id) % 2 === 0;
export const pairs = (g: Game, id: string) => {
  const n: Record<number, number> = {};
  gigs(g, id).forEach((d) => (n[d.value] = (n[d.value] ?? 0) + 1));
  return Object.values(n).reduce((s, v) => s + Math.floor(v / 2), 0);
};
export const minGig = (g: Game, id: string) =>
  gigs(g, id).some((d) => d.value === 1);
export const highGigs = (g: Game, id: string) =>
  gigs(g, id).filter((d) => d.value >= 8).length;
export const has = (g: Game, id: string, slug: string) =>
  g.pieces.some(
    (p) =>
      p.controller === id &&
      p.cardId === slug &&
      ((p.zone === "legends" && p.faceUp) || p.zone === "field"),
  );
export const tag = (p: Piece, t: string) =>
  card(p.cardId).tags.some((x) => x.toUpperCase() === t.toUpperCase());
export const logActor = (g: Game, id: string) => ({
  id,
  name: player(g, id).name,
});
export const logCard = (p: Piece) => ({
  id: p.cardId,
  name: card(p.cardId).nameFull,
});
export const log = (g: Game, event: ActionRecord, privateTo?: string) =>
  g.log.push({
    id: ++g.serial,
    event: structuredClone(event),
    turn: g.turn,
    visibility: privateTo
      ? { kind: "seat", player: privateTo }
      : { kind: "public" },
    text: renderAction(event),
    ...(privateTo ? { privateTo } : {}),
  });
export const random = (g: Game, max: number) => {
  const limit = Math.floor(4294967296 / max) * max;
  while (true) {
    const n = g.random[g.randomCursor++];
    if (n === undefined) throw Error("Randomness exhausted");
    const value = Math.floor(n * 4294967296);
    if (value < limit) return value % max;
  }
};
export function shuffle<T>(g: Game, a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = random(g, i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
export function order(g: Game, start = g.turnPlayer) {
  const i = g.players.findIndex((p) => p.id === start);
  return [...g.players.slice(i), ...g.players.slice(0, i)]
    .filter((p) => !p.eliminated)
    .map((p) => p.id);
}
export function sources(g: Game) {
  return g.pieces.filter(
    (p) =>
      !player(g, p.controller).eliminated &&
      (p.zone === "field" || (p.zone === "legends" && p.faceUp)),
  );
}
export function power(g: Game, p: Piece): number {
  let n =
    (card(p.cardId).power ?? 0) +
    gears(g, p.id).reduce((s, e) => s + (card(e.cardId).power ?? 0), 0);
  for (const m of g.mods.filter((m) => m.target === p.id)) {
    if (m.kind === "power") n += m.amount;
    if (
      g.attack?.stage === "fight" &&
      (g.attack.attacker === p.id || g.attack.target === p.id)
    ) {
      if (m.kind === "fightPower") n += m.amount;
      if (m.kind === "fightLegendPower")
        n += m.amount * faceUpLegends(g, p.controller).length;
    }
  }
  const atk = g.attack?.attacker === p.id;
  if (atk) {
    if (
      tag(p, "ARASAKA") &&
      has(g, p.controller, "saburo-arasaka-stubborn-patriarch")
    )
      n++;
    n +=
      2 *
      field(g).filter(
        (x) =>
          x.controller === p.controller &&
          x.id !== p.id &&
          x.cardId === "saul-bright-stormrider",
      ).length;
  }
  if (p.cardId === "royce-psycho-on-the-edge" && g.turnPlayer === p.controller)
    n += 2 * gears(g, p.id).length;
  if (
    p.cardId === "meredith-stout-stone-cold-corpo" &&
    g.attack?.stage === "fight" &&
    (g.attack.attacker === p.id || g.attack.target === p.id)
  ) {
    const other =
      g.attack.attacker === p.id ? g.attack.target : g.attack.attacker;
    const op = g.pieces.find((x) => x.id === other);
    if (op && card(op.cardId).type === "Legend") n += 2;
  }
  return Math.max(0, n);
}
export function keyword(g: Game, p: Piece, k: string) {
  return (
    [p, ...gears(g, p.id)].some((x) => card(x.cardId).keywords.includes(k)) ||
    g.mods.some((m) => m.target === p.id && m.kind === k)
  );
}
export function modifier(
  g: Game,
  controller: string,
  target: string,
  kind: string,
  amount = 0,
  expires: Modifier["expires"] = "turn",
) {
  g.mods.push({
    id: uid(g),
    controller,
    target,
    kind,
    amount,
    expires,
    turn: g.turn,
  });
}
export function job(
  g: Game,
  key: string,
  controller: string,
  source = "",
  event: GameEvent = { type: "effect", actor: controller },
  vars: Record<string, unknown> = {},
): Job {
  return {
    id: uid(g),
    key,
    controller,
    source,
    cardId: g.pieces.find((p) => p.id === source)?.cardId ?? "",
    event,
    step: 0,
    vars,
  };
}
export function emit(g: Game, e: GameEvent, extra: Piece[] = []) {
  // Count the event even before Steel Dragon enters play (publisher FAQ).
  if (
    e.type === "defeated" &&
    e.piece?.zone === "field" &&
    !e.piece.host &&
    tag(e.piece, "ARASAKA")
  ) {
    for (const p of g.players)
      p.played.ARASAKAdefeated = (p.played.ARASAKAdefeated ?? 0) + 1;
  }
  const due = (g.delayed ?? []).filter(
    (d) => d.event === e.type && d.actor === e.actor,
  );
  g.delayed = (g.delayed ?? []).filter((d) => !due.includes(d));
  g.pending.push(...due.map((d) => d.job));
  for (const source of [
    ...sources(g),
    ...extra.filter((x) => !sources(g).some((s) => s.id === x.id)),
  ]) {
    const bearer = source.host
      ? g.pieces.find((p) => p.id === source.host)
      : source;
    if (!bearer) continue;
    for (const t of triggers[source.cardId] ?? []) {
      if (t.event !== e.type || !t.test(g, bearer, e)) continue;
      if (t.once) {
        const key = t.key + ":" + g.turn;
        if (source.marks[key]) continue;
        source.marks[key] = 1;
      }
      const j = job(g, t.key, source.controller, bearer.id, e);
      j.cardId = source.cardId;
      g.pending.push(j);
    }
  }
}
export function spend(g: Game, p: Piece) {
  if (!p.ready) throw Error("Card is already spent");
  p.ready = false;
  log(g, {
    kind: "spend",
    actor: logActor(g, p.controller),
    piece: p.id,
    label:
      p.zone === "eddies"
        ? "an Eddie"
        : !p.faceUp
          ? "a face-down Legend"
          : card(p.cardId).nameFull,
  });
  emit(g, { type: "spent", actor: p.controller, piece: { ...p } });
}
export function ready(g: Game, p: Piece) {
  if (
    !p.ready &&
    !g.mods.some((m) => m.target === p.id && m.kind === "noReady")
  ) {
    p.ready = true;
    log(g, {
      kind: "ready",
      actor: logActor(g, p.controller),
      piece: p.id,
      label:
        p.zone === "eddies"
          ? "an Eddie"
          : !p.faceUp
            ? "a face-down Legend"
            : card(p.cardId).nameFull,
    });
  }
}
export function move(g: Game, p: Piece, zone: Zone) {
  moveMany(g, [p], zone);
}
export function moveMany(g: Game, pieces: Piece[], zone: Zone) {
  const group = [
    ...new Map(
      pieces.flatMap((p) => [p, ...gears(g, p.id)]).map((p) => [p.id, p]),
    ).values(),
  ];
  for (const item of group) {
    const wasPublic =
      item.faceUp && !["hand", "deck", "eddies"].includes(item.zone);
    item.zone =
      card(item.cardId).type === "Legend" &&
      !["field", "legends"].includes(zone)
        ? "removed"
        : zone;
    item.controller = item.owner;
    item.faceUp = ["field", "trash", "removed"].includes(item.zone);
    delete item.host;
    if (!["field", "legends"].includes(zone))
      g.mods = g.mods.filter((m) => m.target !== item.id);
    log(
      g,
      {
        kind: "move",
        card: logCard(item),
        owner: logActor(g, item.owner),
        zone: item.zone,
      },
      wasPublic || item.faceUp ? undefined : item.owner,
    );
  }
  if (zone === "deck") {
    // Rule 11.12: all cards entering the same deck together form one
    // randomized group, including Gear attached to different Units.
    for (const owner of g.players) {
      const bottom = shuffle(
        g,
        group.filter((p) => p.zone === "deck" && p.owner === owner.id),
      );
      const ids = new Set(bottom.map((p) => p.id));
      g.pieces = g.pieces.filter((p) => !ids.has(p.id));
      g.pieces.push(...bottom);
    }
  }
}
export function defeat(
  g: Game,
  p: Piece,
  actor: string,
  ignoreReplacement = false,
  replacements: string[] = [],
) {
  if (!["field", "legends"].includes(p.zone)) return;
  const dead = gears(g, p.id).filter(
    (x) => x.cardId === "deadman-transmitter" && !replacements.includes(x.id),
  );
  const jackies = sources(g).filter(
    (x) =>
      !p.host &&
      p.zone === "field" &&
      x.controller === p.controller &&
      !replacements.includes(x.id) &&
      x.cardId === "jackie-welles-mama-s-favorite",
  );
  if (!ignoreReplacement && (dead.length || jackies.length)) {
    g.frames.push(
      job(
        g,
        "defeat-replacement",
        p.controller,
        p.id,
        {
          type: "defeatAttempt",
          actor,
          piece: { ...p },
        },
        { replacements },
      ),
    );
    return;
  }
  p.marks.wasEquipped = gears(g, p.id).length;
  const originals = [
    structuredClone(p),
    ...gears(g, p.id).map((x) => structuredClone(x)),
  ];
  move(g, p, "trash");
  log(g, { kind: "defeat", actor: logActor(g, actor), card: logCard(p) });
  emit(g, { type: "defeated", actor, piece: originals[0] }, originals);
}
export function draw(g: Game, id: string, n = 1) {
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (player(g, id).eliminated) break;
    const p = own(g, id, "deck")[0];
    if (!p) {
      eliminate(g, id, "decked out");
      break;
    }
    p.zone = "hand";
    drawn++;
    log(g, { kind: "draw-private", card: logCard(p) }, id);
  }
  log(g, { kind: "draw", actor: logActor(g, id), count: drawn });
}
export function eliminate(g: Game, id: string, reason: string) {
  const p = player(g, id);
  p.eliminated = true;
  p.fixer = [];
  for (const c of own(g, id)) {
    c.zone = "removed";
    delete c.host;
  }
  g.pending = g.pending.filter((j) => j.controller !== id);
  g.delayed = g.delayed?.filter((d) => d.job.controller !== id);
  g.mods = g.mods.filter((m) => m.controller !== id);
  log(g, { kind: "eliminate", actor: logActor(g, id), reason });
  const alive = g.players.filter((p) => !p.eliminated);
  if (alive.length === 1) finish(g, alive[0].id);
  if (!alive.length) {
    g.draw = true;
    g.phase = "finished";
  }
}
export function finish(g: Game, id: string) {
  g.winner = id;
  g.phase = "finished";
  delete g.choice;
  g.frames = [];
  g.pending = [];
  g.delayed = [];
  log(g, { kind: "win", actor: logActor(g, id) });
}
export function checkVictory(g: Game, start = false) {
  if (g.phase === "finished" || g.sudden) return;
  const winners = g.players.filter(
    (p) =>
      !p.eliminated &&
      (g.overtime || (start && p.id === g.turnPlayer)) &&
      gigs(g, p.id).length >= g.target,
  );
  if (winners.length === 1) finish(g, winners[0].id);
  if (winners.length > 1) {
    const eligible = order(g);
    g.sudden = { eligible, remaining: [...eligible], enteredTurn: g.turn };
    log(g, { kind: "sudden-death" });
  }
}
export function select(
  label: string,
  options: Option[],
  key = "target",
  min = 1,
  max = 1,
  playerId?: string,
  privateChoice = false,
): Step {
  return ({ j }) => ({
    player: playerId ?? j.controller,
    label,
    options,
    min: Math.min(min, options.length),
    max: Math.min(max, options.length),
    key,
    private: privateChoice,
  });
}
export function choose(
  label: string,
  options: (c: Context) => Option[],
  key = "target",
  min = 1,
  max = 1,
  who?: (c: Context) => string,
  priv = false,
): Step {
  return (c) => {
    const opts = options(c);
    if (!opts.length || max <= 0) {
      c.j.vars[key] = [];
      return;
    }
    return {
      player: who?.(c) ?? c.j.controller,
      label,
      options: opts,
      min: Math.min(min, max, opts.length),
      max: Math.min(max, opts.length),
      key,
      private: priv,
    };
  };
}
export const selected = (j: Job, key = "target") =>
  (j.vars[key] ?? []) as string[];
export const target = (g: Game, j: Job, key = "target") =>
  g.pieces.find((p) => p.id === selected(j, key)[0]);
export const options = (ps: Piece[], g?: Game): Option[] =>
  ps.map((p) => ({
    id: p.id,
    label:
      card(p.cardId).nameFull +
      (g && p.zone === "field" ? ` · ${power(g, p)} power` : ""),
    cardId: p.cardId,
  }));
export const yes = (label: string, key = "yes") =>
  choose(
    label,
    () => [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
    key,
  );
export const when = (test: (c: Context) => boolean, ...steps: Step[]): Step[] =>
  steps.map((step) => (c) => {
    if (test(c)) return step(c);
  });
export function advance(g: Game) {
  let guard = 0;
  while (!g.choice && g.phase !== "finished") {
    if (++guard > 2000)
      throw Error("Effect loop requires a ruling; action was not committed.");
    let current = g.frames.at(-1);
    if (current?.vars.$drain && !g.pending.length) {
      delete current.vars.$drain;
      delete g.batch;
    }
    if (!current || current.vars.$drain) {
      if (!g.pending.length) {
        delete g.batch;
        // A draw in a main-phase effect can eliminate the active player.
        // Once resolution is complete, no eliminated player must press End Turn.
        if (!current && player(g, g.turnPlayer).eliminated) {
          g.frames.push(job(g, "end-turn", g.turnPlayer));
          continue;
        }
        // No further reactions are available once a combatant leaves the field
        // (rule 9.13). An eliminated defender also cannot pass; attacks on that
        // player's abandoned Gigs instead continue through normal stealing.
        if (
          !current &&
          g.attack?.stage === "react" &&
          (player(g, g.attack.defender).eliminated ||
            g.pieces.find((p) => p.id === g.attack!.attacker)?.zone !==
              "field" ||
            g.pieces.some(
              (p) => p.id === g.attack!.target && p.zone !== "field",
            ))
        ) {
          g.frames.push(job(g, "combat", g.turnPlayer, g.attack.attacker));
          continue;
        }
        break;
      }
      const cycle = order(g, g.batch ?? g.turnPlayer);
      const owner = cycle.find((id) =>
        g.pending.some((j) => j.controller === id),
      );
      if (!owner) {
        g.pending = [];
        break;
      }
      g.batch = owner;
      const batch = g.pending.filter((j) => j.controller === owner);
      if (batch.length > 1) {
        g.choice = {
          id: uid(g),
          player: owner,
          label: "Choose your next pending effect",
          options: batch.map((j) => ({
            id: j.id,
            label: card(j.cardId).nameFull + " · " + j.event.type,
          })),
          min: 1,
          max: 1,
          key: "batch",
          jobId: "batch",
        };
        break;
      }
      current = batch[0];
      g.pending = g.pending.filter((j) => j.id !== current!.id);
      g.frames.push(current);
    }
    const script = scripts[current.key];
    if (!script) throw Error(`Effect not implemented: ${current.key}`);
    if (current.step >= script.length) {
      g.frames.pop();
      checkVictory(g);
      continue;
    }
    const result = script[current.step++]({ g, j: current });
    if (result) {
      if (!result.options.length) {
        current.vars[result.key] = [];
      } else g.choice = { ...result, id: uid(g), jobId: current.id };
    }
  }
}
export function answer(g: Game, actor: string, id: string, values: string[]) {
  const c = g.choice;
  if (!c || c.id !== id || c.player !== actor)
    throw Error("This choice is no longer yours to make");
  if (
    new Set(values).size !== values.length ||
    values.length < c.min ||
    values.length > c.max ||
    (c.allowedCounts !== undefined &&
      !c.allowedCounts.includes(values.length)) ||
    values.some((v) => !c.options.some((o) => o.id === v))
  )
    throw Error("Choose the required number of legal options");
  const hidden =
    c.private ||
    values.some((v) => {
      const p = g.pieces.find((p) => p.id === v);
      return p && (["hand", "deck", "eddies"].includes(p.zone) || !p.faceUp);
    });
  if (hidden) log(g, { kind: "private-choice", actor: logActor(g, actor) });
  log(
    g,
    {
      kind: "choice",
      actor: logActor(g, actor),
      choice: c.id,
      prompt: c.label,
      selected: values.map((id) => ({
        id,
        label: c.options.find((o) => o.id === id)!.label,
      })),
    },
    hidden ? actor : undefined,
  );
  delete g.choice;
  if (c.jobId === "batch") {
    const j = g.pending.find((j) => j.id === values[0])!;
    g.pending = g.pending.filter((x) => x.id !== j.id);
    g.frames.push(j);
  } else {
    const j = g.frames.find((j) => j.id === c.jobId);
    if (!j) throw Error("Choice expired");
    j.vars[c.key] = values;
  }
  advance(g);
}
