# Digital Marketing Lead Attribution and Campaign Reconciliation System

A local, deterministic batch pipeline that ingests multi-source lead/interaction
events, deduplicates leads, reconstructs chronological journeys, attributes
campaigns using explicit rules, reconciles lead state, and generates
campaign-level reports with a full audit trail.

No database, no auth, no background workers, no external services — matches
the PRD's local-execution constraint. Input and output are CSV/JSON files.

## Clone → Setup → Run → Test

```bash
git clone <your-repo-url>
cd <repo>
pip install pytest --break-system-packages   # only external dependency

# Run the pipeline over a fixture (or your own file/directory of CSV/JSON)
python3 -m engine.pipeline fixtures/smoke.json
python3 -m engine.pipeline fixtures        # runs all files in a directory

# Generate the campaign report from pipeline output
python3 -m reports.campaign_report

# Run the automated test suite
python3 -m pytest tests/ -v
```

Output is written to `output/`:
- `reconciled_leads.json` — final lead profiles with state, attribution, timeline
- `rejected_records.json` — records that failed validation, with reasons
- `audit_log.json` — every reconciliation decision with a plain-language reason
- `campaign_report.json` / `campaign_report.csv` — campaign-level performance

## Input Format

Records (CSV or JSON) must contain:

```json
{
  "event_id": "evt-001",
  "lead_id": "lead-001",
  "email": "user@example.com",
  "name": "Example User",
  "source": "organic_search",
  "campaign": "seo-campaign-01",
  "event_type": "form_submission",
  "timestamp": "2026-08-15T10:30:00Z",
  "status": "new",
  "payload": {},
  "phone": "optional, used for dedup when email is missing"
}
```

Valid `source`: `organic_search`, `paid_search`, `social`, `email`, `website`, `manual`
Valid `event_type`: `page_visit`, `campaign_click`, `form_submission`, `email_open`, `email_click`, `contacted`, `qualified`, `converted`

Records missing `event_id`, missing all lead identifiers (lead_id/email/phone),
with an unparseable `timestamp`, or with an invalid `source`/`event_type` are
rejected and reported separately in `rejected_records.json` — never silently
dropped or crashed on.

## How Duplicate Detection Works

Matching is deterministic, priority order:
1. Normalized email (lowercased, trimmed)
2. Phone number, when email is missing
3. Raw `lead_id` as a fallback identity anchor when neither matches anything else

Implementation uses union-find over all events, keyed on these matches, so that
grouping is **independent of file/arrival order** — the same duplicate groups
form regardless of which record arrives first. The canonical (surviving) lead
ID is the lexicographically smallest merged ID, for determinism. Merged-away
IDs are recorded on the surviving profile as `merged_duplicate_ids`.

## How Lead Journeys Are Reconstructed

All events belonging to a canonical lead are sorted by `timestamp` (with
`event_id` as a tiebreaker for identical timestamps) — never by arrival/file
order. This means a late-arriving record with an older timestamp is inserted
into its correct chronological position, not appended to the end.

## Campaign Attribution Rules

Applied in strict order, first match wins:
1. **Conversion campaign** — if any event has `event_type: converted` with a
   campaign, that campaign is selected outright.
2. **Latest pre-qualification campaign** — otherwise, the most recent
   campaign-bearing event before the `qualified` event (or the latest overall,
   if never qualified) is selected.
3. **Source precedence tiebreak** — if multiple campaigns tie on timestamp,
   the one with the higher-precedence source wins. Precedence order:
   `organic_search > paid_search > email > social > website > manual`.
4. **Lexicographic tiebreak** — if still tied, the lexicographically smallest
   campaign ID wins.

Every attribution decision is logged to the audit trail with the specific
rule that fired and the full candidate list considered.

## Lead-State Reconciliation Rules

States: `New → Contacted → Qualified → Converted`, or `Lost` (terminal) from
any non-terminal state.

The engine walks the timeline in timestamp order and applies each event's
state signal (`event_type` mapping, or `status: lost`) only if it's an
**allowed transition** from the current state. Allowed transitions:

| From | Allowed To |
|---|---|
| New | New, Contacted, Qualified, Converted, Lost |
| Contacted | Contacted, Qualified, Converted, Lost |
| Qualified | Qualified, Converted, Lost |
| Converted | Converted (terminal) |
| Lost | Lost (terminal) |

Invalid transitions (e.g. `Converted → New`, `Qualified → New`, `Lost → Converted`)
are **not applied** — the lead's state is retained at its last valid value —
and are recorded both as a `conflicts` entry on the lead profile and as an
audit record explaining exactly what was rejected and why.

## Replay

Determinism is structural, not a special mode: every stage sorts on stable
keys (`event_id`, `timestamp`) rather than list/arrival order, so re-running
the pipeline — or feeding it the same events in a different order — always
produces the same lead states, attribution, and audit decisions.

Demonstrated in `tests/test_pipeline.py::test_replay_with_shuffled_event_order_produces_same_result`,
which runs the same fixture forward and reversed and asserts identical output.
To try it manually:

```bash
python3 -m engine.pipeline fixtures/smoke.json
# then shuffle/reverse the JSON array in fixtures/smoke.json and re-run —
# reconciled_leads.json and audit_log.json will be identical.
```

## Test Fixtures and Expected Outcomes

| Fixture | Edge case(s) covered | Expected outcome |
|---|---|---|
| `smoke.json` | Duplicate email, full valid state progression, conversion attribution | 1 lead (lead-001 + lead-002 merged), state=Converted, campaign=ppc-02 |
| `edge_late_arriving.json` | Late-arriving event with older timestamp | Timeline sorted by timestamp; earliest event (evt-103) appears first despite being last in file |
| `edge_multi_campaign.json` | Same lead, multiple campaigns across touchpoints | Attribution picks latest pre-qualification campaign (seo-c) |
| `edge_phone_match.json` | Missing email, dedup via phone | Two lead_ids merge into one profile |
| `edge_attribution_tie.json` | Conflicting campaigns at identical timestamp | lead-040 resolved by source precedence (organic_search beats social); lead-041 resolved by lexicographic campaign ID (email-a beats email-x) |
| `edge_invalid_transitions.json` | Invalid state transitions: Converted→New, Qualified→New, Lost→Converted | Each lead's state is retained at last valid value; each has exactly 1 conflict recorded |
| `edge_malformed.json` | Missing event_id, missing identifiers, invalid timestamp, invalid source, invalid event_type | 5 records rejected with specific reasons; 1 valid control record still processed |

## Where Reports and Audit Logs Are Generated

- Campaign reports: `output/campaign_report.json` and `output/campaign_report.csv`
- Audit trail: `output/audit_log.json` (one record per duplicate/attribution/state decision)
- Rejected records: `output/rejected_records.json`

## Architecture Notes

- No database — local JSON/CSV files are the persistence layer, per PRD constraints.
- No web framework in the core engine — it's a batch pipeline, not a service.
  If a live API is needed for the frontend, it's a thin read-only layer over
  the same output JSON, not a requirement of the reconciliation logic itself.
- No background job queue — processing is synchronous by design; this is what
  makes determinism and replay guarantees straightforward to prove and test.
