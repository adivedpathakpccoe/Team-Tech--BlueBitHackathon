import asyncio
import json
import logging
from functools import lru_cache
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

_CORPUS_PATH = Path(__file__).parent.parent.parent / "data" / "ai_corpus.json"

# ── Thread pool for CPU-bound ML work ─────────────────────────────────────────
# Running sentence-transformers / sklearn on the event loop thread blocks ALL
# concurrent requests.  We offload to a small thread pool instead.
_ml_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ml")

# ── Lazy-loaded SentenceTransformer ───────────────────────────────────────────
# Importing sentence_transformers pulls in torch (~2-5 s).  Loading the model
# on top of that adds another ~2-5 s.  By deferring the import + load to the
# first actual call we avoid penalizing every server startup and every request
# that doesn't need it.

_st_model = None
_st_lock = asyncio.Lock()


async def _get_st_model():
    """Return the SentenceTransformer model, loading it lazily on first use."""
    global _st_model
    if _st_model is not None:
        return _st_model

    async with _st_lock:
        # Double-check after acquiring the lock
        if _st_model is not None:
            return _st_model

        loop = asyncio.get_running_loop()
        logger.info("Loading SentenceTransformer model (first use)...")

        def _load():
            from sentence_transformers import SentenceTransformer
            return SentenceTransformer("all-MiniLM-L6-v2")

        _st_model = await loop.run_in_executor(_ml_pool, _load)
        logger.info("SentenceTransformer model loaded.")
        return _st_model


# ── Corpus (TF-IDF) ──────────────────────────────────────────────────────────

_corpus: list[dict] = []
_vectorizer: TfidfVectorizer | None = None
_corpus_matrix = None


def _load_corpus() -> None:
    """Load the AI-generated essay corpus and fit the TF-IDF vectorizer."""
    global _corpus, _vectorizer, _corpus_matrix
    if not _CORPUS_PATH.exists():
        _corpus = []
        return
    _corpus = json.loads(_CORPUS_PATH.read_text())
    texts = [doc["text"] for doc in _corpus]
    _vectorizer = TfidfVectorizer()
    _corpus_matrix = _vectorizer.fit_transform(texts)


_load_corpus()


# ── Public scoring functions ──────────────────────────────────────────────────

def compute_similarity_score(submission_text: str) -> dict:
    """Run TF-IDF cosine similarity against the AI corpus; return score and risk."""
    if not _corpus or _vectorizer is None:
        return {"similarity_score": 0.0, "closest_match_id": None, "confidence_percent": 0.0, "risk_level": "low"}

    vec = _vectorizer.transform([submission_text])
    scores = cosine_similarity(vec, _corpus_matrix).flatten()
    max_idx = int(scores.argmax())
    max_score = float(scores[max_idx])

    risk_level = "high" if max_score >= 0.75 else "medium" if max_score >= 0.50 else "low"

    return {
        "similarity_score": round(max_score, 4),
        "closest_match_id": _corpus[max_idx].get("id"),
        "confidence_percent": round(max_score * 100, 2),
        "risk_level": risk_level,
    }


async def compute_honeypot_score(student_essay: str, honeypot_phrase: str, expected_interpretations: list[str]) -> float:
    """Score how well the student engaged with the honeypot phrase (0–100).

    Now async — offloads the heavy SentenceTransformer .encode() calls to a
    thread pool so the event loop is never blocked.
    """
    if honeypot_phrase.lower() in student_essay.lower():
        # Verbatim match — likely AI-generated
        return 0.0

    if not expected_interpretations:
        return 50.0

    model = await _get_st_model()
    loop = asyncio.get_running_loop()

    def _encode_and_score():
        from sentence_transformers import util
        essay_embedding = model.encode(student_essay, convert_to_tensor=True)
        interp_embeddings = model.encode(expected_interpretations, convert_to_tensor=True)
        sims = util.cos_sim(essay_embedding, interp_embeddings).squeeze()
        best_sim = float(sims.max())
        return round(best_sim * 100, 2)

    return await loop.run_in_executor(_ml_pool, _encode_and_score)


def compute_ownership_score(behavior_score: float, honeypot_score: float, socratic_score: float) -> float:
    """Compute final proactive ownership score from three sub-scores."""
    return round(0.4 * behavior_score + 0.3 * honeypot_score + 0.3 * socratic_score, 2)
