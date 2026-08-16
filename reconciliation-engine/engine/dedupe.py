"""Deterministic duplicate detection: email > phone > lead_id fallback.

Grouping is order-independent (uses union-find over sorted events) so that
replay in a different arrival order produces identical groupings.
"""
from __future__ import annotations
from .models import LeadEvent, AuditRecord


class _UnionFind:
    def __init__(self):
        self.parent: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            # deterministic: smaller lexicographic id becomes root
            root, child = (ra, rb) if ra < rb else (rb, ra)
            self.parent[child] = root


def group_duplicates(events: list[LeadEvent]) -> tuple[dict[str, list[LeadEvent]], list[AuditRecord]]:
    """
    Returns (canonical_lead_id -> events, audit_records).
    Matching keys, in priority order: normalized email, then phone,
    then raw lead_id as fallback identity anchor.
    """
    uf = _UnionFind()
    audit: list[AuditRecord] = []

    # sort for determinism regardless of input arrival order
    sorted_events = sorted(events, key=lambda e: (e.event_id or ""))

    email_index: dict[str, str] = {}
    phone_index: dict[str, str] = {}

    for ev in sorted_events:
        anchor = ev.lead_id or f"__anon__{ev.event_id}"
        uf.find(anchor)

        if ev.email:
            if ev.email in email_index:
                uf.union(anchor, email_index[ev.email])
            else:
                email_index[ev.email] = anchor

        if ev.phone:
            if ev.phone in phone_index:
                uf.union(anchor, phone_index[ev.phone])
            else:
                phone_index[ev.phone] = anchor

    groups: dict[str, list[LeadEvent]] = {}
    for ev in sorted_events:
        anchor = ev.lead_id or f"__anon__{ev.event_id}"
        canonical = uf.find(anchor)
        groups.setdefault(canonical, []).append(ev)

    for canonical, group_events in groups.items():
        original_ids = sorted({e.lead_id for e in group_events if e.lead_id and e.lead_id != canonical})
        if original_ids:
            audit.append(AuditRecord(
                lead_id=canonical,
                event_id=None,
                decision_type="duplicate_detection",
                previous_state=None,
                new_state=None,
                selected_campaign=None,
                candidate_campaigns=[],
                reason=(
                    f"Merged lead_id(s) {original_ids} into canonical lead {canonical} "
                    f"based on matching normalized email/phone."
                ),
                timestamp=min(e.timestamp for e in group_events if e.timestamp) if any(e.timestamp for e in group_events) else "",
            ))

    return groups, audit
