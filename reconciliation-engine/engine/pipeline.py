"""Orchestrates: ingest -> dedupe -> journey -> attribution -> reconcile -> audit.

Deterministic and idempotent: sorting happens on stable keys (event_id, timestamp)
at every stage, never on arrival/insertion order, so re-running or reordering the
input list produces byte-identical output.
"""
from __future__ import annotations
import json
from dataclasses import asdict
from pathlib import Path
from .ingest import ingest_files
from .dedupe import group_duplicates
from .journey import build_timeline
from .attribution import attribute
from .reconcile import reconcile_state
from .models import LeadProfile, AuditRecord


def run_pipeline(input_paths: list[str]) -> dict:
    events, rejected = ingest_files(input_paths)
    groups, dedupe_audit = group_duplicates(events)

    profiles: dict[str, LeadProfile] = {}
    all_audit: list[AuditRecord] = list(dedupe_audit)

    # process canonical lead ids in sorted order for deterministic output ordering
    for canonical_id in sorted(groups.keys()):
        group_events = groups[canonical_id]
        timeline = build_timeline(group_events)

        campaign, source, attr_audit = attribute(canonical_id, timeline)
        state, state_audit, conflicts = reconcile_state(canonical_id, timeline)

        # representative email/name: first event in timeline that has one
        email = next((e.email for e in timeline if e.email), None)
        name = next((e.name for e in timeline if e.name), None)
        original_ids = sorted({e.lead_id for e in timeline if e.lead_id and e.lead_id != canonical_id})

        profile = LeadProfile(
            lead_id=canonical_id,
            email=email,
            name=name,
            events=timeline,
            duplicate_lead_ids=original_ids,
            current_state=state,
            attributed_campaign=campaign,
            attributed_source=source,
            conflicts=conflicts,
            audit_trail=[attr_audit, *state_audit],
        )
        profiles[canonical_id] = profile
        all_audit.append(attr_audit)
        all_audit.extend(state_audit)

    return {
        "profiles": profiles,
        "rejected": rejected,
        "audit": all_audit,
    }


def _serialize_profile(p: LeadProfile) -> dict:
    return {
        "lead_id": p.lead_id,
        "email": p.email,
        "name": p.name,
        "current_state": p.current_state,
        "attributed_campaign": p.attributed_campaign,
        "attributed_source": p.attributed_source,
        "is_duplicate": False,  # canonical/surviving lead is never itself a duplicate
        "merged_duplicate_ids": p.duplicate_lead_ids,  # ids of records merged INTO this lead
        "duplicate_count": len(p.duplicate_lead_ids),
        "interaction_count": len(p.events),
        "conflicts": p.conflicts,
        "timeline": [
            {
                "event_id": e.event_id, "source": e.source, "campaign": e.campaign,
                "event_type": e.event_type, "timestamp": e.timestamp, "status": e.status,
            } for e in p.events
        ],
    }


def write_outputs(result: dict, output_dir: str = "output") -> None:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    leads_json = [_serialize_profile(p) for p in sorted(result["profiles"].values(), key=lambda p: p.lead_id)]
    with open(out / "reconciled_leads.json", "w") as f:
        json.dump(leads_json, f, indent=2, default=str)

    rejected_json = [asdict(e) for e in result["rejected"]]
    with open(out / "rejected_records.json", "w") as f:
        json.dump(rejected_json, f, indent=2, default=str)

    audit_json = [asdict(a) for a in result["audit"]]
    with open(out / "audit_log.json", "w") as f:
        json.dump(audit_json, f, indent=2, default=str)


if __name__ == "__main__":
    import sys
    paths = sys.argv[1:] or ["fixtures"]
    if len(paths) == 1 and Path(paths[0]).is_dir():
        paths = [str(p) for p in Path(paths[0]).glob("*") if p.suffix in (".csv", ".json")]
    result = run_pipeline(paths)
    write_outputs(result)
    print(f"Processed {len(result['profiles'])} leads, {len(result['rejected'])} rejected, "
          f"{len(result['audit'])} audit records.")
