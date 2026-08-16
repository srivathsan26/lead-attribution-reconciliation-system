import { validateEvent, validateEventBatch } from '../src/engine/validation.js';
import { normalizeEmail, normalizePhone, normalizeName, normalizeEvent } from '../src/engine/normalization.js';
import { clusterAndDeduplicateEvents } from '../src/engine/deduplication.js';
import { reconstructLeadJourney } from '../src/engine/journey.js';
import { determineCampaignAttribution, getSourcePriority } from '../src/engine/attribution.js';
import { reconcileLeadState, mapEventToState } from '../src/engine/reconciliation.js';
import { calculateLeadScore } from '../src/engine/scoring.js';
import { executeReconciliationPipeline } from '../src/engine/pipeline.js';
import { runDeterminismReplayTest, generateBenchmarkDataset } from '../src/engine/replay.js';
import { DEFAULT_RAW_EVENTS, DEFAULT_SEO_DATA } from '../src/data/defaultData.js';
import { RawEvent } from '../src/types.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    const msg = `  ✗ FAIL: ${testName}${details ? ` -> ${details}` : ''}`;
    console.error(msg);
    failures.push(msg);
  }
}

function describe(suiteName: string, fn: () => void) {
  console.log(`\n========================================`);
  console.log(`SUITE: ${suiteName}`);
  console.log(`========================================`);
  fn();
}

console.log('Starting LeadSync Automated Test Suite...\n');

// 1. DATA VALIDATION
describe('1. Data Validation Tests', () => {
  const validEvt: RawEvent = {
    event_id: 'evt-test-1',
    email: 'user@example.com',
    source: 'organic_search',
    event_type: 'page_visit',
    timestamp: '2026-08-15T10:00:00Z',
  };
  assert(validateEvent(validEvt).isValid === true, 'Valid event passes validation');
  assert(validateEvent({ ...validEvt, source: 'website' }).isValid === true, 'Valid source "website" accepted');
  assert(validateEvent({ ...validEvt, source: 'social' }).isValid === true, 'Valid source "social" accepted');
  assert(validateEvent({ ...validEvt, source: 'referral' }).isValid === false, 'Removed source "referral" rejected');
  assert(validateEvent({ ...validEvt, source: 'direct' }).isValid === false, 'Removed source "direct" rejected');

  assert(
    validateEvent({ ...validEvt, event_id: '' }).isValid === false,
    'Missing event_id rejected'
  );

  assert(
    validateEvent({ ...validEvt, email: '', phone: '', lead_id: '' }).isValid === false,
    'Missing all lead identity rejected'
  );

  assert(
    validateEvent({ ...validEvt, timestamp: 'NOT_A_DATE' }).isValid === false,
    'Invalid timestamp rejected'
  );

  assert(
    validateEvent({ ...validEvt, source: 'invalid_source_channel' }).isValid === false,
    'Unsupported source rejected'
  );

  assert(
    validateEvent({ ...validEvt, event_type: 'unknown_action' }).isValid === false,
    'Unsupported event type rejected'
  );

  const batch = validateEventBatch([validEvt, { event_id: 'bad', timestamp: 'xyz' }]);
  assert(
    batch.validRawEvents.length === 1 && batch.validationErrors.length > 0,
    'Batch validation isolates bad records without crashing'
  );
});

// 2. NORMALIZATION
describe('2. Normalization Engine Tests', () => {
  assert(
    normalizeEmail('  John.Doe+promo@EXAMPLE.com ') === 'john.doe+promo@example.com',
    'Email lowercasing and trimming'
  );
  assert(normalizeEmail('not-an-email') === '', 'Invalid email normalization returns empty string');

  assert(
    normalizePhone(' +1 (555) 019-2834 ') === '+15550192834',
    'Phone formatting strips dashes, spaces, brackets and retains +'
  );

  assert(
    normalizeName('  sArAh   cOnNoR  ') === 'Sarah Connor',
    'Name whitespace collapse and capitalization'
  );

  const normEvt = normalizeEvent({
    event_id: 'e1',
    email: 'User@Test.Org',
    source: ' ORGANIC_SEARCH ',
    event_type: ' FORM_SUBMISSION ',
    campaign: '  Summer-Growth  ',
    timestamp: '2026-08-10T12:00:00Z',
  });
  assert(
    normEvt.email === 'user@test.org' &&
      normEvt.source === 'organic_search' &&
      normEvt.event_type === 'form_submission' &&
      normEvt.campaign === 'Summer-Growth',
    'Event batch normalization maps all fields correctly'
  );
});

