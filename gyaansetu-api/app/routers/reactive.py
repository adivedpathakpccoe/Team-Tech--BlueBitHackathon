"""
Reactive mode endpoints.

Flow:
1. Student uploads file  → text extracted via extractor service → Socratic challenge generated
2. Student answers Socratic challenge → scored
3. Teacher clicks "Close & Analyze" → inter-student TF-IDF runs → combined scores computed
"""

import logging
from uuid import UUID

import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.core.deps import CurrentUserDep, DbDep, TeacherDep
from app.core.responses import ok
from app.services.detection_service import compute_inter_submission_similarity
from app.services.socratic_service import SocraticService

logger = logging.getLogger(__name__)
router = APIRouter()

# The dedicated extractor micro-service (supports PDF, DOCX, PPTX, XLSX, TXT, etc.)
EXTRACTOR_URL = "http://localhost:8001"


async def _extract_via_service(file: UploadFile) -> str:
    """Forward the file to the extractor service and return extracted text."""
    content = await file.read()
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{EXTRACTOR_URL}/extract",
            files={"file": (file.filename, content, file.content_type or "application/octet-stream")},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Extractor service unavailable")
    data = resp.json()
    if not data.get("success"):
        raise HTTPException(status_code=415, detail=data.get("error", "Extraction failed"))
    return data["content"]


# ── Student: get assignment info (no Gemini call) ─────────────────────────────

@router.get("/assignments/{classroom_assignment_id}", response_model=dict)
async def get_reactive_assignment_info(
    classroom_assignment_id: UUID,
    current_user: CurrentUserDep,
    db: DbDep,
):
    """Get classroom assignment metadata for reactive mode (fast, no AI call)."""
    res = await (
        db.table("classroom_assignments")
        .select("*")
        .eq("id", str(classroom_assignment_id))
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=404, 
            detail=f"Reactive metadata for assignment '{classroom_assignment_id}' not found"
        )
    return ok(data=res.data[0])


# ── Student: check existing submission ────────────────────────────────────────

@router.get("/my-submission/{classroom_assignment_id}", response_model=dict)
async def get_my_reactive_submission(
    classroom_assignment_id: UUID,
    current_user: CurrentUserDep,
    db: DbDep,
):
    """Check if the student already submitted for this reactive assignment."""
    try:
        sub_res = await (
            db.table("reactive_submissions")
            .select("*")
            .eq("classroom_assignment_id", str(classroom_assignment_id))
            .eq("student_id", current_user.id)
            .execute()
        )
    except Exception:
        return ok(data=None)

    if not sub_res.data:
        return ok(data=None)

    submission = sub_res.data[0]
    sub_id = submission["id"]

    # Get socratic session — may not exist yet if challenge generation failed
    socratic_data = None
    try:
        socratic_res = await (
            db.table("socratic_sessions")
            .select("challenge, student_response, socratic_score, analysis, followup")
            .eq("submission_id", sub_id)
            .execute()
        )
        if socratic_res and socratic_res.data:
            socratic_data = socratic_res.data[0]
    except Exception as e:
        logger.warning("Failed to fetch socratic session for %s: %s", sub_id, e)
        socratic_data = None

    # Get scores — may not exist yet if analysis hasn't run
    scores_data = None
    try:
        scores_res = await (
            db.table("reactive_scores")
            .select("*")
            .eq("submission_id", sub_id)
            .execute()
        )
        if scores_res and scores_res.data:
            scores_data = scores_res.data[0]
    except Exception as e:
        logger.warning("Failed to fetch reactive scores for %s: %s", sub_id, e)
        scores_data = None

    return ok(data={
        "submission": submission,
        "socratic": socratic_data,
        "scores": scores_data,
    })


# ── Student: upload file ──────────────────────────────────────────────────────

