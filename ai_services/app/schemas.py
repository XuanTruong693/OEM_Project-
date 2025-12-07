from pydantic import BaseModel
from typing import Optional

class GradeRequest(BaseModel):
    student_answer: str
    model_answer: str
    max_points: float

class GradeResponse(BaseModel):
    score: float
    confidence: float
    explanation: str
    fact_multiplier: float
    error: Optional[str] = None
