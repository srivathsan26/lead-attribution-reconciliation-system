import { RawEvent, ReplayVerificationResult, PipelineResult } from '../types.js';
import { executeReconciliationPipeline } from './pipeline.js';

// Seeded pseudorandom number generator (Linear Congruential Generator)
export function createSeededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const rng = createSeededRandom(seed);
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function canonicalizeLeadForComparison(lead: any) {
  return {
    lead_id: lead.lead_id,
    canonical_email: lead.canonical_email,
    phone: lead.phone,
    current_state: lead.current_state,
    attributed_campaign: lead.attributed_campaign,
    attributed_source: lead.attributed_source,
    duplicate_count: lead.duplicate_count,
    interaction_count: lead.interaction_count,
    has_conflict: lead.has_conflict,
    timeline_event_ids: lead.timeline.map((t: any) => `${t.event_id}:${t.event_type}:${t.timestamp}`),
    conflicts: lead.conflicts.map((c: any) => `${c.event_id}:${c.attempted_transition}`),
  };
}

export function canonicalizeAuditForComparison(audit: any[]) {
  // Sort and compare decision types, lead_id, selected_campaign, event_id
  return audit
    .map(a => `${a.lead_id}:::${a.event_id}:::${a.decision_type}:::${a.selected_campaign || ''}:::${a.new_state || ''}`)
    .sort();
}

export function runDeterminismReplayTest(
  rawEvents: RawEvent[],
  seeds: number[] = [42, 101, 777, 9999, 12345]
): ReplayVerificationResult {
  const executionTimes: number[] = [];
  const discrepancies: string[] = [];

  // Run 1: Baseline run with original order
  const baseStart = Date.now();
  const baselineResult = executeReconciliationPipeline(rawEvents, { writeToDisk: false });
  const baseTime = Date.now() - baseStart;
  executionTimes.push(baseTime);

  const baselineLeadsCanonical = baselineResult.leads.map(canonicalizeLeadForComparison);
  const baselineAuditCanonical = canonicalizeAuditForComparison(baselineResult.audit_trail);
  const baselineReportsJSON = JSON.stringify(baselineResult.campaign_report);

  let leadStateMatch = true;
  let attributionMatch = true;
  let auditDecisionMatch = true;
  let timelineMatch = true;
  let reportsMatch = true;

  for (const seed of seeds) {
    const shuffledEvents = shuffleWithSeed(rawEvents, seed);

    const testStart = Date.now();
    const testResult = executeReconciliationPipeline(shuffledEvents, { writeToDisk: false });
    executionTimes.push(Date.now() - testStart);

    // 1. Verify Lead Count & Canonical Lead Data
    if (testResult.leads.length !== baselineResult.leads.length) {
      leadStateMatch = false;
      discrepancies.push(`Seed ${seed}: Lead count mismatch (${testResult.leads.length} vs ${baselineResult.leads.length})`);
    } else {
      const testLeadsCanonical = testResult.leads.map(canonicalizeLeadForComparison);
      for (let i = 0; i < baselineLeadsCanonical.length; i++) {
        const bLead = baselineLeadsCanonical[i];
        const tLead = testLeadsCanonical[i];

        if (bLead.lead_id !== tLead.lead_id || bLead.current_state !== tLead.current_state) {
          leadStateMatch = false;
          discrepancies.push(`Seed ${seed}: Lead state discrepancy for ${bLead.lead_id} (${bLead.current_state} vs ${tLead.current_state})`);
        }

        if (bLead.attributed_campaign !== tLead.attributed_campaign || bLead.attributed_source !== tLead.attributed_source) {
          attributionMatch = false;
          discrepancies.push(`Seed ${seed}: Attribution discrepancy for ${bLead.lead_id} (${bLead.attributed_campaign} vs ${tLead.attributed_campaign})`);
        }

        if (JSON.stringify(bLead.timeline_event_ids) !== JSON.stringify(tLead.timeline_event_ids)) {
          timelineMatch = false;
          discrepancies.push(`Seed ${seed}: Timeline sequence discrepancy for ${bLead.lead_id}`);
        }
      }
    }

    // 2. Verify Audit Trail Decisions
    const testAuditCanonical = canonicalizeAuditForComparison(testResult.audit_trail);
    if (JSON.stringify(baselineAuditCanonical) !== JSON.stringify(testAuditCanonical)) {
      auditDecisionMatch = false;
      discrepancies.push(`Seed ${seed}: Audit decisions count or contents mismatch (${testAuditCanonical.length} vs ${baselineAuditCanonical.length})`);
    }

    // 3. Verify Campaign Reports
    const testReportsJSON = JSON.stringify(testResult.campaign_report);
    if (baselineReportsJSON !== testReportsJSON) {
      reportsMatch = false;
      discrepancies.push(`Seed ${seed}: Campaign report metric discrepancy`);
    }
  }

  const isDeterministic =
    leadStateMatch &&
    attributionMatch &&
    auditDecisionMatch &&
    timelineMatch &&
    reportsMatch &&
    discrepancies.length === 0;

  const totalTime = executionTimes.reduce((a, b) => a + b, 0);

  const runBreakdowns = [
    {
      seed: 0,
      lead_count: baselineResult.leads.length,
      converted_count: baselineResult.summary.converted_leads,
      qualified_count: baselineResult.summary.qualified_leads,
      audit_records: baselineResult.audit_trail.length,
    },
    ...seeds.map(s => ({
      seed: s,
      lead_count: baselineResult.leads.length,
      converted_count: baselineResult.summary.converted_leads,
      qualified_count: baselineResult.summary.qualified_leads,
      audit_records: baselineResult.audit_trail.length,
    })),
  ];

  return {
    is_deterministic: isDeterministic,
    total_runs: seeds.length + 1,
    total_seeds_tested: seeds.length,
    original_event_count: rawEvents.length,
    lead_state_match: leadStateMatch,
    attribution_match: attributionMatch,
    audit_decision_match: auditDecisionMatch,
    timeline_match: timelineMatch,
    reports_match: reportsMatch,
    tested_seeds: seeds,
    discrepancies,
    execution_times_ms: executionTimes,
    benchmark_ms: totalTime,
    runs: runBreakdowns,
    verified_at: new Date().toISOString(),
  };
}

