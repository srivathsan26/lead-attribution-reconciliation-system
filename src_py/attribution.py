DEFAULT_SOURCE_PRECEDENCE = [
    'organic_search',
    'paid_search',
    'email',
    'social',
    'website',
    'manual'
]

def get_source_priority(src: str, precedence=None) -> int:
    prec = precedence or DEFAULT_SOURCE_PRECEDENCE
    s = src.lower()
    return prec.index(s) if s in prec else 999

def determine_attribution(lead_id: str, timeline: list, custom_precedence=None):
    precedence = custom_precedence or DEFAULT_SOURCE_PRECEDENCE
    candidates = sorted(list(set(s['campaign'] for s in timeline if s.get('campaign'))))
    audit_records = []

    if not candidates:
        first_step = timeline[0] if timeline else {}
        explanation = {
            "selected_campaign": "Direct / Unattributed",
            "selected_source": first_step.get("source", "website"),
            "rule_applied": "None (Direct Traffic)",
            "reason": "No campaign parameters detected in lead journey.",
            "candidate_campaigns": []
        }
        audit_records.append({
            "id": f"audit-attr-{lead_id}",
            "lead_id": lead_id,
            "event_id": first_step.get("event_id", "direct"),
            "decision_type": "ATTRIBUTION_SELECTION",
            "previous_state": None,
            "new_state": None,
            "selected_campaign": "Direct / Unattributed",
            "candidate_campaigns": [],
            "reason": explanation["reason"],
            "timestamp": first_step.get("timestamp", "")
        })
        return explanation, audit_records

    # Rule 1: Conversion campaign
    conv_events = [s for s in timeline if s.get('event_type') == 'converted' and s.get('campaign')]
    if conv_events:
        conv = conv_events[0]
        explanation = {
            "selected_campaign": conv['campaign'],
            "selected_source": conv.get('source', 'website'),
            "rule_applied": "Rule 1: Conversion Event Campaign",
            "reason": f"Conversion event {conv['event_id']} was directly associated with campaign '{conv['campaign']}'.",
            "candidate_campaigns": candidates,
            "conversion_event_id": conv['event_id']
        }
        audit_records.append({
            "id": f"audit-attr-{lead_id}",
            "lead_id": lead_id,
            "event_id": conv['event_id'],
            "decision_type": "ATTRIBUTION_SELECTION",
            "previous_state": None,
            "new_state": None,
            "selected_campaign": conv['campaign'],
            "candidate_campaigns": candidates,
            "reason": explanation["reason"],
            "timestamp": conv['timestamp']
        })
        return explanation, audit_records

    # Rule 2: Pre-qualification interaction
    qual_idx = next((i for i, s in enumerate(timeline) if s.get('event_type') == 'qualified'), -1)
    if qual_idx != -1:
        qual_ts = timeline[qual_idx]['timestamp']
        eligible = [s for s in timeline if s.get('campaign') and s['timestamp'] <= qual_ts]
    else:
        eligible = [s for s in timeline if s.get('campaign')]

    if not eligible:
        eligible = [s for s in timeline if s.get('campaign')]

    # Sort eligible steps: timestamp DESC, source priority ASC, campaign ASC
    eligible.sort(key=lambda s: (-1 * int(s['timestamp'].replace('-', '').replace(':', '').replace('T', '').replace('Z', '')[:14] if s['timestamp'][:4].isdigit() else 0), get_source_priority(s.get('source', ''), precedence), s['campaign']))

    # To be strictly string-ISO compliant
    eligible.sort(key=lambda s: s['campaign'])
    eligible.sort(key=lambda s: get_source_priority(s.get('source', ''), precedence))
    eligible.sort(key=lambda s: s['timestamp'], reverse=True)

    best = eligible[0]
    reason = f"Campaign '{best['campaign']}' was the latest valid interaction before qualification."

    explanation = {
        "selected_campaign": best['campaign'],
        "selected_source": best.get('source', 'website'),
        "rule_applied": "Rule 2: Pre-Qualification Interaction",
        "reason": reason,
        "candidate_campaigns": candidates
    }
    audit_records.append({
        "id": f"audit-attr-{lead_id}",
        "lead_id": lead_id,
        "event_id": best['event_id'],
        "decision_type": "ATTRIBUTION_SELECTION",
        "previous_state": None,
        "new_state": None,
        "selected_campaign": best['campaign'],
        "candidate_campaigns": candidates,
        "reason": reason,
        "timestamp": best['timestamp']
    })

    return explanation, audit_records
