import { RawEvent, NormalizedEvent } from '../types.js';

export function normalizeEmail(email: any): string {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim().toLowerCase();
  // Basic sanity check
  if (!trimmed.includes('@') || !trimmed.includes('.')) {
    return '';
  }
  return trimmed;
}

export function normalizePhone(phone: any): string {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  // Keep '+' if it starts with one, then extract all digits
  const hasLeadingPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return '';
  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

export function normalizeName(name: any): string {
  if (!name || typeof name !== 'string') return '';
  // Trim and collapse multiple spaces into one
  const collapsed = name.trim().replace(/\s+/g, ' ');
  if (!collapsed) return '';

  // Title-case words nicely while preserving clean presentation
  return collapsed
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function normalizeSource(source: any): string {
  if (!source || typeof source !== 'string') return 'website';
  return source.trim().toLowerCase();
}

export function normalizeEventType(eventType: any): string {
  if (!eventType || typeof eventType !== 'string') return 'page_visit';
  return eventType.trim().toLowerCase();
}

export function normalizeCampaign(campaign: any): string {
  if (!campaign || typeof campaign !== 'string') return '';
  // Normalize whitespace and trim
  return campaign.trim();
}

export function normalizeTimestamp(timestamp: any): string {
  if (!timestamp || typeof timestamp !== 'string') return new Date().toISOString();
  try {
    const d = new Date(timestamp.trim());
    return d.toISOString();
  } catch {
    return String(timestamp).trim();
  }
}

export function normalizePayload(payload: any): Record<string, any> {
  if (!payload) return {};
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return typeof parsed === 'object' && parsed !== null ? parsed : { raw: payload };
    } catch {
      return { raw: payload };
    }
  }
  return { raw: payload };
}

export function normalizeEvent(raw: RawEvent, arrivalIndex: number = 0): NormalizedEvent {
  const event_id = String(raw.event_id || '').trim();
  const email = normalizeEmail(raw.email);
  const phone = normalizePhone(raw.phone);
  const name = normalizeName(raw.name);
  const source = normalizeSource(raw.source);
  const campaign = normalizeCampaign(raw.campaign);
  const event_type = normalizeEventType(raw.event_type);
  const timestamp = normalizeTimestamp(raw.timestamp);
  const status = raw.status ? String(raw.status).trim() : '';
  const lead_id = raw.lead_id ? String(raw.lead_id).trim() : '';
  const payload = normalizePayload(raw.payload);

  return {
    event_id,
    lead_id,
    email,
    phone,
    name,
    source,
    campaign,
    event_type,
    timestamp,
    status,
    payload,
    arrival_index: arrivalIndex,
  };
}

export function normalizeEventBatch(rawEvents: RawEvent[]): NormalizedEvent[] {
  return rawEvents.map((raw, idx) => normalizeEvent(raw, idx));
}
