// This entry point is bundled with its catalog and deck validator when archived.
export * from "../engine/index";
export { card, cards, CATALOG_VERSION } from "../catalog/index";
export const FEATURES = { normalLegendPlay: true } as const;
