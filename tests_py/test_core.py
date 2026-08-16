import os
import sys
import unittest

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src_py.validation import validate_event, validate_batch
from src_py.normalization import normalize_email, normalize_phone, normalize_name, normalize_event
from src_py.deduplication import cluster_and_deduplicate
from src_py.attribution import determine_attribution
from src_py.reconciliation import reconcile_state
from src_py.pipeline import execute_pipeline
from src_py.replay import run_replay_verification

class TestLeadSyncCore(unittest.TestCase):
    def test_validation(self):
        valid = {
            "event_id": "evt-001",
            "email": "user@test.com",
            "source": "organic_search",
            "event_type": "page_visit",
            "timestamp": "2026-08-15T10:00:00Z"
        }
        self.assertTrue(validate_event(valid)[0])
        self.assertFalse(validate_event({"event_id": ""})[0])
        self.assertFalse(validate_event({**valid, "timestamp": "BAD_TIME"})[0])
        self.assertFalse(validate_event({**valid, "source": "invalid_channel"})[0])

    def test_normalization(self):
        self.assertEqual(normalize_email("  User.Test@Example.COM "), "user.test@example.com")
        self.assertEqual(normalize_phone(" +1 (555) 019-2834 "), "+15550192834")
        self.assertEqual(normalize_name("  sArAh  cOnNoR "), "Sarah Connor")

    def test_attribution_rules(self):
        # Rule 1: Conversion campaign
        tl_r1 = [
            {"event_id": "1", "event_type": "page_visit", "timestamp": "2026-08-10T09:00:00Z", "campaign": "seo-1", "source": "organic_search"},
            {"event_id": "2", "event_type": "converted", "timestamp": "2026-08-10T12:00:00Z", "campaign": "checkout-camp", "source": "website"}
        ]
        attr1, _ = determine_attribution("lead-1", tl_r1)
        self.assertEqual(attr1["selected_campaign"], "checkout-camp")

        # Rule 2: Pre-qual latest
        tl_r2 = [
            {"event_id": "1", "event_type": "campaign_click", "timestamp": "2026-08-10T10:00:00Z", "campaign": "google-ads", "source": "paid_search"},
            {"event_id": "2", "event_type": "qualified", "timestamp": "2026-08-10T11:00:00Z", "campaign": "", "source": "manual"},
            {"event_id": "3", "event_type": "converted", "timestamp": "2026-08-10T12:00:00Z", "campaign": "", "source": "website"}
        ]
        attr2, _ = determine_attribution("lead-2", tl_r2)
        self.assertEqual(attr2["selected_campaign"], "google-ads")

    def test_state_reconciliation_conflicts(self):
        # Converted -> New regression conflict
        tl_conf = [
            {"event_id": "1", "event_type": "converted", "timestamp": "2026-08-10T12:00:00Z", "campaign": "c1", "source": "website", "status": "converted"},
            {"event_id": "2", "event_type": "page_visit", "timestamp": "2026-08-10T13:00:00Z", "campaign": "c1", "source": "website", "status": "new"}
        ]
        state, has_conf, conflicts, _ = reconcile_state("lead-1", tl_conf)
        self.assertEqual(state, "Converted")
        self.assertTrue(has_conf)

    def test_replay_determinism(self):
        import json
        with open("data/sample_events.json", "r") as f:
            sample_data = json.load(f)
        replay = run_replay_verification(sample_data, [42, 101, 777])
        self.assertTrue(replay["is_deterministic"])

if __name__ == '__main__':
    unittest.main()
