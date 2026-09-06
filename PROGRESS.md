# Implementation progress

Updated September 6, 2026. Execution of the full plan is continuing. The repository is a runnable playtest application; it is not yet a certified full-roster release or a deployed service.

## Current milestone assessment

| Milestone | Evidence and remaining work |
| --- | --- |
| M0 foundations | React/Vite/TypeScript application, shared domain modules, Vercel API, reproducible build, formatting check, scenario/browser/SQL tests and CI. |
| M1 authority and identity | Five-seat authorization, revision races, deduplication, connection replacement, encrypted recovery and two retained runtimes tested. Real PostgreSQL integration and restart persistence pass. OAuth uses PKCE with a mocked provider; the actual Discord application and Vercel deployment remain unverified. |
| M2 catalog | 150 candidate identities with pinned official images, printing metadata, both official constructed starters, 17 Gear layout reviews and explicit Legend zero-power corrections. All 150 printed stat baselines are reviewed; 142 identities have linked clause outcome evidence. Eight disputed identities and shared source rulings remain uncertified. |
| M3 deck builder | Anonymous local CRUD, search/filters, paste/file import, export, invalid drafts, duplicate aggregation, official starter templates and cross-tab selected-deck readiness reset implemented and tested. |
| M4 engine | Two- through five-player setup, turns, combat/reactions, effect batches, choices, Rival selection, overtime, Sudden Death and elimination implemented. Specific unresolved rulings and complete interaction validation remain. |
| M5 accounts/lobbies | Public/unlisted tables, readiness, deck validation, persistent host blocks, host succession, reconnection and authority races tested. Live Discord login still needs configuration and provider verification. |
| M6 board | Five-player board, private projections, action log, card inspection and required-input controls implemented. All 12 core journeys pass in Chromium, Firefox and WebKit. A subsequent five-player disconnect/presence refresh journey also passes in all three. Actual Safari automation requires the owner's device setting. |
| M7 persistence | Rolling autosaves, separate manual snapshots, import/export, retained encryption keys, compressed save format with legacy decoding, generation-aware cross-tab writes and archived engine dispatch implemented. Historical manual snapshots must create a separate continuation (approved September 6); implementation remains outstanding. |
| M8 roster completion | Explicit scripts and keyword/stat treatment exist for the candidate roster. Smoke execution covers alternate choices, but cannot certify every ability. 142/150 identities have linked baseline and clause outcome evidence; the remaining eight are explicitly stats-only reviews. |
| M9 operations | Vercel configuration, migrations, recovery instructions and local 100-player SQL measurements exist. Deployed acceptance, live costs, actual Safari and full release certification remain open. |

## Changes during continued execution

- Verified the publisher's August 21 full starter lists. Heist and Embracing Power each contain three Legends and 40 main-deck cards; both copy into independent editable decks.
- Archived the original `2026-09-05.playtest.1` engine, catalog and validator as a self-contained checksummed bundle. Current runtime is `2026-09-06.playtest.2`; projections and commands dispatch through the pinned version.
- Captured 150 non-expiring local image assets with hashes and supporting OCR. Manually checked all 17 Gear textboxes, four flavor-only Units, and the 17 additional Legends whose API power was missing. With Alt, 18 specific image-backed corrections preserve printed **0** separately from null cost.
- Corrected keyword extraction so a reference to Blocker/Adrenaline in an effect does not grant it to the source. Gear inheritance uses the bottom textbox.
- Unified combat and effect-based theft with mandatory prevention, optional Alt choices, controller/Unit attribution and simultaneous dice movement.
- Corrected Saul/Viktor stacking, Synapse Burnout's dynamic fight bonus, Viktor's equip restriction, Maman's exact optional discard, mandatory public-trash retrieval, invalid Gear activation/equip, MaxTac Heavy's chosen-Rival cost and bottom-deck group shuffling.
- Corrected defeat replacement eligibility, mandatory-before-optional ordering and rechecking replacement actions without repeating the same replacement. Added focused outcome tests.
- Normal sales now record the required public reveal; private zone movements and private choices retain their visibility restrictions.
- Split heartbeats from large match documents. Polls omit private random streams; checkpoint reads no longer rewrite games. Restoration hydrates current presence before deciding whether a match is unattended. Existing databases need the updated migration.
- Added cross-tab deck notifications, invalid selected-deck clearing, transactional generation/revision autosave ordering, strict file metadata validation and compressed authenticated saves. Legacy uncompressed saves remain readable.
- Added a native modal card inspector for keyboard focus containment and Escape dismissal.

## Validation evidence