// 3. DUPLICATE LEAD DETECTION
describe('3. Duplicate Lead Detection & Merging Tests', () => {
  const evts = [
    normalizeEvent({ event_id: 'e1', email: 'alice@corp.com', phone: '+15551111', timestamp: '2026-08-10T10:00:00Z' }),
    normalizeEvent({ event_id: 'e2', email: 'alice@corp.com', phone: '', timestamp: '2026-08-10T11:00:00Z' }),
    normalizeEvent({ event_id: 'e3', email: '', phone: '+15551111', timestamp: '2026-08-10T12:00:00Z' }),
    normalizeEvent({ event_id: 'e4', email: 'bob@corp.com', phone: '+15552222', timestamp: '2026-08-10T10:00:00Z' }),
  ];

  const { clusters, duplicateAuditRecords } = clusterAndDeduplicateEvents(evts);
  assert(clusters.length === 2, 'Events clustered into 2 distinct canonical leads (Alice and Bob)');

  const aliceCluster = clusters.find(c => c.primary_email === 'alice@corp.com');
  assert(
    aliceCluster !== undefined && aliceCluster.events.length === 3 && aliceCluster.duplicate_count === 2,
    'Rule A and Rule B correctly clustered email and phone linked touchpoints with duplicate_count = 2'
  );
  assert(
    duplicateAuditRecords.some(a => a.decision_type === 'DUPLICATE_MERGE'),
    'Audit records emitted for DUPLICATE_MERGE'
  );
});

// 4. CHRONOLOGICAL JOURNEY RECONSTRUCTION
describe('4. Chronological Journey Reconstruction Tests', () => {
  // Arriving out of chronological order: converted -> page_visit -> qualified -> campaign_click
  const outOfOrderEvents = [
    normalizeEvent({ event_id: 'e4', timestamp: '2026-08-10T12:00:00Z', event_type: 'converted' }, 0),
    normalizeEvent({ event_id: 'e1', timestamp: '2026-08-10T09:00:00Z', event_type: 'page_visit' }, 1),
    normalizeEvent({ event_id: 'e3', timestamp: '2026-08-10T11:00:00Z', event_type: 'qualified' }, 2),
    normalizeEvent({ event_id: 'e2', timestamp: '2026-08-10T10:00:00Z', event_type: 'campaign_click' }, 3),
  ];

  const { timeline, lateEventAuditRecords } = reconstructLeadJourney('lead-test', outOfOrderEvents);
  assert(
    timeline[0].event_type === 'page_visit' &&
      timeline[1].event_type === 'campaign_click' &&
      timeline[2].event_type === 'qualified' &&
      timeline[3].event_type === 'converted',
    'Journey timeline chronologically reconstructed regardless of arrival order'
  );
  assert(
    lateEventAuditRecords.some(a => a.decision_type === 'LATE_EVENT_REORDER'),
    'Late-arriving events logged to audit trail'
  );
});

