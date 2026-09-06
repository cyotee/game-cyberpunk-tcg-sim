# Cyberpunk TCG Online — Project Requirements

Status: Implementation planning baseline; remaining decisions gate affected work and release  
Version: 0.32  
Last updated: 2026-09-06

## 1. Purpose

Build a web application for playing the current Cyberpunk Trading Card Game with long-distance friends and other online players. Support live matches with two to five players, a complete rules engine, and the full current card roster.

This document records agreed requirements, separates proposed details from decisions, and tracks questions that must be resolved before completing affected implementation work. The [implementation plan](IMPLEMENTATION_PLAN.md) defines milestones and decision gates. Development can proceed in stages, but a limited card pool or partial rules engine does not satisfy the first-release scope.

## 2. Decision summary

| Area | Decision |
| --- | --- |
| Game | Current Cyberpunk TCG from https://cyberpunktcg.com/ |
| Functional reference | https://cyberpunk-tcg-sim.online/ |
| Match size | Two to five players |
| Multiplayer format | Free-for-all; change the official rules as little as necessary |
| Gig victory target | Configured at table creation; default majority updates with lobby participation; seven-Gig preset and host custom value |
| Reactions | Only the defending player may react to an attack |
| Player loss | Deck-out or concession eliminates that player; remaining players continue and the last remaining player wins |
| Automation | Enforce rules and resolve all supported card effects automatically |
| First-release card coverage | All gameplay-distinct cards sufficiently defined by official information published by September 5, 2026 to be playable; full rules support |
| Rules and card sources | Official rules, card database, and errata; versioned project dataset with a separate multiplayer supplement |
| Match rules version | Each match retains its rules-and-card version through saving and resumption |
| Card access | Everyone can use all cards to build decks |
| Deck tools | In-app deck builder with browser-local persistence |
| Deck import/export | Paste text, import a text file, and export decks in the supplied text format |
| Deck backend | Server-side deck storage deferred |
| Accounts | Include accounts to facilitate reconnecting; supersedes the earlier account-free direction |
| Login provider | Discord login required to create or join matches; deck building requires no login |
| Sessions | Live play in player-created tables |
| Discovery | Public table browser available without login; “matchmaking” means table discovery and joining |
| Private play | Unlisted tables accessible by a shareable URL containing a join code, or by entering that code; saving and later resumption supported |
| Disconnects | Continue until the absent player is required, then pause and prompt to save for later; no automatic forfeit |
| Match start | Host may start with two to five seated players, all ready with legal decks, even below table capacity |
| Saving | Automatically preserve progress; any participant may save a copy without pausing or ending play |
| Save versions | Manual saves are separate snapshots; rolling autosave continues updating independently |
| Saved-game storage | Copies in every player's browser, without application-imposed expiry; players may delete saves and export/import them |
| Host departure | Automatically transfer host permissions to another connected player |
| Block lists | Host-owned, account-bound lists that hosts can manage, including unblocking; not limited to one table |
| Seat recovery | Same Discord account may reclaim its seat from another browser, replacing the previous active connection |
| Resumption | All non-eliminated players must be connected and ready, including Sudden Death players currently without turns |
| Visual design | Clean, utilitarian interface; use the reference for functionality, not visual style |
| Platform | Desktop and laptop browsers initially; mobile-browser layouts and native Android/iPhone applications deferred |
| Browser support | Current stable Chrome, Firefox, and Safari initially |
| Initial capacity | Up to 100 simultaneous players; estimate hosting for 20 concurrent five-player matches |
| Spectators | No spectator support in the first release |
| Communication and history | Game action log only; players use external channels to communicate |
| Hosting | Vercel preferred; supporting services or alternatives may be evaluated |
| Cost | Minimize overall costs; no fixed monthly budget yet |

## 3. Users and primary journeys

- A player builds and saves legal decks using any card in the available roster.
- A host creates a public or private table and starts a live game with two to five players.
- A player finds an available public table and joins it.
- Friends join a private table through its invitation URL or join code.
- Players take legal actions while the application manages turn progression, timing, choices, and card-effect resolution.
- A disconnected player returns to their existing seat and game state.
- Participants save a private match and resume it in a later session.

## 4. Game rules and card coverage

### Confirmed requirements

- RULE-01: Use the official rules and card text for the current Cyberpunk TCG as the baseline.
- RULE-02: Support two, three, four, and five participants in free-for-all matches.
- RULE-03: Introduce only the rule changes necessary to support additional players. Do not assume a broader redesign or multiplayer balance changes.
- RULE-04: Enforce legal actions, costs, targets, timing, and deck construction rules. Illegal actions must not change the game state.
- RULE-05: Resolve card effects automatically, asking the appropriate player for choices when required. Player choices remain interactive.
- RULE-06: Implement the full current card roster for the first release. Manual resolution is not a substitute for required card-effect support.
- RULE-07: Make all cards available for deck construction without collection ownership restrictions.
- RULE-08: Only the defending player may take reactions during an attack. Other players' applicable triggered, persistent, or replacement effects still follow their normal timing; this does not grant them a reaction window.
- RULE-18: Setup uses join order as cyclic turn order, starting with the selected first player. Randomly choose the player who selects the first player; resolve mulligans in turn order. In matches with more than two players, the first player starts with two spent Legends and the second with one spent Legend. Two-player setup retains the official procedure.
- RULE-19: Having no Gigs does not eliminate a player. Do not allow concession while an effect is processing. Disconnection waits only when that player’s input is required; it does not eliminate them. Deck-out remains an immediate loss under rule 1.14 and the approved multiplayer elimination adaptation; treatment of an already-resolving effect on deck-out remains open.
- RULE-09: Deck-out or concession eliminates that player while the remaining players continue. The last remaining player wins. Piece/effect cleanup and simultaneous losses remain to be specified.
- RULE-10: Provide three Gig-target modes at table creation: automatic majority (default), a button that selects the official seven-Gig value, and a host-entered custom target. With six dice per participant, majority is `floor(6 × playerCount / 2) + 1`: 7/10/13/16 for 2/3/4/5 players. Update the automatic target as players join or leave the lobby. Do not overwrite the seven-Gig preset or a custom target when occupancy changes. The custom target must represent a positive whole number of dice; upper-bound handling remains open. Lock the target at match start; neither host changes nor player departures recalculate it.

