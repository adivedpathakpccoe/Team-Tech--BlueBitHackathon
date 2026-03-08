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
        """Compute a behavior ownership score (0–100) from a stored log record."""
        score = 100.0

        # Large paste penalty: lose up to 40 points for 500+ words pasted
        paste_words = log.get("largest_paste", 0)
        paste_penalty = min(40.0, (paste_words / 500) * 40)
        score -= paste_penalty

        # Tab switch penalty: lose 5 points per switch, max 30
        tab_penalty = min(30.0, log.get("tab_switches", 0) * 5)
        score -= tab_penalty

        # Idle time penalty: lose up to 20 points for 10+ minutes idle
        idle_minutes = log.get("idle_time", 0) / 60
        idle_penalty = min(20.0, (idle_minutes / 10) * 20)
        score -= idle_penalty

        return max(0.0, round(score, 2))
