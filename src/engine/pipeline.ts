import {
  RawEvent,
  CanonicalLead,
  PipelineResult,
  PipelineSummary,
  AuditRecord,
  ValidationError,
  SEOKeywordRow,
} from '../types.js';
import { validateEventBatch } from './validation.js';
import { normalizeEventBatch } from './normalization.js';
import { clusterAndDeduplicateEvents } from './deduplication.js';
import { reconstructLeadJourney } from './journey.js';
import { determineCampaignAttribution } from './attribution.js';
import { reconcileLeadState } from './reconciliation.js';
import { calculateLeadScore } from './scoring.js';
import {
  generateCampaignReport,
  generateSourceReport,
  exportCampaignReportCSV,
  exportLeadsCSV,
  exportAuditCSV,
} from './reporting.js';
import { processSEOKeywords, exportSEOReportCSV } from './seo.js';

export interface PipelineOptions {
  customSourcePrecedence?: string[];
  outputDir?: string;
  writeToDisk?: boolean;
  seoData?: any[];
}

export function executeReconciliationPipeline(
  rawEvents: RawEvent[],
  options: PipelineOptions = {}
): PipelineResult {
  const startTime = Date.now();

  // --- Step 0: Event ID Deduplication & Idempotency Key Handling ---
  // If the exact same event_id appears multiple times in raw input, deduplicate it deterministically
  const seenEventIds = new Set<string>();
  const deduplicatedRawEvents: RawEvent[] = [];
  let duplicateEventIdCount = 0;

  for (const raw of rawEvents) {
    const rawId = raw && raw.event_id ? String(raw.event_id).trim() : null;
    if (rawId) {
      if (seenEventIds.has(rawId)) {
        duplicateEventIdCount++;
        continue; // Idempotent skip of duplicate raw event_id
      }
      seenEventIds.add(rawId);
    }
    deduplicatedRawEvents.push(raw);
  }

  // --- Step 1: Validation ---
  const { validRawEvents, validationErrors } = validateEventBatch(deduplicatedRawEvents);

  // --- Step 2: Normalization ---
  const normalizedEvents = normalizeEventBatch(validRawEvents);

  // --- Step 3: Deduplication & Lead Clustering ---
  const { clusters, duplicateAuditRecords } = clusterAndDeduplicateEvents(normalizedEvents);

  const allAuditRecords: AuditRecord[] = [...duplicateAuditRecords];
  const canonicalLeads: CanonicalLead[] = [];

  let totalConflictsCount = 0;
  let totalQualifiedCount = 0;
  let totalConvertedCount = 0;

  // --- Step 4: Journey Reconstruction, Attribution, Reconciliation, Scoring for each Lead ---
  for (const cluster of clusters) {
    // a. Journey Reconstruction
    const { timeline, lateEventAuditRecords } = reconstructLeadJourney(
      cluster.canonical_id,
      cluster.events
    );
    allAuditRecords.push(...lateEventAuditRecords);

    // b. Campaign Attribution
    const { attribution, attributionAuditRecords } = determineCampaignAttribution(
      cluster.canonical_id,
      timeline,
      options.customSourcePrecedence
    );
    allAuditRecords.push(...attributionAuditRecords);

    // c. State Reconciliation & Conflict Detection
    const { currentState, hasConflict, conflicts, stateAuditRecords } = reconcileLeadState(
      cluster.canonical_id,
      timeline
    );
    allAuditRecords.push(...stateAuditRecords);

    if (hasConflict) totalConflictsCount++;
    if (currentState === 'Qualified' || currentState === 'Converted') totalQualifiedCount++;
    if (currentState === 'Converted') totalConvertedCount++;

    // d. Lead Quality Scoring
    const score = calculateLeadScore(timeline, currentState, cluster.primary_phone);

    const firstSeen = timeline.length > 0 ? timeline[0].timestamp : new Date().toISOString();
    const lastSeen = timeline.length > 0 ? timeline[timeline.length - 1].timestamp : firstSeen;

    canonicalLeads.push({
      lead_id: cluster.canonical_id,
      canonical_email: cluster.primary_email,
      phone: cluster.primary_phone,
      name: cluster.primary_name,
      current_state: currentState,
      attributed_campaign: attribution.selected_campaign,
      attributed_source: attribution.selected_source,
      attribution_explanation: attribution,
      duplicate_count: cluster.duplicate_count,
      interaction_count: timeline.length,
      has_conflict: hasConflict,
      conflicts,
      timeline,
      merged_event_ids: cluster.events.map(e => e.event_id),
      score,
      first_seen: firstSeen,
      last_seen: lastSeen,
    });
  }

  // Sort canonical leads deterministically by lead_id
  canonicalLeads.sort((a, b) => a.lead_id.localeCompare(b.lead_id));

  // Sort audit records deterministically by timestamp, then lead_id, then id
  allAuditRecords.sort((a, b) => {
    const timeDiff = a.timestamp.localeCompare(b.timestamp);
    if (timeDiff !== 0) return timeDiff;
    const leadDiff = a.lead_id.localeCompare(b.lead_id);
    if (leadDiff !== 0) return leadDiff;
    return a.id.localeCompare(b.id);
  });

  // --- Step 5: Campaign & Source Reporting ---
  const campaignReport = generateCampaignReport(canonicalLeads);
  const sourceReport = generateSourceReport(canonicalLeads);

  // Optional SEO report
  let seoReport: SEOKeywordRow[] | undefined;
  if (options.seoData && options.seoData.length > 0) {
    seoReport = processSEOKeywords(options.seoData);
  }

  const executionTimeMs = Date.now() - startTime;
  const overallConversionRate =
    canonicalLeads.length > 0
      ? Number(((totalConvertedCount / canonicalLeads.length) * 100).toFixed(2))
      : 0.0;

  const summary: PipelineSummary = {
    total_raw_events: rawEvents.length,
    valid_events: validRawEvents.length,
    rejected_records: validationErrors.length,
    duplicate_records:
      canonicalLeads.reduce((sum, l) => sum + l.duplicate_count, 0) + duplicateEventIdCount,
    unique_leads: canonicalLeads.length,
    qualified_leads: totalQualifiedCount,
    converted_leads: totalConvertedCount,
    overall_conversion_rate: overallConversionRate,
    reconciliation_conflicts: totalConflictsCount,
    processed_at: new Date().toISOString(),
    execution_time_ms: executionTimeMs,
  };

  const result: PipelineResult = {
    summary,
    leads: canonicalLeads,
    campaign_report: campaignReport,
    source_report: sourceReport,
    audit_trail: allAuditRecords,
    validation_errors: validationErrors,
    seo_report: seoReport,
  };

  return result;
}
