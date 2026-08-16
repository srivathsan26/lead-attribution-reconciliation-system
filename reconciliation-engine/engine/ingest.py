"""Load CSV/JSON records, validate, split into valid events + rejected records."""
from __future__ import annotations
import csv
import json
from datetime import datetime
from pathlib import Path
from .models import LeadEvent, VALID_SOURCES, VALID_EVENT_TYPES


def _parse_timestamp_ok(ts: str | None) -> bool:
    if not ts:
        return False
    try:
        # accept ISO 8601, with or without trailing Z
        datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return True
    except (ValueError, TypeError):
        return False


def _validate(raw: dict) -> LeadEvent:
    ev = LeadEvent(
        event_id=raw.get("event_id"),
        lead_id=raw.get("lead_id"),
        email=(raw.get("email") or "").strip().lower() or None,
        name=raw.get("name"),
        source=raw.get("source"),
        campaign=raw.get("campaign"),
        event_type=raw.get("event_type"),
        timestamp=raw.get("timestamp"),
        status=raw.get("status"),
        payload=raw.get("payload") or {},
        phone=raw.get("phone"),
    )

    reasons = []
    if not ev.event_id:
        reasons.append("missing event_id")
    if not ev.lead_id and not ev.email and not ev.phone:
        reasons.append("missing lead identification (no lead_id, email, or phone)")
    if not _parse_timestamp_ok(ev.timestamp):
        reasons.append("invalid or missing timestamp")
    if ev.source is not None and ev.source not in VALID_SOURCES:
        reasons.append(f"invalid source: {ev.source}")
    if ev.event_type is not None and ev.event_type not in VALID_EVENT_TYPES:
        reasons.append(f"invalid event_type: {ev.event_type}")

    if reasons:
        ev.is_valid = False
        ev.rejection_reason = "; ".join(reasons)
    return ev


def load_file(path: str | Path) -> list[dict]:
    path = Path(path)
    if path.suffix.lower() == ".json":
        with open(path) as f:
            data = json.load(f)
        return data if isinstance(data, list) else [data]
    elif path.suffix.lower() == ".csv":
        with open(path, newline="") as f:
            reader = csv.DictReader(f)
            rows = []
            for r in reader:
                # allow a JSON-encoded payload column
                if r.get("payload"):
                    try:
                        r["payload"] = json.loads(r["payload"])
                    except (json.JSONDecodeError, TypeError):
                        r["payload"] = {}
                rows.append(r)
            return rows
    else:
        raise ValueError(f"Unsupported file type: {path.suffix}")


def ingest_files(paths: list[str | Path]) -> tuple[list[LeadEvent], list[LeadEvent]]:
    """Returns (valid_events, rejected_events)."""
    valid, rejected = [], []
    for p in paths:
        try:
            rows = load_file(p)
        except (ValueError, json.JSONDecodeError, OSError) as e:
            # malformed file itself — record as a single rejected pseudo-event
            rejected.append(LeadEvent(
                event_id=None, lead_id=None, email=None, name=None,
                source=None, campaign=None, event_type=None, timestamp=None,
                status=None, is_valid=False,
                rejection_reason=f"malformed file {p}: {e}",
            ))
            continue
        for raw in rows:
            if not isinstance(raw, dict):
                rejected.append(LeadEvent(
                    event_id=None, lead_id=None, email=None, name=None,
                    source=None, campaign=None, event_type=None, timestamp=None,
                    status=None, is_valid=False, rejection_reason="malformed record (not an object)",
                ))
                continue
            ev = _validate(raw)
            (valid if ev.is_valid else rejected).append(ev)
    return valid, rejected