- Aggregate scenario/integration run: **1,132 tests passed in 43 files** on September 6, including all printed baselines, per-card outcomes, authority, saves, structured history and paging.
- Browser acceptance: **12 checks passed** across Chromium, Firefox and WebKit: anonymous deck/lobby journey, five independent players advancing setup/turns and saving, concurrent cross-tab autosaves, and deck edits clearing readiness in another tab. WebKit tracing is disabled because recording five pages caused excessive test overhead.
- Real PostgreSQL 18.4: **7 service/OAuth integration tests passed**. Restarting the disposable database retained five authoritative room records. This is distinct from PGlite and from hosted-provider verification.
- Local PostgreSQL 100-player burst polls: twenty five-player tables **2,603 ms p95**, fifty two-player tables **1,970 ms p95**; 300 successful requests per configuration. See `docs/operations/local-postgres-load-results.json`. This excludes HTTP, Vercel, hosted network latency, cold starts and browser rendering.
- Earlier PGlite burst results are retained in `docs/operations/local-load-results.json`; they are not production latency or capacity guarantees.
- Card inventory now records text clauses, data fingerprints, image reviews and test references separately. All 150 stat baselines and 142 identities’ clause outcomes have linked evidence. Eight disputed identities remain uncertified; `check:release` continues to fail deliberately.

## Pending decisions and configuration

September 6 answers approved separate historical continuations, setup penalties and concession restrictions. See [BLOCKERS.md](BLOCKERS.md) for the current handoff and setup instructions. Other recommended options remain unapproved.

- Resolve the provisional handling of the official-source conflicts listed in the audit; setup defaults were answered on September 6.
- Implement the approved separate continuation for historical manual snapshots. Current behavior rejoins a connected game or resumes the latest unattended state; it does not yet create the requested branch.
- Block concessions while effects process (approved). Decide remaining instructions when the controller decks out during resolution; official rule 1.14 explicitly permits this case.
- Apply approved join-order setup: selected first player starts the cycle; in 3–5-player matches first/second players start with two/one spent Legends respectively; retain official two-player setup.
- User has neither Discord OAuth application nor PostgreSQL database yet; provide setup guidance.
- Resolve the concrete conditional scope of Towerfall and Bonnie and Clyde without changing the approved general Rival law.
- Configure Discord, a hosted PostgreSQL database, stable save keys and a linked Vercel project. No project `.env` or `.vercel/project.json` was found; no production credentials were printed, infrastructure provisioned or deployment claimed.
- The installed Vercel CLI is authenticated. Read-only project listing found no existing Cyberpunk application project; unrelated projects were not modified.
- Enable Safari's **Allow remote automation** setting for actual Safari validation, or leave that acceptance check pending.

The original full-roster scope remains unchanged. Passing handler execution, local SQL or browser journeys does not close unresolved rules decisions or certify the complete release.


### Subsequent verification

Eight deterministic complete starter matches now pass (two random inputs at each of 2/3/4/5 players), exercising actual plays, attacks and pending choices. They exposed and now cover an active-player deck-out deadlock during main-phase effects. After resolution finishes, the engine advances that eliminated player's turn automatically.

Further FAQ checks corrected first-event accounting across face-down Legends, per-turn counters for off-turn players, Goro's declaration-time condition, zero-adjustment and single-swap trigger semantics, mandatory Eddie readiness and hidden Eddie labels. The final aggregate run must include these new timing scenarios.


### Large-history and continued card checks

The extended local PostgreSQL run passed 100 simultaneous reconnects for each configuration, rejected all replaced connections, committed 200/500 actions, created 100 encrypted snapshots with 10,000 synthetic log entries per table, and served 100 concurrent anonymous directory requests. Snapshot p95 was 5.2/9.0 seconds; conditional polls that included full presence refreshes reached 11.4/9.2 seconds. These are synthetic in-process measurements under local development load, not hosted acceptance. The before-presence-patch report is retained separately.

Snapshot reads now coalesce concurrent work and compress asynchronously; directory reads coalesce concurrent requests. Unchanged room polls fetch metadata without transferring the full game document. A subsequent compatible presence-only protocol sends connection/waiting updates without retransmitting the action history when the revision is unchanged; its load results remain to be recorded. Every snapshot/poll still checks seat authority.

The card inspector now contains keyboard focus and restores focus to its invoker in WebKit. A transient WebKit development-login assertion passed on focused rerun; the test now waits for authentication completion. Browser quota-failure recovery supports exporting directly to a file and retrying the rolling autosave.

Conceding during a defensive reaction no longer leaves the match awaiting the eliminated player: attacks against removed Units end, while attacks against abandoned Gigs continue. Two focused lifecycle tests pass. Setup-time concessions remain an unresolved edge case alongside the pending setup policy.


### Presence protocol and delayed effects

The updated extended PostgreSQL fixture explicitly exercises stale-presence refreshes. All 600 conditional polls passed: five-seat p95 **907 ms**, two-seat p95 **665 ms**; 290 responses carried presence patches and 310 were unchanged. Payload totals were about 120 KB and 55 KB per 300 requests. Snapshot p95 was **3.0/5.8 seconds**. Local load varies; the reports are evidence of these fixtures, not production guarantees. The previous full-history presence results remain in `local-postgres-extended-before-presence.json`.

All three browser engines passed an additional actual disconnect/reconnect journey: the disconnected status updates while the active player's board remains usable, then clears on reconnect. Save-quota export and retry remain included.

