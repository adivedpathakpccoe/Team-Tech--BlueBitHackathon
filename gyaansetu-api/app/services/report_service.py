from uuid import UUID
from supabase import AsyncClient
from app.services.base import BaseService
from app.models.report import DashboardRow, EvidenceItem, ReportResponse
from app.core.exceptions import NotFoundError


def _risk_level(score: float | None) -> str:
    """Map an ownership score to a risk label."""
    if score is None:
        return "unknown"
    if score < 50:
        return "high"
    if score <= 75:
        return "medium"
    return "low"


def _build_evidence(scores: dict, behavior_log: dict | None) -> list[dict]:
    """Derive human-readable evidence observations from scores and behavioral data."""
    evidence = []

    if behavior_log:
        paste = behavior_log.get("largest_paste", 0)
        if paste > 100:
            evidence.append({"label": "Large paste detected", "detail": f"{paste} words pasted at once"})
        tabs = behavior_log.get("tab_switches", 0)
        if tabs > 3:
            evidence.append({"label": "Frequent tab switching", "detail": f"{tabs} tab switches recorded"})

    honeypot = scores.get("honeypot_score")
    if honeypot is not None and honeypot < 20:
        evidence.append({"label": "Honeypot not engaged", "detail": "Student did not address the embedded honeypot phrase"})

    socratic = scores.get("socratic_score")
    if socratic is not None and socratic < 40:
        evidence.append({"label": "Weak Socratic response", "detail": "Failed to demonstrate reasoning depth in challenge"})

    similarity = scores.get("similarity_score")
    if similarity is not None and similarity >= 0.75:
        evidence.append({"label": "High AI similarity", "detail": f"{similarity * 100:.0f}% similar to known AI-generated essay"})

    return evidence


class ReportService(BaseService):
    """Service for generating dashboard rows and full evidence reports."""

    table = "scores"

    def __init__(self, db: AsyncClient):
        """Bind to the Supabase client."""
        super().__init__(db)

    async def get_dashboard(self) -> list[dict]:
        """Return all submissions with scores and student info for the dashboard."""
        res = await (
            self.db.table("submissions")
            .select("id, student_id, assignment_id, assignments(mode), scores(*), students(name)")
            .execute()
        )
        rows = []
        for row in res.data or []:
            score = (row.get("scores") or [{}])[0]
            ownership = score.get("ownership_score")
            rows.append({
                "student_id": row["student_id"],
                "student_name": (row.get("students") or {}).get("name", "Unknown"),
                "submission_id": row["id"],
                "behavior_score": score.get("behavior_score"),
                "honeypot_score": score.get("honeypot_score"),
                "socratic_score": score.get("socratic_score"),
                "similarity_score": score.get("similarity_score"),
                "ownership_score": ownership,
                "risk_level": _risk_level(ownership),
                "mode": (row.get("assignments") or {}).get("mode", "unknown"),
            })
        return rows

    async def get_report(self, submission_id: UUID) -> dict:
        """Build a full evidence report for a single submission."""
        sub_res = await (
            self.db.table("submissions")
            .select("id, student_id, essay_text, students(name), scores(*), behavior_logs(*)")
            .eq("id", str(submission_id))
            .maybe_single()
            .execute()
        )
        if not sub_res.data:
            raise NotFoundError("submissions", submission_id)

        row = sub_res.data
        score = (row.get("scores") or [{}])[0]
        behavior_log = (row.get("behavior_logs") or [None])[0]
        ownership = score.get("ownership_score")
        evidence = _build_evidence(score, behavior_log)

        return {
            "submission_id": row["id"],
            "student_id": row["student_id"],
            "student_name": (row.get("students") or {}).get("name", "Unknown"),
            "ownership_score": ownership,
            "risk_level": _risk_level(ownership),
            "behavior_score": score.get("behavior_score"),
            "honeypot_score": score.get("honeypot_score"),
            "socratic_score": score.get("socratic_score"),
            "similarity_score": score.get("similarity_score"),
            "evidence": evidence,
        }