// 5. CAMPAIGN ATTRIBUTION HIERARCHY
describe('5. Campaign Attribution Engine (Rules 1-4) Tests', () => {
  // Rule 1: Conversion Campaign
  const journeyRule1 = [
    { event_id: '1', event_type: 'page_visit', timestamp: '2026-08-10T09:00:00Z', campaign: 'seo-top', source: 'organic_search', status: 'new' },
    { event_id: '2', event_type: 'qualified', timestamp: '2026-08-10T10:00:00Z', campaign: 'email-nurture', source: 'email', status: 'qualified' },
    { event_id: '3', event_type: 'converted', timestamp: '2026-08-10T11:00:00Z', campaign: 'checkout-promo', source: 'website', status: 'converted' },
  ];
  const attr1 = determineCampaignAttribution('l1', journeyRule1);
  assert(
    attr1.attribution.selected_campaign === 'checkout-promo' &&
      attr1.attribution.rule_applied.includes('Rule 1'),
    'Rule 1: Conversion campaign takes primary attribution'
  );

  // Rule 2: Pre-Qualification interaction
  const journeyRule2 = [
    { event_id: '1', event_type: 'page_visit', timestamp: '2026-08-10T09:00:00Z', campaign: 'seo-initial', source: 'organic_search', status: 'new' },
    { event_id: '2', event_type: 'campaign_click', timestamp: '2026-08-10T10:00:00Z', campaign: 'google-ads-q3', source: 'paid_search', status: 'new' },
    { event_id: '3', event_type: 'qualified', timestamp: '2026-08-10T11:00:00Z', campaign: '', source: 'manual', status: 'qualified' },
    { event_id: '4', event_type: 'converted', timestamp: '2026-08-10T12:00:00Z', campaign: '', source: 'website', status: 'converted' },
  ];
  const attr2 = determineCampaignAttribution('l2', journeyRule2);
  assert(
    attr2.attribution.selected_campaign === 'google-ads-q3' &&
      attr2.attribution.rule_applied.includes('Rule 2'),
    'Rule 2: Latest campaign before qualification chosen when conversion has no campaign'
  );

  // Rule 3: Source Precedence on tied timestamp
  assert(getSourcePriority('organic_search') === 0, 'Source priority 0 is organic_search');
  assert(getSourcePriority('paid_search') === 1, 'Source priority 1 is paid_search');
  assert(getSourcePriority('email') === 2, 'Source priority 2 is email');
  assert(getSourcePriority('social') === 3, 'Source priority 3 is social');
  assert(getSourcePriority('website') === 4, 'Source priority 4 is website');
  assert(getSourcePriority('manual') === 5, 'Source priority 5 is manual');

  // Rule 3 (Test A): organic_search vs paid_search
  const journeyRule3A = [
    { event_id: '1', event_type: 'campaign_click', timestamp: '2026-08-10T10:00:00Z', campaign: 'paid-ad-01', source: 'paid_search', status: 'new' },
    { event_id: '2', event_type: 'page_visit', timestamp: '2026-08-10T10:00:00Z', campaign: 'organic-seo-01', source: 'organic_search', status: 'new' },
    { event_id: '3', event_type: 'qualified', timestamp: '2026-08-10T11:00:00Z', campaign: '', source: 'manual', status: 'qualified' },
  ];
  const attr3A = determineCampaignAttribution('l3a', journeyRule3A);
  assert(
    attr3A.attribution.selected_campaign === 'organic-seo-01' &&
      attr3A.attribution.rule_applied.includes('Rule 3'),
    'Rule 3: Organic search precedence wins over paid search on tied timestamp'
  );

  // Rule 3 (Test B): email vs social (PRD ordering check: email > social)
  const journeyRule3B = [
    { event_id: '1', event_type: 'campaign_click', timestamp: '2026-08-10T10:00:00Z', campaign: 'social-meta-01', source: 'social', status: 'new' },
    { event_id: '2', event_type: 'email_click', timestamp: '2026-08-10T10:00:00Z', campaign: 'newsletter-email-01', source: 'email', status: 'new' },
  ];
  const attr3B = determineCampaignAttribution('l3b', journeyRule3B);
  assert(
    attr3B.attribution.selected_campaign === 'newsletter-email-01' &&
      attr3B.attribution.selected_source === 'email',
    'Rule 3: Email precedence wins over social on tied timestamp'
  );

  // Rule 3 (Test C): social vs website (PRD ordering check: social > website)
  const journeyRule3C = [
    { event_id: '1', event_type: 'page_visit', timestamp: '2026-08-10T10:00:00Z', campaign: 'website-banner-01', source: 'website', status: 'new' },
    { event_id: '2', event_type: 'campaign_click', timestamp: '2026-08-10T10:00:00Z', campaign: 'social-tiktok-01', source: 'social', status: 'new' },
  ];
  const attr3C = determineCampaignAttribution('l3c', journeyRule3C);
  assert(
    attr3C.attribution.selected_campaign === 'social-tiktok-01' &&
      attr3C.attribution.selected_source === 'social',
    'Rule 3: Social precedence wins over website on tied timestamp'
  );

  // Rule 3 (Test D): website vs manual (PRD ordering check: website > manual)
  const journeyRule3D = [
    { event_id: '1', event_type: 'page_visit', timestamp: '2026-08-10T10:00:00Z', campaign: 'manual-import-01', source: 'manual', status: 'new' },
    { event_id: '2', event_type: 'page_visit', timestamp: '2026-08-10T10:00:00Z', campaign: 'website-direct-01', source: 'website', status: 'new' },
  ];
  const attr3D = determineCampaignAttribution('l3d', journeyRule3D);
  assert(
    attr3D.attribution.selected_campaign === 'website-direct-01' &&
      attr3D.attribution.selected_source === 'website',
    'Rule 3: Website precedence wins over manual on tied timestamp'
  );

  // Rule 4: Lexicographic tie-breaker on identical timestamp AND source
  const journeyRule4 = [
    { event_id: '1', event_type: 'page_visit', timestamp: '2026-08-10T10:00:00Z', campaign: 'campaign-beta', source: 'organic_search', status: 'new' },
    { event_id: '2', event_type: 'page_visit', timestamp: '2026-08-10T10:00:00Z', campaign: 'campaign-alpha', source: 'organic_search', status: 'new' },
  ];
  const attr4 = determineCampaignAttribution('l4', journeyRule4);
  assert(
    attr4.attribution.selected_campaign === 'campaign-alpha' &&
      attr4.attribution.rule_applied.includes('Rule 4'),
    'Rule 4: Lexicographically smaller campaign ID breaks tied candidate campaigns'
  );
});

