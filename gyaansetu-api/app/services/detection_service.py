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

_corpus_embeddings = None
_corpus_embeddings_lock = asyncio.Lock()


async def _get_corpus_embeddings():
    """Return pre-computed semantic embeddings for the AI corpus."""
    global _corpus_embeddings
    if _corpus_embeddings is not None:
        return _corpus_embeddings

    async with _corpus_embeddings_lock:
        if _corpus_embeddings is not None:
            return _corpus_embeddings

        if not _corpus:
            return None

        model = await _get_st_model()
        texts = [doc["text"] for doc in _corpus]
        loop = asyncio.get_running_loop()
        logger.info("Computing embeddings for AI corpus (first use)...")
        _corpus_embeddings = await loop.run_in_executor(_ml_pool, lambda: model.encode(texts, convert_to_tensor=True))
        logger.info("AI corpus embeddings computed.")
        return _corpus_embeddings


# ── Public scoring functions ──────────────────────────────────────────────────

async def compute_similarity_score(submission_text: str) -> dict:
    """Run TF-IDF and Semantic similarity against the AI corpus; return max score."""
    if not _corpus or _vectorizer is None:
        return {"similarity_score": 0.0, "closest_match_id": None, "confidence_percent": 0.0, "risk_level": "low"}

    loop = asyncio.get_running_loop()

    # 1. TF-IDF
    def _run_tfidf():
        vec = _vectorizer.transform([submission_text])
        return cosine_similarity(vec, _corpus_matrix).flatten()

    tfidf_scores = await loop.run_in_executor(_ml_pool, _run_tfidf)

    # 2. Semantic
    model = await _get_st_model()
    corpus_embeddings = await _get_corpus_embeddings()

    def _run_semantic():
        from sentence_transformers import util
        sub_embedding = model.encode(submission_text, convert_to_tensor=True)
        return util.cos_sim(sub_embedding, corpus_embeddings).flatten().cpu().numpy()

    semantic_scores = await loop.run_in_executor(_ml_pool, _run_semantic)

    # Combine: MAX per document
    import numpy as np
    combined_scores = np.maximum(tfidf_scores, semantic_scores)
    max_idx = int(combined_scores.argmax())
    max_score = float(combined_scores[max_idx])

    risk_level = "high" if max_score >= 0.75 else "medium" if max_score >= 0.50 else "low"
    signal_type = "semantic" if semantic_scores[max_idx] > tfidf_scores[max_idx] else "lexical"

    return {
        "similarity_score": round(max_score, 4),
        "closest_match_id": _corpus[max_idx].get("id"),
        "confidence_percent": round(max_score * 100, 2),
        "risk_level": risk_level,
        "method_signal": signal_type,
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


# ── Inter-student Similarity (reactive mode) ──────────────────────────────────

async def compute_inter_submission_similarity(
    texts: list[str],
    submission_ids: list[str],
    student_ids: list[str],
    flag_threshold: float = 0.6,
) -> dict:
    """Compute pairwise similarity across all student submissions.

    Combines:
    1. TF-IDF Cosine Similarity (lexical/word-based)
    2. Semantic Similarity (Sentence-Transformers / all-MiniLM-L6-v2)

    The final similarity signal is the MAX of both methods.

    Returns:
        {
            "flagged_pairs": [{"student_a": ..., "student_b": ..., "similarity": 0.82}, ...],
            "per_submission": {
                "<submission_id>": {"max_similarity": 0.82, "most_similar_to": "<student_id>", "max_similarity_method": "semantic"},
                ...
            }
        }
    """
    loop = asyncio.get_running_loop()

    # 1. TF-IDF Similarity
    def _run_tfidf():
        vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
        tfidf_matrix = vectorizer.fit_transform(texts)
        return cosine_similarity(tfidf_matrix)

    tfidf_sim_matrix = await loop.run_in_executor(_ml_pool, _run_tfidf)

    # 2. Semantic Similarity
    model = await _get_st_model()

    def _run_semantic():
        from sentence_transformers import util
        embeddings = model.encode(texts, convert_to_tensor=True)
        # util.cos_sim returns a matrix
        return util.cos_sim(embeddings, embeddings).cpu().numpy()

    semantic_sim_matrix = await loop.run_in_executor(_ml_pool, _run_semantic)

    # 3. Combine and Flag
    n = len(texts)
    flagged_pairs: list[dict] = []
    per_submission: dict[str, dict] = {}

    for i in range(n):
        max_sim = 0.0
        most_similar_to = None
        max_sim_method = "lexical"

        for j in range(n):
            if i == j:
                continue

            # Take the MAX of both signals (lexical vs semantic)
            lexical_sim = float(tfidf_sim_matrix[i][j])
            semantic_sim = float(semantic_sim_matrix[i][j])
            sim = max(lexical_sim, semantic_sim)

            if sim > max_sim:
                max_sim = sim
                most_similar_to = student_ids[j]
                max_sim_method = "semantic" if semantic_sim > lexical_sim else "lexical"

            # Flag high-similarity pairs (each pair only once, when i < j)
            if sim >= flag_threshold and i < j:
                flagged_pairs.append({
                    "student_a": student_ids[i],
                    "student_b": student_ids[j],
                    "submission_a": submission_ids[i],
                    "submission_b": submission_ids[j],
                    "similarity": round(sim, 4),
                    "method_signal": "semantic" if semantic_sim > lexical_sim else "lexical"
                })

        per_submission[submission_ids[i]] = {
            "max_similarity": round(max_sim, 4),
            "most_similar_to": most_similar_to,
            "max_similarity_method": max_sim_method
        }

    return {
        "flagged_pairs": sorted(flagged_pairs, key=lambda x: x["similarity"], reverse=True),
        "per_submission": per_submission,
    }

