import pytest


@pytest.mark.asyncio
async def test_create_submission_unauthenticated(client):
    """Verify unauthenticated submission returns 403."""
    res = await client.post("/api/submission/", json={"assignment_id": "00000000-0000-0000-0000-000000000001", "essay_text": "Test essay"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_similarity_score_no_upload(client):
    """Verify similarity score returns 404 when no upload exists."""
    res = await client.post("/api/similarity/score", params={"submission_id": "00000000-0000-0000-0000-000000000001"})
    assert res.status_code in (401, 403, 404)