@router.post("/upload", response_model=dict, status_code=201)
async def reactive_upload(
    current_user: CurrentUserDep,
    db: DbDep,
    classroom_assignment_id: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Accept a reactive file upload.
    1. Extract text via extractor service
    2. Store in reactive_submissions
    3. Generate Socratic challenge
    4. Return challenge to student
    """
    student_id = current_user.id

    # Check duplicate
    existing = await (
        db.table("reactive_submissions")
        .select("id", count="exact", head=True)
        .eq("classroom_assignment_id", classroom_assignment_id)
        .eq("student_id", student_id)
        .execute()
    )
    if (existing.count or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="You have already submitted for this assignment",
        )

    # Extract text via the dedicated extractor micro-service
    extracted_text = await _extract_via_service(file)

    if len(extracted_text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Extracted text is too short (minimum 50 characters)",
        )

    # Create reactive submission record
    sub_res = await (
        db.table("reactive_submissions")
        .insert({
            "classroom_assignment_id": classroom_assignment_id,
            "student_id": student_id,
            "filename": file.filename,
            "extracted_text": extracted_text,
        })
        .execute()
    )
    submission = sub_res.data[0]
    submission_id = submission["id"]

    # Generate Socratic challenge
    challenge = None
    try:
        svc = SocraticService(db)
        session = await svc.generate_challenge(UUID(submission_id), extracted_text)
        challenge = session["challenge"]
    except Exception as e:
        logger.warning("Socratic generation failed (non-critical): %s", e)

    return ok(
        data={
            "submission_id": submission_id,
            "filename": file.filename,
            "text_length": len(extracted_text),
            "challenge": challenge,
        },
        message="File uploaded and processed",
    )


# ── Student: answer Socratic challenge ────────────────────────────────────────

@router.post("/socratic-answer", response_model=dict)
async def reactive_socratic_answer(
    body: dict,
    current_user: CurrentUserDep,
    db: DbDep,
):
    """Score the student's Socratic response."""
    submission_id = body.get("submission_id")
    student_response = body.get("student_response")

    if not submission_id or not student_response:
        raise HTTPException(
            status_code=400,
            detail="submission_id and student_response are required",
        )

    if len(student_response.strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Response must be at least 20 characters",
        )

    svc = SocraticService(db)
    session = await svc.score_response(UUID(submission_id), student_response)
    socratic_score = session["socratic_score"]

    # Store score
    await (
        db.table("reactive_scores")
        .upsert(
            {
                "submission_id": submission_id,
                "socratic_score": socratic_score,
            },
            on_conflict="submission_id",
        )
        .execute()
    )

    return ok(data={
        "socratic_score": socratic_score,
        "analysis": session["analysis"],
        "followup": session.get("followup"),
    })


# ── Teacher: close & analyze ─────────────────────────────────────────────────

@router.post("/{classroom_assignment_id}/analyze", response_model=dict)
async def analyze_reactive_assignment(
    classroom_assignment_id: UUID,
    _: TeacherDep,
    db: DbDep,
):
    """
    Teacher closes the assignment and runs inter-student TF-IDF analysis.
    Combined score = 0.5 * tfidf_originality + 0.5 * socratic_score
    """
    # Fetch all reactive submissions for this assignment
    subs_res = await (
        db.table("reactive_submissions")
        .select("id, student_id, extracted_text, filename")
        .eq("classroom_assignment_id", str(classroom_assignment_id))
        .execute()
    )
    submissions = subs_res.data or []

    if len(submissions) < 2:
        # If only 1 submission, just compute score from Socratic alone
        if len(submissions) == 1:
            sub = submissions[0]
            scores_res = await (
                db.table("reactive_scores")
                .select("socratic_score")
                .eq("submission_id", sub["id"])
                .execute()
            )
            socratic_score = (scores_res.data[0] if scores_res.data else {}).get("socratic_score") or 0.0
            ownership_score = socratic_score  # Only Socratic if no comparison possible

            await (
                db.table("reactive_scores")
                .upsert(
                    {
                        "submission_id": sub["id"],
                        "similarity_score": 0.0,
                        "similarity_method": "lexical",
                        "tfidf_originality": 100.0,
                        "socratic_score": socratic_score,
                        "ownership_score": round(ownership_score, 2),
                    },
                    on_conflict="submission_id",
                )
                .execute()
            )
            return ok(
                data={
                    "total_submissions": 1,
                    "flagged_pairs": [],
                    "results": [{
                        "submission_id": sub["id"],
                        "student_id": sub["student_id"],
                        "filename": sub["filename"],
                        "max_similarity": 0.0,
                        "tfidf_originality": 100.0,
                        "socratic_score": socratic_score,
                        "ownership_score": round(ownership_score, 2),
                    }],
                },
                message="Analysis complete (single submission)",
            )

        raise HTTPException(
            status_code=400,
            detail="Need at least 1 submission to run analysis",
        )

    # Run inter-student TF-IDF
    texts = [s["extracted_text"] for s in submissions]
    ids = [s["id"] for s in submissions]
    student_ids = [s["student_id"] for s in submissions]

    similarity_results = await compute_inter_submission_similarity(texts, ids, student_ids)

    # Compute combined scores
    results = []
    for sub in submissions:
        sub_id = sub["id"]
        per_sub = similarity_results["per_submission"].get(sub_id, {})
        max_sim = per_sub.get("max_similarity", 0.0)
        tfidf_originality = round((1 - max_sim) * 100, 2)

        # Fetch existing socratic score
        scores_res = await (
            db.table("reactive_scores")
            .select("socratic_score")
            .eq("submission_id", sub_id)
            .execute()
        )
        socratic_score = (scores_res.data[0] if scores_res.data else {}).get("socratic_score") or 0.0

        # Combined: 50% TF-IDF originality + 50% Socratic
        ownership_score = round(0.5 * tfidf_originality + 0.5 * socratic_score, 2)

        # Upsert all scores
        await (
            db.table("reactive_scores")
            .upsert(
                {
                    "submission_id": sub_id,
                    "similarity_score": max_sim,
                    "similarity_method": per_sub.get("max_similarity_method", "lexical"),
                    "tfidf_originality": tfidf_originality,
                    "socratic_score": socratic_score,
                    "ownership_score": ownership_score,
                },
                on_conflict="submission_id",
            )
            .execute()
        )

        results.append({
            "submission_id": sub_id,
            "student_id": sub["student_id"],
            "filename": sub["filename"],
            "max_similarity": max_sim,
            "most_similar_to": per_sub.get("most_similar_to"),
            "similarity_method": per_sub.get("max_similarity_method", "lexical"),
            "tfidf_originality": tfidf_originality,
            "socratic_score": socratic_score,
            "ownership_score": ownership_score,
        })

    return ok(
        data={
            "total_submissions": len(submissions),
            "flagged_pairs": similarity_results["flagged_pairs"],
            "results": sorted(results, key=lambda r: r["ownership_score"]),
        },
        message="Analysis complete",
    )


# ── Teacher: get results ──────────────────────────────────────────────────────

@router.get("/{classroom_assignment_id}/results", response_model=dict)
async def get_reactive_results(
    classroom_assignment_id: UUID,
    _: TeacherDep,
    db: DbDep,
):
    """Get analysis results for a reactive assignment."""
    subs_res = await (
        db.table("reactive_submissions")
        .select("id, student_id, filename, created_at")
        .eq("classroom_assignment_id", str(classroom_assignment_id))
        .order("created_at")
        .execute()
    )
    submissions = subs_res.data or []

    results = []
    for sub in submissions:
        scores_res = await (
            db.table("reactive_scores")
            .select("*")
            .eq("submission_id", sub["id"])
            .execute()
        )
        # Try to get student profile info
        profile_res = await (
            db.table("profiles")
            .select("name, email")
            .eq("id", sub["student_id"])
            .execute()
        )

        results.append({
            "submission_id": sub["id"],
            "student_id": sub["student_id"],
            "student_name": (profile_res.data[0] if profile_res.data else {}).get("name", "Unknown"),
            "student_email": (profile_res.data[0] if profile_res.data else {}).get("email"),
            "filename": sub["filename"],
            "submitted_at": sub["created_at"],
            "scores": scores_res.data[0] if scores_res.data else None,
        })

    return ok(data=results)
