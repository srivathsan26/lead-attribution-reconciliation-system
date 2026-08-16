def map_event_to_state(event_type: str, status: str = ""):
    norm_type = (event_type or "").lower()
    norm_status = (status or "").lower()

    if norm_type == 'converted' or norm_status == 'converted':
        return 'Converted'
    if norm_type == 'qualified' or norm_status == 'qualified':
        return 'Qualified'
    if norm_type == 'contacted' or norm_status == 'contacted':
        return 'Contacted'
    if norm_type == 'lost' or norm_status == 'lost':
        return 'Lost'
    if norm_type in ('form_submission', 'page_visit', 'campaign_click', 'email_open', 'email_click') or norm_status == 'new':
        return 'New'
    return None

def reconcile_state(lead_id: str, timeline: list):
    current_state = "New"
    conflicts = []
    audit_records = []

    for step in timeline:
        implied = map_event_to_state(step.get('event_type'), step.get('status'))
        if not implied or implied == current_state:
            continue

        # Inconsistent regressions
        if implied == 'New' and current_state in ('Qualified', 'Converted'):
            msg = f"Invalid state regression attempted from '{current_state}' to 'New' by event {step['event_id']}. State retained as '{current_state}'."
            conflicts.append({
                "event_id": step['event_id'],
                "attempted_transition": f"{current_state} -> New",
                "current_state": current_state,
                "timestamp": step.get('timestamp', ''),
                "reason": msg
            })
            audit_records.append({
                "id": f"audit-conflict-{step['event_id']}",
                "lead_id": lead_id,
                "event_id": step['event_id'],
                "decision_type": "STATE_CONFLICT",
                "previous_state": current_state,
                "new_state": current_state,
                "selected_campaign": step.get('campaign'),
                "candidate_campaigns": [step.get('campaign')] if step.get('campaign') else [],
                "reason": msg,
                "timestamp": step.get('timestamp', '')
            })
            continue

        if current_state == 'Converted' and implied in ('Contacted', 'Qualified'):
            msg = f"Inconsistent regression from 'Converted' to '{implied}' by event {step['event_id']}."
            conflicts.append({
                "event_id": step['event_id'],
                "attempted_transition": f"Converted -> {implied}",
                "current_state": current_state,
                "timestamp": step.get('timestamp', ''),
                "reason": msg
            })
            audit_records.append({
                "id": f"audit-conflict-{step['event_id']}",
                "lead_id": lead_id,
                "event_id": step['event_id'],
                "decision_type": "STATE_CONFLICT",
                "previous_state": current_state,
                "new_state": current_state,
                "selected_campaign": step.get('campaign'),
                "candidate_campaigns": [step.get('campaign')] if step.get('campaign') else [],
                "reason": msg,
                "timestamp": step.get('timestamp', '')
            })
            continue

        prev = current_state
        current_state = implied
        audit_records.append({
            "id": f"audit-state-{step['event_id']}",
            "lead_id": lead_id,
            "event_id": step['event_id'],
            "decision_type": "STATE_CHANGE",
            "previous_state": prev,
            "new_state": current_state,
            "selected_campaign": step.get('campaign'),
            "candidate_campaigns": [step.get('campaign')] if step.get('campaign') else [],
            "reason": f"State progressed from '{prev}' to '{current_state}'.",
            "timestamp": step.get('timestamp', '')
        })

    return current_state, len(conflicts) > 0, conflicts, audit_records
