# Cyberpunk TCG Online — Implementation Plan

Status: Playtest implementation in progress; see PROGRESS.md for implemented work, validation evidence, and remaining release gates.  
Version: 1.0  
Created: 2026-09-05  
Requirements baseline: [PRD.md](PRD.md), version 0.31 (gameplay decisions unchanged from 0.30).

## 1. Outcome and execution policy

Deliver a desktop/laptop browser application for fully enforced Cyberpunk TCG free-for-all matches with two to five players. Include Discord identity, anonymous deck building and table browsing, public and unlisted tables, browser-local decks, reconnecting, and protected local saved-game export/import. The first release must cover every gameplay identity sufficiently defined by official information published by September 5, 2026.

The PRD remains the requirements authority. Approved entries in the [multiplayer register](docs/rules-audit/MULTIPLAYER.md) govern multiplayer behavior. Proposals in that register are not automatically approved by this plan. Architecture choices below are implementation recommendations to validate, not new gameplay decisions.

Implement in reviewable increments. Each milestone finishes with runnable evidence and an updated coverage/decision record. Small card subsets are internal integration checkpoints only: neither a two-player-only build nor a partial rules engine satisfies the first release. Do not replace unsupported effects with manual controls.

This plan does not create infrastructure, register Discord credentials, or deploy the application. Those are scheduled implementation steps. No completion dates or cost guarantees are asserted before the initial technical experiments and card certification.

## 2. Starting point and first work

The repository contains the PRD, captured official sources, audit indexes, and an offline Python audit script. There is no application, production card catalog, rules engine, or application test suite yet.

The audit reconciles 151 catalog identities and 460 printings. Rebecca — Having a Moment is deferred because gameplay was unrevealed at the cutoff. The remaining 150 identities are candidates, not yet a certified complete dataset. Existing source defects, FAQ conflicts, and unverified retail starter quantities are documented in the [audit](docs/rules-audit/README.md).

Start with these tasks:

1. Establish the workspace, CI, shared schemas, and an empty browser shell (M0).
2. Prove serialized authoritative commands and protected save restoration using synthetic fixtures (M1).
3. Certify the data and settle decisions needed by each engine subsystem (M2, continuing alongside independent work).
4. Deliver the anonymous deck builder and headless engine foundations (M3 and M4).

Do not wait for every card ruling to build local storage, catalog browsing, transport contracts, or a synthetic authority experiment. Do not guess a disputed ruling to make its card appear complete.

## 3. Recommended architecture

### Components

| Component | Initial choice | Reason and validation required |
| --- | --- | --- |
| Browser application | TypeScript, React, Vite; semantic HTML and CSS | A client-heavy game and local deck builder do not require server rendering. Keep the frontend deployable as static assets on Vercel. Pin supported versions during M0. |
| Workspace | npm workspaces, one lockfile | Share domain types and validation without introducing a separate build orchestration service. |
| Game engine | Pure TypeScript package with explicit effect handlers | Run the same tested rules in the authority and test harness. Keep storage, networking, UI, and wall-clock access outside the engine. |
| Match authority | Cloudflare Worker routing to one SQLite-backed Durable Object per table/match | Co-locate ordered match processing and active-state storage. Prove concurrency, restart behavior, and old-version dispatch in M1. |
| Live transport | Authenticated WebSockets with revision-based resynchronization | Send commands and per-seat projections. Treat connections as replaceable; correctness must not depend on a socket staying open. |
| Shared records | Cloudflare D1 | Store accounts, sessions, host block lists, public directory metadata, and match routing records. The match authority remains responsible for seat admission and game-state truth. |
| Browser storage | IndexedDB behind a small repository interface | Store one shared deck library, rolling autosaves, and separate manual snapshots. Use schema migrations and transactional updates. |
| Authentication | Discord authorization code flow through the API; secure application sessions | Use stable Discord IDs and the minimum `identify` scope. Select a maintained OAuth helper in M1; do not implement cryptographic primitives. |
| Validation | Runtime schemas at network and file boundaries; shared deck legality rules | Reject malformed or unauthorized inputs before applying game commands. Client checks improve feedback; server checks authorize play. |
| Verification | Unit/scenario tests, property-based invariants, browser automation, scripted load clients | Exercise rule outcomes, information visibility, multi-client races, and browser workflows separately. Select and pin test tooling in M0. |