- RULE-14: For all two- through five-player matches, use official-style per-player pending-effect batches as a binding project rule. Begin with the current turn player, then proceed in normal cyclic turn order, skipping players with no pending effects. Each player chooses the order of all their pending effects and finishes their entire batch, including newly triggered effects they control, before passing resolution to the next player. Finish the currently resolving effect before beginning another. Continue around the table again when earlier players have gained pending effects, until none remain. Sudden Death players without turns still participate in effect resolution; turn ineligibility does not suppress their effects. This supersedes chronological trigger ordering and next-upcoming-player-first simultaneous ordering. No general response window or effect-interruption permission is implied. See MP-08 for examples and official sources.

- RULE-15: When an effect requires choosing “a Rival,” the effect’s controller selects one eligible opposing player. Bind that Rival for the whole effect instance from that source: resolve all instructions referring to that Rival against the same player, who makes any choices assigned to them. Do not select a different Rival for each instruction or distribute that effect across opponents. Each separately triggered effect has its own Rival selection, whether triggered by another source or by another occurrence of the same source’s trigger. The binding is per effect instance, not permanent for the card. Card-specific eligibility and timing restrictions still apply. Event-trigger conditions do not themselves require preselecting a Rival; apply RULE-16. Wording permitting multiple targets follows RULE-17.

- RULE-16: When a condition concerning a Rival permits an action in relation to that Rival, evaluate eligibility per opponent. The controller may choose any qualifying Rival, but cannot use one opponent’s qualification to perform that action against a nonqualifying opponent. For example, a hypothetical effect allowing a Gig swap with a Rival who has more Street Cred permits choosing among qualifying Rivals only. Event-based triggers such as “when a Rival plays a Unit” trigger whenever a matching event occurs for any Rival, subject to the card’s stated limits; they do not require a Rival to have been selected in advance. Preserve the event’s player identity for any linked references, and apply the effect’s written target restrictions separately. This does not convert a conditional permission or continuous ability into a triggered ability or change official timing.
- RULE-17: Multi-target card effects may select targets across players when their text permits. An unrestricted “eliminate two Units” may select any two otherwise legal Units, including Units controlled by different players. “Select a Rival and eliminate two of their Units” requires both Units to be controlled by the same selected Rival. Preserve all written ownership, control, eligibility, and linked-reference restrictions. These examples illustrate wording scope, not additional cards or effects.

### Overtime and Sudden Death

Official rule 1.11.1 begins overtime after two consecutive turns in which both players begin with empty fixer areas; rule 8.17 applies the transition after end-of-turn effects. The d20 is rolled last (8.6.5.1.1), normally on turn six, but that turn did not begin with an empty fixer. Normally overtime starts after both players finish turn seven, not immediately after the final d20 roll.

Before overtime, the Gig win check occurs at the start of the player's turn, before readying (1.10). During overtime, reaching the target wins immediately, including on entry to overtime (1.11–1.11.2). Rule 1.13.1 treats simultaneous wins as a tie in two-player play.

Approved multiplayer adaptation: after all active players' fixers are empty, complete a full cycle of turns that each began with an empty fixer, then enter overtime after end-of-turn effects. Use the locked table target for both normal and overtime wins. Cycle tracking across eliminations still needs specification. Rule links and decision details are in [MULTIPLAYER.md](docs/rules-audit/MULTIPLAYER.md).

- RULE-11: When multiple players qualify simultaneously for Gig victory, enter a distinct Sudden Death tiebreak instead of declaring a draw. This trigger follows the context of the simultaneous-winner question; overtime itself still uses the approved rule above.
- RULE-12: In the first Sudden Death round, every remaining player receives one additional turn. After the round, the sole player with the most controlled Gigs wins, regardless of the configured target. If the lead remains tied, only the tied leaders receive one additional turn each; compare again and repeat until there is a sole leader. “Leader” means Gig count, not Street Cred. Suspend ordinary immediate Gig-win checks during Sudden Death; compare counts only after every turn-eligible player has received a full turn. Players below the lead retain their pieces and reactions but receive no further turns; they are not eliminated and their Gigs are not abandoned. Continue normal cyclic turn order from the next player due a turn, skipping players ineligible for turns. Compare Gig counts across all non-eliminated players at each round boundary, including those no longer receiving turns; any sole leader wins. Turn eligibility and victory eligibility are separate. Recompute turn eligibility from the tied leaders at every round boundary, so a previously skipped player who ties for the lead receives a turn in the next round. Effects lasting until that player’s next turn expire when their next turn position is skipped. This expiry check does not grant a turn, ready cards, draw cards, or trigger start-of-turn effects.
- RULE-13: Only deck-out or concession abandons a player’s Gigs. Retain those Gig dice on the board so any remaining player may attack and take them; the locked target does not change. A disconnect retains the player’s seat, pieces, and defenses. Remove the eliminated player’s cards from play and remove their unrolled fixer dice; do not roll those dice into play. Only already-rolled Gigs remain. Abandoned Gig areas have no defender reactions. Already-stolen Gigs retain their current controller and value when their owner is eliminated; do not move them back to the abandoned area. Elimination cleanup does not trigger card effects, including defeat or other removal triggers. Cancel the eliminated player’s pending effects and end lingering effects they control. The treatment of an effect already resolving at the instant of elimination and mixed card ownership/control still requires precise cleanup rules.

