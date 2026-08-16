import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.pipeline import run_pipeline, write_outputs
from engine.ingest import ingest_files
from engine.dedupe import group_duplicates
from engine.journey import build_timeline
from engine.attribution import attribute
from engine.reconcile import reconcile_state

FIXTURES = Path(__file__).parent.parent / "fixtures"


def _profiles_by_lead(result):
    return {lid: p for lid, p in result["profiles"].items()}


# ---------- Duplicate lead detection ----------

def test_duplicate_email_merges_into_single_lead():
    result = run_pipeline([str(FIXTURES / "smoke.json")])
    profiles = _profiles_by_lead(result)
    assert len(profiles) == 1
    profile = list(profiles.values())[0]
    assert profile.lead_id == "lead-001"
    assert "lead-002" in profile.duplicate_lead_ids
    assert len(profile.events) == 5


def test_phone_match_merges_leads_without_email():
    result = run_pipeline([str(FIXTURES / "edge_phone_match.json")])
    profiles = _profiles_by_lead(result)
    assert len(profiles) == 1
    profile = list(profiles.values())[0]
    assert len(profile.events) == 2


# ---------- Missing identifiers / malformed records ----------

def test_missing_event_id_is_rejected():
    events, rejected = ingest_files([str(FIXTURES / "edge_malformed.json")])
    reasons = [r.rejection_reason for r in rejected]
    assert any("missing event_id" in r for r in reasons)


def test_missing_lead_identifier_is_rejected():
    events, rejected = ingest_files([str(FIXTURES / "edge_malformed.json")])
    reasons = [r.rejection_reason for r in rejected]
    assert any("missing lead identification" in r for r in reasons)


def test_invalid_timestamp_is_rejected():
    events, rejected = ingest_files([str(FIXTURES / "edge_malformed.json")])
    reasons = [r.rejection_reason for r in rejected]
    assert any("invalid or missing timestamp" in r for r in reasons)


def test_invalid_source_is_rejected():
    events, rejected = ingest_files([str(FIXTURES / "edge_malformed.json")])
    reasons = [r.rejection_reason for r in rejected]
    assert any("invalid source" in r for r in reasons)


def test_invalid_event_type_is_rejected():
    events, rejected = ingest_files([str(FIXTURES / "edge_malformed.json")])
    reasons = [r.rejection_reason for r in rejected]
    assert any("invalid event_type" in r for r in reasons)


def test_valid_record_in_malformed_batch_still_processed():
    events, rejected = ingest_files([str(FIXTURES / "edge_malformed.json")])
    assert any(e.event_id == "evt-806" for e in events)
    assert len(rejected) == 5  # all others should be rejected


# ---------- Late-arriving events / temporal reconstruction ----------

def test_late_arriving_event_inserted_by_timestamp_not_arrival_order():
    result = run_pipeline([str(FIXTURES / "edge_late_arriving.json")])
    profile = list(result["profiles"].values())[0]
    timestamps = [e.timestamp for e in profile.events]
    assert timestamps == sorted(timestamps), "timeline must be timestamp-ordered regardless of file order"
    assert profile.events[0].event_id == "evt-103"  # earliest timestamp despite being last in file


# ---------- Multiple campaigns / attribution ----------

def test_multi_campaign_attributes_latest_pre_qualification_campaign():
    result = run_pipeline([str(FIXTURES / "edge_multi_campaign.json")])
    profile = list(result["profiles"].values())[0]
    assert profile.attributed_campaign == "seo-c"


def test_conversion_campaign_always_wins_attribution():
    result = run_pipeline([str(FIXTURES / "smoke.json")])
    profile = list(result["profiles"].values())[0]
    assert profile.attributed_campaign == "ppc-02"  # the conversion event's campaign


# ---------- Source precedence & tie-breaking ----------

def test_attribution_tie_resolved_by_source_precedence():
    result = run_pipeline([str(FIXTURES / "edge_attribution_tie.json")])
    profiles = _profiles_by_lead(result)
    profile = profiles["lead-040"]
    # organic_search outranks social in precedence list -> aaa-seo wins
    assert profile.attributed_campaign == "aaa-seo"