Dying Night's end-of-turn readiness is now a serialized delayed effect created by its attack trigger. It survives bearer defeat and save/restore, supports independent repeated attacks in the owner's batch, and is canceled on controller elimination. It no longer readies Eddies merely because the Gear is attached at turn end. Five focused tests pass, including the publisher's FAQ examples.

### Continued Program and Unit outcome audit

The aggregate suite passed **774 tests in 22 files** before the latest Program scenarios. Control Programs add 22 passing cases, advanced removal 17, search/retrieval 20, and modal Programs 10. Type checking and formatting passed after these additions. The current evidence inventory links **57 of 150** card identities; this is not full-roster certification.

Further implementation corrections preserve the public marker on known face-down Legends without exposing their identities to Rivals, allow Nocturne to select an anonymous face-down Legend and retain its Go Solo discount when Called, and prevent an attacked Unit from using Blocker to redirect its own attack. The board now receives a legal-blocker list so it only offers that action to eligible Units.

Pyramid Song has another source conflict: the pinned official image shows −4 power, while structured card text says −5. RULE-PYRAMID records it alongside RULE-SAFETY; no source-precedence decision has been assumed. All seventeen Gear cards have linked outcome evidence. Gorilla Arms now tracks the bearer's first theft, including late equipment and moving Gear between bearers; face-up Go Solo Legends count for Synapse Burnout, Berserk, Panam, and MaxTac Squadron.

Presence patches are scoped to both game generation and revision. The browser accepts a restored game with a newer generation and lower revision, and rejects delayed responses from older generations. The enhanced five-player journey passed in Chromium and Firefox; WebKit passed on focused rerun after a transient GET connection reset. Fixture GETs now allow a limited transport retry; mutations are not retried automatically.

### Starter Legend and action validation corrections

The next aggregate run passed **893 tests in 29 files**, with build and lint passing. Nine additional Unit reviews and three Heist Legend reviews bring the evidence inventory to **77 card identities**. Kerry can now spend without an 8+ Gig and draws only when qualified, matching the explicit FAQ.

The Legend review exposed missing normal-play behavior and an action validation hole. Normal Legend play now preserves orientation and enters with Lag; Go Solo remains a separate action and is restricted to face-up Legends with that keyword. Ordinary cards in hand cannot use a forged Go Solo command. Attached Gear follows its Legend into the field, and free Gear selectors exclude other attached Gear as hosts. The board offers the normal-play alternative, with runtime capabilities preventing that new action from being offered on the immutable earlier runtime. Focused action/runtime tests are being completed after this latest change.


### Expanded roster audit and structured history

The full regression suite passed **1,122 tests in 42 files** after structured action history was added; formatting and type checks passed. An additional stats-only review suite and catalog checks passed **10 focused tests**. All 150 official card images have now been manually inspected for printed stats. **142 identities** have linked clause outcome evidence. Bonnie and Clyde, Towerfall, Pyramid Song, Safety Override, V — Streetkid, Johnny — Rocking Renegade, River Ward and Flathead remain uncertified pending their recorded rulings. Pyramid Song's image/text discrepancy is explicitly retained, not silently reconciled.

Further outcome checks fixed Misty's Legend prediction option, Sandayu's mandatory target count and Steel Dragon's first-Arasaka-defeat accounting when it enters after an earlier defeat. Normal Legend play and Gear controls passed the five-player Chromium/Firefox/WebKit journey. The browser command now builds the current client automatically.

History now records typed events with captured names, turn numbers and explicit public/seat permissions. Authorized projections render from those records; legacy text histories remain readable. New records include attack declarations, blocks, activation sources, defender passes, combat power/results and turn boundaries. Private identities and choice selections remain seat-scoped. Encrypted save round trips and legacy rendering are tested.

`npm run check:deploy` validates environment configuration without printing values; `-- --database` adds a read-only table check. The current checkout fails the configuration check because all six required production variables are absent. No credentials, infrastructure or deployment have been invented. The complete twelve-journey browser rerun passed in Chromium, Firefox and WebKit (4.6 minutes). The updated structured-history PostgreSQL load fixture passed with 10,000 entries per table, one third private. Command p95 was 1.55/2.60 seconds and snapshot p95 7.54/14.23 seconds in the 20 tables of five players / 50 tables of two players configurations. These remain local burst measurements, not hosted targets.

History paging subsequently bounded normal board projections to 200 authorized entries while preserving complete saves. Eight focused log tests and five service tests pass, including no gaps, private-entry exclusion, generation metadata, malformed cursors and replaced-connection rejection. The seven real-PostgreSQL/OAuth tests and restart recovery also pass with this endpoint. History paging now passes in Chromium, Firefox and WebKit.

The final aggregate after history paging passed **1,132 tests in 43 files**. Production build, type checking and formatting pass. The corrected five-player history-paging journey passes in all three browser engines. The test now includes entry-number prefixes in text matching and waits for intercepted requests during route cleanup; Firefox passed its focused rerun in 47.6 seconds.
