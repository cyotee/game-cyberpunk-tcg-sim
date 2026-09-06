import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { cards, CATALOG_VERSION } from "../packages/catalog/index";
import "../packages/engine/index";
import { scripts } from "../packages/engine/kernel";
import imageReviews from "../docs/rules-audit/card-reviews.json";
const engineFiles = [
  "packages/engine/actions.ts",
  "packages/engine/kernel.ts",
  "packages/engine/effects.ts",
];
const contents = engineFiles.map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
}));
const reviewFile = "docs/rules-audit/ability-reviews.json";
const reviews: Record<
  string,
  {
    baseline?: { fingerprint: string; tests: string[]; rules: string[] };
    abilities?: Record<string, { tests: string[]; rules: string[] }>;
  }
> = existsSync(reviewFile)
  ? JSON.parse(readFileSync(reviewFile, "utf8")).cards
  : {};
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const validEvidence = (e: { tests: string[]; rules: string[] } | undefined) =>
  !!e &&
  e.tests.length > 0 &&
  e.tests.every((p) => existsSync(p)) &&
  e.rules.length > 0;
const entries = cards.map((card) => {
  const fingerprint = hash({
    type: card.type,
    color: card.color,
    cost: card.cost,
    power: card.power,
    ram: card.ram,
    sell: card.sell,
    tags: card.tags,
    text: card.text,
    gearText: card.gearText,
    keywords: card.keywords,
  });
  const review = reviews[card.id];
  const printedText = card.gearText
    ? [card.gearText.intrinsic, card.gearText.inherited]
        .filter(Boolean)
        .join("\n")
    : card.text;
  // Clauses are review starting points, not automatically classified executable effects.
  const abilities = printedText
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t && !t.startsWith("("))
    .map((text) => {
      const id = hash(text);
      const evidence = review?.abilities?.[id];
      return {
        id,
        text,
        verified: validEvidence(evidence),
        evidence: evidence ?? null,
      };
    });
  const baselineVerified =
    review?.baseline?.fingerprint === fingerprint &&
    validEvidence(review.baseline);
  const imageReview = imageReviews.reviews.find((r) => r.id === card.id);
  const verifiedAbilities =
    baselineVerified &&
    abilities.every((a) => a.verified) &&
    !!imageReview?.imageTextChecked;
  return {
    id: card.id,
    name: card.nameFull,
    fingerprint,
    handlers: Object.keys(scripts).filter((key) =>
      key.startsWith(card.id + ":"),
    ),
    references: contents
      .filter((file) => file.text.includes(card.id))
      .map((file) => file.path),
    executionSmoke: "tests/scenarios/cards.test.ts",
    imageReview: imageReview ?? null,
    baselineVerified,
    abilities,
    verifiedAbilities,
    status: verifiedAbilities
      ? "review evidence recorded; shared release gates still apply"
      : "requires baseline or printed-clause outcome evidence",
  };
});
const verified = entries.filter((e) => e.verifiedAbilities).length;
writeFileSync(
  "docs/rules-audit/implementation-coverage.json",
  JSON.stringify(
    {
      catalogVersion: CATALOG_VERSION,
      certified: false,
      description:
        "Review evidence inventory. Clause extraction and smoke execution do not certify effects. Source conflicts and shared release gates remain open.",
      count: entries.length,
      reviewedCount: verified,
      entries,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Indexed ${entries.length} candidates; ${verified} have linked baseline and clause outcome evidence.`,
);
if (process.argv.includes("--release")) {
  console.error(
    "Release gate failed: complete card evidence and shared rules/production acceptance remain open.",
  );
  process.exitCode = 1;
}