### Agreed sourcing and validation approach

- Establish a versioned baseline of the official rules, official errata, and card inventory. The official errata page says its revised text supersedes printed text.
- Define “current roster” as all gameplay-distinct cards sufficiently defined by official information published by September 5, 2026 to be playable, regardless of physical release date. Include promotional identities when sufficiently defined; alternate artworks do not require separate effect implementations. Missing API fields may be repaired from official images or other official sources. Do not invent unpublished abilities. Rebecca — Having a Moment is deferred because her gameplay is unrevealed. The remaining 150 catalog identities are candidates pending data verification and source-conflict resolution; the date cutoff remains fixed.
- Maintain a card coverage inventory linking each gameplay-distinct card to its implemented behavior and validation evidence.
- Document every multiplayer deviation with its reason and examples. Preserve official two-player behavior unless a deviation is explicitly agreed.
- Ensure the shared game authority validates actions and exposes only information each player is allowed to see.

### Source authority and research findings

| Information | Authoritative source and role |
| --- | --- |
| Core gameplay and timing | [Official comprehensive rules](https://cyberpunktcg.com/comprehensive-rules) |
| Card identities, statistics, text, and printings | [Official card database](https://cyberpunktcg.com/cards) |
| Corrections to printed cards | [Official errata](https://cyberpunktcg.com/errata); revised text supersedes printed text |
| Specific rulings | Official general/card FAQ data; reconcile contradictions with current card text and comprehensive rules explicitly |
| Multiplayer changes | Our separately documented and agreed multiplayer supplement |
| Interface functionality | Reference simulator; not the authority for game rules |

Research observations from 2026-09-05:

- The source audit captured and reconciled all 151 listed card IDs and their 460 printings across 13 products. This establishes catalog coverage, not physical-release eligibility or complete gameplay-data accuracy.
- Public unauthenticated Netdeck GET endpoints used by the official site provide structured rules, cards, filters, and FAQs. A supported external API contract has not been verified. Captured JSON and checksums are retained in [the audit directory](docs/rules-audit/README.md).
- Individual card pages expose rules text, statistics, set information, collector numbers, and printing choices.
- [Viktor Vektor — Sit Down and Relax](https://cyberpunktcg.com/cards/viktor-vektor-sit-down-and-relax?printing=7d539173-4022-402e-a9f4-100338935fd2) lists six printings, including collector numbers `001`, `β001`, `002`, `β002`, and `040`. A collector number alone is therefore insufficient as the application's stable gameplay identity.
- The initial empty-page issue is resolved: the rules endpoint supplies 660 numbered rules and 53 section nodes, updated September 1, 2026. The official FAQ supplies 270 rulings, updated September 4. Both were read during the initial audit.
- Targeted image checks found an omitted Alt Cunningham ability and a numeric-power mismatch in the API; Gear textbox structure is also missing. The catalog needs a reviewed correction layer before it can serve as the engine specification.
- Official sources disagree on some effects and timing details. The [audit conflict register](docs/rules-audit/README.md#official-source-conflict-register) records the issues without silently selecting interpretations.
- The cutoff now uses sufficient official gameplay definition rather than physical distribution. Revealed beta/retail cards can qualify; the textless Rebecca promo does not. This scope refinement is approved.
- The supplied Heist import maps to all 20 retail-starter identities and passes standard construction checks. The two official print-and-play demos each contain only 27 main cards plus 3 Legends; they cannot substitute for legal constructed starter templates. Official retail starter copy quantities still require verification.

### Versioned catalog and effect implementation

- DATA-01: Maintain a structured, versioned project catalog rather than requiring live official-site requests during gameplay.
- DATA-02: Separate gameplay card identities from their printings. Record names, set/printing identifiers, collector numbers, types, statistics, rules text, and source references. Preserve collector numbers as identifiers, including leading zeros and any prefixes.
- DATA-03: Resolve imported card numbers and names to stable gameplay identities using printing information. Unresolved ambiguity must be surfaced; the exact conflict-resolution interaction remains open.
- DATA-04: Record source dates and versions. Compare upstream changes and review them before publishing a catalog or rules update, with validation of affected behavior.
- DATA-05: Pin each match to a versioned rules-and-card baseline, including the multiplayer supplement and corresponding effect behavior. Saved matches resume under that same baseline after catalog updates.
- DATA-06: Implement effects explicitly in tested engine logic derived from official card text and rules. Maintain coverage evidence for each gameplay-distinct card, including timing, interactions, and any multiplayer interpretation.
- DATA-07: Keep raw source captures separate from reviewed data corrections and official-source conflict decisions. Preserve Gear top/bottom textbox ownership, distinguish null from zero, and validate structured fields against official card images. An API `legal` flag or missing rules text is not sufficient evidence that a card is playable.

### Source inventory and rules audit status

Before implementation planning, produce an audit that:

1. Obtains the official rules document and records its version, source, and retrieval date.
2. Establishes the full roster sufficiently defined by official information published by September 5, 2026, reconciling sets, promotional identities, and alternate printings.
3. Records applicable errata and associates corrections with affected gameplay cards and printings.
4. Identifies every rule and card requiring a multiplayer decision, with source references and proposed minimal changes for discussion.
5. Establishes the card coverage checklist and verifies that the supplied deck-import fixture can be mapped to catalog identities.
6. Records missing data and unresolved official-rule ambiguities explicitly rather than silently inventing behavior.

The [initial audit](docs/rules-audit/README.md) is complete, with a [151-card checklist](docs/rules-audit/card-coverage.csv), captured sources, import-fixture validation, an errata register, and a [multiplayer decision register](docs/rules-audit/MULTIPLAYER.md). The final playable baseline remains uncertified pending source-conflict resolutions, full gameplay image verification/corrections, and official starter quantities. Approved multiplayer decisions are marked in the register; remaining proposals still require resolution.

### Open rules decisions

- Remaining card-specific wording cases beyond RULE-15–RULE-17, including cost calculations, global effects, and theft prevention. Rival eligibility, event-trigger scope, and multi-target player scope are approved; verify each card against these policies.
- Which players may be targeted, attacked, or affected by each relevant effect.
- Setup turn order, starting player selection, response opportunities, passing, and ordering multiple players’ choices within a single effect. Pending-effect batching is settled by RULE-14.
- Shared versus per-player game areas and resources, wherever the official rules require interpretation.
- Victory, defeat, elimination, concessions, ties, and what happens to an eliminated player's cards and unresolved effects.
- Whether any setup values must change with player count.
- Reconciled card/printing inventory at the September 5, 2026 cutoff, rules version, and errata baseline. Promotional identities qualify when sufficiently defined; artwork variants share gameplay behavior where their rules are identical. The gameplay-publication cutoff does not by itself select a rules-document or errata version.

The initial rules/card review has organized these into numbered decisions in [MULTIPLAYER.md](docs/rules-audit/MULTIPLAYER.md). No multiplayer interpretation is approved merely because it appears plausible.

## 5. Deck builder and local storage

- DECK-01: Provide a way to browse the roster and construct decks from all available cards.
- DECK-02: Allow players to save and reopen built decks in the same browser after refresh or restart.
- DECK-03: Allow selection of a built deck for a match and enforce deck legality before play.
- DECK-04: Keep the persistent deck library in browser storage for the first release. Accounts do not imply cloud deck synchronization.
- DECK-05: Defer the server-side deck-library storage design to later work.
- DECK-06: Allow deck building and browser-local deck storage without login.
- DECK-07: Import decks from the text format specified below, without requiring login. Preserve the deck name, section assignments, card identities, and quantities in the resulting editable deck.
- DECK-08: Support both pasted deck text and text-file import using the required format.
- DECK-09: Export built decks in the same text format, preserving the name, Legends/Main Deck sections, card identities, and quantities. Export requires no login. An exported deck must be importable without changing its gameplay contents.
- DECK-10: Maintain one deck library per browser, shared by guest use and any Discord accounts using that browser. Login and logout do not switch deck libraries.
- DECK-11: Retain malformed or partially valid imports as editable drafts and display their errors. Block use of an invalid deck in a match. Players can resolve the blocker by editing the draft until it is legal or selecting another legal deck from their stored library. An unrelated invalid draft must not prevent use of a valid selected deck.
- DECK-12: Combine quantities when multiple entries resolve to the same gameplay card within the same section, then report any resulting deck-legality issues. Preserve the distinction between Legends and Main Deck sections.
- DECK-13: Include deck creation, naming, renaming, duplication, editing, and deletion in the first release. Duplicating a deck creates an independently editable copy in the browser-local library.
- DECK-14: Search cards by name and rules text, and provide filters for type, cost, tags, color, and set.
- DECK-15: Include official starter decks as ready-to-use templates that players can copy into their local library and edit. Verify template contents against official sources during the source inventory audit; identify the included starter products at the agreed roster cutoff.

The running match must retain the deck information necessary to play and resume it. This is distinct from storing a player's reusable deck library on a backend.

### Required deck import format

The user-supplied example below is the initial acceptance fixture. The importer must recognize:

- `# Name: <deck name>` as the deck name.
- `# Legends` and `# Main Deck` as distinct deck sections.
- `<quantity>x <card number> <card name>` as a card entry in the current section.
- Leading-zero card numbers such as `001`, names containing an em dash, apostrophes, and digits, and blank lines between sections.

```text
# Name: The Heist Starter Deck

# Legends
1x 011 Jackie Welles — Pour One Out For Me
1x 012 V — Corporate Exile
1x 001 Viktor Vektor — Sit Down and Relax

# Main Deck
2x 065 Afterparty at Lizzie's
3x 112 Delamain Cab
2x 002 Dexter DeShawn — One Last Chance
2x 128 Dying Night — V's Pistol
3x 113 Evelyn Parker — Scheming Siren
3x 132 Floor It
2x 047 Heywood Ripperdoc
3x 061 Kiroshi Optics
3x 062 Mandibular Upgrade
2x 015 MT0D12 Flathead
2x 051 Offduty Malfini
2x 124 Psycho Squad
2x 136 Reboot Optics
2x 053 Secondhand Bombus
2x 055 T-Bug — Amateur Philosopher
2x 130 Tetratronic Rippler
3x 064 Zetatech Faceplate
```

Acceptance: importing this fixture yields a deck named `The Heist Starter Deck`, three Legends entries totaling three cards, and 17 Main Deck entries totaling 40 cards, with every listed quantity and section preserved. The deck can be edited, saved locally, and reopened without login. Successful parsing does not by itself establish deck legality; the official card inventory and construction rules still govern validation.

Required error handling: identify malformed entries, unknown or ambiguous cards, and disagreements between a card number and name. Preserve unresolved input in the editable draft rather than silently dropping entries or substituting cards. Report deck-legality problems separately from text-format problems. Combine duplicate resolved entries as specified by DECK-12.

Open import/export details: tolerance for alternate whitespace and punctuation, number/name conflict resolution, card-number collisions across sets, export behavior for unresolved drafts, and choosing a printing's number/name when exporting cards with multiple printings.

Open deck-builder details: search/filter matching semantics, sorting, storage limits, and handling of cleared browser data. Deck-library ownership is browser-local rather than account-specific. The source audit must establish the exact official starter-deck inventory and lists.

## 6. Accounts and Discord login

### Updated direction

Accounts are now in scope to support persistent player identity and reconnection. Discord is the account creation and login provider required for creating or joining matches. This replaces the earlier decision to defer accounts, while leaving browser-local deck storage unchanged.

### Confirmed access policy

- AUTH-07: Require Discord login before a player can create or join any public or private match. Every seated player must be signed in.
- AUTH-08: Allow deck building without login, including saving and reopening decks in browser storage.
- AUTH-09: Allow public table browsing without login.
- AUTH-10: Present the login option early, but require authentication only for actions that need it. Creating or joining a match requires Discord login; browsing and deck building do not.

### Proposed requirements

- AUTH-01: Offer “Continue with Discord.” First successful sign-in creates the application account; later sign-ins return to the same account.
- AUTH-02: Associate the account with Discord's stable user ID so display-name changes do not create a new player identity.
- AUTH-03: Associate occupied match seats with application accounts and authorize reconnection accordingly.
- AUTH-04: Use Discord's OAuth2 authorization code flow and request the minimum identity access needed, initially the `identify` scope.
- AUTH-05: Keep login credentials and application secrets out of browser code, validate the OAuth state, and use secure application sessions.
- AUTH-06: Use application-owned storage for account and match records; Discord supplies identity rather than game persistence.

Discord's official documentation supports authorization code login and basic identity access. The specific authentication library, account data model, and storage service are implementation decisions still to be evaluated.

Open details: session lifetime and account deletion behavior. No Discord bot, server membership requirement, or messaging feature has been requested.

## 7. Tables and live play

- TABLE-01: Let players create tables for live matches of two to five players.
- TABLE-02: Provide a public table browser through which players can discover and join tables.
- TABLE-03: Support private tables for invited participants.
- TABLE-04: Support the lobby-to-match flow, including participant seating, deck selection, and match start.
- TABLE-05: Keep participants synchronized with the authoritative match state.
- TABLE-06: Keep private tables out of public listings. Provide a join code embedded in the room URL so players can share either the full URL or the code alone.
- TABLE-07: Provide a way to enter a join code. The shared URL and code must resolve to the same table; Discord login is required to join through either route. A join code does not authorize taking over another player's existing seat.
- TABLE-08: Allow the host to start a match with two to five seated players only when every seated player has a legal deck and has explicitly indicated readiness. The table need not reach its configured capacity before starting. Do not silently omit or automatically remove unready seated players to start a match.
- TABLE-09: When the host leaves or disconnects, automatically transfer host permissions to the connected player with the earliest seating/join order among the remaining players. “Oldest” refers to time at the table, not account or personal age. This does not transfer the original host's player seat or bypass normal disconnect rules.
- TABLE-10: Allow the host to remove any other player from the pregame lobby, regardless of readiness. A host may remove an unready player before starting with the remaining ready players. This permission does not authorize removing players from an ongoing match.
- TABLE-11: Reset a player's readiness when they edit or switch their selected deck before match start. Require explicit readiness again even if the resulting deck is legal. Changes to an unrelated stored deck do not change the selected deck's readiness.
- TABLE-12: Maintain a block list belonging to the host's application account, rather than a single table. Kicking a player adds their authenticated account to the host's block list. Enforce the list when players attempt to join tables hosted by that account, across browsers and both URL/code and public-browser join routes. Hosts can manage their own list, including explicitly unblocking players. These are host-specific blocks, not site-wide bans; blocking or unblocking does not change another host's list.
- TABLE-13: Display table name, host, occupied and maximum seats, and lobby/in-progress status in the public table browser. Provide filters for available seats, capacity, and status. Listing an in-progress table does not grant spectator access or permission for new players to join an active match.
- TABLE-14: After host transfer, use only the new host's block list for future joins. Do not carry forward separate table-level exclusions from the previous host. Previously kicked players may join an eligible lobby if the new host has not blocked them. Existing match seats remain intact; applying a new host's list does not remove participants from an ongoing game.
- TABLE-16: Do not admit new players after the game starts. Reconnection by an existing participant to reclaim their seat is allowed and is not a new join.
- TABLE-15: Display the Gig-target mode and current target to lobby participants, and provide the host configuration controls specified in RULE-10. Whether changing this setting resets player readiness remains to be decided.

An automatic matchmaking queue and ranked play are outside the agreed first-release scope.

Open details: handling of already seated lobby players on an incoming host's block list, remaining host permissions, behavior when no player remains connected, and join-code lifetime and revocation. Host-owned block lists require shared account persistence independent of browser-local decks and saves. Spectators and in-table chat are excluded from the first release.

## 8. Reconnection, saving, and resumption

- REC-01: Allow a disconnected player to reconnect to the same match and seat.
- REC-02: Do not automatically forfeit a player because they disconnect.
- REC-03: Preserve a consistent match state across disconnection and reconnection.
- REC-04: Allow private matches to be saved and resumed in a later session.
- REC-05: Restore all state needed to continue correctly, including hidden information, pending decisions, turn/timing position, and unresolved effects where applicable.
- REC-06: Resume saved matches using their pinned rules-and-card baseline and effect behavior, as specified by DATA-05.
- REC-07: A disconnected player retains their seat and game pieces; their Gigs are not abandoned. Continue play until their input is required, then wait for reconnection, whether on their own turn or off-turn for choices, effect ordering, optional replacements, or defender reactions. Do not silently auto-pass optional input. Never infer concession from disconnecting.
- REC-08: When play pauses for an absent player, prompt the remaining participants to save the game for later resumption. Apply this disconnect behavior to public and private matches.
- REC-09: Automatically preserve match progress for both public and private matches. Manual saving must not be necessary to protect progress already accepted by the game authority.
- REC-10: Allow any participant, rather than only the host, to save a copy of a public or private match for later resumption. Saving a copy does not pause, end, or otherwise interrupt play. If the match is already paused awaiting an absent player, saving does not clear that pause. This is available in addition to automatic progress persistence.
- REC-11: Resume a saved match only when all non-eliminated players are connected and each has explicitly indicated readiness. Include Sudden Death players currently without turns because they retain reactions and victory eligibility. Eliminated players need not return or indicate readiness. A host or individual participant cannot bypass this requirement.
- REC-12: Store saved games in browser-local storage without application-imposed expiry. Allow players to delete their saved games. This does not guarantee survival of browser-data clearing, browser eviction, or device loss.
- REC-13: Allow a player to reclaim their existing seat from another browser using the same Discord account. Account identity establishes seat ownership; it does not by itself transfer a browser-local save to another browser.
- REC-14: Keep a protected saved-game copy in every participant's browser. Any participant's valid copy can be used to restore the shared match, subject to version validation and the all-non-eliminated-players-connected-and-ready resumption requirement. Synchronize returning participants with the current authoritative state before updating their local copies; disconnected browsers cannot receive new progress until they reconnect.
- REC-15: Allow players to export saved games as files and import them into another browser for backup or migration. Preserve match identity, player-seat ownership, game state, and the pinned rules/card version. Possession of a save file does not grant another player's seat or bypass Discord login and readiness requirements.
- REC-16: When a player reconnects and reclaims their seat, replace their previous active connection. The superseded connection must no longer be able to submit game actions for that seat.
- REC-17: Deleting a saved game removes only that browser's copy. It does not delete other participants' copies, end an active match, or revoke their ability to restore a retained copy.
- REC-18: Include the full game action log in local saves and exported saved-game files, and restore it when the match resumes. Protect hidden information both in stored/exported data and in each player's displayed history; complete history does not mean all players may read all private events.
- REC-19: Do not provide a manual pause control. The game is turn-based. Waiting for required participation after a disconnect and readiness requirements for saved-match resumption remain in effect; saving a copy does not pause play.
- REC-21: Restoring a historical manual snapshot creates a separate continuation, preserving newer progress in the original match. The continuation retains participant identities and requires every non-eliminated player to connect and indicate readiness before play resumes.
- REC-20: Store each manual save as a separate snapshot of the match at the time of saving. Continue updating the rolling autosave independently; subsequent gameplay must not overwrite an existing manual snapshot. Both types retain the state, rules/card version, and action history required for restoration.

Storage and recovery details to resolve: how a saved match is restored to the shared game authority; how returning players find the restored match; how stale or conflicting save revisions are handled; and how duplicate active restorations are prevented. Local copies and exported files must preserve hidden information and allow the game authority to detect unauthorized state changes. The storage design must also reconcile automatic progress persistence with abrupt browser disconnection. These are unresolved design requirements, not a decision to introduce cloud saved-game storage.

Open details: abandoned-table cleanup and whether an active match recreates a local autosave after the player deletes it. The rules audit must identify when absent-player participation is required. Version retention must support saves with no application-imposed expiry.

No automatic forfeit does not yet define how indefinitely abandoned matches are closed. That policy needs an explicit decision.

## 9. Interface and functional reference

- UI-01: Deliver a browser-based application with a clean, utilitarian visual style.
- UI-02: Use the reference simulator to inform functionality without copying its visual style.
- UI-03: Make matches with up to five players understandable and actionable, including player identity, board state, whose action is required, and legal choices.
- UI-04: Keep native Android and iPhone applications outside the first release.
- UI-05: Target desktop and laptop browsers for the first release. Mobile-browser layouts are deferred.
- UI-06: Do not provide spectator access in the first release.
- UI-07: Provide a game action log that respects each player's access to hidden information. Preserve the full log through saving and resumption as specified by REC-18. Do not include in-app text, voice, or video chat; players use external communication channels.
- UI-08: Support current stable Chrome, Firefox, and Safari on desktop/laptop platforms for the first release. Edge is not an explicit initial support target.

The reference simulator returned HTTP 403 during the initial inspection. Its feature set has not yet been audited, so feature parity is not a defined acceptance criterion. A later walkthrough must identify which functions to adopt.

Open details: minimum viewport, keyboard interaction, accessibility criteria, layout at five players, animations, and action-log presentation detail. The log must not reveal information a player is not entitled to see.

## 10. Hosting, persistence, and operating constraints

- OPS-01: Prefer Vercel for hosting. The Vercel CLI is installed according to the project owner.
- OPS-02: Evaluate additional services or alternative hosting if they better fit authoritative live game sessions and durable storage.
- OPS-03: Minimize overall operating costs; no hard monthly budget is set.
- OPS-04: Distinguish browser-local deck libraries and saved games from the shared account records and active match state required for multiplayer. The restoration mechanism and active-state durability remain to be designed; cloud saved-game storage has not been selected.
- OPS-05: Plan initial hosting capacity for up to 100 simultaneous players, using 20 concurrent five-player matches as the initial sizing scenario. This is a capacity and cost-planning target, not an agreed hard admission limit. Also evaluate the overhead of more concurrent tables at smaller player counts within the same player target.

The [implementation plan](IMPLEMENTATION_PLAN.md) recommends a framework, transport, storage, and hosting architecture, with an early feasibility and cost gate before committing infrastructure. These technical recommendations do not change the agreed requirements. The authentication library and pinned dependency versions remain implementation selections.

Open details: latency targets, availability expectations, persistence retention, operational visibility, and expected costs at the agreed initial capacity and growing usage. Anonymous table browsers and other non-playing visitors are additional load to estimate.

## 11. First-release acceptance gates

The release must demonstrate:

1. Complete matches at each supported player count: two, three, four, and five.
2. An agreed multiplayer rules supplement and verified, versioned official rules/card baseline covering all gameplay-distinct cards sufficiently defined by official information published by September 5, 2026, including qualifying promotional identities.
3. Complete card coverage, including relevant interactions and timing cases; no required effect depends on manual resolution.
4. Rejection of illegal actions and appropriate protection of hidden information.
5. Deck creation, naming, renaming, duplication, editing, deletion, import of the specified text fixture through paste and file upload with correct name/sections/quantities, text export and reimport without gameplay-content changes, local persistence, reopening, and legality validation, all without requiring login. Verify one library across login/logout, editable invalid imports, duplicate-quantity aggregation, and unblocking match participation by either repairing the selected deck or selecting another legal stored deck. Verify name/rules-text search, type/cost/tags/color/set filters, and copying verified official starter templates into independently editable local decks.
6. Public table discovery without login, authenticated joining, private table access through either a shared room URL or its join code, and match startup.
7. Discord login required for creating or joining public and private matches, authorized return to an existing seat, and deck building with local saving/reopening available without login.
8. Reconnection without automatic forfeiture or duplicated/lost game actions; play continues after a disconnect until absent-player participation is required, then pauses and offers saving for later.
9. Automatic progress persistence for public and private matches; any participant can save for later, and resumption requires all non-eliminated players connected and explicitly ready. Keep protected local copies in every participant's browser without application-imposed expiry; support deletion and save-file export/import. Restore required state and preserve original rules/card behavior across catalog updates. Verify migration to another browser, same-account seat recovery, and rejection of actions from the replaced connection.
10. A usable five-player desktop/laptop interface with a game action log that respects hidden information, and a deployment/cost approach appropriate to the agreed usage targets.

Exact test cases and measurable performance targets will be added as the open decisions are resolved.

## 12. Deferred scope

- Backend storage and synchronization of reusable deck libraries.
- Native Android and iPhone applications.
- Mobile-browser layouts, spectator access, and in-app chat.
- Ranked play and automatic matchmaking queues.
- Additional multiplayer formats such as teams.

Bots, tournaments, monetization, and other unrequested features are not assumed requirements. Players use external channels for communication.

## 13. Next clarification rounds

1. Resolve the audit's official-source conflicts and verify candidate gameplay data, then agree on the numbered multiplayer decisions in [MULTIPLAYER.md](docs/rules-audit/MULTIPLAYER.md).
2. Define remaining account-session details and deck-builder interactions.
3. Define table lifecycle, disconnect behavior, and save/resume permissions.
4. Review reference functionality and specify deck-builder and gameplay interactions.
5. Define device support, usage assumptions, retention, and measurable release criteria.

The [implementation plan](IMPLEMENTATION_PLAN.md) is now available. Foundation work may begin while remaining decisions are resolved at the plan's explicit gates. This document remains the requirements source of truth during iteration; unresolved rules and data certification still gate full release.

## 14. Sources

- [Official Cyberpunk TCG site](https://cyberpunktcg.com/)
- [Official card database](https://cyberpunktcg.com/cards)
- [Viktor Vektor — Sit Down and Relax, including printing information](https://cyberpunktcg.com/cards/viktor-vektor-sit-down-and-relax?printing=7d539173-4022-402e-a9f4-100338935fd2)
- [Official comprehensive rules entry point](https://cyberpunktcg.com/comprehensive-rules) — full structured contents captured and initially reviewed.
- [Official-site comprehensive rules data](https://api.netdeck.gg/api/cyberpunk/comprehensive-rules)
- [Official-site general and card FAQ data](https://api.netdeck.gg/api/faqs/cyberpunk)
- [Source audit and evidence inventory](docs/rules-audit/README.md)
- [Official card errata](https://cyberpunktcg.com/errata)
- [Functional reference simulator](https://cyberpunk-tcg-sim.online/) — inspection pending.
- [Discord OAuth2 documentation](https://docs.discord.com/developers/topics/oauth2)
- [Discord OAuth2 scopes and permissions](https://docs.discord.com/developers/platform/oauth2-and-permissions)

## 15. Decision history

- 2026-09-05: Requested and created the implementation plan with phased deliverables, recommended architecture, validation evidence, and explicit remaining-decision gates. Updated planning status without changing approved gameplay or release scope.

- 2026-09-05: Confirmed that Rival-dependent actions may target only a Rival satisfying their condition; qualification by a different opponent is insufficient. Event triggers respond to matching events from any Rival without advance selection. Multi-target effects may span players when the text allows; references to one selected Rival bind all associated targets to that Rival.

- 2026-09-05: Confirmed that an effect’s controller chooses one eligible Rival for the whole effect instance from its source. All references to that Rival stay bound within that effect. Separate triggers, including repeated triggers from the same source, may choose different Rivals.

- 2026-09-05: Adopted official-style pending-effect batching as binding project policy for all two- through five-player matches: current turn player first, player-chosen order within each complete batch including new effects, then cyclic turn order until no effects remain. This supersedes the earlier chronological and B → C → A decisions below.

- 2026-09-05: Clarified custom simultaneous resolution as B → C → A during A’s turn, with each player ordering their own simultaneous effects. Official batching is being evaluated before finalizing the algorithm or its two-player applicability.

- 2026-09-05: Confirmed cancellation of eliminated players’ pending and lingering effects, next-turn expiry at a skipped Sudden Death turn position, and chronological trigger ordering. Simultaneous triggers are ordered from the next upcoming turn; stack insertion versus resolution direction requires clarification.

- 2026-09-05: Confirmed resumption readiness from all non-eliminated players, including Sudden Death players without turns; preserved stolen Gigs’ current controllers and values upon owner elimination; elimination cleanup triggers no card effects. Already-pending and lingering effects remain a separate decision.

- 2026-09-05: Confirmed that every Sudden Death round recomputes turn eligibility from tied leaders, including previously skipped players. Deck-out/concession removes the player’s cards and unrolled fixer dice; only rolled Gigs remain, with no defender reactions for the abandoned area.

- 2026-09-05: Confirmed disconnect waiting whenever input is required, including off-turn. All non-eliminated players remain eligible to win Sudden Death even without further turns. Extra rounds continue normal turn order while skipping players ineligible for turns.

- 2026-09-05: Confirmed that only deck-out/concession abandons Gigs; disconnects wait for reconnection. Sudden Death compares counts after full extra turns, with ordinary Gig-win checks suspended. Players below the lead keep pieces/reactions but receive no further turns and are not eliminated.

- 2026-09-05: Approved multiplayer overtime timing, target locking at match start, no new mid-game players, and retention of departed players’ Gig dice as attackable resources. Replaced simultaneous Gig-win draws with repeated Sudden Death rounds, first for all remaining players and then only tied leaders. Detailed departure and tiebreak interactions remain open.

- 2026-09-05: Added host-configurable Gig victory targets with dynamic lobby-majority default, seven-Gig preset, and custom entry. Confirmed defender-only reactions and continuation after deck-out/concession. Rechecked official overtime timing; multiplayer overtime and target locking remain proposed.

- 2026-09-05: Clarified the fixed September 5 cutoff as sufficient official gameplay definition, regardless of physical release. Deferred Rebecca’s unrevealed gameplay; retained 150 candidate identities for verification.

- 2026-09-05: Completed the initial official-source audit: 151 card identities, 460 printings, 660 numbered rules, 270 FAQs, demo-deck counts, and Heist import validation. Recorded data defects, source conflicts, and proposed multiplayer adaptations. Release-cutoff semantics and the final certified baseline remain open.

- 2026-09-05: Confirmed manual snapshots remain separate from the independently updated rolling autosave, and fixed initial card-roster scope to all officially released cards as of September 5, 2026.

- 2026-09-05: Confirmed use of only the new host's block list after host transfer, retention of the full game action log in saves with hidden information protected, and no manual pause control for turn-based play. Disconnect waiting and saved-match readiness requirements remain unchanged.

- 2026-09-05: Replaced table-specific blocks with host-account-owned, manageable block lists including unblocking. Confirmed initial Chrome/Firefox/Safari support and a capacity-planning target of 100 simultaneous players. Host-transfer block-list behavior remains open.

- 2026-09-05: Confirmed readiness resets after editing or switching the selected deck, kicked players are blocked from rejoining the same table, and public listings show table name/host/occupied and maximum seats/lobby or in-progress status with available-seat/capacity/status filters.

- 2026-09-05: Confirmed that every seated player must be ready before starting, hosts may remove ready or unready players from the pregame lobby, and host succession follows earliest table join order among connected players.

- 2026-09-05: Confirmed full deck creation/naming/renaming/duplication/editing/deletion, name and rules-text search with type/cost/tags/color/set filters, and official starter-deck templates for the first release.

- 2026-09-05: Confirmed one deck library per browser regardless of account, editable invalid imports with visible errors and match use blocked until a legal deck is selected, recovery by editing or switching stored decks, and combining duplicate card quantities within each section before legality validation.

- 2026-09-05: Confirmed desktop/laptop browsers as initial targets, no spectator support, and a game action log without in-app communication features.

- 2026-09-05: Confirmed that manual saving only saves a copy and leaves play running, deleting a save affects only that browser, and deck tools support pasted text, text-file import, and export in the required deck format.

- 2026-09-05: Confirmed saved-game copies in every participant's browser, saved-game file export/import for backup and migration, and replacement of the previous active connection when a player reclaims their seat.

- 2026-09-05: Confirmed automatic host transfer to a connected player, browser-local saved games without expiry and with player deletion, and cross-browser seat recovery through the same Discord account. Save distribution/restoration and simultaneous-connection behavior remain open.

- 2026-09-05: Confirmed host-controlled start with two to five ready players without requiring full capacity; automatic progress saving and participant-controlled save-for-later for public and private matches; saved games resume only when all players are connected and explicitly ready.

- 2026-09-05: Confirmed anonymous public-table browsing, early optional login, private-room URLs containing shareable join codes, and continuing after disconnect until the absent player is required, then pausing and prompting to save for later.

- 2026-09-05: Established full-roster, fully enforced browser play for two to five players, free-for-all, table browsing, local decks, reconnecting without automatic forfeits, and private match saving/resumption.
- 2026-09-05: Revised the account-free direction to include accounts for reconnection; selected Discord as the intended provider pending detailed access-policy decisions.
- 2026-09-05: Confirmed Discord login is required to create or join matches; deck building and browser-local deck storage remain available without login. Table-browsing access remains to be confirmed.
- 2026-09-05: Added required text deck import using the supplied “The Heist Starter Deck” example as the initial acceptance fixture.
- 2026-09-05: Approved official-source sourcing, a versioned project catalog separating cards from printings, reviewed data updates, explicit tested effects, and match version pinning. Defined roster scope to include all officially released gameplay-distinct cards, including unique promos, at a cutoff still to be agreed. Added research findings and made the source inventory and rules audit the next requirements deliverable.
