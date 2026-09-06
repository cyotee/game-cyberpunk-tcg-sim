import { card } from "../catalog/index";
import type { Game, Piece, Job, Command, SeatDeck } from "./types";
import { validateDeck } from "../decks/index";
import {
  uid,
  player,
  piece,
  own,
  field,
  faceUpLegends,
  gears,
  gigs,
  rivals,
  cred,
  has,
  tag,
  log,
  logActor,
  logCard,
  random,
  shuffle,
  order,
  power,
  keyword,
  modifier,
  job,
  emit,
  spend,
  ready,
  move,
  defeat,
  draw,
  eliminate,
  finish,
  checkVictory,
  scripts,
  choose,
  selected,
  target,
  options,
  yes,
  advance,
  answer,
  highGigs,
  type Step,
} from "./kernel";
export const VERSION = "2026-09-06.playtest.2";
export function resources(g: Game, id: string) {
  return own(g, id).filter(
    (p) =>
      !p.host &&
      p.ready &&
      (p.zone === "eddies" ||
        (p.zone === "legends" && (!p.faceUp || card(p.cardId).sell))),
  );
}
export function cost(g: Game, p: Piece, solo = false, rival?: string) {
  let n = card(p.cardId).cost ?? Infinity;
  const id = p.controller;
  if (p.cardId === "maxtac-heavy")
    n -= Math.max(
      0,
      ...rivals(g, id)
        .filter((r) => !rival || r.id === rival)
        .map((r) => field(g).filter((x) => x.controller === r.id).length),
    );
  if (["octant", "carnage-at-the-colosseum"].includes(p.cardId))
    n -= highGigs(g, id);
  if (p.cardId === "trauma-team-operatives")
    n -= own(g, id, "trash").filter(
      (x) => card(x.cardId).type === "Unit",
    ).length;
  if (p.cardId === "zetatech-berserk") n -= faceUpLegends(g, id).length;
  if (p.cardId === "nocturne-op55-n1" && !player(g, id).fixer.length) n = 1;
  if (
    p.cardId === "we-gotta-live-together" &&
    rivals(g, id).some((r) => gigs(g, r.id).length >= gigs(g, id).length + 2)
  )
    n = 3;
  if (
    tag(p, "CYBERWARE") &&
    card(p.cardId).type === "Gear" &&
    has(g, id, "viktor-vektor-drop-your-illusions") &&
    !player(g, id).played.CYBERWARE
  )
    n -=
      3 *
      field(g).filter(
        (x) =>
          x.controller === id &&
          x.cardId === "viktor-vektor-drop-your-illusions",
      ).length;
  if (card(p.cardId).type === "Program")
    n += g.mods
      .filter((m) => m.controller === id && m.kind === "programDiscount")
      .reduce((v, m) => v + m.amount, 0);
  if (solo)
    n += g.mods
      .filter((m) => m.target === p.id && m.kind === "soloDiscount")
      .reduce((v, m) => v + m.amount, 0);
  if (solo)
    n +=
      g.pieces.filter(
        (x) => x.cardId === "riot-shield" && x.controller !== id && x.host,
      ).length * 2;
  return Math.max(1, n);
}
export const barrier: Step = ({ j }) => {
  j.vars.$drain = true;
};
export function playPiece(g: Game, p: Piece, equip?: string, solo = false) {
  const c = card(p.cardId);
  if (c.type === "Gear") {
    const host = equip ? piece(g, equip) : undefined;
    if (
      !host ||
      host.host ||
      host.controller !== p.controller ||
      !(host.zone === "field" || (host.zone === "legends" && host.faceUp))
    )
      throw Error("Choose a friendly Unit or face-up Legend");
    p.zone = host.zone;
    p.host = host.id;
    p.faceUp = true;
  } else if (c.type === "Program") {
    g.mods = g.mods.filter(
      (m) => !(m.controller === p.controller && m.kind === "programDiscount"),
    );
    p.zone = "resolving";
    p.faceUp = true;
    const key = p.cardId + ":program";
    if (!scripts[key])
      throw Error("This Program needs its effect implementation");
    g.frames.push(job(g, "program-finish", p.controller, p.id));
    g.frames.push(job(g, key, p.controller, p.id));
    player(g, p.controller).programs++;
  } else {
    p.zone = "field";
    p.faceUp = true;
    if (c.type !== "Legend" || solo) p.ready = true;
    for (const gear of gears(g, p.id)) gear.zone = "field";
    p.entered = g.turn;
    if (solo) modifier(g, p.controller, p.id, "Adrenaline");
  }
  const owner = player(g, p.controller);
  if (c.color === "Blue" && (p.zone === "field" || c.type === "Gear"))
    owner.played.BlueUnitOrGear = (owner.played.BlueUnitOrGear ?? 0) + 1;
  owner.played[c.type] = (owner.played[c.type] ?? 0) + 1;
  for (const t of c.tags)
    owner.played[t.toUpperCase()] = (owner.played[t.toUpperCase()] ?? 0) + 1;
  log(g, { kind: "play", actor: logActor(g, p.controller), card: logCard(p) });
  emit(g, { type: "play", actor: p.controller, piece: structuredClone(p) });
}
scripts["program-finish"] = [
  ({ g, j }) => {
    const p = piece(g, j.source);
    if (p.zone === "resolving") move(g, p, j.vars.bottom ? "deck" : "trash");
  },
];
scripts["pay"] = [
  (c) => {
    const amount = c.j.vars.amount as number;
    if (!amount) return;
    const ps = resources(c.g, c.j.controller).filter(
      (p) => p.id !== c.j.vars.exclude,
    );
    if (ps.length < amount)
      throw Error("Not enough ready Eddies or eligible Legends");
    return {
      player: c.j.controller,
      label: `Pay ${amount} €$ — choose resources to spend`,
      options: ps.map((p) => ({
        id: p.id,
        label:
          p.zone === "eddies"
            ? "Ready Eddie"
            : p.faceUp
              ? card(p.cardId).nameFull
              : `Face-down Legend ${own(c.g, p.controller, "legends").indexOf(p) + 1}`,
      })),
      min: amount,
      max: amount,
      key: "payment",
    };
  },
  ({ g, j }) => {
    for (const id of selected(j, "payment")) spend(g, piece(g, id));
  },
];
export function pay(g: Game, id: string, amount: number, exclude?: string) {
  g.frames.push(job(g, "pay", id, "", undefined, { amount, exclude }));
}
scripts["play-action"] = [
  ({ g, j }) => {
    const p = piece(g, j.source);
    if (p.cardId !== "maxtac-heavy") return;
    const eligible = rivals(g, j.controller).filter(
      (r) =>
        cost(g, p, !!j.vars.solo, r.id) <= resources(g, j.controller).length,
    );
    return {
      player: j.controller,
      label: "Choose the Rival whose Units reduce MaxTac Heavy’s cost",
      options: eligible.map((r) => ({
        id: r.id,
        label: `${r.name} · pay ${cost(g, p, !!j.vars.solo, r.id)} €$`,
      })),
      min: 1,
      max: 1,
      key: "costRival",
    };
  },
  ({ g, j }) => {
    const p = piece(g, j.source);
    if (card(p.cardId).type === "Gear")
      return choose(
        "Equip to a friendly Unit or face-up Legend",
        (c) =>
          options(
            own(c.g, c.j.controller).filter(
              (p) =>
                !p.host &&
                (p.zone === "field" || (p.zone === "legends" && p.faceUp)),
            ),
            c.g,
          ),
        "equip",
      )({ g, j });
  },
  ({ g, j }) =>
    pay(
      g,
      j.controller,
      cost(g, piece(g, j.source), !!j.vars.solo, selected(j, "costRival")[0]),
    ),
  ({ g, j }) =>
    playPiece(g, piece(g, j.source), selected(j, "equip")[0], !!j.vars.solo),
];
scripts["call"] = [
  ({ g, j }) => {
    const p = piece(g, j.source);
    if (p.zone !== "legends" || p.faceUp || player(g, j.controller).called)
      throw Error("That Legend cannot be Called now");
    if (!j.vars.free)
      pay(
        g,
        j.controller,
        has(g, j.controller, "panam-palmer-strength-through-family") &&
          g.turnPlayer === j.controller
          ? 0
          : 1,
      );
  },
  ({ g, j }) => {
    const p = piece(g, j.source);
    p.faceUp = true;
    player(g, j.controller).called = true;
    log(g, {
      kind: "call",
      actor: logActor(g, j.controller),
      card: logCard(p),
    });
    emit(g, { type: "call", actor: j.controller, piece: structuredClone(p) });
  },
];
scripts["setup"] = [
  choose(
    "Choose the player who takes the first turn",
    ({ g }) => g.players.map((p) => ({ id: p.id, label: p.name })),
    "first",
  ),
  ({ g, j }) => {
    g.turnPlayer = selected(j, "first")[0];
    g.openingPlayer = g.turnPlayer;
    const ls = own(g, g.turnPlayer, "legends");
    ls[0].ready = false;
    ls[1].ready = false;
    for (const id of order(g).reverse()) g.frames.push(job(g, "mulligan", id));
  },
  ({ g }) => {
    g.phase = "start";
    g.frames.push(job(g, "start-turn", g.turnPlayer));
  },
];
scripts["mulligan"] = [
  yes("Mulligan your opening hand? Replace all six cards once."),
  ({ g, j }) => {
    if (selected(j, "yes")[0] === "yes") {
      for (const p of own(g, j.controller, "hand")) p.zone = "deck";
      const shuffled = shuffle(g, own(g, j.controller, "deck"));
      g.pieces = [
        ...g.pieces.filter(
          (p) => !(p.controller === j.controller && p.zone === "deck"),
        ),
        ...shuffled,
      ];
      draw(g, j.controller, 6);
    }
    player(g, j.controller).opening = false;
  },
];
scripts["start-turn"] = [
  ({ g, j }) => {
    g.phase = "start";
    checkVictory(g, true);
    if (g.winner || g.draw) return;
    const p = player(g, j.controller);
    for (const seat of g.players) {
      seat.called = false;
      seat.sold = false;
      seat.programs = 0;
      seat.played = {};
    }
    g.mods = g.mods.filter(
      (m) => !(m.expires === "next" && m.controller === p.id),
    );
    if (!p.fixer.length && !g.emptyCycle.includes(p.id))
      g.emptyCycle.push(p.id);
    else if (p.fixer.length) g.emptyCycle = [];
    log(g, { kind: "turn-start", actor: logActor(g, p.id) });
    emit(g, { type: "start", actor: p.id });
  },
  barrier,
  ({ g, j }) => {
    for (const p of own(g, j.controller))
      if (
        !p.host &&
        ["field", "legends", "eddies"].includes(p.zone) &&
        !(g.turn === 1 && p.zone === "legends" && !p.ready)
      )
        ready(g, p);
    draw(g, j.controller);
  },
  ({ g, j }) => {
    if (player(g, j.controller).eliminated) {
      g.frames.push(job(g, "end-turn", j.controller));
      return;
    }
    const dice = player(g, j.controller).fixer.filter(
      (n) => n !== 20 || player(g, j.controller).fixer.length === 1,
    );
    if (dice.length)
      return {
        player: j.controller,
        label: "Roll a Gig into your area",
        options: dice.map((n) => ({ id: String(n), label: `d${n}` })),
        min: 1,
        max: 1,
        key: "die",
      };
  },
  ({ g, j }) => {
    const sides = Number(selected(j, "die")[0]);
    if (sides && !player(g, j.controller).eliminated) {
      player(g, j.controller).fixer = player(g, j.controller).fixer.filter(
        (n) => n !== sides,
      );
      const d = {
        id: uid(g),
        owner: j.controller,
        controller: j.controller,
        sides,
        value: 1 + random(g, sides),
      };
      g.gigs.push(d);
      log(g, {
        kind: "roll",
        actor: logActor(g, j.controller),
        gig: d.id,
        sides,
        value: d.value,
      });
      emit(g, { type: "roll", actor: j.controller, gig: { ...d } });
    }
  },
  barrier,
  ({ g }) => {
    if (g.phase !== "finished") g.phase = "main";
  },
];
scripts["end-turn"] = [
  ({ g, j }) => {
    g.phase = "end";
    log(g, { kind: "turn-end", actor: logActor(g, j.controller) });
    emit(g, { type: "end", actor: j.controller });
  },
  barrier,
  ({ g, j }) => {
    for (const p of field(g)) {
      if (
        p.marks.cyberpsychosis === g.turn &&
        g.mods.some((m) => m.target === p.id && m.kind === "cyberpsychosis")
      ) {
        defeat(g, p, j.controller);
      }
    }
  },
  barrier,
  ({ g, j }) => {
    g.mods = g.mods.filter(
      (m) =>
        m.expires !== "turn" &&
        !(
          m.expires === "targetEnd" &&
          g.pieces.find((p) => p.id === m.target)?.controller ===
            j.controller &&
          m.turn < g.turn
        ),
    );
    const active = g.players.filter((p) => !p.eliminated);
    if (
      !g.overtime &&
      active.every((p) => !p.fixer.length && g.emptyCycle.includes(p.id))
    ) {
      g.overtime = true;
      log(g, { kind: "overtime" });
      checkVictory(g);
    }
    if (g.phase === "finished") return;
    if (g.sudden && g.sudden.enteredTurn !== g.turn) {
      g.sudden.remaining = g.sudden.remaining.filter(
        (id) => id !== j.controller && !player(g, id).eliminated,
      );
      if (!g.sudden.remaining.length) {
        const top = Math.max(...active.map((p) => gigs(g, p.id).length));
        const leaders = active
          .filter((p) => gigs(g, p.id).length === top)
          .map((p) => p.id);
        if (leaders.length === 1) {
          finish(g, leaders[0]);
          return;
        }
        g.sudden = { eligible: leaders, remaining: [...leaders] };
        log(g, { kind: "sudden-tie" });
      }
    }
    const start = g.players.findIndex((p) => p.id === g.turnPlayer);
    for (let n = 1; n <= g.players.length; n++) {
      const p = g.players[(start + n) % g.players.length];
      if (p.eliminated || (g.sudden && !g.sudden.eligible.includes(p.id))) {
        g.mods = g.mods.filter(
          (m) => !(m.expires === "next" && m.controller === p.id),
        );
        continue;
      }
      g.turnPlayer = p.id;
      break;
    }
    g.turn++;
    g.frames.push(job(g, "start-turn", g.turnPlayer));
  },
];
export function mayAttack(g: Game, p: Piece, targetId: string) {
  if (
    p.controller !== g.turnPlayer ||
    p.zone !== "field" ||
    p.host ||
    !p.ready ||
    g.mods.some((m) => m.target === p.id && m.kind === "noAttack")
  )
    return false;
  if (
    ["corpo-security", "misty-olszewski-mender-of-broken-spirits"].includes(
      p.cardId,
    )
  )
    return false;
  if (p.cardId === "jacked-in-voodoo-boy" && !player(g, p.controller).programs)
    return false;
  const t = g.pieces.find((x) => x.id === targetId);
  const area = g.players.find((x) => x.id === targetId);
  if (t && !(t.zone === "field" && !t.host && t.controller !== p.controller))
    return false;
  if (!t && (!area || area.id === p.controller || !gigs(g, area.id).length))
    return false;
  if (area && p.cardId === "ruthless-lowlife") return false;
  if (
    t &&
    t.ready &&
    !(
      g.mods.some((m) => m.target === p.id && m.kind === "attackReady") ||
      (p.cardId === "valentino-guerrera" &&
        cred(g, p.controller) > cred(g, t.controller) &&
        keyword(g, t, "Blocker"))
    )
  )
    return false;
  if (p.entered === g.turn) {
    if (
      rivals(g, p.controller).some((r) =>
        has(g, r.id, "maxtac-suppression-team"),
      )
    )
      return false;
    const allowed =
      keyword(g, p, "Adrenaline") ||
      (gears(g, p.id).some((e) => e.cardId === "adrenaline-converter") &&
        gigs(g, t?.controller ?? area!.id).length >=
          gigs(g, p.controller).length + 2) ||
      (!!t &&
        (["sandayu-oda-hanako-s-guardian"].includes(p.cardId) ||
          g.mods.some((m) => m.target === p.id && m.kind === "attackUnits"))) ||
      (!!area &&
        p.cardId === "nadia-fighting-through-grief" &&
        gigs(g, area.id).length > gigs(g, p.controller).length);
    if (!allowed) return false;
  }
  return true;
}
scripts["attack"] = [
  barrier,
  ({ g }) => {
    const a = g.attack;
    if (!a) return;
    const p = piece(g, a.attacker);
    const t = g.pieces.find((p) => p.id === a.target);
    if (p.zone !== "field" || (t && t.zone !== "field")) {
      endAttack(g);
      return;
    }
    a.stage = "react";
    if (player(g, a.defender).eliminated)
      g.frames.push(job(g, "combat", p.controller, p.id));
  },
];
export function endAttack(g: Game) {
  const a = g.attack;
  if (a?.stage === "fight") {
    const ids = [a.attacker, a.target];
    g.mods = g.mods.filter(
      (m) => !(ids.includes(m.target) && m.kind === "noDefeat"),
    );
  }
  if (a)
    g.mods = g.mods.filter(
      (m) => !(m.target === a.attacker && m.kind === "attackReady"),
    );
  delete g.attack;
  g.mods = g.mods.filter((m) => m.expires !== "attack");
}
scripts["combat"] = [
  ({ g }) => {
    const a = g.attack;
    if (!a) return;
    const p = piece(g, a.attacker);
    const t = g.pieces.find((x) => x.id === a.target);
    if (p.zone !== "field" || (t && t.zone !== "field")) {
      endAttack(g);
      return;
    }
    if (t) {
      a.stage = "fight";
      for (const unit of [p, t]) {
        if (
          g.mods.some(
            (m) => m.target === unit.id && m.kind === "cyberpsychosis",
          )
        )
          unit.marks.cyberpsychosis = g.turn;
      }
      const pp = power(g, p),
        tp = power(g, t);
      a.losers = [];
      a.winners = [];
      if (
        p.cardId === "johnny-silverhand-never-stop-fighting" &&
        tag(t, "CORPO")
      ) {
        a.losers = [t.id];
        a.winners = [p.id];
      } else if (
        t.cardId === "johnny-silverhand-never-stop-fighting" &&
        tag(p, "CORPO")
      ) {
        a.losers = [p.id];
        a.winners = [t.id];
      } else {
        if (pp <= tp) a.losers.push(p.id);
        if (tp <= pp) a.losers.push(t.id);
        if (pp > tp) a.winners.push(p.id);
        if (tp > pp) a.winners.push(t.id);
      }
      log(g, {
        kind: "fight",
        attacker: logCard(p),
        defender: logCard(t),
        attackerPower: pp,
        defenderPower: tp,
        winners: a.winners.map((id) => card(piece(g, id).cardId).nameFull),
      });
      for (const x of [p, t])
        emit(g, {
          type: "fight",
          actor: x.controller,
          piece: { ...x },
          opponent: x.id === p.id ? t.id : p.id,
          won: a.winners.includes(x.id),
          amount: Math.abs(pp - tp),
        });
      for (const loserId of a.losers) {
        const loser = piece(g, loserId),
          enemy = loserId === p.id ? t : p;
        const safeties = g.mods.filter(
          (m) => m.controller === loser.controller && m.kind === "safety",
        );
        if (safeties.length) {
          g.mods = g.mods.filter((m) => !safeties.some((s) => s.id === m.id));
          g.pending.push(
            job(g, "safety-trigger", loser.controller, loser.id, {
              type: "fight",
              actor: loser.controller,
              piece: { ...loser },
              opponent: enemy.id,
            }),
          );
        }
      }
      for (const winnerId of a.winners) {
        const winner = piece(g, winnerId),
          loser = winnerId === p.id ? t : p;
        const appetites = g.mods.filter(
          (m) => m.controller === winner.controller && m.kind === "appetite",
        );
        if (appetites.length && power(g, winner) - power(g, loser) >= 3) {
          g.mods = g.mods.filter((m) => !appetites.some((s) => s.id === m.id));
          for (const _ of appetites)
            g.pending.push(
              job(g, "appetite-trigger", winner.controller, winner.id, {
                type: "fight",
                actor: winner.controller,
                piece: { ...winner },
              }),
            );
        }
      }
    } else {
      a.stage = "steal";
      if (g.mods.some((m) => m.target === p.id && m.kind === "cyberpsychosis"))
        p.marks.cyberpsychosis = g.turn;
      let n = power(g, p) > 0 ? Math.floor(power(g, p) / 10) + 1 : 0;
      n += g.mods
        .filter((m) => m.target === p.id && m.kind === "steal")
        .reduce((s, m) => s + m.amount, 0);
      a.selected = [];
      const ds = gigs(g, a.defender);
      if (n > 0 && ds.length)
        return {
          player: p.controller,
          label: `Choose ${Math.min(n, ds.length)} Gig(s) to steal`,
          options: ds.map((d) => ({
            id: d.id,
            label: `d${d.sides} · ${d.value}`,
          })),
          min: Math.min(n, ds.length),
          max: Math.min(n, ds.length),
          key: "steal",
        };
    }
  },
  barrier,
  ({ g, j }) => {
    const a = g.attack;
    if (a?.stage === "steal")
      g.frames.push(
        job(g, "steal-gigs", j.controller, a.attacker, undefined, {
          ids: selected(j, "steal"),
          adjust: false,
        }),
      );
  },
  ({ g }) => {
    const a = g.attack;
    if (!a || a.stage !== "fight") return;
    const p = piece(g, a.attacker),
      t = piece(g, a.target);
    // Rule 9.13: a fight-triggered effect can end the attack before defeat.
    if (p.zone !== "field" || t.zone !== "field") {
      endAttack(g);
      return;
    }
    for (const id of a.losers ?? []) {
      const loser = piece(g, id),
        winner = id === p.id ? t : p;
      if (
        power(g, winner) > 0 &&
        !g.mods.some((m) => m.target === loser.id && m.kind === "fightSafe") &&
        !g.mods.some(
          (m) =>
            m.target === winner.id &&
            m.kind === "noDefeat" &&
            m.controller === loser.controller,
        )
      )
        defeat(g, loser, winner.controller);
    }
  },
  barrier,
  ({ g }) => endAttack(g),
];
// One theft pipeline for combat, Gorilla Arms, and Appetite for Destruction.
// Mandatory restrictions precede optional replacements. Move all dice before
// evaluating triggers so each trigger observes the same completed event.
scripts["steal-gigs"] = [
  ({ g, j }) => {
    const unit = piece(g, j.source);
    let ids = j.vars.ids as string[];
    if (j.vars.adjust !== false) {
      const adjustment = g.mods
        .filter((m) => m.target === unit.id && m.kind === "steal")
        .reduce((n, m) => n + m.amount, 0);
      ids = ids.slice(0, Math.max(0, ids.length + adjustment));
    }
    const candidates = g.gigs.filter(
      (d) =>
        ids.includes(d.id) &&
        d.controller !== j.controller &&
        !g.mods.some(
          (m) =>
            m.controller === d.controller &&
            ((m.kind === "chrome" && d.value > power(g, unit)) ||
              (m.kind === "westbrook" &&
                card(unit.cardId).type === "Legend" &&
                d.value < power(g, unit))),
        ),
    );
    j.vars.candidates = candidates.map((d) => d.id);
    j.vars.prevented = [];
    for (const gig of candidates.slice().reverse())
      for (const id of order(g).reverse())
        if (
          id !== j.controller &&
          has(g, id, "alt-cunningham-mother-of-daemons")
        )
          g.frames.push(
            job(g, "steal-prevention", id, "", undefined, {
              gigId: gig.id,
              parent: j.id,
            }),
          );
  },
  ({ g, j }) => {
    const unit = piece(g, j.source);
    const stolen = g.gigs.filter(
      (d) =>
        (j.vars.candidates as string[]).includes(d.id) &&
        !(j.vars.prevented as string[]).includes(d.id) &&
        d.controller !== j.controller,
    );
    const first = unit.marks.stole !== g.turn;
    const previous = new Map(stolen.map((d) => [d.id, d.controller]));
    for (const d of stolen) d.controller = j.controller;
    if (stolen.length) unit.marks.stole = g.turn;
    for (const d of stolen) {
      log(g, {
        kind: "steal",
        actor: logActor(g, j.controller),
        previous: logActor(g, previous.get(d.id)!),
        gig: d.id,
        sides: d.sides,
        value: d.value,
      });
      emit(g, {
        type: "steal",
        actor: j.controller,
        piece: { ...unit },
        gig: { ...d },
        opponent: previous.get(d.id),
      });
    }
    if (stolen.length)
      emit(g, {
        type: "stoleMany",
        first,
        actor: j.controller,
        piece: { ...unit },
        amount: stolen.length,
      });
  },
];
export function newGame(
  id: string,
  seats: SeatDeck[],
  targetCount: number,
  randomValues: number[],
): Game {
  if (seats.length < 2 || seats.length > 5)
    throw Error("Matches need 2–5 players");
  if (!Number.isSafeInteger(targetCount) || targetCount < 1)
    throw Error("Invalid Gig target");
  for (const s of seats) {
    const errors = validateDeck(s.deck);
    if (errors.length) throw Error(errors[0]);
  }
  const g: Game = {
    version: VERSION,
    id,
    players: seats.map((s) => ({
      id: s.id,
      name: s.name,
      eliminated: false,
      fixer: [4, 6, 8, 10, 12, 20],
      called: false,
      sold: false,
      programs: 0,
      played: {},
      opening: true,
    })),
    pieces: [],
    gigs: [],
    turnPlayer: seats[0].id,
    turn: 1,
    phase: "setup",
    target: targetCount,
    pending: [],
    frames: [],
    mods: [],
    log: [],
    serial: 0,
    random: randomValues,
    randomCursor: 0,
    emptyCycle: [],
    overtime: false,
    openingPlayer: seats[0].id,
  };
  for (const s of seats) {
    for (const zone of ["legends", "deck"] as const) {
      const entries = zone === "legends" ? s.deck.legends : s.deck.main;
      const ids = shuffle(
        g,
        entries.flatMap((e) =>
          Array.from({ length: e.quantity }, () => e.cardId),
        ),
      );
      for (const cardId of ids)
        g.pieces.push({
          id: uid(g),
          cardId,
          owner: s.id,
          controller: s.id,
          zone,
          ready: true,
          faceUp: false,
          entered: 0,
          marks: {},
        });
    }
    draw(g, s.id, 6);
  }
  g.frames.push(job(g, "setup", seats[random(g, seats.length)].id));
  advance(g);
  return g;
}
export function applyCommand(
  original: Game,
  actor: string,
  cmd: Command,
): Game {
  const g = structuredClone(original);
  if (g.version !== VERSION) throw Error("Unsupported rules version");
  if (g.phase === "finished") throw Error("The match is finished");
  if (player(g, actor).eliminated)
    throw Error("Your player has been eliminated");
  if (cmd.type === "concede") {
    eliminate(g, actor, "concedes");
    if (g.choice?.player === actor) {
      delete g.choice;
      g.frames = g.frames.filter((j) => j.controller !== actor);
    }
    if (g.turnPlayer === actor && !g.winner && !g.draw && !g.frames.length)
      g.frames.push(job(g, "end-turn", actor));
    advance(g);
    return g;
  }
  if (cmd.type === "choose") {
    answer(g, actor, cmd.choice ?? "", cmd.values ?? []);
    return g;
  }
  if (g.choice || g.frames.length || g.pending.length)
    throw Error("Resolve the pending choice first");
  const reaction = g.attack?.stage === "react" && g.attack.defender === actor;
  if (!reaction && (g.turnPlayer !== actor || g.phase !== "main" || g.attack))
    throw Error("It is not your action window");
  if (cmd.type === "endReaction") {
    if (!reaction) throw Error("Only the defender may end reactions");
    log(g, { kind: "pass-reaction", actor: logActor(g, actor) });
    g.frames.push(job(g, "combat", g.turnPlayer, g.attack!.attacker));
  } else if (cmd.type === "endTurn") {
    if (reaction) throw Error("Finish reacting first");
    const forced = field(g).filter(
      (p) =>
        p.controller === actor &&
        g.mods.some((m) => m.target === p.id && m.kind === "forced") &&
        [...field(g).map((x) => x.id), ...g.players.map((x) => x.id)].some(
          (t) => mayAttack(g, p, t),
        ),
    );
    if (forced.length) throw Error("A Unit must attack if able");
    g.frames.push(job(g, "end-turn", actor));
  } else if (cmd.type === "sell") {
    const p = piece(g, cmd.piece ?? "");
    if (
      reaction ||
      p.controller !== actor ||
      p.zone !== "hand" ||
      !card(p.cardId).sell ||
      player(g, actor).sold
    )
      throw Error("Cannot sell that card now");
    p.zone = "eddies";
    p.faceUp = false;
    p.ready = true;
    player(g, actor).sold = true;
    log(g, { kind: "sell", actor: logActor(g, actor), card: logCard(p) });
  } else if (cmd.type === "call") {
    const p = piece(g, cmd.piece ?? "");
    if (p.controller !== actor) throw Error("Not your Legend");
    g.frames.push(job(g, "call", actor, p.id));
  } else if (cmd.type === "play" || cmd.type === "solo") {
    const p = piece(g, cmd.piece ?? "");
    const c = card(p.cardId);
    if (
      p.controller !== actor ||
      p.host ||
      (cmd.type === "solo"
        ? !(
            c.type === "Legend" &&
            p.zone === "legends" &&
            p.faceUp &&
            c.cost !== null &&
            keyword(g, p, "Go Solo")
          )
        : !(
            (p.zone === "hand" && c.type !== "Legend") ||
            (c.type === "Legend" &&
              p.zone === "legends" &&
              p.faceUp &&
              c.cost !== null)
          ))
    )
      throw Error("Cannot play that card");
    if (reaction && !(c.type === "Program" && c.text.includes("{Quick}")))
      throw Error("Only Quick Programs may be played as reactions");
    if (
      c.type === "Gear" &&
      !own(g, actor).some(
        (x) =>
          !x.host && (x.zone === "field" || (x.zone === "legends" && x.faceUp)),
      )
    )
      throw Error("A Gear needs a friendly Unit or face-up Legend to equip");
    if (resources(g, actor).length < cost(g, p, cmd.type === "solo"))
      throw Error("Not enough ready resources");
    g.frames.push(
      job(g, "play-action", actor, p.id, undefined, {
        solo: cmd.type === "solo",
      }),
    );
  } else if (cmd.type === "attack") {
    const p = piece(g, cmd.piece ?? "");
    if (reaction || !mayAttack(g, p, cmd.target ?? ""))
      throw Error("Illegal attack target");
    const t = g.pieces.find((p) => p.id === cmd.target);
    g.attack = {
      attacker: p.id,
      target: cmd.target!,
      defender: t?.controller ?? cmd.target!,
      stage: "effects",
      unblocked:
        p.cardId === "mt0d12-flathead" &&
        cred(g, p.controller) < cred(g, t?.controller ?? cmd.target!),
    };
    spend(g, p);
    if (tag(p, "ARASAKA"))
      player(g, actor).played.ARASAKAattack =
        (player(g, actor).played.ARASAKAattack ?? 0) + 1;
    emit(g, {
      type: "attack",
      actor,
      piece: { ...p },
      opponent: g.attack.defender,
    });
    g.frames.push(job(g, "attack", actor, p.id));
    log(g, {
      kind: "attack",
      actor: logActor(g, actor),
      defender: logActor(g, g.attack.defender),
      card: logCard(p),
      target: g.attack.target,
    });
  } else if (cmd.type === "block") {
    const p = piece(g, cmd.piece ?? "");
    if (
      !reaction ||
      p.controller !== actor ||
      p.zone !== "field" ||
      p.host ||
      !p.ready ||
      g.attack!.target === p.id ||
      !keyword(g, p, "Blocker")
    )
      throw Error("That Unit cannot block");
    const attacker = piece(g, g.attack!.attacker);
    if (g.attack!.unblocked) throw Error("This attack cannot be blocked");
    spend(g, p);
    g.attack!.target = p.id;
    log(g, {
      kind: "block",
      actor: logActor(g, actor),
      card: logCard(p),
      attacker: logCard(attacker),
    });
    emit(g, { type: "block", actor, piece: { ...p } });
  } else if (cmd.type === "activate") {
    const p = piece(g, cmd.piece ?? "");
    if (
      p.controller !== actor ||
      !!p.host ||
      !p.faceUp ||
      !["field", "legends"].includes(p.zone) ||
      !p.ready ||
      (p.zone === "field" && p.entered === g.turn)
    )
      throw Error("Cannot activate this card");
    const source = cmd.ability
      ? gears(g, p.id).find((x) => x.id === cmd.ability)
      : p;
    if (!source || !scripts[source.cardId + ":activate"])
      throw Error("No activated effect on that card");
    if (reaction && !card(source.cardId).text.includes("{Quick}"))
      throw Error("Only Quick effects may react");
    const activation = job(g, source.cardId + ":activate", actor, p.id);
    activation.cardId = source.cardId;
    g.frames.push(activation);
    log(g, {
      kind: "activate",
      actor: logActor(g, actor),
      card: logCard(source),
      bearer: p.id,
    });
  } else throw Error("Unknown game command");
  advance(g);
  return g;
}
