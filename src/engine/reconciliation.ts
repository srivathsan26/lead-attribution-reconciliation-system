import { JourneyStep, LeadState, StateConflict, AuditRecord } from '../types.js';

export const STATE_RANK: Record<LeadState, number> = {
  New: 1,
  Contacted: 2,
  Qualified: 3,
  Converted: 4,
  Lost: 0,
};

export function mapEventToState(eventType: string, status?: string): LeadState | null {
  const normType = (eventType || '').toLowerCase();
  const normStatus = (status || '').toLowerCase();

  if (normType === 'converted' || normStatus === 'converted') return 'Converted';
  if (normType === 'qualified' || normStatus === 'qualified') return 'Qualified';
  if (normType === 'contacted' || normStatus === 'contacted') return 'Contacted';
  if (normType === 'lost' || normStatus === 'lost') return 'Lost';
  if (
    normType === 'form_submission' ||
    normType === 'page_visit' ||
    normType === 'campaign_click' ||
    normType === 'email_open' ||
    normType === 'email_click' ||
    normStatus === 'new'
  ) {
    return 'New';
  }
  return null;
}

export function reconcileLeadState(
  leadId: string,
  timeline: JourneyStep[]
): {
  currentState: LeadState;
  hasConflict: boolean;
  conflicts: StateConflict[];
  stateAuditRecords: AuditRecord[];
} {
  let currentState: LeadState = 'New';
  const conflicts: StateConflict[] = [];
  const stateAuditRecords: AuditRecord[] = [];

  for (let i = 0; i < timeline.length; i++) {
    const step = timeline[i];
    const impliedState = mapEventToState(step.event_type, step.status);

    if (!impliedState) continue;

    // Check if this step attempts a transition
    if (impliedState === currentState) {
      continue;
    }

    // Evaluate valid vs conflicting transitions

    // 1. Invalid: Any transition from terminal state "Lost" (e.g. Lost -> Converted, Lost -> Qualified, etc.)
    if (currentState === 'Lost') {
      const conflictMsg = `Invalid state transition from "Lost" to "${impliedState}" attempted by event ${step.event_id} (${step.event_type} at ${step.timestamp}). State retained as "Lost".`;
      conflicts.push({
        event_id: step.event_id,
        attempted_transition: `Lost -> ${impliedState}`,
        current_state: currentState,
        timestamp: step.timestamp,
        reason: conflictMsg,
      });

      stateAuditRecords.push({
        id: `audit-conflict-${step.event_id}`,
        lead_id: leadId,
        event_id: step.event_id,
        decision_type: 'STATE_CONFLICT',
        previous_state: currentState,
        new_state: currentState,
        selected_campaign: step.campaign || null,
        candidate_campaigns: step.campaign ? [step.campaign] : [],
        reason: conflictMsg,
        timestamp: step.timestamp,
      });
      continue;
    }

    // 2. Invalid: Any regression from terminal state "Converted" (e.g. Converted -> New, Converted -> Contacted, Converted -> Qualified, Converted -> Lost)
    if (currentState === 'Converted') {
      const conflictMsg = `Invalid state regression from "Converted" to "${impliedState}" attempted by event ${step.event_id} (${step.event_type} at ${step.timestamp}). State retained as "Converted".`;
      conflicts.push({
        event_id: step.event_id,
        attempted_transition: `Converted -> ${impliedState}`,
        current_state: currentState,
        timestamp: step.timestamp,
        reason: conflictMsg,
      });

      stateAuditRecords.push({
        id: `audit-conflict-${step.event_id}`,
        lead_id: leadId,
        event_id: step.event_id,
        decision_type: 'STATE_CONFLICT',
        previous_state: currentState,
        new_state: currentState,
        selected_campaign: step.campaign || null,
        candidate_campaigns: step.campaign ? [step.campaign] : [],
        reason: conflictMsg,
        timestamp: step.timestamp,
      });
      continue;
    }

    // 3. Invalid: Regression from "Qualified" to "Contacted" or "New"
    if (currentState === 'Qualified' && (impliedState === 'Contacted' || impliedState === 'New')) {
      const conflictMsg = `Invalid state regression attempted from "Qualified" to "${impliedState}" by event ${step.event_id} (${step.event_type} at ${step.timestamp}). State retained as "Qualified".`;
      conflicts.push({
        event_id: step.event_id,
        attempted_transition: `Qualified -> ${impliedState}`,
        current_state: currentState,
        timestamp: step.timestamp,
        reason: conflictMsg,
      });

      stateAuditRecords.push({
        id: `audit-conflict-${step.event_id}`,
        lead_id: leadId,
        event_id: step.event_id,
        decision_type: 'STATE_CONFLICT',
        previous_state: currentState,
        new_state: currentState,
        selected_campaign: step.campaign || null,
        candidate_campaigns: step.campaign ? [step.campaign] : [],
        reason: conflictMsg,
        timestamp: step.timestamp,
      });
      continue;
    }

    // 4. Invalid: Regression from "Contacted" to "New"
    if (currentState === 'Contacted' && impliedState === 'New') {
      const conflictMsg = `Invalid state regression attempted from "Contacted" to "New" by event ${step.event_id} (${step.event_type} at ${step.timestamp}). State retained as "Contacted".`;
      conflicts.push({
        event_id: step.event_id,
        attempted_transition: `Contacted -> New`,
        current_state: currentState,
        timestamp: step.timestamp,
        reason: conflictMsg,
      });

      stateAuditRecords.push({
        id: `audit-conflict-${step.event_id}`,
        lead_id: leadId,
        event_id: step.event_id,
        decision_type: 'STATE_CONFLICT',
        previous_state: currentState,
        new_state: currentState,
        selected_campaign: step.campaign || null,
        candidate_campaigns: step.campaign ? [step.campaign] : [],
        reason: conflictMsg,
        timestamp: step.timestamp,
      });
      continue;
    }

    // Valid forward progression (New -> Contacted/Qualified/Converted/Lost, Contacted -> Qualified/Converted/Lost, Qualified -> Converted/Lost)
    const prevState = currentState;
    currentState = impliedState;

    stateAuditRecords.push({
      id: `audit-state-${step.event_id}`,
      lead_id: leadId,
      event_id: step.event_id,
      decision_type: 'STATE_CHANGE',
      previous_state: prevState,
      new_state: currentState,
      selected_campaign: step.campaign || null,
      candidate_campaigns: step.campaign ? [step.campaign] : [],
      reason: `Lead lifecycle state advanced from "${prevState}" to "${currentState}" triggered by event ${step.event_id} (${step.event_type}).`,
      timestamp: step.timestamp,
    });
  }

  return {
    currentState,
    hasConflict: conflicts.length > 0,
    conflicts,
    stateAuditRecords,
  };
}
