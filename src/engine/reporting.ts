import {
  CanonicalLead,
  CampaignReportRow,
  SourceReportRow,
  AuditRecord,
} from '../types.js';

export function generateCampaignReport(leads: CanonicalLead[]): CampaignReportRow[] {
  // Aggregate by [attributed_campaign, attributed_source]
  const map = new Map<
    string,
    {
      campaign: string;
      source: string;
      unique_leads: number;
      qualified_leads: number;
      converted_leads: number;
      duplicate_leads: number;
      total_events: number;
    }
  >();

  for (const lead of leads) {
    const campaign = lead.attributed_campaign || 'Direct / Unattributed';
    const source = lead.attributed_source || 'website';
    const key = `${campaign}|||${source}`;

    if (!map.has(key)) {
      map.set(key, {
        campaign,
        source,
        unique_leads: 0,
        qualified_leads: 0,
        converted_leads: 0,
        duplicate_leads: 0,
        total_events: 0,
      });
    }

    const row = map.get(key)!;
    row.unique_leads += 1;
    if (lead.current_state === 'Qualified' || lead.current_state === 'Converted') {
      row.qualified_leads += 1;
    }
    if (lead.current_state === 'Converted') {
      row.converted_leads += 1;
    }
    row.duplicate_leads += lead.duplicate_count;
    row.total_events += lead.interaction_count;
  }

  const result: CampaignReportRow[] = Array.from(map.values()).map(r => {
    const rate =
      r.unique_leads > 0
        ? Number(((r.converted_leads / r.unique_leads) * 100).toFixed(2))
        : 0.0;

    return {
      campaign: r.campaign,
      source: r.source,
      unique_leads: r.unique_leads,
      qualified_leads: r.qualified_leads,
      converted_leads: r.converted_leads,
      duplicate_leads: r.duplicate_leads,
      total_events: r.total_events,
      conversion_rate: rate,
    };
  });

  // Sort deterministically: converted_leads DESC, conversion_rate DESC, campaign ASC
  result.sort((a, b) => {
    if (b.converted_leads !== a.converted_leads) return b.converted_leads - a.converted_leads;
    if (b.conversion_rate !== a.conversion_rate) return b.conversion_rate - a.conversion_rate;
    return a.campaign.localeCompare(b.campaign);
  });

  return result;
}

export function generateSourceReport(leads: CanonicalLead[]): SourceReportRow[] {
  const map = new Map<
    string,
    {
      source: string;
      unique_leads: number;
      qualified_leads: number;
      converted_leads: number;
      total_events: number;
    }
  >();

  for (const lead of leads) {
    const source = lead.attributed_source || 'website';
    if (!map.has(source)) {
      map.set(source, {
        source,
        unique_leads: 0,
        qualified_leads: 0,
        converted_leads: 0,
        total_events: 0,
      });
    }

    const row = map.get(source)!;
    row.unique_leads += 1;
    if (lead.current_state === 'Qualified' || lead.current_state === 'Converted') {
      row.qualified_leads += 1;
    }
    if (lead.current_state === 'Converted') {
      row.converted_leads += 1;
    }
    row.total_events += lead.interaction_count;
  }

  const result: SourceReportRow[] = Array.from(map.values()).map(r => {
    const rate =
      r.unique_leads > 0
        ? Number(((r.converted_leads / r.unique_leads) * 100).toFixed(2))
        : 0.0;

    return {
      source: r.source,
      unique_leads: r.unique_leads,
      qualified_leads: r.qualified_leads,
      converted_leads: r.converted_leads,
      total_events: r.total_events,
      conversion_rate: rate,
    };
  });

  result.sort((a, b) => b.converted_leads - a.converted_leads || b.unique_leads - a.unique_leads);
  return result;
}

export function convertToCSV<T extends Record<string, any>>(
  rows: T[],
  headers: { key: keyof T; label: string }[]
): string {
  if (!rows || rows.length === 0) {
    return headers.map(h => `"${h.label}"`).join(',') + '\n';
  }

  const headerLine = headers.map(h => `"${h.label}"`).join(',');
  const dataLines = rows.map(row => {
    return headers
      .map(h => {
        const val = row[h.key];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',');
  });

  return [headerLine, ...dataLines].join('\n');
}

export function exportCampaignReportCSV(report: CampaignReportRow[]): string {
  return convertToCSV(report, [
    { key: 'campaign', label: 'Campaign' },
    { key: 'source', label: 'Source' },
    { key: 'unique_leads', label: 'Unique Leads' },
    { key: 'qualified_leads', label: 'Qualified Leads' },
    { key: 'converted_leads', label: 'Converted Leads' },
    { key: 'duplicate_leads', label: 'Duplicate Leads' },
    { key: 'total_events', label: 'Total Events' },
    { key: 'conversion_rate', label: 'Conversion Rate (%)' },
  ]);
}

export function exportLeadsCSV(leads: CanonicalLead[]): string {
  const flatLeads = leads.map(l => ({
    lead_id: l.lead_id,
    name: l.name,
    email: l.canonical_email,
    phone: l.phone,
    current_state: l.current_state,
    attributed_campaign: l.attributed_campaign,
    attributed_source: l.attributed_source,
    score: l.score.score,
    tier: l.score.tier,
    interaction_count: l.interaction_count,
    duplicate_count: l.duplicate_count,
    has_conflict: l.has_conflict ? 'YES' : 'NO',
    rule_applied: l.attribution_explanation.rule_applied,
    reason: l.attribution_explanation.reason,
    first_seen: l.first_seen,
    last_seen: l.last_seen,
  }));

  return convertToCSV(flatLeads, [
    { key: 'lead_id', label: 'Lead ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'current_state', label: 'Status' },
    { key: 'attributed_campaign', label: 'Attributed Campaign' },
    { key: 'attributed_source', label: 'Source' },
    { key: 'score', label: 'Quality Score' },
    { key: 'tier', label: 'Quality Tier' },
    { key: 'interaction_count', label: 'Interactions' },
    { key: 'duplicate_count', label: 'Duplicates Merged' },
    { key: 'has_conflict', label: 'Conflict Flag' },
    { key: 'rule_applied', label: 'Attribution Rule' },
    { key: 'reason', label: 'Attribution Reason' },
    { key: 'first_seen', label: 'First Seen' },
    { key: 'last_seen', label: 'Last Seen' },
  ]);
}

export function exportAuditCSV(auditLogs: AuditRecord[]): string {
  const flat = auditLogs.map(a => ({
    id: a.id,
    lead_id: a.lead_id,
    event_id: a.event_id,
    decision_type: a.decision_type,
    previous_state: a.previous_state || 'N/A',
    new_state: a.new_state || 'N/A',
    selected_campaign: a.selected_campaign || 'N/A',
    candidate_campaigns: a.candidate_campaigns.join('; '),
    reason: a.reason,
    timestamp: a.timestamp,
  }));

  return convertToCSV(flat, [
    { key: 'id', label: 'Audit ID' },
    { key: 'lead_id', label: 'Lead ID' },
    { key: 'event_id', label: 'Event ID' },
    { key: 'decision_type', label: 'Decision Type' },
    { key: 'previous_state', label: 'Previous State' },
    { key: 'new_state', label: 'New State' },
    { key: 'selected_campaign', label: 'Selected Campaign' },
    { key: 'candidate_campaigns', label: 'Candidate Campaigns' },
    { key: 'reason', label: 'Reason' },
    { key: 'timestamp', label: 'Timestamp' },
  ]);
}
