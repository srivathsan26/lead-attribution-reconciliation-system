import json
import os
from .validation import validate_batch
from .normalization import normalize_event
from .deduplication import cluster_and_deduplicate
from .attribution import determine_attribution
from .reconciliation import reconcile_state

EVENT_TYPE_ORDER = {
    'page_visit': 1,
    'campaign_click': 2,
    'form_submission': 3,
    'email_open': 4,
    'email_click': 5,
    'contacted': 6,
    'qualified': 7,
    'converted': 8,
    'lost': 9,
}

def execute_pipeline(raw_events: list, output_dir="output", write_to_disk=False):
    # Deduplicate event_id
    seen_ids = set()
    dedup_raw = []
    for r in raw_events:
        eid = str(r.get('event_id') or '').strip()
        if eid:
            if eid in seen_ids:
                continue
            seen_ids.add(eid)
        dedup_raw.append(r)

    valid_raw, val_errors = validate_batch(dedup_raw)
    normalized = [normalize_event(r, i) for i, r in enumerate(valid_raw)]
    clusters, dup_audit = cluster_and_deduplicate(normalized)

    all_audit = list(dup_audit)
    canonical_leads = []

    total_conflicts = 0
    total_qualified = 0
    total_converted = 0

    for cluster in clusters:
        # Sort journey
        events = sorted(cluster['events'], key=lambda e: (e['timestamp'], EVENT_TYPE_ORDER.get(e['event_type'], 50), e['event_id']))
        timeline = [{
            "event_id": e['event_id'],
            "event_type": e['event_type'],
            "timestamp": e['timestamp'],
            "campaign": e['campaign'],
            "source": e['source'],
            "status": e['status']
        } for e in events]

        attr_exp, attr_audit = determine_attribution(cluster['canonical_id'], timeline)
        all_audit.extend(attr_audit)

        curr_state, has_conf, confs, state_audit = reconcile_state(cluster['canonical_id'], timeline)
        all_audit.extend(state_audit)

        if has_conf:
            total_conflicts += 1
        if curr_state in ('Qualified', 'Converted'):
            total_qualified += 1
        if curr_state == 'Converted':
            total_converted += 1

        canonical_leads.append({
            "lead_id": cluster['canonical_id'],
            "canonical_email": cluster['primary_email'],
            "phone": cluster['primary_phone'],
            "name": cluster['primary_name'],
            "current_state": curr_state,
            "attributed_campaign": attr_exp['selected_campaign'],
            "attributed_source": attr_exp['selected_source'],
            "attribution_explanation": attr_exp,
            "duplicate_count": cluster['duplicate_count'],
            "interaction_count": len(timeline),
            "has_conflict": has_conf,
            "conflicts": confs,
            "timeline": timeline
        })

    canonical_leads.sort(key=lambda l: l['lead_id'])
    all_audit.sort(key=lambda a: (a['timestamp'], a['lead_id'], a['id']))

    summary = {
        "total_raw_events": len(raw_events),
        "valid_events": len(valid_raw),
        "rejected_records": len(val_errors),
        "unique_leads": len(canonical_leads),
        "qualified_leads": total_qualified,
        "converted_leads": total_converted,
        "reconciliation_conflicts": total_conflicts
    }

    if write_to_disk:
        os.makedirs(output_dir, exist_ok=True)
        with open(os.path.join(output_dir, 'reconciled_leads.json'), 'w') as f:
            json.dump(canonical_leads, f, indent=2)

    return {
        "summary": summary,
        "leads": canonical_leads,
        "audit_trail": all_audit,
        "validation_errors": val_errors
    }
