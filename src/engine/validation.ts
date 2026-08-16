import { RawEvent, ValidationError, SourceType } from '../types.js';

export const VALID_SOURCES = new Set<string>([
  'organic_search',
  'paid_search',
  'social',
  'email',
  'website',
  'manual',
]);

export const VALID_EVENT_TYPES = new Set([
  'page_visit',
  'campaign_click',
  'form_submission',
  'email_open',
  'email_click',
  'contacted',
  'qualified',
  'converted',
  'lost',
]);

export function isValidIsoTimestamp(str: any): boolean {
  if (!str || typeof str !== 'string') return false;
  // Check basic ISO format or Date parseability
  const parsed = Date.parse(str);
  if (isNaN(parsed)) return false;
  // Require reasonable year and structure (e.g. 2020-2035)
  const d = new Date(parsed);
  return d.getFullYear() >= 1990 && d.getFullYear() <= 2100;
}

export function validateEvent(raw: RawEvent): {
  isValid: boolean;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      errors: [
        {
          event_id: 'unknown',
          error_type: 'MALFORMED_RECORD',
          field: 'record',
          message: 'Event record must be a valid JSON object or CSV row.',
          raw_record: raw,
        },
      ],
    };
  }

  // 1. Validate event_id
  const eventId = raw.event_id ? String(raw.event_id).trim() : '';
  if (!eventId) {
    errors.push({
      event_id: 'missing-id',
      error_type: 'MISSING_EVENT_ID',
      field: 'event_id',
      message: 'Event record is missing a required event_id.',
      raw_record: raw,
    });
  }

  // 2. Validate lead identification (at least one of email, phone, or explicit lead_id)
  const email = raw.email ? String(raw.email).trim() : '';
  const phone = raw.phone ? String(raw.phone).trim() : '';
  const leadId = raw.lead_id ? String(raw.lead_id).trim() : '';

  if (!email && !phone && !leadId) {
    errors.push({
      event_id: eventId || 'missing-id',
      error_type: 'MISSING_LEAD_IDENTITY',
      field: 'email/phone/lead_id',
      message: 'Event must contain at least one usable identifier (email, phone, or lead_id).',
      raw_record: raw,
    });
  }

  // 3. Validate timestamp
  const timestamp = raw.timestamp;
  if (!isValidIsoTimestamp(timestamp)) {
    errors.push({
      event_id: eventId || 'missing-id',
      error_type: 'INVALID_TIMESTAMP',
      field: 'timestamp',
      message: `Timestamp "${timestamp}" is not a valid ISO-8601 date string.`,
      raw_record: raw,
    });
  }

  // 4. Validate source
  const source = raw.source ? String(raw.source).trim().toLowerCase() : '';
  if (!source || !VALID_SOURCES.has(source)) {
    errors.push({
      event_id: eventId || 'missing-id',
      error_type: 'INVALID_SOURCE',
      field: 'source',
      message: `Source "${raw.source}" is unsupported. Supported sources: ${Array.from(VALID_SOURCES).join(', ')}.`,
      raw_record: raw,
    });
  }

  // 5. Validate event_type
  const eventType = raw.event_type ? String(raw.event_type).trim().toLowerCase() : '';
  if (!eventType || !VALID_EVENT_TYPES.has(eventType)) {
    errors.push({
      event_id: eventId || 'missing-id',
      error_type: 'INVALID_EVENT_TYPE',
      field: 'event_type',
      message: `Event type "${raw.event_type}" is unsupported. Supported types: ${Array.from(VALID_EVENT_TYPES).join(', ')}.`,
      raw_record: raw,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateEventBatch(rawEvents: RawEvent[]): {
  validRawEvents: RawEvent[];
  validationErrors: ValidationError[];
} {
  const validRawEvents: RawEvent[] = [];
  const validationErrors: ValidationError[] = [];

  if (!Array.isArray(rawEvents)) {
    return { validRawEvents: [], validationErrors: [{
      event_id: 'batch_error',
      error_type: 'MALFORMED_RECORD',
      field: 'payload',
      message: 'Input batch must be an array of event objects.',
    }] };
  }

  for (let i = 0; i < rawEvents.length; i++) {
    const raw = rawEvents[i];
    const { isValid, errors } = validateEvent(raw);
    if (isValid) {
      validRawEvents.push(raw);
    } else {
      validationErrors.push(...errors);
    }
  }

  return { validRawEvents, validationErrors };
}
