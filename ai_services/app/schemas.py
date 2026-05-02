from pydantic import BaseModel
from typing import Optional

class GradeRequest(BaseModel):
    student_answer: str
    model_answer: str
    max_points: float
    question_text: Optional[str] = None
    grading_mode: Optional[str] = "general"

class GradeResponse(BaseModel):
    score: float
    confidence: float
    explanation: str
    fact_multiplier: float
    type: Optional[str] = None
    error: Optional[str] = None
