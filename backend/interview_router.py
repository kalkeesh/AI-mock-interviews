import os
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

if __package__:
    from .db import get_interview_sessions_collection
else:
    from db import get_interview_sessions_collection

router = APIRouter(prefix="/interview", tags=["Interview"])

Level = Literal["Low", "Medium", "High"]
_st_model = None


class QuestionAnswer(BaseModel):
    question: str
    category: Optional[str] = None
    expected_answer: Optional[str] = None
    answer_text: str = ""
    asked_at: Optional[datetime] = None
    answered_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None


class FaceMetrics(BaseModel):
    confidence_level: Level
    nervousness_level: Level
    confidence_score: float = Field(ge=0, le=100)
    nervousness_score: float = Field(ge=0, le=100)
    face_visible_ratio: Optional[float] = None
    centered_ratio: Optional[float] = None
    movement_score: Optional[float] = None


class InterviewSessionPayload(BaseModel):
    session_mode: Optional[Literal["interview", "gd"]] = "interview"
    candidate_email: Optional[str] = None
    candidate_name: Optional[str] = None
    answers: List[QuestionAnswer]
    face_metrics: FaceMetrics


def _get_sentence_model():
    global _st_model
    if _st_model is None:
        token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN") or os.getenv("HF_API_KEY")
        if token:
            os.environ.setdefault("HF_TOKEN", token)
            os.environ.setdefault("HUGGINGFACE_HUB_TOKEN", token)

        from sentence_transformers import SentenceTransformer

        _st_model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2", token=token)
    return _st_model


def _score_answers_batch(answers: List[QuestionAnswer]) -> dict:
    if not answers:
        return {
            "question_scores": [],
            "average_score": 0.0,
            "completion_rate": 0.0,
            "quality": "Low",
        }

    expected_texts = [(a.expected_answer or a.question or "").strip() for a in answers]
    candidate_texts = [(a.answer_text or "").strip() for a in answers]

    non_empty = [a for a in candidate_texts if a]
    completion_rate = len(non_empty) / len(answers)

    model = _get_sentence_model()
    expected_emb = model.encode(expected_texts, convert_to_tensor=True)
    candidate_emb = model.encode(candidate_texts, convert_to_tensor=True)

    from sentence_transformers import util

    diagonal_sim = util.cos_sim(expected_emb, candidate_emb).diagonal()

    question_scores = []
    for i, sim in enumerate(diagonal_sim):
        if not candidate_texts[i]:
            question_scores.append(0.0)
            continue
        similarity = float(sim.item())
        similarity = max(0.0, min(1.0, similarity))
        question_scores.append(round(similarity * 10, 2))

    average_score = round(sum(question_scores) / len(question_scores), 2)

    if average_score >= 7.0 and completion_rate >= 0.8:
        quality = "High"
    elif average_score >= 4.5 and completion_rate >= 0.5:
        quality = "Medium"
    else:
        quality = "Low"

    return {
        "question_scores": question_scores,
        "average_score": average_score,
        "completion_rate": round(completion_rate, 2),
        "quality": quality,
    }


def _overall_result(confidence: Level, nervousness: Level, answer_quality: str) -> str:
    if confidence == "High" and nervousness == "Low" and answer_quality in {"High", "Medium"}:
        return "Strong performance"
    if confidence == "Low" or nervousness == "High" or answer_quality == "Low":
        return "Needs improvement"
    return "Moderate performance"


@router.post("/session/complete")
def complete_interview_session(payload: InterviewSessionPayload):
    try:
        answer_eval = _score_answers_batch(payload.answers)
        summary = {
            "answer_quality": answer_eval["quality"],
            "question_scores": answer_eval["question_scores"],
            "average_answer_score": answer_eval["average_score"],
            "completion_rate": answer_eval["completion_rate"],
            "confidence_level": payload.face_metrics.confidence_level,
            "nervousness_level": payload.face_metrics.nervousness_level,
            "overall_result": _overall_result(
                payload.face_metrics.confidence_level,
                payload.face_metrics.nervousness_level,
                answer_eval["quality"],
            ),
        }

        document = {
            "session_mode": payload.session_mode or "interview",
            "candidate_email": payload.candidate_email,
            "candidate_name": payload.candidate_name,
            "answers": [a.model_dump() for a in payload.answers],
            "face_metrics": payload.face_metrics.model_dump(),
            "summary": summary,
            "created_at": datetime.utcnow(),
        }
        collection = get_interview_sessions_collection()
        insert_result = collection.insert_one(document)

        return {
            "message": "Interview session stored",
            "session_id": str(insert_result.inserted_id),
            "session_mode": payload.session_mode or "interview",
            "summary": summary,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save session: {exc}") from exc
