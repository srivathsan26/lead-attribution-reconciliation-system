import { JourneyStep, AttributionExplanation, AuditRecord, SourceType } from '../types.js';

export const DEFAULT_SOURCE_PRECEDENCE: SourceType[] = [
  'organic_search',
  'paid_search',
  'email',
  'social',
  'website',
  'manual',
];

export function getSourcePriority(source: string, customPrecedence?: string[]): number {
  const precedence = customPrecedence || DEFAULT_SOURCE_PRECEDENCE;
  const index = precedence.indexOf(source.toLowerCase());
  return index === -1 ? 999 : index;
}

export function determineCampaignAttribution(
  leadId: string,
  timeline: JourneyStep[],
  customSourcePrecedence?: string[]
): {
  attribution: AttributionExplanation;
  attributionAuditRecords: AuditRecord[];
} {
  const sourcePrecedence = customSourcePrecedence || DEFAULT_SOURCE_PRECEDENCE;
  const attributionAuditRecords: AuditRecord[] = [];

  // All distinct campaign IDs present across the timeline
  const candidateCampaigns = Array.from(
    new Set(timeline.map(step => step.campaign).filter(c => Boolean(c && c.trim())))
  ).sort();

  // Edge case: No campaign interaction anywhere in the journey
  if (candidateCampaigns.length === 0) {
    const firstStep = timeline[0];
    const fallbackSource = firstStep ? firstStep.source : 'website';
    const explanation: AttributionExplanation = {
      selected_campaign: 'Direct / Unattributed',
      selected_source: fallbackSource,
      rule_applied: 'None (Direct Traffic)',
      reason: 'No campaign parameters were detected in any interaction for this lead. Attributed to direct / organic touchpoint.',
      candidate_campaigns: [],
    };

    attributionAuditRecords.push({
      id: `audit-attr-${leadId}`,
      lead_id: leadId,
      event_id: firstStep ? firstStep.event_id : 'direct',
      decision_type: 'ATTRIBUTION_SELECTION',
      previous_state: null,
      new_state: null,
      selected_campaign: 'Direct / Unattributed',
      candidate_campaigns: [],
      reason: explanation.reason,
      timestamp: firstStep ? firstStep.timestamp : new Date().toISOString(),
    });

    return { attribution: explanation, attributionAuditRecords };
  }

  // --- Rule 1: Conversion campaign ---
  // If a valid conversion event contains a non-empty campaign
  const conversionEvents = timeline.filter(
    step => step.event_type === 'converted' && Boolean(step.campaign && step.campaign.trim())
  );

  if (conversionEvents.length > 0) {
    // If multiple conversion events exist, take the earliest or latest conversion event
    const conv = conversionEvents[0];
    const explanation: AttributionExplanation = {
      selected_campaign: conv.campaign,
      selected_source: conv.source,
      rule_applied: 'Rule 1: Conversion Event Campaign',
      reason: `Conversion event ${conv.event_id} was directly associated with campaign "${conv.campaign}". Under Rule 1, the converting touchpoint takes primary attribution.`,
      candidate_campaigns: candidateCampaigns,
      conversion_event_id: conv.event_id,
    };

    attributionAuditRecords.push({
      id: `audit-attr-${leadId}`,
      lead_id: leadId,
      event_id: conv.event_id,
      decision_type: 'ATTRIBUTION_SELECTION',
      previous_state: null,
      new_state: null,
      selected_campaign: conv.campaign,
      candidate_campaigns: candidateCampaigns,
      reason: explanation.reason,
      timestamp: conv.timestamp,
    });

    return { attribution: explanation, attributionAuditRecords };
  }

  // --- Rule 2: Pre-qualification interaction ---
  // If no conversion campaign exists, select the latest valid campaign interaction occurring before or at qualification
  const qualificationIndex = timeline.findIndex(step => step.event_type === 'qualified');
  let eligibleSteps: JourneyStep[];

  if (qualificationIndex !== -1) {
    const qualStep = timeline[qualificationIndex];
    // Interactions before or equal to qualification timestamp
    eligibleSteps = timeline.filter(
      step =>
        Boolean(step.campaign && step.campaign.trim()) &&
        step.timestamp <= qualStep.timestamp
    );
  } else {
    // If not qualified, look across all campaign interactions
    eligibleSteps = timeline.filter(step => Boolean(step.campaign && step.campaign.trim()));
  }

  if (eligibleSteps.length === 0) {
    // Fall back to any available campaign interaction in timeline
    eligibleSteps = timeline.filter(step => Boolean(step.campaign && step.campaign.trim()));
  }

  // Sort eligible steps to find the latest valid interaction
  // Order: timestamp DESC (latest), then source priority ASC, then campaign ID ASC (lexicographic)
  eligibleSteps.sort((a, b) => {
    // 1. Latest timestamp
    const timeCompare = b.timestamp.localeCompare(a.timestamp);
    if (timeCompare !== 0) return timeCompare;

    // 2. Rule 3: Source precedence
    const prioA = getSourcePriority(a.source, sourcePrecedence);
    const prioB = getSourcePriority(b.source, sourcePrecedence);
    if (prioA !== prioB) return prioA - prioB;

    // 3. Rule 4: Lexicographical smallest campaign ID
    return a.campaign.localeCompare(b.campaign);
  });

  const bestStep = eligibleSteps[0];
  const tiedCandidates = eligibleSteps.filter(
    s => s.timestamp === bestStep.timestamp && s.campaign !== bestStep.campaign
  );

  let ruleApplied = 'Rule 2: Pre-Qualification Interaction';
  let reason = '';

  if (tiedCandidates.length > 0) {
    // Check if tie was resolved by source precedence or lexicographical
    const sameSourceTies = tiedCandidates.filter(
      s => getSourcePriority(s.source, sourcePrecedence) === getSourcePriority(bestStep.source, sourcePrecedence)
    );

    if (sameSourceTies.length > 0) {
      ruleApplied = 'Rule 4: Lexicographic Campaign Tie-Breaker';
      reason = `No conversion campaign existed. Competing campaigns (${candidateCampaigns.join(', ')}) were tied at timestamp ${bestStep.timestamp} with identical source precedence (${bestStep.source}). Tie was deterministically broken by selecting lexicographically smallest campaign ID "${bestStep.campaign}".`;

      attributionAuditRecords.push({
        id: `audit-tie-${leadId}`,
        lead_id: leadId,
        event_id: bestStep.event_id,
        decision_type: 'TIE_BREAK',
        previous_state: null,
        new_state: null,
        selected_campaign: bestStep.campaign,
        candidate_campaigns: candidateCampaigns,
        reason: `Lexicographical tie-breaker applied between tied candidates [${candidateCampaigns.join(', ')}]. Selected "${bestStep.campaign}".`,
        timestamp: bestStep.timestamp,
      });
    } else {
      ruleApplied = 'Rule 3: Source Precedence Tie-Break';
      reason = `No conversion campaign existed. Competing campaigns had identical interaction timestamp ${bestStep.timestamp}. Selected "${bestStep.campaign}" because source "${bestStep.source}" has higher precedence in [${sourcePrecedence.join(' > ')}].`;
    }
  } else {
    if (qualificationIndex !== -1) {
      reason = `No conversion campaign existed. Campaign "${bestStep.campaign}" was selected as the latest valid interaction before lead qualification (event ${bestStep.event_id} at ${bestStep.timestamp}).`;
    } else {
      reason = `No conversion or qualification campaign existed. Campaign "${bestStep.campaign}" was the latest active touchpoint in the journey (event ${bestStep.event_id} at ${bestStep.timestamp}).`;
    }
  }

  const explanation: AttributionExplanation = {
    selected_campaign: bestStep.campaign,
    selected_source: bestStep.source,
    rule_applied: ruleApplied,
    reason,
    candidate_campaigns: candidateCampaigns,
    qualifying_event_id: qualificationIndex !== -1 ? timeline[qualificationIndex].event_id : undefined,
  };

  attributionAuditRecords.push({
    id: `audit-attr-${leadId}`,
    lead_id: leadId,
    event_id: bestStep.event_id,
    decision_type: 'ATTRIBUTION_SELECTION',
    previous_state: null,
    new_state: null,
    selected_campaign: bestStep.campaign,
    candidate_campaigns: candidateCampaigns,
    reason: explanation.reason,
    timestamp: bestStep.timestamp,
  });

  return { attribution: explanation, attributionAuditRecords };
}
