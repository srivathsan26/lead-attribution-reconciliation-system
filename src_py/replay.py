import random
from .pipeline import execute_pipeline

def run_replay_verification(raw_events: list, seeds: list = None):
    seeds = seeds or [42, 101, 777]
    base = execute_pipeline(raw_events, write_to_disk=False)

    base_leads = [{
        "id": l["lead_id"],
        "state": l["current_state"],
        "campaign": l["attributed_campaign"]
    } for l in base["leads"]]

    is_deterministic = True
    discrepancies = []

    for s in seeds:
        shuffled = list(raw_events)
        rng = random.Random(s)
        rng.shuffle(shuffled)

        res = execute_pipeline(shuffled, write_to_disk=False)
        test_leads = [{
            "id": l["lead_id"],
            "state": l["current_state"],
            "campaign": l["attributed_campaign"]
        } for l in res["leads"]]

        if base_leads != test_leads:
            is_deterministic = False
            discrepancies.append(f"Discrepancy at seed {s}")

    return {
        "is_deterministic": is_deterministic,
        "total_seeds": len(seeds),
        "discrepancies": discrepancies
    }
