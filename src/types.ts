export type SourceType =
  | 'organic_search'
  | 'paid_search'
  | 'social'
  | 'email'
  | 'website'
  | 'manual';

export type LeadSource = SourceType | string;

export type EventType =
  | 'page_visit'
  | 'campaign_click'
  | 'form_submission'
  | 'email_open'
  | 'email_click'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'lost'
  | string;

export type LeadState =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Converted'
  | 'Lost';

export type QualityTier = 'Low' | 'Medium' | 'High';

export type DecisionType =
  | 'DUPLICATE_MERGE'
  | 'ATTRIBUTION_SELECTION'
  | 'STATE_CHANGE'
  | 'STATE_CONFLICT'
  | 'VALIDATION_REJECTION'
  | 'TIE_BREAK'
  | 'LATE_EVENT_REORDER';

export interface RawEvent {
  event_id?: string;
  lead_id?: string;
  email?: string;
  phone?: string;
  name?: string;
  source?: string;
  campaign?: string;
  event_type?: string;
  timestamp?: string;
  status?: string;
  payload?: Record<string, any> | string;
  [key: string]: any;
}

export interface ValidationError {
  event_id: string;
  error_type:
    | 'MISSING_EVENT_ID'
    | 'MISSING_LEAD_IDENTITY'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_SOURCE'
    | 'INVALID_EVENT_TYPE'
    | 'MALFORMED_RECORD'
    | 'INVALID_FIELD_TYPE';
  field: string;
  message: string;
  raw_record?: any;
}

export interface NormalizedEvent {
  event_id: string;
  lead_id: string;
  email: string;
  phone: string;
  name: string;
  source: string;
  campaign: string;
  event_type: string;
  timestamp: string; // ISO 8601 UTC
  status: string;
  payload: Record<string, any>;
  arrival_index: number;
}

export interface JourneyStep {
  event_id: string;
  event_type: string;
  timestamp: string;
  campaign: string;
  source: string;
  status: string;
  name?: string;
  email?: string;
  phone?: string;
  is_late_arrival?: boolean;
}

export interface AttributionExplanation {
  selected_campaign: string;
  selected_source: string;
  rule_applied: string;
  reason: string;
  candidate_campaigns: string[];
  conversion_event_id?: string;
  qualifying_event_id?: string;
}

export interface StateConflict {
  event_id: string;
  attempted_transition: string;
  current_state: LeadState;
  timestamp: string;
  reason: string;
}

export interface LeadScore {
  score: number;
  tier: QualityTier;
  breakdown: {
    form_submission: number;
    email_clicks: number;
    email_opens: number;
    campaign_clicks: number;
    phone_provided: number;
    qualified: number;
    converted: number;
    interaction_density: number;
  };
}

export interface CanonicalLead {
  lead_id: string;
  canonical_email: string;
  phone: string;
  name: string;
  current_state: LeadState;
  attributed_campaign: string;
  attributed_source: string;
  attribution_explanation: AttributionExplanation;
  duplicate_count: number;
  interaction_count: number;
  has_conflict: boolean;
  conflicts: StateConflict[];
  timeline: JourneyStep[];
  merged_event_ids: string[];
  score: LeadScore;
  first_seen: string;
  last_seen: string;
}

export interface AuditRecord {
  id: string;
  lead_id: string;
  event_id: string;
  decision_type: DecisionType;
  previous_state: string | null;
  new_state: string | null;
  selected_campaign: string | null;
  candidate_campaigns: string[];
  reason: string;
  timestamp: string;
}

export interface CampaignReportRow {
  campaign: string;
  source: string;
  unique_leads: number;
  qualified_leads: number;
  converted_leads: number;
  duplicate_leads: number;
  total_events: number;
  conversion_rate: number; // e.g. 25.0 (%)
}

export interface SourceReportRow {
  source: string;
  unique_leads: number;
  qualified_leads: number;
  converted_leads: number;
  total_events: number;
  conversion_rate: number;
}

export interface SEOKeywordRow {
  keyword: string;
  campaign: string;
  impressions: number;
  clicks: number;
  leads: number;
  leads_generated?: number;
  conversions: number;
  ctr: number; // Click-through-rate %
  conversion_rate: number; // Lead to conversion rate %
  avg_position?: number;
}

export interface PipelineSummary {
  total_raw_events: number;
  valid_events: number;
  rejected_records: number;
  duplicate_records: number;
  unique_leads: number;
  qualified_leads: number;
  converted_leads: number;
  overall_conversion_rate: number;
  reconciliation_conflicts: number;
  processed_at?: string;
  execution_time_ms?: number;
  processing_time_ms?: number;
  pipeline_timestamp?: string;
}

export interface PipelineResult {
  summary: PipelineSummary;
  leads: CanonicalLead[];
  campaign_report: CampaignReportRow[];
  source_report: SourceReportRow[];
  audit_trail: AuditRecord[];
  validation_errors: ValidationError[];
  seo_report?: SEOKeywordRow[];
}

export interface ReplayVerificationResult {
  is_deterministic: boolean;
  total_runs: number;
  original_event_count: number;
  lead_state_match: boolean;
  attribution_match: boolean;
  audit_decision_match: boolean;
  timeline_match: boolean;
  reports_match: boolean;
  tested_seeds: number[];
  discrepancies: string[];
  execution_times_ms: number[];
  verified_at: string;
  benchmark_ms?: number;
  total_seeds_tested?: number;
  runs?: Array<{
    seed: number;
    lead_count: number;
    converted_count: number;
    qualified_count: number;
    audit_records: number;
  }>;
}