// 6. LEAD STATE RECONCILIATION & CONFLICT DETECTION
describe('6. Lead State Reconciliation & Conflict Detection Tests', () => {
  // Normal progression
  const normalTimeline = [
    { event_id: '1', event_type: 'page_visit', timestamp: '2026-08-10T09:00:00Z', campaign: '', source: 'website', status: 'new' },
    { event_id: '2', event_type: 'contacted', timestamp: '2026-08-10T10:00:00Z', campaign: '', source: 'manual', status: 'contacted' },
    { event_id: '3', event_type: 'qualified', timestamp: '2026-08-10T11:00:00Z', campaign: '', source: 'manual', status: 'qualified' },
    { event_id: '4', event_type: 'converted', timestamp: '2026-08-10T12:00:00Z', campaign: '', source: 'website', status: 'converted' },
  ];
  const rec1 = reconcileLeadState('lead-1', normalTimeline);
  assert(rec1.currentState === 'Converted' && !rec1.hasConflict, 'Normal progression reaches Converted without conflicts');

  // Conflict: Converted followed by New
  const conflictTimeline = [
    ...normalTimeline,
    { event_id: '5', event_type: 'page_visit', timestamp: '2026-08-10T13:00:00Z', campaign: '', source: 'website', status: 'new' },
  ];
  const rec2 = reconcileLeadState('lead-2', conflictTimeline);
  assert(
    rec2.currentState === 'Converted' && rec2.hasConflict === true && rec2.conflicts.length > 0,
    'Invalid transition (Converted -> New) flags conflict and retains Converted state'
  );

  // Conflict: Lost followed by Converted (Invalid Transition C: state must remain 'Lost')
  const lostToConvTimeline = [
    { event_id: '1', event_type: 'form_submission', timestamp: '2026-08-10T09:00:00Z', campaign: '', source: 'website', status: 'new' },
    { event_id: '2', event_type: 'lost', timestamp: '2026-08-10T10:00:00Z', campaign: '', source: 'manual', status: 'lost' },
    { event_id: '3', event_type: 'converted', timestamp: '2026-08-10T11:00:00Z', campaign: '', source: 'website', status: 'converted' },
  ];
  const rec3 = reconcileLeadState('lead-070', lostToConvTimeline);
  assert(
    rec3.hasConflict === true &&
      rec3.conflicts.some(c => c.attempted_transition === 'Lost -> Converted') &&
      rec3.currentState === 'Lost',
    'Invalid Transition C (Lost -> Converted): flags conflict and retains Lost state'
  );

  // Conflict: Qualified followed by Contacted (Regression: state must remain 'Qualified')
  const qualToContTimeline = [
    { event_id: '1', event_type: 'form_submission', timestamp: '2026-08-10T09:00:00Z', campaign: '', source: 'website', status: 'new' },
    { event_id: '2', event_type: 'qualified', timestamp: '2026-08-10T10:00:00Z', campaign: '', source: 'manual', status: 'qualified' },
    { event_id: '3', event_type: 'contacted', timestamp: '2026-08-10T11:00:00Z', campaign: '', source: 'manual', status: 'contacted' },
  ];
  const rec4 = reconcileLeadState('lead-4', qualToContTimeline);
  assert(
    rec4.hasConflict === true &&
      rec4.conflicts.some(c => c.attempted_transition === 'Qualified -> Contacted') &&
      rec4.currentState === 'Qualified',
    'Invalid regression (Qualified -> Contacted): flags conflict and retains Qualified state'
  );
});

