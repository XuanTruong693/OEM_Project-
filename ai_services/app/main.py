from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.schemas import GradeRequest, GradeResponse
from app.nlp import calculate_score, get_model
from app.security import SecurityMiddleware, load_blacklist
import uvicorn
import os

# Import learning module
try:
    from app.learning import get_learning_engine
    _learning_available = True
except ImportError:
    _learning_available = False

app = FastAPI(title="AI Grading Service", version="1.1.0")

# Add security middleware FIRST
app.add_middleware(SecurityMiddleware)

# CORS configuration for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4000",
        "http://127.0.0.1:4000",
        "http://www.oem.io.vn",
        "https://www.oem.io.vn",
        "http://oem.io.vn",
        "https://oem.io.vn",
        "http://localhost:5000",
    ],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    print("[Security] Loading Security Configuration...")
    load_blacklist()
    print("[AI Model] Loading AI Model...")
    get_model()
    
    if _learning_available:
        print("[Learning] Learning Engine initialized")
        print("[Learning] Loading synonyms from learned_synonyms.json...")
        try:
             engine = get_learning_engine()
        except Exception as e:
             print(f"[Learning] ⚠️ Error loading engine/patterns: {e}")
             # Non-critical, continue
             engine = None
        
        if engine:
             print(f"[Learning] Loaded {len(engine.synonyms)} synonym groups from file")
        
        # Auto-load patterns from database
        try:
            import mysql.connector
            db_config = {
                "host": os.getenv("DB_HOST", "localhost"),
                "user": os.getenv("DB_USER", "root"),
                "password": os.getenv("DB_PASSWORD", "Truongdo123."),
                "database": os.getenv("DB_NAME", "oem_mini"),
                "charset": "utf8mb4"
            }
            print(f"[Learning] Connecting to database {db_config['database']}@{db_config['host']}...")
            conn = mysql.connector.connect(**db_config)
            count = engine.load_patterns_from_db(conn)
            conn.close()
            print(f"[Learning] ✅ Loaded {count} instructor-confirmed patterns from database")
            # print("[Learning] ℹ️ DB loading temporarily disabled due to crash.")
        except ImportError:
            print("[Learning] ⚠️ mysql-connector not installed, skipping DB patterns")
        except Exception as e:
            print(f"[Learning] ⚠️ Could not load patterns from DB: {e}")
            print("[Learning] ℹ️ Using file-based synonyms only")
    
    print("[Ready] AI Service Ready!")

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
    return {"status": "ok", "service": "AI Grading Service", "version": "1.1.0"}

@app.get("/favicon.ico")
def favicon():
    """Return 204 to prevent 404 spam in logs"""
    from fastapi.responses import Response
    return Response(status_code=204)


# ===== LEARNING ENDPOINTS =====

@app.post("/learn/reload")
def reload_learning_patterns(db_host: str = "localhost", db_user: str = "root", 
                             db_password: str = "", db_name: str = "oem_mini"):
    # Reload learned patterns from database.

    if not _learning_available:
        return {"status": "error", "message": "Learning module not available"}
    
    try:
        import mysql.connector
        
        db_config = {
            "host": os.getenv("DB_HOST", db_host),
            "user": os.getenv("DB_USER", db_user),
            "password": os.getenv("DB_PASSWORD", db_password),
            "database": os.getenv("DB_NAME", db_name),
            "charset": "utf8mb4"
        }
        
        conn = mysql.connector.connect(**db_config)
        engine = get_learning_engine()
        count = engine.load_patterns_from_db(conn)
        conn.close()
        
        return {
            "status": "ok",
            "message": f"Reloaded {count} patterns",
            "stats": engine.get_stats()
        }
    except Exception as e:
        print(f"[Learning] Reload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/learn/stats")
def get_learning_stats():
    """Get learning statistics"""
    if not _learning_available:
        return {"status": "error", "message": "Learning module not available"}
    
    engine = get_learning_engine()
    return {"status": "ok", "stats": engine.get_stats()}


@app.get("/learn/synonyms")
def get_synonyms():
    """Get current synonym mappings"""
    if not _learning_available:
        return {"status": "error", "message": "Learning module not available"}
    
    engine = get_learning_engine()
    # Convert sets to lists for JSON serialization
    synonyms_dict = {k: list(v) for k, v in engine.synonyms.items()}
    return {
        "status": "ok",
        "total_groups": len(synonyms_dict),
        "synonyms": synonyms_dict
    }


class CorrectionRequest(BaseModel):
    student_answer: str
    model_answer: str
    old_score: float
    new_score: float
    max_points: float = 10.0  # Default max points
    feedback: str = ""


@app.post("/learn/from-correction")
def learn_from_correction(req: CorrectionRequest):
    try:
        # 1. Save to dataset_learning.py (File-based, immediate)
        from app.dataset_learning import learn_correction as ds_learn
        ds_success = ds_learn(
            student_text=req.student_answer,
            model_text=req.model_answer,
            actual_score=req.new_score,
            max_points=req.max_points,
            feedback=req.feedback if req.feedback else f"Instructor corrected: {req.old_score} → {req.new_score}"
        )
        
        # 2. LEGACY: Also update learning.py engine if available
        legacy_success = False
        if _learning_available:
            try:
                engine = get_learning_engine()
                engine.add_learned_pattern(
                    student_answer=req.student_answer,
                    model_answer=req.model_answer,
                    confirmed_score=req.new_score,
                    max_points=req.max_points
                )
                
                # Learn synonyms if score was increased
                if req.new_score > req.old_score:
                    candidates = [{
                        "student_words": engine._tokenize(req.student_answer),
                        "model_words": engine._tokenize(req.model_answer),
                        "ai_score_percent": req.old_score,
                        "confirmed_score_percent": req.new_score
                    }]
                    engine._learn_synonyms_from_candidates(candidates)
                
                legacy_success = True
            except Exception as e:
                print(f"[Learning] Legacy engine error: {e}")
        
        return {
            "status": "ok",
            "message": "Learned from correction",
            "dataset_saved": ds_success,
            "legacy_saved": legacy_success,
            "student_answer": req.student_answer[:100],
            "model_answer": req.model_answer[:100],
            "score_change": f"{req.old_score} → {req.new_score}"
        }
    except Exception as e:
        print(f"[Learning] Error learning from correction: {e}")
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    import os
    is_dev = os.getenv("ENVIRONMENT", "production").lower() == "development"
    port = int(os.getenv("AI_PORT", 8000))
    
    print(f"[AI Service] Starting in {'DEVELOPMENT' if is_dev else 'PRODUCTION'} mode on port {port}")
    
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=port, 
        reload=is_dev,  # Only reload in development
        timeout_keep_alive=60,  # Keep connections alive for batch requests
        access_log=not is_dev  # Disable access log in dev for cleaner output
    )
