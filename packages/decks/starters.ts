import data from "./starters.json" with { type: "json" };
import { newDeck, type Deck } from "./index";
export const starterSource = data.source;
export const starters = data.decks;
export function copyStarter(index: number): Deck {
  const starter = starters[index];
  if (!starter) throw Error("Unknown starter deck");
  return {
    ...newDeck(starter.name),
    legends: structuredClone(starter.legends),
    main: structuredClone(starter.main),
  };
}
