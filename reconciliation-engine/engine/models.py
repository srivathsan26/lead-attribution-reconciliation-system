"""Core data models. Plain dataclasses — no ORM, no external deps."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Any

VALID_SOURCES = {"organic_search", "paid_search", "social", "email", "website", "manual"}
VALID_EVENT_TYPES = {
    "page_visit", "campaign_click", "form_submission", "email_open",
    "email_click", "contacted", "qualified", "converted",
}
VALID_STATES = {"New", "Contacted", "Qualified", "Converted", "Lost"}

# event_type -> state it implies (used by reconcile.py)
EVENT_TYPE_TO_STATE = {
    "form_submission": "New",
    "contacted": "Contacted",
    "qualified": "Qualified",
    "converted": "Converted",
}

# allowed forward transitions; anything not listed here is a conflict
ALLOWED_TRANSITIONS = {
    "New": {"New", "Contacted", "Qualified", "Converted", "Lost"},
    "Contacted": {"Contacted", "Qualified", "Converted", "Lost"},
    "Qualified": {"Qualified", "Converted", "Lost"},
    "Converted": {"Converted"},  # terminal
    "Lost": {"Lost"},  # terminal
}

SOURCE_PRECEDENCE = ["organic_search", "paid_search", "email", "social", "website", "manual"]


@dataclass
class LeadEvent:
    event_id: str
    lead_id: Optional[str]
    email: Optional[str]
    name: Optional[str]
    source: Optional[str]
    campaign: Optional[str]
    event_type: Optional[str]
    timestamp: Optional[str]  # ISO 8601 string, validated at ingest
    status: Optional[str]
    payload: dict = field(default_factory=dict)
    phone: Optional[str] = None  # optional field for phone-based matching

    # populated during ingest validation
    is_valid: bool = True
    rejection_reason: Optional[str] = None


@dataclass
class AuditRecord:
    lead_id: str
    event_id: Optional[str]
    decision_type: str  # "duplicate_detection" | "attribution" | "state_transition"
    previous_state: Optional[str]
    new_state: Optional[str]
    selected_campaign: Optional[str]
    candidate_campaigns: list[str]
    reason: str
    timestamp: str


@dataclass
class LeadProfile:
    lead_id: str  # canonical id (primary of duplicate group)
    email: Optional[str]
    name: Optional[str]
    events: list[LeadEvent] = field(default_factory=list)
    duplicate_lead_ids: list[str] = field(default_factory=list)
    current_state: str = "New"
    attributed_campaign: Optional[str] = None
    attributed_source: Optional[str] = None
    conflicts: list[str] = field(default_factory=list)
    audit_trail: list[AuditRecord] = field(default_factory=list)
