"""Serialize audit records to JSON."""
from __future__ import annotations
import json
from dataclasses import asdict
from pathlib import Path
from .models import AuditRecord


def write_audit_log(records: list[AuditRecord], path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump([asdict(r) for r in records], f, indent=2, default=str)
