import { NormalizedEvent, JourneyStep, AuditRecord } from '../types.js';

// Logical chronological precedence for events occurring at the exact same millisecond
export const EVENT_TYPE_ORDER: Record<string, number> = {
  page_visit: 1,
  campaign_click: 2,
  form_submission: 3,
  email_open: 4,
  email_click: 5,
  contacted: 6,
  qualified: 7,
  converted: 8,
  lost: 9,
};

export function reconstructLeadJourney(
  leadId: string,
  events: NormalizedEvent[]
): {
  timeline: JourneyStep[];
  lateEventAuditRecords: AuditRecord[];
} {
  const lateEventAuditRecords: AuditRecord[] = [];

  // Identify any late arrivals based on arrival_index vs timestamp ordering
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    // If the event that arrived later has an earlier timestamp than the previous one, it was late-arriving
    if (curr.arrival_index > prev.arrival_index && curr.timestamp < prev.timestamp) {
      lateEventAuditRecords.push({
        id: `audit-late-${curr.event_id}`,
        lead_id: leadId,
        event_id: curr.event_id,
        decision_type: 'LATE_EVENT_REORDER',
        previous_state: null,
        new_state: null,
        selected_campaign: curr.campaign || null,
        candidate_campaigns: curr.campaign ? [curr.campaign] : [],
        reason: `Late-arriving event ${curr.event_id} with timestamp ${curr.timestamp} inserted into historical timeline before event ${prev.event_id} (${prev.timestamp}).`,
        timestamp: curr.timestamp,
      });
    }
  }

  // Deterministically sort events by timestamp, then event type sequence, then event_id
  const sorted = [...events].sort((a, b) => {
    const timeCompare = a.timestamp.localeCompare(b.timestamp);
    if (timeCompare !== 0) return timeCompare;

    const orderA = EVENT_TYPE_ORDER[a.event_type] || 50;
    const orderB = EVENT_TYPE_ORDER[b.event_type] || 50;
    if (orderA !== orderB) return orderA - orderB;

    return a.event_id.localeCompare(b.event_id);
  });

  const timeline: JourneyStep[] = sorted.map((evt, idx) => {
    // Check if it was out of order relative to arrival index
    const isLate = idx > 0 && evt.arrival_index < sorted[idx - 1].arrival_index;

    return {
      event_id: evt.event_id,
      event_type: evt.event_type,
      timestamp: evt.timestamp,
      campaign: evt.campaign,
      source: evt.source,
      status: evt.status,
      name: evt.name,
      email: evt.email,
      phone: evt.phone,
      is_late_arrival: isLate,
    };
  });

  return { timeline, lateEventAuditRecords };
}
