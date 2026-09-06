# Multiplayer decision register

Status: Decision register; approved items are identified below, others remain proposals.  
Baseline: Captured official comprehensive rules and FAQ on 2026-09-05.  
Scope: Free-for-all, two to five players, minimal changes.

Rule numbers below map to stable official URLs in [rule-index.json](rule-index.json). Card names map to source URLs and FAQ IDs in [card-inventory.json](card-inventory.json). All 151 catalog texts were reviewed; the table groups shared questions rather than inventing 151 independent rule variants. Every card also depends on the universal timing, victory, and elimination decisions.

## Decisions that affect the whole game

| ID | Decision needed | Proposed starting point | Relevant official rules |
| --- | --- | --- | --- |
| MP-01 | Opponents, friendly pieces, and public reveals | Every other active player is a Rival. “Friendly” means controlled by you. Reveal public information to all active players; personal hidden information remains private. | 1.4, 1.7, 3.18, 5.3, 11.14 |
| MP-02 | Victory threshold | **Approved:** host configures at table creation. Default majority updates with lobby player count: 7/10/13/16 for 2/3/4/5 players. Provide a seven-Gig preset button and custom positive-integer target. Occupancy changes do not override preset/custom modes. The target locks at match start and does not change after departures. Custom upper-bound handling and readiness resets remain open. | 1.10–1.11, 7.2 |
| MP-03 | Overtime | **Approved:** replace the two-player condition with one full cycle in which every active player's turn begins with an empty fixer. Check overtime after completing that cycle. Do not hard-code turn seven; elimination and effects can matter. | 1.11.1, 8.17 |
| MP-04 | Deck-out, concession, and elimination | **Approved:** deck-out or concession eliminates that player while others continue; the last remaining player wins. A Gig win ends the whole match. Departed players’ Gig dice remain attackable. Simultaneous Gig wins enter the Sudden Death procedure below; other cleanup and simultaneous-loss cases remain open. | 1.5–1.6, 1.13–1.17 |
| MP-05 | Eliminated player's pieces and effects | **Approved:** leave a departed player’s Gig dice on the board; any player may attack and take them. No new player may join mid-game. Only deck-out/concession abandons Gigs; disconnection preserves the seat and pieces. Remove their cards from play and remove unrolled fixer dice without rolling them. Only rolled Gigs remain; abandoned areas have no defender reactions. Already-stolen Gigs keep their controller and value. Cleanup generates no card-effect triggers. Cancel their pending effects and end lingering effects they control. Effects lasting until a skipped Sudden Death next turn expire at that skipped position. Mixed card ownership/control and already-resolving effects remain open. | 1.7, 4.12, 6.7, 10.10–10.15 |
| MP-06 | Setup and seat order | Use a fixed cyclic seating order, randomly select a player to choose who starts, and keep the two-spent-Legend penalty only for the first player. Mulligans proceed in turn order. Keep exact official first/second choice for two players. | 7.5, 7.7.4, 7.9.2, 8.2 |
| MP-07 | Attacks and reactions | **Approved reaction policy:** only the defending player may react. Third-party triggered/replacement effects may still apply when their text permits, but third parties do not gain a general reaction window. Proposal for target selection: an attack selects one opponent's valid Unit or Gig area. | 9.3–9.12; general QUICK FAQs |
| MP-08 | Pending effects and simultaneous choices | **Approved; binding for 2–5 players:** use official-style batches, beginning with the current turn player and proceeding in normal cyclic turn order. Each player chooses the order of all their pending effects and completes their batch, including newly triggered effects they control. Finish each effect before starting another. Skip empty batches and continue around again until no pending effects remain. This supersedes the earlier chronological and next-player-first policy. Sudden Death turn ineligibility does not remove effect-resolution participation. No general interrupt window is implied. Multiple choices within one effect remain open. | 2.9, 10.2.2–10.2.3, 10.12–10.14.1, 10.33 |
| MP-09 | “Once/first time each turn” and durations | Keep these per individual player's turn, not per complete round. Keep “until your next turn” tied to the source controller's next turn. “Next turn” instructions imposed on another player's Unit should refer to that controller's next turn; formalize this as a multiplayer adaptation. | 5.7.3, 8.12, 8.16, 11.11; Evelyn/Mox FAQs |
| MP-10 | Disconnection dependencies | **Approved:** wait only when the missing player must choose, order effects, take/decline an optional replacement, or finish a defender reaction window. Other players' turns can still require that player. No silent auto-pass. | 9.7–9.12, 10.12, 10.26–10.33; PRD REC-07 |

