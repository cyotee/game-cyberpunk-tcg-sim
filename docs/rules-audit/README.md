# Official sources and multiplayer rules audit

Audit date: 2026-09-05  
Status: Initial source audit complete; production rules/card baseline is **not yet certified**.

## Findings

We can obtain structured official rules, card data, and FAQs through the public GET endpoints used by cyberpunktcg.com. They are suitable inputs for a versioned project dataset, but the card payload is not complete enough to drive a faithful game engine without correction and verification.

| Captured information | Result |
| --- | --- |
| Comprehensive rules | 660 numbered rules and 53 section nodes; API update timestamp `2026-09-01T19:28:10.028Z`; credits say August 2026 |
| Card catalog | 151 distinct card IDs, reconciled across both list pages and all 151 detail responses |
| Printings | 460 unique printing IDs across 13 set/product codes |
| Types | 27 Legends, 73 Units, 17 Gears, 34 Programs |
| Colors | 38 Red, 38 Blue, 38 Green, 37 Yellow |
| Official FAQs | 270 entries: 25 general and 245 card-specific, covering 140 card IDs; updated `2026-09-04T22:57:19.946Z` |
| User's Heist import | All 20 entries resolve by name plus a matching printing number; 3 Legends, 40 main cards, Blue 4 / Yellow 2 RAM; construction checks pass |
| Image verification | Three targeted catalog-image checks plus all eight pages of the two official demo PDFs; not a full 460-printing image audit |

Source endpoints and captured-file checksums are in [source-manifest.json](source-manifest.json). The public endpoints were discovered in the official site's frontend bundle. No documented, supported external API contract or bulk-export commitment has been verified. Do not make live play depend on these endpoints.

## Reading and reproducing the audit

- [Card inventory](card-inventory.json): one record per gameplay identity, printing/set associations, source links, FAQ links by ID, and known issues.
- [Card coverage checklist](card-coverage.csv): all 151 records, implementation/test status, and conservative text-triage flags. Flags identify review areas; they do not certify complete effect semantics.
- [Set inventory](set-inventory.json): distinct-card and printing counts per product; counts overlap across products.
- [Errata register](errata-register.json): official corrections mapped to card identities and associated printing IDs, with scope distinguished from printing lookup membership.
- [Rule index](rule-index.json): numbered rules and stable official-page anchors.
- [Heist fixture](the-heist-import-fixture.txt) and [mapping/legality report](the-heist-import-check.json).
- [Multiplayer decision register](MULTIPLAYER.md): approved changes are explicitly marked; other entries remain proposals or unresolved cases.
- [Demo-deck inventory](demo-decks.json): visually counted print-and-play contents, separate from retail starters.
- `sources/`: captured official JSON, preserved without correcting upstream defects.

Run `python3 scripts/build-rules-audit.py` from the repository root to regenerate indexes and verify IDs, counts, and fixture mapping. This is audit tooling, not a game engine or production deck importer. The temporary PDF extraction dependency is not needed to run it.

## Approved cutoff: sufficient official gameplay definition

The PRD originally used physical-release wording; the user has clarified that sufficient official gameplay definition by September 5 controls eligibility. The official organized-play FAQ says beta store sales begin September 10; the beta guide places full retail release in November. Therefore catalog presence and the API's `legal` flag do not prove physical availability at our cutoff. [Official OP FAQ](https://cyberpunktcg.com/opfaq), [Beta event guide](https://cyberpunktcg.com/beta-event-guide).

