"""Order events by timestamp (not arrival order) to build each lead's timeline."""
from __future__ import annotations
from .models import LeadEvent


def build_timeline(events: list[LeadEvent]) -> list[LeadEvent]:
    """Deterministic ordering: timestamp, then event_id as tiebreaker."""
    return sorted(events, key=lambda e: (e.timestamp or "", e.event_id or ""))