// 7. LEAD QUALITY SCORING
describe('7. Lead Quality Scoring Tests', () => {
  const convertedTimeline = [
    { event_id: '1', event_type: 'form_submission', timestamp: '2026-08-10T09:00:00Z', campaign: 'c1', source: 'website', status: 'new' },
    { event_id: '2', event_type: 'email_click', timestamp: '2026-08-10T10:00:00Z', campaign: 'c1', source: 'email', status: 'contacted' },
    { event_id: '3', event_type: 'campaign_click', timestamp: '2026-08-10T11:00:00Z', campaign: 'c1', source: 'paid_search', status: 'new' },
    { event_id: '4', event_type: 'converted', timestamp: '2026-08-10T12:00:00Z', campaign: 'c1', source: 'website', status: 'converted' },
  ];
  const score1 = calculateLeadScore(convertedTimeline, 'Converted', '+15550192834');
  assert(score1.score >= 70 && score1.tier === 'High', 'Highly engaged converted lead receives High quality tier (>=70)');

  const lowTimeline = [
    { event_id: '1', event_type: 'page_visit', timestamp: '2026-08-10T09:00:00Z', campaign: 'c1', source: 'organic_search', status: 'new' },
  ];
  const score2 = calculateLeadScore(lowTimeline, 'New', '');
  assert(score2.score < 40 && score2.tier === 'Low', 'Single page visit lead receives Low quality tier (<40)');
});

// 8. IDEMPOTENCY
describe('8. Idempotency Tests', () => {
  const baseResult = executeReconciliationPipeline(DEFAULT_RAW_EVENTS, { writeToDisk: false });
  // Duplicate all events in input
  const duplicatedEvents = [...DEFAULT_RAW_EVENTS, ...DEFAULT_RAW_EVENTS];
  const dupResult = executeReconciliationPipeline(duplicatedEvents, { writeToDisk: false });

  assert(
    baseResult.leads.length === dupResult.leads.length,
    'Processing duplicate event_ids does not create extra canonical leads'
  );
  assert(
    baseResult.summary.converted_leads === dupResult.summary.converted_leads,
    'Processing duplicate event_ids does not artificially increment converted leads'
  );
  assert(
    baseResult.summary.qualified_leads === dupResult.summary.qualified_leads,
    'Processing duplicate event_ids does not distort qualified lead metrics'
  );
});

// 9. REPLAY DETERMINISM
describe('9. Replay Determinism Verification Tests', () => {
  const replayResult = runDeterminismReplayTest(DEFAULT_RAW_EVENTS, [42, 101, 777, 9999]);
  assert(replayResult.is_deterministic === true, 'Multi-seed arrival shuffling produces 100% identical outputs');
  assert(replayResult.lead_state_match === true, 'Replay lead states match perfectly');
  assert(replayResult.attribution_match === true, 'Replay campaign attributions match perfectly');
  assert(replayResult.audit_decision_match === true, 'Replay audit trail decisions match perfectly');
});

// 10. BENCHMARKING PERFORMANCE (10,000 EVENTS)
describe('10. Performance Benchmark (10,000 Events)', () => {
  console.log('  Generating 10,000 synthetic marketing event dataset...');
  const benchEvents = generateBenchmarkDataset(10000);
  const benchStart = Date.now();
  const benchResult = executeReconciliationPipeline(benchEvents, { writeToDisk: false });
  const durationMs = Date.now() - benchStart;

  console.log(`  Processed 10,000 events in ${durationMs} ms (${benchResult.leads.length} unique leads derived).`);
  assert(durationMs < 10000, `Processing 10,000 events took ${durationMs}ms (Target < 10,000ms)`);
});

console.log(`\n========================================`);
console.log(`TEST SUMMARY:`);
console.log(`Total Assertions: ${totalTests}`);
console.log(`Passed:           ${passedTests}`);
console.log(`Failed:           ${failedTests}`);
console.log(`========================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('All tests passed successfully!\n');
}
