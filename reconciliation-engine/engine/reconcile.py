"""Derive final lead state from full event history; flag invalid transitions."""
from __future__ import annotations
from .models import LeadEvent, AuditRecord, EVENT_TYPE_TO_STATE, ALLOWED_TRANSITIONS


def reconcile_state(lead_id: str, timeline: list[LeadEvent]) -> tuple[str, list[AuditRecord], list[str]]:
    """
    Walk the timeline in timestamp order, applying only recognized state-bearing
    event types. Returns (final_state, audit_records, conflict_descriptions).
    """
    state = "New"
    audit: list[AuditRecord] = []
    conflicts: list[str] = []

    for ev in timeline:
        target = None
        if ev.status in ("lost",):
            target = "Lost"
        elif ev.event_type in EVENT_TYPE_TO_STATE:
            target = EVENT_TYPE_TO_STATE[ev.event_type]
        elif ev.status and ev.status.capitalize() in ("New", "Contacted", "Qualified", "Converted", "Lost"):
            target = ev.status.capitalize()

        if target is None:
            continue  # event doesn't carry a state signal (e.g. page_visit)

        if target in ALLOWED_TRANSITIONS.get(state, set()):
            if target != state:
                audit.append(AuditRecord(
                    lead_id=lead_id, event_id=ev.event_id, decision_type="state_transition",
                    previous_state=state, new_state=target, selected_campaign=None,
                    candidate_campaigns=[], reason=f"Valid transition {state} -> {target} from event_type '{ev.event_type}'.",
                    timestamp=ev.timestamp or "",
                ))
            state = target
        else:
            desc = f"Invalid transition {state} -> {target} at event {ev.event_id} (timestamp {ev.timestamp})"
            conflicts.append(desc)
            audit.append(AuditRecord(
                lead_id=lead_id, event_id=ev.event_id, decision_type="state_transition",
                previous_state=state, new_state=state, selected_campaign=None,
                candidate_campaigns=[],
                reason=f"Rejected invalid transition {state} -> {target}; state retained as '{state}'.",
                timestamp=ev.timestamp or "",
            ))
            # state is NOT updated — invalid transitions are reported, not applied

    return state, audit, conflicts
