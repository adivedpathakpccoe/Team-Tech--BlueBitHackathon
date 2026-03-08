import io
from uuid import UUID
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pypdf import PdfReader
from docx import Document
from app.core.deps import CurrentUserDep, DbDep
from app.core.responses import ok

router = APIRouter()

_ALLOWED_TYPES = {"text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


def _extract_text(content: bytes, content_type: str) -> str:
    """Extract plain text from uploaded file bytes based on MIME type."""
    if content_type == "text/plain":
        return content.decode("utf-8", errors="replace")
    if content_type == "application/pdf":
        reader = PdfReader(io.BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    doc = Document(io.BytesIO(content))
    return "\n".join(para.text for para in doc.paragraphs)


@router.post("/", response_model=dict, status_code=201)
async def upload_file(
    current_user: CurrentUserDep,
    db: DbDep,
    submission_id: UUID = Form(...),
    file: UploadFile = File(...),
):
    """Accept a reactive file upload, extract text, and persist the upload record."""
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Use .txt, .pdf, or .docx")

    content = await file.read()
    extracted_text = _extract_text(content, file.content_type)

    res = await db.table("uploads").insert({
        "submission_id": str(submission_id),
        "filename": file.filename,
        "extracted_text": extracted_text,
    }).execute()

    return ok(data=res.data[0], message="File uploaded and text extracted")
