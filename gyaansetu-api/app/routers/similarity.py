from uuid import UUID
from fastapi import APIRouter
from app.core.deps import CurrentUserDep, DbDep
from app.core.responses import ok
from app.services.detection_service import compute_similarity_score

router = APIRouter()


@router.post("/score", response_model=dict)
async def run_similarity(submission_id: UUID, _: CurrentUserDep, db: DbDep):
    """Run TF-IDF cosine similarity on the uploaded text and store the result."""
    upload_res = await db.table("uploads").select("extracted_text").eq("submission_id", str(submission_id)).maybe_single().execute()
    if not upload_res.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No upload found for this submission")

    result = compute_similarity_score(upload_res.data["extracted_text"])
    similarity_score = result["similarity_score"]
    ownership_score = round((1 - similarity_score) * 100, 2)

    await db.table("scores").upsert({
        "submission_id": str(submission_id),
        "similarity_score": similarity_score,
        "ownership_score": ownership_score,
    }, on_conflict="submission_id").execute()

    return ok(data={**result, "ownership_score": ownership_score})
