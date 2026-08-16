"""Deterministic attribution: conversion campaign > latest pre-qualification
campaign > source precedence > lexicographically smallest campaign id."""
from __future__ import annotations
from typing import Optional
from .models import LeadEvent, AuditRecord, SOURCE_PRECEDENCE


def attribute(lead_id: str, timeline: list[LeadEvent]) -> tuple[Optional[str], Optional[str], AuditRecord]:
    campaign_events = [e for e in timeline if e.campaign]

    # Rule 1: conversion event's campaign wins outright
    converted = [e for e in timeline if e.event_type == "converted" and e.campaign]
    if converted:
        chosen = converted[-1]  # latest conversion event, timeline already time-ordered
        audit = AuditRecord(
            lead_id=lead_id, event_id=chosen.event_id, decision_type="attribution",
            previous_state=None, new_state=None,
            selected_campaign=chosen.campaign,
            candidate_campaigns=sorted({e.campaign for e in campaign_events}),
            reason=f"Selected campaign '{chosen.campaign}' from the conversion event.",
            timestamp=chosen.timestamp or "",
        )
        return chosen.campaign, chosen.source, audit

    # Rule 2: latest valid campaign interaction before qualification
    qualified_events = [e for e in timeline if e.event_type == "qualified"]
    cutoff_ts = qualified_events[0].timestamp if qualified_events else None
    pre_qual = [e for e in campaign_events if not cutoff_ts or (e.timestamp or "") <= cutoff_ts]
    candidates = pre_qual or campaign_events

    if not candidates:
        audit = AuditRecord(
            lead_id=lead_id, event_id=None, decision_type="attribution",
            previous_state=None, new_state=None, selected_campaign=None,
            candidate_campaigns=[], reason="No campaign-bearing events found for this lead.",
            timestamp="",
        )
        return None, None, audit

    latest_ts = max(e.timestamp or "" for e in candidates)
    tied = [e for e in candidates if (e.timestamp or "") == latest_ts]

    if len(tied) == 1:
        chosen = tied[0]
        reason = f"Selected campaign '{chosen.campaign}' as the latest campaign interaction before qualification."
    else:
        # Rule 3: source precedence tiebreak
        def precedence_rank(e: LeadEvent) -> int:
            try:
                return SOURCE_PRECEDENCE.index(e.source)
            except ValueError:
                return len(SOURCE_PRECEDENCE)

        min_rank = min(precedence_rank(e) for e in tied)
        by_precedence = [e for e in tied if precedence_rank(e) == min_rank]

        if len(by_precedence) == 1:
            chosen = by_precedence[0]
            reason = (
                f"Multiple campaigns tied at timestamp {latest_ts}; resolved via source "
                f"precedence, selecting source '{chosen.source}'."
            )
        else:
            # Rule 4: lexicographically smallest campaign id
            chosen = min(by_precedence, key=lambda e: e.campaign)
            reason = (
                f"Multiple campaigns tied at timestamp {latest_ts} with equal source "
                f"precedence; resolved via lexicographically smallest campaign id."
            )

    audit = AuditRecord(
        lead_id=lead_id, event_id=chosen.event_id, decision_type="attribution",
        previous_state=None, new_state=None,
        selected_campaign=chosen.campaign,
        candidate_campaigns=sorted({e.campaign for e in candidates}),
        reason=reason, timestamp=chosen.timestamp or "",
    )
    return chosen.campaign, chosen.source, audit
