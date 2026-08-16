import re
import json

def normalize_email(email) -> str:
    if not email or not isinstance(email, str):
        return ""
    trimmed = email.strip().lower()
    if "@" not in trimmed or "." not in trimmed:
        return ""
    return trimmed

def normalize_phone(phone) -> str:
    if not phone or not isinstance(phone, str):
        return ""
    trimmed = phone.strip()
    has_plus = trimmed.startswith('+')
    digits = re.sub(r'\D', '', trimmed)
    if not digits:
        return ""
    return f"+{digits}" if has_plus else digits

def normalize_name(name) -> str:
    if not name or not isinstance(name, str):
        return ""
    collapsed = re.sub(r'\s+', ' ', name.strip())
    if not collapsed:
        return ""
    words = collapsed.split(' ')
    return ' '.join(w.capitalize() for w in words if w)

def normalize_source(source) -> str:
    if not source or not isinstance(source, str):
        return "website"
    return source.strip().lower()

def normalize_event_type(event_type) -> str:
    if not event_type or not isinstance(event_type, str):
        return "page_visit"
    return event_type.strip().lower()

def normalize_campaign(campaign) -> str:
    if not campaign or not isinstance(campaign, str):
        return ""
    return campaign.strip()

def normalize_payload(payload) -> dict:
    if not payload:
        return {}
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, str):
        try:
            parsed = json.loads(payload)
            return parsed if isinstance(parsed, dict) else {"raw": payload}
        except Exception:
            return {"raw": payload}
    return {"raw": str(payload)}

def normalize_event(raw: dict, arrival_index: int = 0) -> dict:
    return {
        "event_id": str(raw.get("event_id") or "").strip(),
        "lead_id": str(raw.get("lead_id") or "").strip(),
        "email": normalize_email(raw.get("email")),
        "phone": normalize_phone(raw.get("phone")),
        "name": normalize_name(raw.get("name")),
        "source": normalize_source(raw.get("source")),
        "campaign": normalize_campaign(raw.get("campaign")),
        "event_type": normalize_event_type(raw.get("event_type")),
        "timestamp": str(raw.get("timestamp") or "").strip(),
        "status": str(raw.get("status") or "").strip(),
        "payload": normalize_payload(raw.get("payload")),
        "arrival_index": arrival_index
    }