The catalog includes a textless Rebecca — Having a Moment promo. The publisher says its rules will be revealed with set two and it becomes playable when that set releases. It also says promo cards will not be mechanically unique: they are variants of broadly available cards. Rebecca's API record nevertheless says `legal`, with missing RAM, cost, power, and rules text. [Publisher's Rebecca explanation](https://cyberpunktcg.com/blog/rebecca-promo-update).

Approved scope: include all gameplay identities sufficiently defined by official gameplay information published by September 5, including qualifying revealed beta/retail cards. Defer Rebecca’s gameplay; never invent her effect or treat missing rules as a vanilla Legend. This yields 150 **candidate** identities, not 150 certified complete records, because data defects remain.

Physical distribution dates are not an eligibility requirement. API completeness alone is also not the criterion: official images can supply omitted text or values. Unresolved official-source conflicts still require explicit decisions before certifying behavior.

## Rules baseline and useful engine implications

Use English official rules as the baseline (1.3). The complete document was obtained; the earlier empty-page problem is resolved. Its publication announcement is dated August 28, while the API revision is September 1. Record both rather than inventing a semantic version. [Official announcement](https://cyberpunktcg.com/blog/comp-rules-published), [Rules source](https://api.netdeck.gg/api/cyberpunk/comprehensive-rules).

The main baseline requirements are:

- Three differently named Legends; 40–50 non-Legends; at most three copies per name/subtitle pair; per-color RAM limits (7.3, 3.20).
- Victory checked before start-phase actions; overtime and deck-out have explicit timing (1.10–1.17).
- Only the defender reacts; finish resolving effects rather than permitting arbitrary responses (9.7.1, 10.2).
- Players choose their pending-effect order; the approved multiplayer adaptation uses complete per-player batches in cyclic turn order, starting with the current turn player (10.12–10.14.1; [MP-08](MULTIPLAYER.md#pending-effect-batching--binding-project-rule)).
- Gear textbox ownership, null values, hidden Legends/Eddies, replacement effects, and random bottom-deck order must be represented explicitly (4.11, 5.3, 5.7–5.8, 10.24–10.30, 11.12).

The [official FAQ endpoint](https://api.netdeck.gg/api/faqs/cyberpunk) is an additional required source, absent from our original sourcing list. It resolves many cases, but the conflicts below prevent treating its answers as an unconditional override.

## Data-quality register

| ID | Evidence | Required follow-up |
| --- | --- | --- |
| DATA-ALT | Alt Cunningham — Soulkiller Architect's API text omits the first activated ability. Its official image shows a spend ability that discounts the next Program using friendly minimum-value Gigs. Image power is 0; API power is null. [Image evidence](evidence/alt-cunningham-soulkiller-architect.webp) | Resolved in the correction layer: the missing Alt ability and printed power 0 are retained. Seventeen more printed-zero Legends were visually checked and corrected on September 6; see `card-data-corrections.json`. Raw captures remain unchanged. |
| DATA-GEAR | The API flattens Gear text into one string. The rules distinguish effects belonging to the Gear from effects inherited by its bearer. Riot Shield visibly separates these textboxes. [Image evidence](evidence/riot-shield.webp) | Completed image/textbox review for all 17 Gears; production metadata distinguishes intrinsic/inherited text. See `card-reviews.json`; ability semantics still require separate verification. |
| DATA-FLAVOR | Some `rules_text` values contain only flavor, with inconsistent markers: Animals Wrecker, Emergency Atlus, Psycho Squad, Rockn' Rockerboy. | Separate flavor/reminder text from executable effects; do not interpret prose as abilities. |
| DATA-KEYWORDS | `keywords` is empty in the captured records even where `{Quick}`, `{Blocker}`, or other keywords occur in text. | Derive reviewed keyword metadata; do not assume the structured array is complete. |
| DATA-REBECCA | Physically distributed textless promotional card with unrevealed gameplay; misleading `legal` flag. | Defer gameplay until the official information exists; exclusion from this baseline is agreed. |
| DATA-PRINTINGS | Number reuse, beta prefixes, and artwork suffixes occur across products; API data has no release dates. | Preserve printing IDs and product context; use gameplay identity for deck-copy limits. |
| DATA-IMAGES | Image URLs include expiring query signatures; the source URL is also supplied but durable anonymous availability has not been verified. | All 150 candidate renderings are now pinned locally with SHA-256 hashes in `evidence/card-image-manifest.json`; the browser uses local assets, not signed URLs. |

The manual checks now include all 17 Gears, four flavor-only Units and the 17 additional printed-zero Legends, alongside the original targeted checks. OCR supports the remaining comparisons. This is not proof that all abilities and interactions have been certified.

## Official-source conflict register

These are implementation blockers for affected behavior, not multiplayer house-rule choices. Resolve via clearer official text/errata where available, or record an explicitly agreed provisional interpretation. No message has been sent to the publisher.

| ID | Conflict or ambiguity | Evidence / suggested handling |
| --- | --- | --- |
| RULE-SELL | Whether effect-based selling consumes the main-phase sale; whether a deck-top sale is revealed. | 5.8.4 versus 11.9.2.2; 11.9.1 versus Bootleg Black Sapphire Show FAQ. Its FAQ explicitly allows a sale after a main-phase sale and says not to look/reveal. Record as a specific exception pending a consistent rule. |
| RULE-V | V — Streetkid's card text permits retrieving a BRAINDANCE from the trash, while FAQs restrict retrieval to the three just trashed. | API text and [official image](evidence/v-streetkid.webp) agree on the broader wording; FAQ contradicts it. Do not silently narrow the effect. |
| RULE-DISCOUNT | Minimum activated-effect payment. | 11.8.3 sets a minimum of one, while Johnny Silverhand — Rocking Renegade's FAQ allows zero. Decide whether the latter is a specific exception. |
| RULE-TARGET-TIMING | Targets during activation versus resolution. | 10.19.1 and 10.31 versus the broader target step at 10.20.3. Preserve cost choices separately from resolution choices and obtain a consistent interpretation. |
| RULE-LEGEND-TIMING | Legend spend effects described as available at any point. | 5.7.6 versus 8.14/10.18 and the defender-only reaction restrictions. Do not infer unrestricted off-turn activation. |
| RULE-FLATHEAD | Conditional unblockability after Street Cred changes during an attack. | MT0D12 Flathead FAQ says it remains unblockable; its conditional card text needs an explicit timing interpretation. Avoid generalizing this answer to unrelated persistent effects. |
| RULE-RIVER | Which of two searched cards must be trashed. | River Ward card text permits choosing one; FAQ wording says the top card. Requires clarification of whether that answer is shorthand or a restriction. |
| RULE-ZERO | FAQ says zero is not even. | Field Operator concerns Street Cred, for which no Gigs means null under 5.11.4/11.2. Do not implement a global “zero is not even” rule from this answer. |
| RULE-PYRAMID | Pyramid Song power reduction differs between the official image and structured text. | Pinned official rendering shows −4, while the structured card text says −5. Current implementation uses −5; hold ability certification until the source-policy ruling establishes precedence. |
| RULE-SAFETY | Whether Safety Override chooses a Unit when played. | Current card text establishes the next friendly fight-loss effect without naming a target, while its FAQ answers yes to choosing a Unit. Current implementation follows the printed global-next-event wording; this conflict needs the pending source-policy ruling. |
| RULE-GUIDE | Teaching guide differs from comprehensive rules on bottom-deck order and attack sequencing. | Prefer detailed 11.12 and 9.3 as the proposed baseline; do not derive the engine from quick-reference sheets. |

Card-specific FAQ IDs are linked from `card-inventory.json`; the raw questions and answers remain in `sources/faqs.json`. Other editorial errors were observed, such as a NetWatch Netdriver question mentioning Zetatech Faceplate. They reinforce the need to review question, answer, and current card together.

## Starter decks and import findings

The official catalog contains 20 distinct identities in each retail starter product, with the same identity counts for corresponding beta products. Set membership does not supply copy quantities. The user-provided Heist list matches the 20 identities in the retail Heist product and passes constructed-deck checks, but this does not independently certify its official quantities.

Both official print-and-play PDFs were retrieved and all four pages of each were visually reviewed. Each has three Legends and **27 main-deck cards**, plus reference cards. The Heist demo has 15 distinct identities and Embracing Power has 14. They are smaller demo decks, not legal 40–50-card constructed starter templates. Do not substitute either PDF for the requested retail starter list. [Heist demo PDF](https://cyberpunktcg.com/docs/print-and-play-mercs.pdf), [Embracing Power demo PDF](https://cyberpunktcg.com/docs/print-and-play-araska.pdf).

Their counted contents and PDF checksums are in [demo-decks.json](demo-decks.json). **Resolved 2026-09-06:** the publisher's [August 21 full starter-deck lists](https://cyberpunktcg.com/blog/wnc-starter-decks) provide all quantities for both 40-card constructed starters. They match the supplied Heist fixture. Production templates and provenance are in `packages/decks/starters.json`; legality and independent-copy tests are in `tests/scenarios/versions.test.ts`. The smaller demo lists remain separate.

## Completion boundary

Completed: source discovery, complete current API inventory, numbered-rule review, card-text review, FAQ review, targeted image checks, demo-PDF counts, import-fixture mapping, and a multiplayer decision register.

The [implementation plan](../../IMPLEMENTATION_PLAN.md) schedules official-source conflict resolution, remaining multiplayer decisions, gameplay-data verification/correction, and official constructed starter quantities as explicit gates for affected work and release. Foundations may proceed before full certification. Current implementation tests and release gaps are tracked in `PROGRESS.md` and `implementation-coverage.json`; the original source inventory is not the implementation-status authority.

## Implementation verification added 2026-09-06

See [card-reviews.json](card-reviews.json) for all 17 manually reviewed Gear textbox layouts and numeric values. All candidate renderings are pinned with hashes in [the image manifest](evidence/card-image-manifest.json). Local OCR results in `evidence/card-ocr.json` support comparison; they do not certify abilities. The production catalog now distinguishes intrinsic Gear text, inherited text, reminder text and flavor.

Kiroshi Optics' printed equip reminder differs in wording from the API. Reminder text is not effect text and does not change gameplay (3.18.1.2.2.1); normal friendly equip eligibility remains in force.


The official FAQ also supplies regression expectations for first-event limits (Jackie and Yorinobu), Goro's trigger-time condition, zero adjustments, a single Meredith trigger for a swap, and defeat replacement sequencing. Focused assertions are in `tests/scenarios/timing.test.ts` and `tests/scenarios/mechanics.test.ts`. These checks do not settle the unrelated source conflicts above.
