import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { card } from "../../packages/catalog/index";
import corrections from "../../docs/rules-audit/card-data-corrections.json";
const raw = JSON.parse(
  readFileSync("docs/rules-audit/sources/card-details.json", "utf8"),
).items;
it("image-backed corrections preserve printed zero power and null cost separately", () => {
  expect(Object.keys(corrections.cards)).toHaveLength(18);
  for (const id of Object.keys(corrections.cards)) {
    expect(raw.find((c: any) => c.slug === id).power, id).toBeNull();
    expect(card(id).power, id).toBe(0);
    expect(card(id).cost, id).toBeNull();
  }
});
it("the catalog matches the manually recorded card-image stats", async () => {
  const { default: reviews } =
    await import("../../docs/rules-audit/card-reviews.json");
  for (const review of reviews.reviews)
    expect(card(review.id), review.id).toMatchObject(review.stats);
});
