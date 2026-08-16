# Lead Attribution & Reconciliation System
   
   Deterministic digital marketing lead attribution and campaign state reconciliation system.
   
   - `/reconciliation-engine` — tested standalone Python core engine (dedup, attribution, state machine, 20 passing pytest assertions, 7 edge-case fixtures). See `reconciliation-engine/README-engine.md` for full documentation of rules, fixtures, and how to run it.
   - `/src`, `/config`, `/data` — web dashboard (frontend + backend), built with Antigravity.
   
   ## Quick Start (engine)
```bash
   cd reconciliation-engine
   pip install pytest --break-system-packages
   python -m pytest tests/ -v
   python -m engine.pipeline fixtures
```
