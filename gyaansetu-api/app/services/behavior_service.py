from supabase import AsyncClient
from app.services.base import BaseService
from app.models.submission import BehaviorLogCreate


class BehaviorService(BaseService):
    """Service for storing and scoring behavioral telemetry."""

    table = "behavior_logs"

    def __init__(self, db: AsyncClient):
        """Bind to the Supabase client."""
        super().__init__(db)

    async def log(self, data: BehaviorLogCreate) -> dict:
        """Persist behavioral telemetry and return the stored log record."""
        return await self.create({
            "submission_id": str(data.submission_id),
            "typing_events": data.typing_events,
            "paste_events": data.paste_events,
            "largest_paste": data.largest_paste,
            "tab_switches": data.tab_switches,
            "idle_time": data.idle_time,
        })

    def compute_score(self, log: dict) -> float:
        """Compute a behavior ownership score (0–100) from a stored log record.

        Penalty breakdown (all capped, total can reach 0):
          • Paste magnitude   — up to 40 pts  (largest single paste ≥ 500 chars)
          • Paste frequency   — up to 15 pts  (each additional large paste ≥ 50 chars costs 3 pts)
          • Tab switches      — up to 30 pts  (5 pts per switch)
          • Idle time         — up to 20 pts  (≥ 10 minutes idle = max penalty)

        Thresholds:
          • A paste of 100 chars  → ~8 pts magnitude penalty
          • A paste of 250 chars  → 20 pts magnitude penalty
          • A paste of 500+ chars → 40 pts magnitude penalty (cap)
          • 1 tab switch          →  5 pts penalty
          • 3 tab switches        → 15 pts penalty  (frontend shows warning here)
          • 5+ tab switches       → 25 pts penalty  (frontend blocks submission here)
          • 5 min idle            → 10 pts penalty
          • 10+ min idle          → 20 pts penalty (cap)
        """
        score = 100.0

        paste_events = log.get("paste_events") or []
        largest_paste_chars = log.get("largest_paste", 0)

        # Magnitude: largest single paste (chars), cap at 500 chars → 40 pts
        magnitude_penalty = min(40.0, (largest_paste_chars / 500) * 40)

        # Frequency: each paste ≥ 50 chars beyond the first costs 3 pts (cap 15 pts)
        large_paste_count = sum(1 for e in paste_events if e.get("len", 0) >= 50)
        frequency_penalty = min(15.0, max(0, large_paste_count - 1) * 3.0)

        # Use the larger of the two paste penalties (they partially overlap in intent)
        score -= max(magnitude_penalty, frequency_penalty)

        # Tab switch penalty: 5 pts each, cap at 30 pts
        # Aligns with: frontend warning at 3 switches (15 pts), block at 5 (25 pts)
        tab_penalty = min(30.0, log.get("tab_switches", 0) * 5.0)
        score -= tab_penalty

        # Idle time penalty: idle_time is stored in seconds
        # Cap at 10 minutes (600s) → 20 pts
        idle_seconds = log.get("idle_time", 0)
        idle_penalty = min(20.0, (idle_seconds / 600) * 20)
        score -= idle_penalty

        return max(0.0, round(score, 2))
