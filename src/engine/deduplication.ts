import { NormalizedEvent, AuditRecord } from '../types.js';

export interface LeadCluster {
  canonical_id: string;
  primary_email: string;
  primary_phone: string;
  primary_name: string;
  events: NormalizedEvent[];
  duplicate_count: number;
  merge_reasons: string[];
}

export function clusterAndDeduplicateEvents(
  events: NormalizedEvent[],
  existingAuditTrail?: AuditRecord[]
): {
  clusters: LeadCluster[];
  duplicateAuditRecords: AuditRecord[];
} {
  // We use a Disjoint-Set / Union-Find structure or deterministic clustering maps
  // to ensure that transitive linkages (e.g. event1 has email A & phone B, event2 has phone B)
  // or simple email/phone grouping are deterministic regardless of arrival order.

  const duplicateAuditRecords: AuditRecord[] = [];

  // Group events deterministically.
  // First, index by email, phone, and lead_id
  const emailToGroupIndex = new Map<string, number>();
  const phoneToGroupIndex = new Map<string, number>();
  const explicitIdToGroupIndex = new Map<string, number>();

  // To maintain absolute determinism regardless of arrival order:
  // Sort events first by a stable signature (e.g., event_id) before initial clustering evaluation
  const sortedEvents = [...events].sort((a, b) => a.event_id.localeCompare(b.event_id));

  // Disjoint set parent pointers
  const parent: number[] = [];
  function find(i: number): number {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(i: number, j: number) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      if (rootI < rootJ) {
        parent[rootJ] = rootI;
      } else {
        parent[rootI] = rootJ;
      }
    }
  }

  for (let i = 0; i < sortedEvents.length; i++) {
    parent[i] = i;
  }

  // Link events
  for (let i = 0; i < sortedEvents.length; i++) {
    const evt = sortedEvents[i];

    // Rule A: Normalized Email
    if (evt.email) {
      if (emailToGroupIndex.has(evt.email)) {
        union(i, emailToGroupIndex.get(evt.email)!);
      } else {
        emailToGroupIndex.set(evt.email, i);
      }
    }

    // Rule B: Normalized Phone (when phone is present)
    if (evt.phone) {
      if (phoneToGroupIndex.has(evt.phone)) {
        union(i, phoneToGroupIndex.get(evt.phone)!);
      } else {
        phoneToGroupIndex.set(evt.phone, i);
      }
    }

    // Rule C: If both email and phone are missing, match explicit lead_id if present
    if (!evt.email && !evt.phone && evt.lead_id) {
      if (explicitIdToGroupIndex.has(evt.lead_id)) {
        union(i, explicitIdToGroupIndex.get(evt.lead_id)!);
      } else {
        explicitIdToGroupIndex.set(evt.lead_id, i);
      }
    }
  }

  // Group events by root cluster
  const rootGroups = new Map<number, NormalizedEvent[]>();
  for (let i = 0; i < sortedEvents.length; i++) {
    const root = find(i);
    if (!rootGroups.has(root)) {
      rootGroups.set(root, []);
    }
    rootGroups.get(root)!.push(sortedEvents[i]);
  }

  const clusters: LeadCluster[] = [];

  for (const groupEvents of rootGroups.values()) {
    // Sort events deterministically within group by timestamp, then event_id
    groupEvents.sort((a, b) => {
      const timeDiff = a.timestamp.localeCompare(b.timestamp);
      if (timeDiff !== 0) return timeDiff;
      return a.event_id.localeCompare(b.event_id);
    });

    // Derive canonical lead ID deterministically
    // If any event already had a non-empty lead_id, select the lexicographically earliest one
    const explicitIds = groupEvents
      .map(e => e.lead_id)
      .filter(id => Boolean(id && id.trim()))
      .sort();

    // Primary email and phone
    const emails = groupEvents
      .map(e => e.email)
      .filter(Boolean)
      .sort();
    const phones = groupEvents
      .map(e => e.phone)
      .filter(Boolean)
      .sort();
    const names = groupEvents
      .map(e => e.name)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length); // prefer fuller name

    const primaryEmail = emails[0] || '';
    const primaryPhone = phones[0] || '';
    const primaryName = names[0] || 'Anonymous Lead';

    let canonicalId = explicitIds[0];
    if (!canonicalId) {
      if (primaryEmail) {
        // Deterministic ID based on email prefix or sanitized email
        const sanitized = primaryEmail.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 24);
        canonicalId = `lead-${sanitized}`;
      } else if (primaryPhone) {
        const sanitized = primaryPhone.replace(/[^0-9]/g, '');
        canonicalId = `lead-phone-${sanitized}`;
      } else {
        canonicalId = `lead-${groupEvents[0].event_id}`;
      }
    }

    const mergeReasons: string[] = [];
    const duplicateCount = Math.max(0, groupEvents.length - 1);

    // If there are duplicate events in the cluster, generate audit records
    if (groupEvents.length > 1) {
      const firstEvent = groupEvents[0];
      for (let k = 1; k < groupEvents.length; k++) {
        const dupEvent = groupEvents[k];
        let reason = '';
        if (dupEvent.email && dupEvent.email === firstEvent.email) {
          reason = `Merged with canonical lead ${canonicalId} (Normalized email matched ${dupEvent.email})`;
        } else if (dupEvent.phone && dupEvent.phone === firstEvent.phone) {
          reason = `Merged with canonical lead ${canonicalId} (Normalized phone matched ${dupEvent.phone})`;
        } else if (dupEvent.lead_id && dupEvent.lead_id === firstEvent.lead_id) {
          reason = `Merged with canonical lead ${canonicalId} (Explicit lead_id matched ${dupEvent.lead_id})`;
        } else {
          reason = `Merged with canonical lead ${canonicalId} based on linked identity parameters`;
        }

        mergeReasons.push(reason);

        duplicateAuditRecords.push({
          id: `audit-dup-${dupEvent.event_id}`,
          lead_id: canonicalId,
          event_id: dupEvent.event_id,
          decision_type: 'DUPLICATE_MERGE',
          previous_state: null,
          new_state: null,
          selected_campaign: dupEvent.campaign || null,
          candidate_campaigns: [dupEvent.campaign].filter(Boolean) as string[],
          reason,
          timestamp: dupEvent.timestamp,
        });
      }
    }

    clusters.push({
      canonical_id: canonicalId,
      primary_email: primaryEmail,
      primary_phone: primaryPhone,
      primary_name: primaryName,
      events: groupEvents,
      duplicate_count: duplicateCount,
      merge_reasons: mergeReasons,
    });
  }

  // Sort clusters deterministically by canonical_id
  clusters.sort((a, b) => a.canonical_id.localeCompare(b.canonical_id));

  return { clusters, duplicateAuditRecords };
}
