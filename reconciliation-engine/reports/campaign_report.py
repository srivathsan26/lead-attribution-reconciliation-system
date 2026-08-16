"""Aggregate reconciled leads into a campaign-level performance report."""
from __future__ import annotations
import csv
import json
from pathlib import Path


def generate_report(leads: list[dict]) -> list[dict]:
    stats: dict[tuple[str, str], dict] = {}

    for lead in leads:
        campaign = lead.get("attributed_campaign")
        source = lead.get("attributed_source")
        if not campaign:
            continue
        key = (campaign, source or "unknown")
        s = stats.setdefault(key, {
            "campaign": campaign, "source": source or "unknown",
            "unique_leads": 0, "qualified_leads": 0,
            "converted_leads": 0, "duplicate_leads": 0,
        })
        s["unique_leads"] += 1
        s["duplicate_leads"] += lead.get("duplicate_count", 0)
        state = lead.get("current_state")
        if state == "Qualified":
            s["qualified_leads"] += 1
        elif state == "Converted":
            s["converted_leads"] += 1

    rows = []
    for key in sorted(stats.keys()):
        s = stats[key]
        denom = s["unique_leads"] or 1
        s["conversion_rate"] = round(s["converted_leads"] / denom, 4)
        rows.append(s)
    return rows


def write_report(rows: list[dict], out_dir: str = "output") -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    with open(out / "campaign_report.json", "w") as f:
        json.dump(rows, f, indent=2)

    if rows:
        with open(out / "campaign_report.csv", "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)


if __name__ == "__main__":
    with open("output/reconciled_leads.json") as f:
        leads = json.load(f)
    rows = generate_report(leads)
    write_report(rows)
    print(f"Generated report for {len(rows)} campaign/source combinations.")