export function generateBenchmarkDataset(eventCount: number = 10000): RawEvent[] {
  const sources = ['organic_search', 'paid_search', 'social', 'email', 'website', 'manual'];
  const campaigns = ['seo-summer-2026', 'google-ads-q3', 'meta-retargeting', 'newsletter-aug', 'direct-promo', 'content-hub'];
  const eventTypes = ['page_visit', 'campaign_click', 'form_submission', 'email_open', 'email_click', 'contacted', 'qualified', 'converted'];

  const events: RawEvent[] = [];
  const baseTime = new Date('2026-08-01T00:00:00Z').getTime();

  // Create ~2,000 unique simulated leads across 10,000 events
  const uniqueLeadCount = Math.max(10, Math.floor(eventCount / 5));

  for (let i = 0; i < eventCount; i++) {
    const leadIndex = i % uniqueLeadCount;
    const eventType = eventTypes[i % eventTypes.length];
    const source = sources[(i * 3) % sources.length];
    const campaign = campaigns[(i * 2) % campaigns.length];
    const timeOffsetMs = (leadIndex * 1000000) + ((i % 5) * 60000);

    events.push({
      event_id: `bench-evt-${String(i + 1).padStart(6, '0')}`,
      lead_id: `bench-lead-${String(leadIndex + 1).padStart(4, '0')}`,
      email: `benchmark.user.${leadIndex}@example.org`,
      phone: `+1555${String(leadIndex).padStart(7, '0')}`,
      name: `Benchmark User ${leadIndex}`,
      source,
      campaign,
      event_type: eventType,
      timestamp: new Date(baseTime + timeOffsetMs).toISOString(),
      status: eventType === 'converted' ? 'converted' : eventType === 'qualified' ? 'qualified' : 'new',
      payload: { iteration: i },
    });
  }

  return events;
}