def test_attribution_tie_resolved_by_lexicographic_campaign_id():
    result = run_pipeline([str(FIXTURES / "edge_attribution_tie.json")])
    profiles = _profiles_by_lead(result)
    profile = profiles["lead-041"]
    # same source (email), same timestamp -> lexicographically smallest campaign id wins
    assert profile.attributed_campaign == "email-a"


# ---------- Invalid state transitions ----------

def test_converted_to_new_is_flagged_and_state_preserved():
    result = run_pipeline([str(FIXTURES / "edge_invalid_transitions.json")])
    profiles = _profiles_by_lead(result)
    profile = profiles["lead-050"]
    assert profile.current_state == "Converted"  # invalid transition rejected, state retained
    assert len(profile.conflicts) == 1
    assert "Converted -> New" in profile.conflicts[0] or "Converted -> New" in profile.conflicts[0]


def test_qualified_to_new_is_flagged_and_state_preserved():
    result = run_pipeline([str(FIXTURES / "edge_invalid_transitions.json")])
    profiles = _profiles_by_lead(result)
    profile = profiles["lead-060"]
    assert profile.current_state == "Qualified"
    assert len(profile.conflicts) == 1


def test_lost_to_converted_is_flagged_and_state_preserved():
    result = run_pipeline([str(FIXTURES / "edge_invalid_transitions.json")])
    profiles = _profiles_by_lead(result)
    profile = profiles["lead-070"]
    assert profile.current_state == "Lost"
    assert len(profile.conflicts) == 1


def test_valid_transition_sequence_has_no_conflicts():
    result = run_pipeline([str(FIXTURES / "smoke.json")])
    profile = list(result["profiles"].values())[0]
    assert profile.conflicts == []
    assert profile.current_state == "Converted"


# ---------- Idempotency ----------

def test_reprocessing_same_input_produces_identical_result():
    result1 = run_pipeline([str(FIXTURES / "smoke.json")])
    result2 = run_pipeline([str(FIXTURES / "smoke.json")])
    p1 = list(result1["profiles"].values())[0]
    p2 = list(result2["profiles"].values())[0]
    assert p1.current_state == p2.current_state
    assert p1.attributed_campaign == p2.attributed_campaign
    assert len(p1.events) == len(p2.events)
    assert len(result1["audit"]) == len(result2["audit"])


# ---------- Replay determinism (different arrival order -> same result) ----------

def test_replay_with_shuffled_event_order_produces_same_result(tmp_path):
    with open(FIXTURES / "smoke.json") as f:
        events = json.load(f)

    forward_path = tmp_path / "forward.json"
    reversed_path = tmp_path / "reversed.json"
    with open(forward_path, "w") as f:
        json.dump(events, f)
    with open(reversed_path, "w") as f:
        json.dump(list(reversed(events)), f)

    result_forward = run_pipeline([str(forward_path)])
    result_reversed = run_pipeline([str(reversed_path)])

    p_fwd = list(result_forward["profiles"].values())[0]
    p_rev = list(result_reversed["profiles"].values())[0]

    assert p_fwd.current_state == p_rev.current_state
    assert p_fwd.attributed_campaign == p_rev.attributed_campaign
    assert [e.event_id for e in p_fwd.events] == [e.event_id for e in p_rev.events]


# ---------- Campaign conversion calculations ----------

def test_campaign_report_conversion_rate_calculation():
    from reports.campaign_report import generate_report

    result = run_pipeline([str(FIXTURES / "smoke.json")])
    write_outputs(result, output_dir=str(Path(__file__).parent / "_tmp_output"))
    with open(Path(__file__).parent / "_tmp_output" / "reconciled_leads.json") as f:
        leads = json.load(f)

    rows = generate_report(leads)
    ppc02 = next(r for r in rows if r["campaign"] == "ppc-02")
    assert ppc02["unique_leads"] == 1
    assert ppc02["converted_leads"] == 1
    assert ppc02["conversion_rate"] == 1.0
