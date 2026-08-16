import re
from datetime import datetime

VALID_SOURCES = {
    'organic_search',
    'paid_search',
    'social',
    'email',
    'website',
    'manual'
}

VALID_EVENT_TYPES = {
    'page_visit',
    'campaign_click',
    'form_submission',
    'email_open',
    'email_click',
    'contacted',
    'qualified',
    'converted',
    'lost'
}

def is_valid_iso_timestamp(val: str) -> bool:
    if not val or not isinstance(val, str):
        return False
    # Try parsing ISO 8601 strings
    clean = val.strip().replace('Z', '+00:00')
    try:
        dt = datetime.fromisoformat(clean)
        return 1990 <= dt.year <= 2100
    except Exception:
        # Fallback date parse
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(val)
            return 1990 <= dt.year <= 2100
        except Exception:
            return False

def validate_event(raw: dict):
    errors = []
    if not isinstance(raw, dict):
        return False, [{
            "event_id": "unknown",
            "error_type": "MALFORMED_RECORD",
            "field": "record",
            "message": "Event record must be a dictionary/JSON object."
        }]

    event_id = str(raw.get('event_id') or '').strip()
    if not event_id:
        errors.append({
            "event_id": "missing-id",
            "error_type": "MISSING_EVENT_ID",
            "field": "event_id",
            "message": "Event record is missing a required event_id."
        })

    email = str(raw.get('email') or '').strip()
    phone = str(raw.get('phone') or '').strip()
    lead_id = str(raw.get('lead_id') or '').strip()

    if not email and not phone and not lead_id:
        errors.append({
            "event_id": event_id or "missing-id",
            "error_type": "MISSING_LEAD_IDENTITY",
            "field": "email/phone/lead_id",
            "message": "Event must contain at least one usable identifier."
        })

    ts = raw.get('timestamp')
    if not is_valid_iso_timestamp(ts):
        errors.append({
            "event_id": event_id or "missing-id",
            "error_type": "INVALID_TIMESTAMP",
            "field": "timestamp",
            "message": f"Timestamp '{ts}' is not a valid ISO-8601 date string."
        })

    source = str(raw.get('source') or '').strip().lower()
    if not source or source not in VALID_SOURCES:
        errors.append({
            "event_id": event_id or "missing-id",
            "error_type": "INVALID_SOURCE",
            "field": "source",
            "message": f"Source '{raw.get('source')}' is unsupported."
        })

    event_type = str(raw.get('event_type') or '').strip().lower()
    if not event_type or event_type not in VALID_EVENT_TYPES:
        errors.append({
            "event_id": event_id or "missing-id",
            "error_type": "INVALID_EVENT_TYPE",
            "field": "event_type",
            "message": f"Event type '{raw.get('event_type')}' is unsupported."
        })

    return len(errors) == 0, errors

def validate_batch(raw_events: list):
    valid = []
    errors = []
    for r in raw_events:
        is_ok, errs = validate_event(r)
        if is_ok:
            valid.append(r)
        else:
            errors.extend(errs)
    return valid, errors
