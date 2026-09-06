import { cards, byId, colors, type Color } from "../catalog/index";
export interface DeckEntry {
  cardId: string;
  quantity: number;
  number?: string;
}
export interface Deck {
  id: string;
  name: string;
  legends: DeckEntry[];
  main: DeckEntry[];
  unresolved: string[];
  updatedAt: string;
}
export function newDeck(name = "Untitled deck"): Deck {
  return {
    id: crypto.randomUUID(),
    name,
    legends: [],
    main: [],
    unresolved: [],
    updatedAt: new Date().toISOString(),
  };
}
const normal = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function importDeck(text: string): Deck {
  const deck = newDeck();
  let section: "legends" | "main" | undefined;
  for (const line of text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (/^#\s*name:/i.test(line)) {
      deck.name = line.replace(/^#\s*name:\s*/i, "") || "Untitled deck";
      continue;
    }
    if (/^#\s*legends\s*$/i.test(line)) {
      section = "legends";
      continue;
    }
    if (/^#\s*main deck\s*$/i.test(line)) {
      section = "main";
      continue;
    }
    const m = line.match(/^(\d+)\s*x\s+(\S+)\s+(.+)$/i);
    if (!m || !section) {
      deck.unresolved.push(line);
      continue;
    }
    const quantity = Number(m[1]);
    const name = normal(m[3]);
    const matching = cards.filter(
      (c) =>
        normal(c.nameFull) === name &&
        c.printings.some((p) => normal(p.number) === normal(m[2])),
    );
    if (
      matching.length !== 1 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 1000
    ) {
      deck.unresolved.push(line);
      continue;
    }
    const existing = deck[section].find((e) => e.cardId === matching[0].id);
    if (existing) existing.quantity += quantity;
    else deck[section].push({ cardId: matching[0].id, quantity, number: m[2] });
  }
  return deck;
}
export function limits(deck: Deck): Record<Color, number> {
  const ram = Object.fromEntries(colors.map((c) => [c, 0])) as Record<
    Color,
    number
  >;
  for (const e of deck.legends) {
    const c = byId[e.cardId];
    if (c && c.type === "Legend") ram[c.color] += (c.ram ?? 0) * e.quantity;
  }
  return ram;
}
export function validateDeck(deck: Deck): string[] {
  const errors: string[] = [];
  const count = (entries: DeckEntry[]) =>
    entries.reduce((n, e) => n + e.quantity, 0);
  if (!deck.name.trim() || deck.name.length > 120)
    errors.push("Deck names must contain 1–120 characters.");
  if (deck.unresolved.length)
    errors.push(
      `${deck.unresolved.length} unresolved import line(s). Edit the source text to repair them.`,
    );
  if (count(deck.legends) !== 3) errors.push("Choose exactly 3 Legends.");
  if (count(deck.main) < 40 || count(deck.main) > 50)
    errors.push("The main deck must contain 40–50 cards.");
  const names = new Set<string>();
  const ram = limits(deck);
  for (const section of ["legends", "main"] as const) {
    const totals = new Map<string, number>();
    for (const e of deck[section]) {
      const c = byId[e.cardId];
      if (!c) {
        errors.push("Unknown card in deck.");
        continue;
      }
      if (
        !Number.isSafeInteger(e.quantity) ||
        e.quantity < 1 ||
        e.quantity > 1000
      )
        errors.push(`Invalid quantity for ${c.nameFull}.`);
      if ((c.type === "Legend") !== (section === "legends"))
        errors.push(`${c.nameFull} is in the wrong section.`);
      if (section === "legends") {
        if (names.has(c.name) || e.quantity !== 1)
          errors.push("Legends must have different names.");
        names.add(c.name);
      } else {
        totals.set(c.id, (totals.get(c.id) ?? 0) + e.quantity);
        if ((c.ram ?? 0) > ram[c.color])
          errors.push(
            `${c.nameFull} needs ${c.ram} ${c.color} RAM; available: ${ram[c.color]}.`,
          );
      }
    }
    for (const [id, n] of totals)
      if (n > 3) errors.push(`At most 3 copies of ${byId[id].nameFull}.`);
  }
  return [...new Set(errors)];
}
export function exportDeck(deck: Deck): string {
  const lines = (entries: DeckEntry[]) =>
    entries.map((e) => {
      const c = byId[e.cardId];
      return c
        ? `${e.quantity}x ${e.number ?? c.printings[0].number} ${c.nameFull}`
        : `${e.quantity}x ??? ${e.cardId}`;
    });
  return (
    [
      `# Name: ${deck.name.replace(/[\r\n]/g, " ")}`,
      "",
      "# Legends",
      ...lines(deck.legends),
      "",
      "# Main Deck",
      ...lines(deck.main),
      ...(deck.unresolved.length ? ["", ...deck.unresolved] : []),
    ].join("\n") + "\n"
  );
}
