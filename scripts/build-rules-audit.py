"""Regenerate audit indexes from captured official data; no network or game code.

Run from any directory with: python3 scripts/build-rules-audit.py
The catalog is an evidence inventory, not a corrected production card database.
"""

import collections
import csv
import hashlib
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs/rules-audit"
SOURCES = AUDIT / "sources"


def read(name):
    return json.loads((SOURCES / name).read_text())


def write(name, value):
    (AUDIT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def normalized_name(value):
    # Audit-only candidate matching. Production ambiguity rules remain to be specified.
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", value).casefold())


cards = read("card-details.json")["items"]
rules = read("comprehensive-rules.json")
faqs = read("faqs.json")
listed = read("cards-page-0.json")["items"] + read("cards-page-100.json")["items"]
assert len(cards) == len({c["id"] for c in cards}) == 151
assert {c["id"] for c in cards} == {c["id"] for c in listed}
assert sum(r["node_type"] == "rule" for r in rules["items"]) == 660
assert len(faqs["items"]) == 270

faq_by_card = collections.defaultdict(list)
for faq in faqs["items"]:
    if faq["card"]:
        faq_by_card[faq["card"]["id"]].append(faq["id"])

sets = {}
printing_ids = set()
inventory = []
for card in sorted(cards, key=lambda c: c["slug"]):
    for printing in card["printings"]:
        assert printing["id"] not in printing_ids
        printing_ids.add(printing["id"])
        code = printing["set"]["code"]
        row = sets.setdefault(code, {
            "name": printing["set"]["name"], "card_ids": set(), "printing_count": 0,
            "release_date": None, "cutoff_eligibility": "per-card official gameplay definition by 2026-09-05; physical release not required",
        })
        row["card_ids"].add(card["id"])
        row["printing_count"] += 1
    text = card["rules_text"] or ""
    tags = []
    # These are conservative text-review prompts, not certified effect semantics.
    checks = {
        "rival-scope": r"\brivals?\b",
        "all-player-effect": r"each player|all other Units",
        "unqualified-gig-target": r"(?:adjust|increase|decrease|set) a (?:player's )?Gig",
        "choice-or-hidden-information": r"choose|search|look at|reveal|discard",
        "reaction-or-replacement": r"\{Quick\}|\{Blocker\}|would|instead",
        "duration-or-turn-history": r"next turn|each turn|this turn|end of your turn",
        "effect-steal-or-swap": r"steal|swap",
    }
    for tag, pattern in checks.items():
        if re.search(pattern, text, re.IGNORECASE):
            tags.append(tag)
    issues = []
    if card["slug"] == "rebecca-having-a-moment":
        issues.append("DATA-REBECCA: unrevealed gameplay; not implementable")
    if card["slug"] == "alt-cunningham-soulkiller-architect":
        issues.append("DATA-ALT: ability missing from API; printed power 0 vs API null")
    if card["card_type"] == "Gear":
        issues.append("DATA-GEAR: top/bottom textbox structure requires image review")
    if card["card_type"] == "Legend" and card["power"] is None:
        issues.append("DATA-NULL: numeric-vs-null power requires image verification")
    if card["slug"] in {
        "bootleg-black-sapphire-show", "v-streetkid", "johnny-silverhand-rocking-renegade",
        "field-operator", "mt0d12-flathead", "river-ward-detective-on-the-hunt",
    }:
        issues.append("SOURCE-CONFLICT: see audit conflict register")
    inventory.append({
        "id": card["id"], "slug": card["slug"], "name": card["name"],
        "subtitle": card["subname"], "display_name": card["display_name"],
        "type": card["card_type"], "color": card["color"],
        "roster_status": "deferred: unrevealed gameplay" if card["slug"] == "rebecca-having-a-moment" else "candidate: verify official gameplay data",
        "cost": card["cost"], "power": card["power"], "ram": card["ram"],
        "printing_count": len(card["printings"]),
        "sets": sorted({p["set"]["code"] for p in card["printings"]}),
        "source_url": "https://cyberpunktcg.com/cards/" + card["slug"],
        "faq_ids": faq_by_card[card["id"]], "triage_tags": tags,
        "known_issues": issues, "implementation_status": "not implemented",
        "validation_status": "not tested", "image_review_status": (
            "spot-checked" if card["slug"] in {
                "alt-cunningham-soulkiller-architect", "riot-shield", "v-streetkid"
            } else "pending"
        ),
    })
assert len(printing_ids) == 460
write("card-inventory.json", inventory)
with (AUDIT / "card-coverage.csv").open("w", newline="") as f:
    fields = ["slug", "display_name", "type", "color", "roster_status", "printing_count", "triage_tags",
              "known_issues", "image_review_status", "implementation_status", "validation_status"]
    writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for card in inventory:
        writer.writerow({k: "; ".join(v) if isinstance(v, list) else v for k, v in card.items()})
write("set-inventory.json", [
    {"code": code, **row, "card_ids": sorted(row["card_ids"]), "distinct_cards": len(row["card_ids"])}
    for code, row in sorted(sets.items())
])
write("rule-index.json", [
    {"number": r["display_number"], "type": r["node_type"], "anchor": r["stable_anchor"],
     "source_url": "https://cyberpunktcg.com/comprehensive-rules#" + r["stable_anchor"]}
    for r in rules["items"]
])

fixture = (ROOT / "PRD.md").read_text().split("```text\n", 1)[1].split("```", 1)[0]
(AUDIT / "the-heist-import-fixture.txt").write_text(fixture)
section = None
resolved = []
for line in fixture.splitlines():
    if line in ("# Legends", "# Main Deck"):
        section = line[2:]
    match = re.fullmatch(r"(\d+)x (\S+) (.+)", line)
    if not match:
        continue
    quantity, number, name = match.groups()
    candidates = [c for c in cards if normalized_name(c["display_name"]) == normalized_name(name)]
    assert len(candidates) == 1, name
    card = candidates[0]
    printings = [p for p in card["printings"] if p["collector_number"] == number]
    assert printings, (number, name)
    resolved.append({"section": section, "quantity": int(quantity), "input_number": number,
                     "input_name": name, "card_id": card["id"], "slug": card["slug"],
                     "matching_printing_ids": [p["id"] for p in printings]})
by_id = {c["id"]: c for c in cards}
legends = [r for r in resolved if r["section"] == "Legends"]
main = [r for r in resolved if r["section"] == "Main Deck"]
ram = collections.Counter()
for entry in legends:
    card = by_id[entry["card_id"]]
    ram[card["color"]] += card["ram"] * entry["quantity"]
assert sum(r["quantity"] for r in legends) == 3
assert len({by_id[r["card_id"]]["name"] for r in legends}) == 3
assert all(by_id[r["card_id"]]["card_type"] == "Legend" for r in legends)
assert len(main) == 17 and sum(r["quantity"] for r in main) == 40
assert all(by_id[r["card_id"]]["card_type"] != "Legend" for r in main)
assert all(r["quantity"] <= 3 for r in main)
assert all(by_id[r["card_id"]]["ram"] <= ram[by_id[r["card_id"]]["color"]] for r in main)
write("the-heist-import-check.json", {
    "name": "The Heist Starter Deck", "entries": resolved, "ram_limits": dict(ram),
    "result": "20/20 entries resolved; 3 Legends and 40 main cards; construction checks pass",
    "limitation": "Does not certify cutoff eligibility or official starter quantities; not a production parser",
})

endpoints = {
    "comprehensive-rules.json": "https://api.netdeck.gg/api/cyberpunk/comprehensive-rules",
    "faqs.json": "https://api.netdeck.gg/api/faqs/cyberpunk",
    "card-filters.json": "https://api.netdeck.gg/api/cards/cyberpunk/filters",
    "cards-page-0.json": "https://api.netdeck.gg/api/cards/cyberpunk?limit=100&offset=0",
    "cards-page-100.json": "https://api.netdeck.gg/api/cards/cyberpunk?limit=100&offset=100",
    "card-details.json": "https://api.netdeck.gg/api/cards/cyberpunk/{slug} (151 public GET responses)",
}
write("source-manifest.json", {
    "retrieved_on": "2026-09-05", "cutoff": "2026-09-05",
    "eligibility_policy": "Sufficient officially published gameplay definition by cutoff; physical release not required",
    "rules_updated_at": rules["updated_at"], "faqs_updated_at": faqs["updated_at"],
    "access": "Public unauthenticated GET endpoints used by the official website; no supported external API contract verified",
    "files": [{"file": "sources/" + name, "url": url,
               "sha256": hashlib.sha256((SOURCES / name).read_bytes()).hexdigest()}
              for name, url in endpoints.items()],
})
print(f"Verified {len(cards)} card IDs, {len(printing_ids)} printings, 660 rules, 270 FAQs, and 20 fixture entries.")