Cloudflare documents Durable Objects as compute with associated storage, and provides WebSocket hibernation to reduce idle duration charges. This makes it a promising fit for turn-based rooms; actual cost and latency must be measured. Hibernation requires persisted state rather than reliance on in-memory fields. [Durable Objects overview](https://developers.cloudflare.com/durable-objects/), [WebSocket guidance](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

D1 provides managed SQL storage suitable for the proposed shared records. Keep directory updates separate from authoritative command commits; reconcile stale listings rather than assuming a cross-service transaction. [D1 documentation](https://developers.cloudflare.com/d1/).

Discord supports authorization code login and the `identify` scope for basic identity. Authenticate through the service, exchange codes server-side, validate OAuth state, and issue application sessions; Discord is not a game-state store. [Discord OAuth2 documentation](https://docs.discord.com/developers/topics/oauth2).

### Hosting alternatives and selection gate

Prefer Vercel for the frontend. Compare the recommended Cloudflare backend against Vercel Functions with external transactional storage and coordination, and against a small persistent application server with a database. Compare total operating effort as well as service charges.

As checked on September 5, 2026, Vercel documents WebSocket support in beta. Connections close at function duration limits, reconnects can reach different instances, and durable state/coordination must live outside function memory. Vercel-only compute is therefore a viable candidate requiring a different authority/persistence design, not something to reject using the older claim that Vercel cannot serve WebSockets. [Vercel WebSocket documentation](https://vercel.com/docs/functions/websockets).

M1 must produce an architecture decision record choosing the runtime, storage, authentication boundary, and deployment layout after a small experiment. A failed experiment changes infrastructure adapters, not the gameplay model. Do not build and maintain three production backends.

### Proposed repository layout

```text
apps/web/                 Browser shell, deck builder, lobby, board, save library
apps/service/             OAuth/session endpoints, directory API, match authority
packages/catalog/         Normalized identities, printings, corrections, release manifests
packages/engine/          State machine, legal actions, timing, effects, projections
packages/protocol/        Commands, responses, schemas, version negotiation
packages/decks/           Text format, identity resolution, construction validation
packages/saves/           Envelope schemas and browser/server save interfaces
tests/scenarios/          Rules, card interactions, deterministic replay fixtures
tests/integration/        Authority, account, storage, reconnect and restoration tests
tests/e2e/                Multi-browser user journeys
tests/load/               Concurrent tables, reconnect storms, payload measurements
docs/architecture/        Decisions, persistence design, compatibility strategy
docs/operations/          Deployment, recovery, keys, cost and release evidence
docs/rules-audit/         Existing preserved sources, rulings and coverage evidence
```

These paths are planned deliverables, not files already implemented. Keep the current raw source captures immutable; corrections belong in a reviewed layer.

## 4. State, authority, and information boundaries

### Deterministic rules kernel

Represent card identity separately from physical card instances and printings. Track owner and controller separately. State includes ordered seats, zones, deck order, face-down information, card statuses, Gig identity/value/controller, fixer dice, resource values including null where meaningful, turn/phase, attacks, pending effects, decision prompts, durations, victory eligibility, and turn eligibility.

Use an interface conceptually equivalent to `applyCommand(state, command, randomInput) -> transition`. A transition contains the next state, domain events, and any required choices. Represent suspended resolution with serializable frames and explicit decision IDs, not closures or an in-memory JavaScript call stack. This allows a save at a choice boundary to resume exactly.

The authority generates randomness. Retain the resolved random outcomes and any necessary private generator state for deterministic recovery; never expose a seed that predicts future hidden draws or rolls. A rejected command must not spend resources, advance randomness, or partially mutate state.

The effect scheduler implements RULE-14: current turn player's batch first, player-chosen ordering within a full batch including new effects, then cyclic batches until none remain. Retain the batch holder when their new effects appear. Sudden Death players who lack turns still receive pending-effect batches. Do not implement a generic last-in-first-out stack.

Represent each effect instance with a source identity, controller, trigger/event context, selected Rival binding, targets, and progress. RULE-15–RULE-17 require distinct bindings per trigger, qualification by the actual Rival receiving a conditional action, event triggers for any qualifying Rival, and multi-player targets only where wording permits. Target-selection timing and revalidation follow the eventual resolution of the official timing conflict.

### Authoritative command processing

Every game command carries a protocol version, match ID, match generation, command ID, expected revision, and decision ID where applicable. Derive the acting account from the authenticated connection; do not trust a client-supplied seat identity.

Serialize match commands and atomically persist the resulting revision, state/events, and deduplication result before acknowledging acceptance. Duplicate commands return their original outcome. Stale commands receive a resynchronization response. External directory publication may retry after the authoritative commit. No request may hold an unlocked mutable state reference across asynchronous work.

Maintain a connection generation per seat. Reclaiming the seat atomically replaces the previous generation so delayed messages from the older connection cannot act. Check seat authority on every command, not only at socket connection time.

### Per-player views and logs

Generate a projection for each authenticated seat. Expose public board information and only that player's permitted private information. Public directory responses contain the agreed table fields, not decks, hands, logs, or unlisted tables. No spectator endpoint may return match state.

Store structured action events with explicit visibility, rather than a preformatted global transcript. Render each player's history from those permissions and preserve knowledge legitimately revealed earlier. Network patches, reconnect snapshots, errors, telemetry, and debug logs must use the same information boundary. Hidden hands and deck order must never be sent in plaintext to other players merely to simplify rendering.

## 5. Persistence and restoration design

Separate four concerns:

| Data | Storage and lifecycle |
| --- | --- |
| Reusable decks | Browser-local IndexedDB, shared across guest and logged-in use; no account cloud library. |
| Account/session/block records | Shared service storage, so identity and host blocks work across browsers. |
| Active match authority | Durable service state for serialized commands, abrupt disconnections, and process restarts. Retention policy is a decision gate. |
| Saved games | Protected copies in every participant's browser, with file export/import and no application-imposed expiry. Manual snapshots remain separate from rolling autosaves. |

Persisting active match state is an implementation dependency, not a decision to offer a cloud saved-game library. Document its retention and cleanup explicitly before completing M7.

### Proposed protected save envelope

Use a versioned, authenticated-encryption envelope sealed by the authority, containing the complete restorable state and action history. Bind match identity, participant IDs, revision, generation, rules/catalog/engine versions, and key ID to the authenticated envelope. Use a reviewed standard cryptographic implementation and server-managed keys. A shared plaintext save or a signature alone does not protect opponents' hidden information.

Browsers store and export the opaque envelope. Display only safe metadata; obtain authorized game views from the service. Save-file possession never grants seat ownership. Reject altered files, unsupported schemas, oversized payloads, and mismatched participant/version metadata before restoring any state. This design requires the service to resume a game; offline play is not in scope.

Issue rolling checkpoints after durable transitions and distribute them to connected participants. Record the latest locally persisted revision, retry missed updates, and resynchronize a returning browser before replacing its local autosave. Disconnected browsers cannot receive new revisions. Never claim a snapshot is stored locally until its IndexedDB transaction succeeds; surface quota or write failures and provide export recovery.

A manual save captures a specific committed revision without pausing the match, including pending choices where present. Later progress must not modify that snapshot. Deleting a file removes only the local copy. Keep the full action log logically intact; segmentation/compression may reduce repeated transfers but cannot discard required history.

### Restore protocol

1. Authenticate the importing participant through Discord and verify/decrypt the envelope server-side.
2. Resolve the pinned rules, catalog, effect implementation, and save schema before creating a resumable room.
3. Use the match's single authority to check for an existing live/restoring generation. Concurrent imports must converge on one active restoration.
4. Compare revisions and apply the explicitly selected historical-snapshot policy. A stale snapshot must not silently replace a newer live match.
5. Reconstruct original seat ownership and gather all non-eliminated players. Show the selected snapshot and clear readiness whenever the restoration candidate changes.
6. Resume only after every non-eliminated player is connected and ready, including players without Sudden Death turns. Eliminated players need not return.
7. Start a new connection generation, synchronize authorized views, and distribute current protected checkpoints.

M1 must prove the save format and M7 must complete the restore lifecycle. Long-lived saves require retaining decryption keys and executable old rules versions, not just JSON migration. Version engine behavior independently of the latest app; archive tested bundles/manifests and maintain a compatibility dispatch path. Key rotation must retain a recovery path for previous files. Never expire a valid local save because a routine deployment removed its rules implementation.

## 6. Decision gates

Resolve these at their point of need. Research official behavior first; ask the user only for remaining product or multiplayer choices. Record decisions in the PRD/register with examples. Unrelated milestones may continue.

| Gate | Remaining decision or evidence | Blocks |
| --- | --- | --- |
| D1 — Official baseline | Resolve audit conflicts concerning sales, V, discounts, target timing, Legend timing, Flathead, River, null/zero interpretation, and teaching-guide discrepancies. Fix image/API differences and certify the cutoff roster and retail starter quantities. | Affected engine handlers and starter templates; full-roster release. |
| D2 — Multiplayer setup and wording | Finalize initial seating/starting player, mulligan order and first-player penalty, remaining MP-01/MP-06/MP-09 proposals, global effects, cost calculations, forced attacks, and card-specific theft/prevention scope. Already approved Rival and batching policies stay fixed. | Corresponding setup and card scenarios. |
| D3 — Elimination and round boundaries | Resolve an already-resolving effect when its controller is eliminated, mixed card ownership/control cleanup, simultaneous losses, overtime cycle tracking across elimination, and remaining Sudden Death boundary cases. | Complete lifecycle and affected global effects. |
| D4 — Choices and conflicting actions | Resolve multi-player choices within one effect, trigger/target timing conflicts, and any mandatory effect loop with no normal exit. Preserve effect atomicity and no automatic player choices on disconnect. | Relevant timing handlers; no arbitrary timeout may become a game result. |
| D5 — Lobby lifecycle | Gig-setting readiness resets, warning for unreachable custom target, incoming host's blocks against already-seated lobby players, all-disconnected host succession, join-code lifetime/revocation, and remaining host permissions. | Final lobby behavior. |
| D6 — Saves and abandonment | Historical manual snapshot restore versus latest progress, duplicate generation policy, discovery of restored rooms, active-state retention, abandoned room cleanup, and whether an active match recreates a locally deleted autosave. No expiry of retained user saves or automatic forfeit. | Production restoration and cleanup. |
| D7 — Identity lifecycle | Session duration/renewal, account deletion and its effect on retained seats, blocks, and saved-game identity. | Production account lifecycle; basic identity work can proceed. |
| D8 — Service and interface targets | Hosting selection/cost estimate, viewport/accessibility targets, reconnect/latency measurements, operational retention, and reference functionality walkthrough. | Release criteria and deployment configuration. |

The reference simulator previously returned HTTP 403. Retry ordinary access during UI work; if it remains unavailable, record the limitation and base flows on the approved PRD. Do not claim unverified feature parity or let an unavailable reference block already specified features.

## 7. Milestones

### M0 — Workspace and executable foundation

Dependencies: none. Requirements: foundations for all PRD areas.

- Create the proposed workspace and browser shell; document local setup and environment variables without secrets.
- Add build, typecheck, lint, unit-test, and browser-test entry points and CI. Lock package/runtime versions after verifying current supported versions.
- Define initial card, deck, command, projection, and save schemas with explicit version fields.
- Preserve/reproduce the existing audit and distinguish generated data from manually reviewed corrections.
- Document the module dependency direction: UI and service depend on domain packages; the engine depends on neither runtime.

Exit evidence: clean checkout can install, build, run the shell, and pass a small meaningful schema/rejection test. No claim of gameplay support.

### M1 — Authority, identity, and save feasibility experiments

Dependencies: M0. Gates: choose D8 architecture; identify D6 constraints.

- Use synthetic match fixtures to demonstrate five clients, serialized commands, conflicting revisions, deduplication, and durable restart recovery.
- Exercise WebSocket reconnection/hibernation and replacement of an older seat connection.
- Implement an OAuth/session proof with an isolated test configuration; demonstrate one stable account across login/name changes and server-side identity checks.
- Seal/export/import a fixture containing hidden data and a pending decision. Show that an authorized original participant can initiate restoration while a modified file or unrelated account cannot.
- Prove server-side decryption after key rotation and dispatch to two different rules-version fixtures after a deployment.
- Record deployment topology, session/cookie/CORS/CSRF boundaries, socket authentication, storage transaction boundaries, rollback strategy, and measured costs/limits in architecture records.

Exit evidence: fault-injection results and an architecture decision. If a provider cannot preserve authority and old saves reliably, change the adapter now. Provider credentials are needed for deployed experiments; local experiments and document work proceed independently.

### M2 — Certified catalog and rules specification

Dependencies: M0 for production schemas; existing audit work is reusable. Gates: D1–D4 as applicable.

- Normalize stable gameplay IDs and printing metadata. Preserve collector prefixes/leading zeros, distinguish null from zero, separate flavor/reminder text, and annotate all Gear text ownership.
- Verify every candidate's gameplay fields against sufficient official evidence, applying errata and a sourced correction layer. Avoid requiring redundant image review of identical artwork variants unless text differs.
- Reconcile all official-source conflicts with sourced decisions or explicitly agreed provisional rulings. Record affected cards and tests.
- Obtain verified official starter quantities. Keep the Heist user fixture and 27-card demos distinct from certified constructed starter templates.
- Produce a versioned catalog/rules/multiplayer manifest and an asset manifest that does not depend on expiring source URLs.
- Extend card coverage to track every ability, rules/FAQ references, multiplayer cases, implementation location, test location, and unresolved blocker. Preserve reviewed evidence when regenerating audit indexes.

Exit evidence: certified roster manifest with every inclusion/exclusion justified, legal official starter templates, and resolved rulings for the behavior being released. Engine work may consume verified subsets before complete certification, but M8 cannot finish on subsets.

### M3 — Anonymous deck builder

Dependencies: M0; verified catalog portions from M2. Requirements: DATA-01–DATA-03, DECK-01–DECK-15, AUTH-08, UI-01/UI-05/UI-08.

- Implement create, name, rename, duplicate, edit, delete, save and reopen in a single browser-local library, unchanged by login/logout.
- Provide name/rules-text search and type, cost, tags, color, and set filters. Separate printing selection from gameplay copy limits.
- Implement paste, file import, and text export using the supplied Name/Legends/Main Deck format. Preserve Unicode, collector numbers, section distinctions, and quantities.
- Resolve number/name pairs through printing metadata; present explicit ambiguity/errors rather than silently choosing the wrong card. Retain unresolved lines in editable drafts.
- Combine duplicate gameplay identities within each section, then validate construction. Show actionable errors while retaining invalid drafts.
- Copy verified official starters into independent editable decks. Keep unknown starter quantities blocked until M2 provides evidence.

Exit evidence: exact Heist fixture import through both paths, semantic export/reimport, duplicates/ambiguous numbers/invalid entries, RAM and copy-limit failures, independent duplication, reload persistence, and one library across account changes. An invalid unrelated draft must not block a legal selected deck.

### M4 — Headless game engine and multiplayer lifecycle

Dependencies: M0, M1 contracts, verified M2 behavior. Gates: D1–D4 per subsystem. Requirements: RULE-01–RULE-17, DATA-05/DATA-06.

- Implement setup, zones, resource calculations, turn phases, die roll-in, draw/deck-out, main actions, costs, sale rules, and attack/defender reaction sequencing.
- Implement resumable choices, replacement effects, inherited Gear effects, continuous modifiers, last-known information, durations, and official-style batches.
- Implement effect-instance Rival bindings, qualifying-Rival checks, event identity, and text-scoped multi-target selection.
- Implement dynamic lobby Gig modes and locked match targets; normal victory checks and full-cycle overtime; repeated Sudden Death rounds with separate turn/victory eligibility.
- Implement elimination cleanup without cleanup triggers, pending/lingering effect cancellation, rolled/abandoned Gig retention, and skipped-position expiry. Finish only the unresolved details after their gates close.
- Expose legal commands and structured choice options for UI use without leaking private state.

Exit evidence: headless complete matches at 2/3/4/5 players with an internal verified card subset; deterministic scenarios for all agreed lifecycle rules; illegal actions leave state unchanged. This is an integration checkpoint, not the release roster.

### M5 — Accounts, public/private lobbies, and live authority

Dependencies: M1, M3 legality, M4 integration slice. Gates: D5 and D7. Requirements: AUTH-01–AUTH-10, TABLE-01–TABLE-16, REC-01–REC-03/REC-07/REC-13/REC-16.

- Complete Discord login/logout, stable account-seat mapping, secure sessions, and early optional login UI. Require login only for authenticated actions.
- Implement anonymous public listings with the agreed fields/filters, unlisted room URL/code entry, and authoritative seat admission with capacity race handling.
- Validate submitted decks on the server; pin a selected deck revision/hash. Reset readiness on selected-deck edits or switches, and revalidate all seats atomically at start.
- Require every seated player ready and legal; allow starting below capacity with 2–5 seats. Freeze decks/rules/target at start and reject new mid-game joins.
- Implement pregame kicks, persistent host-owned block management, oldest-connected host succession, and only the incoming host's block list for subsequent admissions.
- Integrate ordered game commands, per-seat snapshots/updates, stale-state recovery, disconnect dependency detection, and connection replacement. No missing optional reaction may be silently declined.

Exit evidence: multi-client lobby/start races, public/private entry paths, unauthorized requests, block behavior across hosts/browsers, and uninterrupted play until an absent player's input is required. Ongoing-match host permissions cannot remove seats or rewrite state.

### M6 — Usable two- through five-player board

Dependencies: M4 and M5. Gates: relevant D8 UI choices. Requirements: UI-01–UI-08, RULE-04/RULE-05.

- Build a utilitarian board with consistent seat order, readable Gig areas and counts, inspectable cards, current phase/actor, and a clear required-input panel.
- Support legal action selection, costs, target selection across players, Rival binding/eligibility explanations, defender reactions, and effect ordering. Server-confirmed state drives board changes.
- Keep hidden areas private; expose clear public information for disconnected, eliminated, and turn-ineligible players.
- Render the authorized game action log and connection/save status. Provide no spectator or chat workflow.
- Support keyboard operation and visible focus for core journeys; never rely on color or hover alone to communicate legal actions. Validate the chosen desktop viewport and five-player density in all target browsers.

Exit evidence: users can complete a five-player internal match and understand every outstanding decision. Verify ordinary two-player layout as well as crowded five-player boards. Use automated browser tests plus actual stable Safari checks; a WebKit automation pass alone is not Safari certification.

### M7 — Complete local saves, reconnecting, and restoration

Dependencies: M1, M4–M6. Gate: D6 and relevant D7 retention decisions. Requirements: REC-01–REC-20, DATA-05.

- Integrate protected rolling autosaves in every connected participant's browser, separate manual snapshots, local deletion, file export/import, and safe save-library metadata.
- Implement the restore protocol, generation coordination, stale/historical snapshot policy, participant discovery, and all-non-eliminated readiness.
- Handle browser crashes, storage failures, authority restart, duplicate imports, and reconnecting from another browser with the same Discord identity.
- Preserve complete authorized history and all hidden/pending state across export, migration, version changes, and key rotation.
- Document application retention versus browser eviction, active-state cleanup, archived engine compatibility, and operator recovery.

Exit evidence: restore from each participant's copy, migrate a manual snapshot to a fresh browser, reject tampering and seat theft, and resume a mid-effect decision. Show that saving keeps play running, manual snapshots survive subsequent autosaves, deletion affects only one browser, and disconnects never automatically forfeit.

### M8 — Full roster and interaction completion

Dependencies: M2 certification, M4 infrastructure, M5–M7 integration. Gates: all applicable D1–D4 decisions.

- Implement card handlers in mechanic groups: resource/zone changes; attack and reaction keywords; targeting and choice; Gear/inheritance/modifiers; replacement/prevention; complex global and multi-trigger interactions.
- For every included identity, cover each distinct ability with its legal path, restrictions, timing, and relevant interactions. Cards without executable abilities still need verified stats/keywords and engine treatment.
- Verify multiplayer interaction groups from the register, including effects crossing player boundaries, trigger ordering, elimination, and disconnection at off-turn decisions.
- Link test evidence into the coverage inventory and fail the release coverage check for missing handlers, unsupported ability paths, unresolved required rulings, or missing card evidence.

Exit evidence: every certified gameplay identity implemented and validated. No placeholder effect, manual override, starter-only restriction, or unverified automatic fallback remains. A percentage of source-code coverage alone cannot satisfy this gate.

### M9 — Release validation and operations

Dependencies: M2–M8 complete; D1–D8 resolved where release-blocking. Requirements: PRD section 11 and OPS-01–OPS-05.

- Run the complete acceptance matrix below in supported browsers and deployed staging.
- Load-test 20 five-player tables and 50 two-player tables, plus anonymous directory traffic, bursty triggers, long histories, and simultaneous reconnects.
- Measure command commit latency, client-visible update latency, cold reconnect recovery, storage/write volume, snapshot size, browser storage failures, and hosting charges. Agree numeric release targets in D8 before treating results as passing.
- Verify operational logs exclude hidden cards, OAuth credentials, session tokens, join secrets, and decrypted saves. Record errors/revisions with safe identifiers.
- Configure deployment, secrets, migrations, backup/recovery procedures, spend visibility, and rollback. Test a deployment with active old-version matches and a restored old save.
- Produce a release evidence document with card coverage, browser results, known limitations, measured cost estimates, and the exact rules/catalog/engine versions.

Exit evidence: all PRD release gates pass, operating cost is reviewed, and deployment/recovery procedures are executable. Only then publish the first full release.

## 8. Verification matrix

| Area | Required evidence |
| --- | --- |
| Determinism and legality | Same initial state, commands, and random outcomes produce identical results; rejected commands have no gameplay side effects; cards/dice obey zone and ownership invariants. |
| Batching | A → B → C initial batches; A1 triggers A2 before B1; new A effects during B's batch wait through C; player-chosen order; serialized pending choices survive a save. |
| Rival semantics | Same instance keeps one Rival; repeated/source-distinct triggers can choose differently; C qualifying cannot authorize a conditional action against nonqualifying B; event triggers respond to any matching Rival; unrestricted multi-target versus same-Rival wording. |
| Victory | Majority targets 7/10/13/16 while in lobby; preset/custom persistence; start-time locking; pre-ready normal win check; d20 roll alone does not start overtime; approved cycle completion and immediate overtime checks. |
| Sudden Death | One full turn each before comparison; tied leaders alone receive later turns; all non-eliminated players remain win-eligible; skipped players may requalify; next-turn expiry at skipped positions without start-turn actions. |
| Elimination | Cards/unrolled dice removed, cleanup triggers suppressed, pending/lingering effects ended, stolen rolled Gigs retain controller/value, abandoned Gigs attackable, last remaining player wins; approved simultaneous-loss/resolving-effect cases. |
| Hidden information | Separate accounts cannot inspect opponents' hands/deck order through payloads, errors, logs, exports, or reconnects; historical log visibility matches legitimate knowledge. |
| Network correctness | Duplicates, reordering, stale revisions, capacity races, old connection messages, authority restarts, concurrent restorations, and lost acknowledgments never create duplicate actions or seats. |
| Disconnects | Continue while no absent input is needed; wait for on/off-turn required choices and optional reactions; no auto-pass/forfeit; host transfer does not change seat ownership. |
| Persistence | All REC-01–REC-20 journeys, full-history preservation, browser quota/eviction failures, compatible old versions, key rotation, local-only deletion, separate manual snapshots. |
| Browser journeys | Anonymous deck building/browsing, Discord join, legal-deck repair/switch, invitation URL/code, host moderation, complete 2/3/4/5-player matches, save migration and ready-to-resume. |
| Capacity and operation | Agreed 100-player workloads, anonymous traffic, measured service costs, deployment/rollback with active matches, and recovery without hidden-information exposure. |

Add scenario-specific expected outcomes from official rules and approved decisions, not assertions that merely repeat handler code. Pair focused tests with selected interaction scenarios; exhaustive testing of every possible deck combination is not a credible promise.

## 9. Dependencies, tracking, and release boundary

The critical path is M0 → M1 → M4 → M5 → M6 → M7 → M9, with M2 certification and M8 full-card coverage also required before M9 completes. M3 can proceed after the catalog schema and verified inputs exist. Data review and card implementation can advance incrementally while UI and service work consume already verified behavior.

Keep milestone status and evidence in this file or a linked progress record. For each implementation increment, record affected requirement IDs, decisions settled, runnable checks, and remaining blockers. Do not mark a milestone complete merely because its UI is present or its happy path passes.

Before first release, confirm all ten acceptance gates in PRD section 11. Deferred scope remains unchanged: cloud deck libraries, native/mobile layouts, spectators, chat, ranked/automatic matchmaking, and additional game formats. Do not silently reduce the roster or rules coverage to meet a schedule.

### Initial baseline (superseded by PROGRESS.md)

| Milestone | Status |
| --- | --- |
| M0–M9 | Not started |
| Requirements and initial source audit | Available; remaining decisions and certification work tracked above |
| This implementation plan | Written; no application implementation or deployment claimed |
