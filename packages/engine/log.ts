/** Immutable, visibility-scoped history. Names are captured when the action occurs. */
export type LogActor = { id: string; name: string };
export type LogCard = { id: string; name: string };
export type ActionRecord =
  | { kind: "spend" | "ready"; actor: LogActor; piece: string; label: string }
  | { kind: "move"; card: LogCard; owner: LogActor; zone: string }
  | {
      kind: "defeat" | "play" | "call" | "sell";
      actor: LogActor;
      card: LogCard;
    }
  | { kind: "draw-private"; card: LogCard }
  | { kind: "draw" | "discard"; actor: LogActor; count: number }
  | { kind: "eliminate"; actor: LogActor; reason: string }
  | { kind: "win" | "private-choice" | "prevent-theft"; actor: LogActor }
  | { kind: "turn-start" | "turn-end" | "pass-reaction"; actor: LogActor }
  | { kind: "activate"; actor: LogActor; card: LogCard; bearer: string }
  | { kind: "block"; actor: LogActor; card: LogCard; attacker: LogCard }
  | {
      kind: "fight";
      attacker: LogCard;
      defender: LogCard;
      attackerPower: number;
      defenderPower: number;
      winners: string[];
    }
  | { kind: "sudden-death" | "sudden-tie" | "overtime" }
  | {
      kind: "choice";
      actor: LogActor;
      choice: string;
      prompt: string;
      selected: { id: string; label: string }[];
    }
  | {
      kind: "adjust" | "roll";
      actor: LogActor;
      gig: string;
      sides: number;
      value: number;
    }
  | { kind: "reroll"; gig: string; sides: number; value: number }
  | { kind: "reveal"; actor: LogActor; cards: LogCard[]; sourceName?: string }
  | { kind: "look-legend"; card: LogCard; position: number }
  | {
      kind: "steal";
      actor: LogActor;
      previous: LogActor;
      gig: string;
      sides: number;
      value: number;
    }
  | {
      kind: "attack";
      actor: LogActor;
      defender: LogActor;
      card: LogCard;
      target: string;
    };
export type LogVisibility =
  { kind: "public" } | { kind: "seat"; player: string };
export function renderAction(e: ActionRecord): string {
  switch (e.kind) {
    case "turn-start":
      return `${e.actor.name} begins their turn.`;
    case "turn-end":
      return `${e.actor.name} ends their turn.`;
    case "pass-reaction":
      return `${e.actor.name} finishes reacting.`;
    case "activate":
      return `${e.actor.name} activates ${e.card.name}.`;
    case "block":
      return `${e.actor.name} blocks ${e.attacker.name} with ${e.card.name}.`;
    case "fight":
      return `${e.attacker.name} (${e.attackerPower}) fights ${e.defender.name} (${e.defenderPower}). ${e.winners.length ? e.winners.join(", ") + " wins" : "Both lose"}.`;

    case "spend":
      return `${e.actor.name} spends ${e.label}.`;
    case "ready":
      return `${e.actor.name} readies ${e.label}.`;
    case "move":
      return `${e.card.name} moves to ${e.owner.name}’s ${e.zone}.`;
    case "defeat":
      return `${e.actor.name} defeats ${e.card.name}.`;
    case "play":
      return `${e.actor.name} plays ${e.card.name}.`;
    case "call":
      return `${e.actor.name} Calls ${e.card.name}.`;
    case "sell":
      return `${e.actor.name} reveals ${e.card.name} and sells it.`;
    case "draw-private":
      return `Drew ${e.card.name}.`;
    case "draw":
      return `${e.actor.name} draws ${e.count}.`;
    case "discard":
      return `${e.actor.name} discards ${e.count}.`;
    case "eliminate":
      return `${e.actor.name} ${e.reason}. Rolled Gigs remain on the board.`;
    case "win":
      return `${e.actor.name} wins the match.`;
    case "private-choice":
      return `${e.actor.name} completes a private choice.`;
    case "prevent-theft":
      return `${e.actor.name} prevents a Gig theft with Alt Cunningham.`;
    case "sudden-death":
      return "Sudden Death: every remaining player receives one full additional turn.";
    case "sudden-tie":
      return "Sudden Death remains tied. Only the tied leaders receive turns next round.";
    case "overtime":
      return "Overtime begins. Reaching the locked Gig target now wins immediately.";
    case "choice":
      return `${e.actor.name}: ${e.prompt} — ${e.selected.map((o) => o.label).join("; ") || "no selections"}`;
    case "adjust":
      return `${e.actor.name} sets d${e.sides} to ${e.value}.`;
    case "roll":
      return `${e.actor.name} rolls d${e.sides}: ${e.value}.`;
    case "reroll":
      return `Kerry rerolls d${e.sides}: ${e.value}.`;
    case "reveal":
      return `${e.sourceName ?? e.actor.name} reveals ${e.cards.map((c) => c.name).join(", ")}.`;
    case "look-legend":
      return `Looked at Legend ${e.position}: ${e.card.name}.`;
    case "steal":
      return `${e.actor.name} steals d${e.sides} (${e.value}) from ${e.previous.name}.`;
    case "attack":
      return `${e.actor.name} attacks ${e.defender.name} with ${e.card.name}.`;
  }
}
export function projectLog<
  T extends {
    id: number;
    text: string;
    privateTo?: string;
    event?: ActionRecord;
    visibility?: LogVisibility;
  },
>(entries: T[], seat: string) {
  return entries
    .filter((e) =>
      e.visibility
        ? e.visibility.kind === "public" || e.visibility.player === seat
        : !e.privateTo || e.privateTo === seat,
    )
    .map((e) => ({ ...e, text: e.event ? renderAction(e.event) : e.text }));
}

/** Page only the caller's visible events; the full encrypted history stays intact. */
export function projectLogPage<
  T extends {
    id: number;
    text: string;
    privateTo?: string;
    event?: ActionRecord;
    visibility?: LogVisibility;
  },
>(entries: T[], seat: string, before?: number, limit = 200) {
  const visible = entries.filter(
    (e) =>
      (before === undefined || e.id < before) &&
      (e.visibility
        ? e.visibility.kind === "public" || e.visibility.player === seat
        : !e.privateTo || e.privateTo === seat),
  );
  const selected = visible.slice(-limit);
  return {
    log: projectLog(selected, seat),
    logBefore: visible.length > selected.length ? selected[0].id : null,
  };
}
