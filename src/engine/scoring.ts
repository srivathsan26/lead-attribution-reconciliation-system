import { JourneyStep, LeadState, LeadScore, QualityTier } from '../types.js';

export function calculateLeadScore(
  timeline: JourneyStep[],
  currentState: LeadState,
  phone: string
): LeadScore {
  let formSub = 0;
  let emailClicks = 0;
  let emailOpens = 0;
  let campaignClicks = 0;
  let phoneScore = 0;
  let qualScore = 0;
  let convScore = 0;
  let interactionBonus = 0;

  // Evaluate journey events
  for (const step of timeline) {
    if (step.event_type === 'form_submission') {
      formSub = 20;
    } else if (step.event_type === 'email_click') {
      emailClicks = Math.min(15, emailClicks + 15);
    } else if (step.event_type === 'email_open') {
      emailOpens = Math.min(10, emailOpens + 10);
    } else if (step.event_type === 'campaign_click') {
      campaignClicks = Math.min(15, campaignClicks + 15);
    }
  }

  // Profile data bonus
  if (phone && phone.trim().length >= 6) {
    phoneScore = 10;
  }

  // Lifecycle state bonus
  if (currentState === 'Qualified') {
    qualScore = 20;
  } else if (currentState === 'Converted') {
    qualScore = 20;
    convScore = 20;
  }

  // Interaction volume bonus
  if (timeline.length >= 4) {
    interactionBonus = 10;
  } else if (timeline.length >= 2) {
    interactionBonus = 5;
  }

  const rawTotal =
    formSub +
    emailClicks +
    emailOpens +
    campaignClicks +
    phoneScore +
    qualScore +
    convScore +
    interactionBonus;

  // Clamp strictly between 0 and 100
  const score = Math.min(100, Math.max(0, rawTotal));

  let tier: QualityTier = 'Low';
  if (score >= 70) {
    tier = 'High';
  } else if (score >= 40) {
    tier = 'Medium';
  } else {
    tier = 'Low';
  }

  return {
    score,
    tier,
    breakdown: {
      form_submission: formSub,
      email_clicks: emailClicks,
      email_opens: emailOpens,
      campaign_clicks: campaignClicks,
      phone_provided: phoneScore,
      qualified: qualScore,
      converted: convScore,
      interaction_density: interactionBonus,
    },
  };
}
