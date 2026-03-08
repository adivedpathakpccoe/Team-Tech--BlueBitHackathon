import os
import json
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer, util

_CORPUS_PATH = Path(__file__).parent.parent.parent / "data" / "ai_corpus.json"
_st_model = SentenceTransformer("all-MiniLM-L6-v2")

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


def compute_honeypot_score(student_essay: str, honeypot_phrase: str, expected_interpretations: list[str]) -> float:
    """Score how well the student engaged with the honeypot phrase (0–100)."""
    if honeypot_phrase.lower() in student_essay.lower():
        # Verbatim match — likely AI-generated
        return 0.0

    if not expected_interpretations:
        return 50.0

    essay_embedding = _st_model.encode(student_essay, convert_to_tensor=True)
    interp_embeddings = _st_model.encode(expected_interpretations, convert_to_tensor=True)
    sims = util.cos_sim(essay_embedding, interp_embeddings).squeeze()
    best_sim = float(sims.max())
    return round(best_sim * 100, 2)


def compute_ownership_score(behavior_score: float, honeypot_score: float, socratic_score: float) -> float:
    """Compute final proactive ownership score from three sub-scores."""
    return round(0.4 * behavior_score + 0.3 * honeypot_score + 0.3 * socratic_score, 2)