## Pending-effect batching — binding project rule

MP-08 applies uniformly to two- through five-player matches. Official rules let a player choose their pending-effect order ([10.12](https://cyberpunktcg.com/comprehensive-rules#rule-73aaaba0-4ad8-5a17-8a2b-fbfef8b44cb6)), give the current turn player the first complete batch ([10.13](https://cyberpunktcg.com/comprehensive-rules#rule-7efe9c08-6370-57fd-8f25-cdba7841252c)), and require finishing the current effect and the batch holder’s new pending effects before passing resolution ([10.14–10.14.1](https://cyberpunktcg.com/comprehensive-rules#rule-ed24f25b-1fdd-5a69-a719-ca9dcdfb5c2e)). Extending that handoff cyclically across additional players is the approved multiplayer adaptation.

Acceptance scenarios:

- During A’s turn, A, B, and C gain pending effects together: resolve A’s complete batch, then B’s, then C’s.
- A1 and B1 are pending; resolving A1 triggers A2: resolve A1 → A2 → B1.
- During B’s batch, B gains B2 and A gains A2: B finishes B2 and any other effects in B’s batch, then resolution continues to C before returning to A for A2. A’s status as turn player does not interrupt B’s batch or restart the cycle.
- A player chooses among all their pending effects whenever selecting the next effect in their batch, including newly pending effects.
- A Sudden Death player without turns still receives a batch when they have pending effects. Wait if that disconnected player must make a choice, following REC-07.

Ordering choices made by multiple players within one resolving effect, and elimination during an already-resolving effect, remain separate open decisions. This policy does not override elimination cleanup or card-specific rules.

## Overtime recheck (2026-09-05)

The live official endpoint was fetched again and matched the captured rules exactly. The final d20 roll is **not** the overtime trigger. Normally each player rolls their d20 on their sixth turn. Their seventh turn begins with an empty fixer, and overtime begins after both seventh turns finish, including end-of-turn effects. Having no fixer dice means no further roll-in is possible; it is not a loss condition.

Sources: [d20 selection, 8.6.5.1.1](https://cyberpunktcg.com/comprehensive-rules#rule-aae9d4fa-243f-5f89-ad5d-529370f56e34), [overtime trigger, 1.11.1](https://cyberpunktcg.com/comprehensive-rules#rule-42918654-95fe-5e43-b31c-5f8809d34bbe), [end-of-turn transition, 8.17](https://cyberpunktcg.com/comprehensive-rules#rule-7c7fec94-83c4-5311-9ac3-277a670bd2ee).

Approved MP-03: once all active fixers are empty, each active player must complete a turn that began with an empty fixer before overtime starts. Then use the configured target for immediate wins rather than waiting for the start of a turn. An already-qualified player wins on entry. Multiple qualifiers enter the approved Sudden Death tiebreak below. Cycle handling across elimination remains to be specified.

Approved MP-02 continuation: freeze the selected target at match start. A host may choose any positive whole-number target, including one larger than the starting dice supply; recommend explaining that Gig victory would then be unreachable rather than silently clamping the value. The warning behavior remains proposed; post-start target locking is approved. Elimination still provides another route to victory.

## Sudden Death tiebreak

**Approved:** simultaneous Gig-win qualification starts a tiebreak, not a draw. Each remaining player gets one further turn. At the round boundary, the sole leader by controlled Gig count wins. If tied, only those tied leaders get one additional turn each; repeat this comparison until one leader remains. The ordinary configured threshold does not determine the round-end leader. This is separate from normal overtime, based on the question the user answered.

**Approved:** suspend ordinary Gig-win checks until every eligible player completes their full extra turn. Players below the lead retain pieces and reactions but receive no more turns. They are not eliminated; their Gigs are not abandoned.

**Approved:** continue normal cyclic turn order from the next player due a turn, skipping those without turn eligibility. Compare all non-eliminated players at round end: a player who no longer receives turns can still become the sole leader and win. Disconnects wait whenever input is required, including off-turn choices and reactions.

**Approved:** recompute the next round’s turn-eligible players from all tied leaders. A previously skipped player regains a turn if they tie for the lead.

**Approved:** effects lasting until a skipped player’s next turn expire at that next skipped position, without a turn, readying, draws, or start-turn triggers.

Open details: already-resolving effects on deck-out/concession and simultaneous losses within the tiebreak. Only deck-out or concession abandons Gigs. Remove eliminated players’ cards and unrolled dice, retaining rolled Gigs without defender reactions.

## Card wording that needs a consistent multiplayer interpretation

| ID | Pattern and examples | Proposed interpretation / unresolved edge |
| --- | --- | --- |
| MP-C01 | “A Rival discards/chooses”: Augmented Negotiators, Caliber, Maelstrom Goons, Rogue — Preem Solo, Sasha, Fool on the Hill | **Approved (RULE-15):** the effect controller selects one eligible opposing player for the whole effect instance from its source. All instructions referring to that Rival use that same player; the Rival makes any choices assigned to them. Do not split the effect among Rivals. A separate trigger from another source, or another occurrence of the same source’s trigger, may select a different Rival. The binding is per effect instance, not permanent for the card. Preserve card-specific eligibility and choice timing. |
| MP-C02 | Compare with “a Rival”: Adrenaline Converter, Dexter — One Last Chance, Evelyn — Scheming Siren, Minotaur, Modded Muramasa, MT0D12 Flathead, Royce — Don't Call Me Simon, Valentino Guerrera, We Gotta Live Together | **Approved policy (RULE-16):** evaluate Rival-dependent action eligibility per opponent. Choose any qualifying Rival; a condition met against C does not authorize the associated action against nonqualifying B. This supersedes the unapproved cross-opponent-benefit proposal. Preserve each card’s ability type and timing; do not turn continuous permissions into triggers. Verify card-specific application during the audit. |
| MP-C03 | A comparison binds a subsequent player/area: Nadia, Gunpoint Diplomacy | **Approved scope policy (RULE-15–RULE-16):** the Rival receiving an action must satisfy the linked condition. Apply Nadia’s early attack permission only to qualifying Rivals’ Gig areas. Gunpoint requires selecting the qualifying Rival who chooses its effect; the controller still chooses the friendly Unit. |
| MP-C04 | Cost based on “a Rival's Units”: MaxTac Heavy | Count one Rival's field rather than adding all enemy fields. Proposal: controller chooses the Rival while determining payment; changing this to the sum substantially increases the discount. |
| MP-C05 | Unqualified targets: Afterparty, Industrial Assembly, Heywood Ripperdoc, Over the Edge, Wild in the Streets, Cyberpsychosis, Peace Offering, Padre | Permit any target satisfying the written restrictions, including third-party pieces. Padre explicitly refers to two different players; decide whether both may be opponents. Proposal: yes. |
| MP-C06 | Global effects: Adam Smasher — Metal Over Meat, Live with the Aftermath, Shattered Memories, (Don't Fear) The Reaper, Towerfall, MaxTac Suppression Team, Riot Shield | Apply “each player” across active players, “all rival” across opponents, and “all other Units” across everyone except the source. Shattered Memories counts all discarded cards. Preserve single-effect resolution and MP-08 ordering. |
| MP-C07 | Multiple rival targets: Bonnie and Clyde, Sandayu Oda, Towerfall's two modes | **Approved (RULE-17):** targets may span players when the card text permits. Unrestricted “eliminate two Units” may select legal Units across players; “select a Rival and eliminate two of their Units” binds both to that selected Rival. Preserve every written restriction; verify each card’s particular wording. |
| MP-C08 | Gig theft through effects: Appetite for Destruction, Gorilla Arms; prevention by Alt — Mother of Daemons, Chrome Fang, Westbrook Netrunner, Take Control | Normal combat theft stays in the attacked Gig area. Proposal: an additional effect with an unrestricted rival-Gig choice may take from another opponent. Define prevention based on each die's current controller and preserve actor identity for triggers. |
| MP-C09 | Third-party triggers: Meredith Stout, Yorinobu — Steel Dragon, Alt — Mother of Daemons | **Approved event policy (RULE-16):** “when a Rival…” triggers whenever any Rival produces a matching event, subject to written limits, without advance Rival selection. Preserve the event’s player identity for linked references and the written scope of the resulting effect. A qualifying third-party defeat can matter where wording permits it. Alt’s theft-prevention wording still needs explicit scope review when someone steals from another Rival. |
| MP-C10 | Forced attacks: Evelyn — Beautiful Enigma, Mox Inciters | Use the affected controller's next turn. Decide whether they can satisfy the requirement by attacking any legal opponent; proposal: yes. The FAQ requires another attack if the Unit readies and can still attack. |

## Scenarios to validate after decisions

1. A attacks B while C is disconnected: proceed if C has no required choice; wait if C must resolve an applicable replacement or trigger.
2. A controls seven Gigs while B and C each control seven in a five-player match: apply the selected overtime/tie policy consistently.
3. A's Maelstrom Goons steals multiple dice: count distinct trigger instances; each may select a different eligible Rival. Keep every instruction referring to that Rival within one instance bound to its chosen player, and resolve using MP-08. A trigger from a different source has an independent selection.
4. A has a Rival-dependent action requiring the chosen Rival to have more Street Cred than A. C qualifies and B does not: allow the action against C and reject it against B. If both qualify, A may choose either.
5. Shattered Memories affects five players and one decks out during resolution: apply agreed elimination cleanup before continuing the same effect.
6. A concedes while B controls A's stolen Gig and a restriction lasts until A's next turn: handle ownership and effect expiry without an impossible future turn.
7. Multiple players control effects triggered by the same defeat: apply MP-08’s current-turn-player-first batches, player-chosen ordering, inclusion of new effects within the current batch, and last-known information.
8. Resume a saved match with every non-eliminated player connected and ready, including Sudden Death players currently without turns; eliminated players need not return.

9. A hypothetical “when a Rival plays a Unit, change a Gig die value by one” triggers for qualifying plays by B and C independently, subject to its written limits. Do not require advance selection of B or C; resolve each trigger using its written target scope and MP-08.
10. An unrestricted two-Unit effect may select B’s Unit and C’s Unit. An effect selecting one Rival and two of their Units must reject that mixed-player selection.

Resolve MP-01 through MP-04 first, then setup/reactions/ordering, then card-language patterns and elimination cleanup. Do not hide these decisions inside implementation details.

## September 6 setup and concession decisions

Use join order as cyclic turn order, beginning with the selected first player. Randomly select the player who chooses first player; mulligans follow turn order. For 3–5 players, first player starts with two spent Legends and second player with one. Preserve official two-player setup. Concession is unavailable while an effect processes. Zero Gigs does not eliminate a player. Deck-out during an effect remains possible under official 1.14/1.14.1, so remaining instructions on controller deck-out still require a ruling. Historical manual saves create separate continuations, preserving the original match.
