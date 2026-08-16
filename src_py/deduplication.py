def cluster_and_deduplicate(events: list):
    sorted_events = sorted(events, key=lambda e: e['event_id'])
    n = len(sorted_events)
    parent = list(range(n))

    def find(i):
        if parent[i] == i:
            return i
        parent[i] = find(parent[i])
        return parent[i]

    def union(i, j):
        root_i = find(i)
        root_j = find(j)
        if root_i != root_j:
            if root_i < root_j:
                parent[root_j] = root_i
            else:
                parent[root_i] = root_j

    email_map = {}
    phone_map = {}
    lead_id_map = {}

    for i, evt in enumerate(sorted_events):
        if evt['email']:
            if evt['email'] in email_map:
                union(i, email_map[evt['email']])
            else:
                email_map[evt['email']] = i

        if evt['phone']:
            if evt['phone'] in phone_map:
                union(i, phone_map[evt['phone']])
            else:
                phone_map[evt['phone']] = i

        if not evt['email'] and not evt['phone'] and evt['lead_id']:
            if evt['lead_id'] in lead_id_map:
                union(i, lead_id_map[evt['lead_id']])
            else:
                lead_id_map[evt['lead_id']] = i

    groups = {}
    for i in range(n):
        root = find(i)
        if root not in groups:
            groups[root] = []
        groups[root].append(sorted_events[i])

    clusters = []
    duplicate_audit = []

    for group_events in groups.values():
        group_events.sort(key=lambda e: (e['timestamp'], e['event_id']))
        explicit_ids = sorted([e['lead_id'] for e in group_events if e.get('lead_id')])
        emails = sorted([e['email'] for e in group_events if e.get('email')])
        phones = sorted([e['phone'] for e in group_events if e.get('phone')])
        names = sorted([e['name'] for e in group_events if e.get('name')], key=lambda n: len(n), reverse=True)

        primary_email = emails[0] if emails else ""
        primary_phone = phones[0] if phones else ""
        primary_name = names[0] if names else "Anonymous Lead"

        canonical_id = explicit_ids[0] if explicit_ids else ""
        if not canonical_id:
            if primary_email:
                clean = "".join(c if c.isalnum() else "-" for c in primary_email)[:24]
                canonical_id = f"lead-{clean}"
            elif primary_phone:
                clean = "".join(c for c in primary_phone if c.isdigit())
                canonical_id = f"lead-phone-{clean}"
            else:
                canonical_id = f"lead-{group_events[0]['event_id']}"

        dup_count = max(0, len(group_events) - 1)
        if len(group_events) > 1:
            first_e = group_events[0]
            for dup_e in group_events[1:]:
                reason = f"Merged with canonical lead {canonical_id} (Linked match)"
                if dup_e.get('email') and dup_e.get('email') == first_e.get('email'):
                    reason = f"Merged with canonical lead {canonical_id} (Normalized email matched {dup_e['email']})"
                elif dup_e.get('phone') and dup_e.get('phone') == first_e.get('phone'):
                    reason = f"Merged with canonical lead {canonical_id} (Normalized phone matched {dup_e['phone']})"

                duplicate_audit.append({
                    "id": f"audit-dup-{dup_e['event_id']}",
                    "lead_id": canonical_id,
                    "event_id": dup_e['event_id'],
                    "decision_type": "DUPLICATE_MERGE",
                    "previous_state": None,
                    "new_state": None,
                    "selected_campaign": dup_e.get('campaign'),
                    "candidate_campaigns": [dup_e.get('campaign')] if dup_e.get('campaign') else [],
                    "reason": reason,
                    "timestamp": dup_e['timestamp']
                })

        clusters.append({
            "canonical_id": canonical_id,
            "primary_email": primary_email,
            "primary_phone": primary_phone,
            "primary_name": primary_name,
            "events": group_events,
            "duplicate_count": dup_count
        })

    clusters.sort(key=lambda c: c['canonical_id'])
    return clusters, duplicate_audit
