from fastapi import FastAPI, HTTPException
from app.schemas import GradeRequest, GradeResponse
from app.nlp import calculate_score, get_model
import uvicorn
import os

app = FastAPI(title="AI Grading Service", version="1.0.0")

@app.on_event("startup")
def startup_event():
    print("Loading AI Model...")
    get_model()
    print("AI Model Loaded Successfully.")

@app.post("/grade", response_model=GradeResponse)
def grade_answer(request: GradeRequest):
    try:
        result = calculate_score(
            request.student_answer,
            request.model_answer,
            request.max_points
        )
        return result
    except Exception as e:
        print(f"Error grading: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def health_check():
    return {"status": "ok", "service": "AI Grading Service"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
