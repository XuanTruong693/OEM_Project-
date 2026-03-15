from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.schemas import GradeRequest, GradeResponse
from app.nlp import calculate_score, get_model
from app.security import SecurityMiddleware, load_blacklist
import uvicorn
import os
import json
import threading
from typing import List, Optional
from datetime import datetime

# Import learning module
try:
    from app.learning import get_learning_engine
    _learning_available = True
except ImportError:
    _learning_available = False

app = FastAPI(title="AI Grading Service", version="1.2.0")

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

# ===== AUTO-RETRAIN SYSTEM =====
RETRAIN_THRESHOLD = int(os.getenv("RETRAIN_THRESHOLD", "1"))  # Số corrections cần đạt để auto-retrain
RETRAIN_LOG_PATH = os.path.join(os.path.dirname(__file__), "retrain_history.json")
_retrain_lock = threading.Lock()

# In-memory retrain state
_retrain_state = {
    "corrections_since_last_retrain": 0,
    "total_corrections": 0,
    "last_retrain_at": None,
    "retrain_count": 0,
    "accuracy_before": None,
    "accuracy_after": None,
    "is_retraining": False,
}


def _load_retrain_history():
    """Load retrain history from file."""
    global _retrain_state
    try:
        if os.path.exists(RETRAIN_LOG_PATH):
            with open(RETRAIN_LOG_PATH, "r", encoding="utf-8") as f:
                saved = json.load(f)
                _retrain_state.update(saved)
    except Exception as e:
        print(f"[AutoRetrain] Could not load history: {e}")


def _save_retrain_history():
    """Save retrain history to file."""
    try:
        with open(RETRAIN_LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(_retrain_state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[AutoRetrain] Could not save history: {e}")


def _measure_accuracy_sample():
    """Measure accuracy on a small sample of learned data for before/after comparison."""
    try:
        from app.dataset_learning import get_learning_stats as ds_stats
        stats = ds_stats()
        return stats.get("total", 0)
    except Exception:
        return 0


def _do_auto_retrain():
    """Perform auto-retrain: reload patterns from DB + file, update stats."""
    global _retrain_state
    
    with _retrain_lock:
        if _retrain_state["is_retraining"]:
            return  # Already retraining
        _retrain_state["is_retraining"] = True
    
    try:
        print(f"[AutoRetrain] 🔄 Bắt đầu auto-retrain (đã đủ {RETRAIN_THRESHOLD} corrections)...")
        
        # Measure accuracy BEFORE
        accuracy_before = _measure_accuracy_sample()
        
        # Retrain: reload all patterns
        if _learning_available:
            engine = get_learning_engine()
            
            # Reload from DB
            db_count = 0
            try:
                import mysql.connector
                db_config = {
                    "host": os.getenv("DB_HOST", "localhost"),
                    "user": os.getenv("DB_USER", "root"),
                    "password": os.getenv("DB_PASSWORD", "Truongdo123."),
                    "database": os.getenv("DB_NAME", "oem_mini"),
                    "charset": "utf8mb4"
                }
                conn = mysql.connector.connect(**db_config)
                db_count = engine.load_patterns_from_db(conn)
                conn.close()
            except Exception as e:
                print(f"[AutoRetrain] ⚠️ DB reload failed: {e}")
            
            # Reload from file
            engine._load_patterns_from_file()
        
        # Reload dataset_learning patterns
        try:
            from app.dataset_learning import _reload_learned_patterns
            _reload_learned_patterns()
        except Exception as e:
            print(f"[AutoRetrain] ⚠️ Dataset reload failed: {e}")
        
        # Measure accuracy AFTER
        accuracy_after = _measure_accuracy_sample()
        
        # Update state
        with _retrain_lock:
            _retrain_state["corrections_since_last_retrain"] = 0
            _retrain_state["last_retrain_at"] = datetime.now().isoformat()
            _retrain_state["retrain_count"] += 1
            _retrain_state["accuracy_before"] = accuracy_before
            _retrain_state["accuracy_after"] = accuracy_after
            _retrain_state["is_retraining"] = False
        
        _save_retrain_history()
        
        print(f"[AutoRetrain] ✅ Auto-retrain hoàn tất!")
        print(f"[AutoRetrain]    Version: #{_retrain_state['retrain_count']}")
        print(f"[AutoRetrain]    Patterns trước: {accuracy_before}, sau: {accuracy_after}")
        
    except Exception as e:
        print(f"[AutoRetrain] ❌ Error: {e}")
        with _retrain_lock:
            _retrain_state["is_retraining"] = False


def _increment_correction_counter():
    """Increment correction counter and trigger auto-retrain if threshold reached."""
    global _retrain_state
    
    with _retrain_lock:
        _retrain_state["corrections_since_last_retrain"] += 1
        _retrain_state["total_corrections"] += 1
        count = _retrain_state["corrections_since_last_retrain"]
    
    if count >= RETRAIN_THRESHOLD:
        # Fire-and-forget retrain in background thread
        print(f"[AutoRetrain] 🎯 Đạt ngưỡng {RETRAIN_THRESHOLD} corrections! Triggering auto-retrain...")
        thread = threading.Thread(target=_do_auto_retrain, daemon=True)
        thread.start()
    elif count % 10 == 0:
        print(f"[AutoRetrain] 📊 {count}/{RETRAIN_THRESHOLD} corrections đến lần retrain tiếp theo")


# ===== STARTUP =====

@app.on_event("startup")
def startup_event():
    print("[Security] Loading Security Configuration...")
    load_blacklist()
    print("[AI Model] Loading AI Model...")
    get_model()
    
    # Load retrain history
    _load_retrain_history()
    print(f"[AutoRetrain] Loaded history: {_retrain_state['retrain_count']} retrains, "
          f"{_retrain_state['corrections_since_last_retrain']}/{RETRAIN_THRESHOLD} corrections pending")
    
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
    return {"status": "ok", "service": "AI Grading Service", "version": "1.2.0"}

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
    """Get learning statistics including auto-retrain info"""
    if not _learning_available:
        return {"status": "error", "message": "Learning module not available"}
    
    engine = get_learning_engine()
    stats = engine.get_stats()
    
    # Merge retrain stats
    stats["auto_retrain"] = {
        "corrections_since_last_retrain": _retrain_state["corrections_since_last_retrain"],
        "threshold": RETRAIN_THRESHOLD,
        "total_corrections": _retrain_state["total_corrections"],
        "retrain_count": _retrain_state["retrain_count"],
        "last_retrain_at": _retrain_state["last_retrain_at"],
        "is_retraining": _retrain_state["is_retraining"],
    }
    
    return {"status": "ok", "stats": stats}


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
        
        # 3. AUTO-RETRAIN: Track correction count
        _increment_correction_counter()
        
        return {
            "status": "ok",
            "message": "Learned from correction",
            "dataset_saved": ds_success,
            "legacy_saved": legacy_success,
            "student_answer": req.student_answer[:100],
            "model_answer": req.model_answer[:100],
            "score_change": f"{req.old_score} → {req.new_score}",
            "corrections_until_retrain": max(0, RETRAIN_THRESHOLD - _retrain_state["corrections_since_last_retrain"]),
        }
    except Exception as e:
        print(f"[Learning] Error learning from correction: {e}")
        return {"status": "error", "message": str(e)}


# ===== BATCH TRAIN ENDPOINT =====

class BatchTrainItem(BaseModel):
    student_answer: str
    model_answer: str
    old_score: float = 0.0
    new_score: float
    max_points: float = 10.0
    feedback: str = ""

class BatchTrainRequest(BaseModel):
    samples: List[BatchTrainItem]
    trigger_retrain: bool = False  # Force retrain after batch


@app.post("/learn/batch-train")
def batch_train(req: BatchTrainRequest):
    """
    Batch train: nhận nhiều corrections cùng lúc và xử lý hàng loạt.
    Dùng khi instructor đã sửa nhiều bài cùng lúc hoặc import training data.
    """
    if not req.samples:
        return {"status": "error", "message": "No samples provided"}
    
    results = {
        "total": len(req.samples),
        "success": 0,
        "failed": 0,
        "errors": [],
        "dataset_saved": 0,
        "legacy_saved": 0,
    }
    
    from app.dataset_learning import learn_correction as ds_learn
    
    for i, sample in enumerate(req.samples):
        try:
            # 1. Save to dataset_learning.py
            ds_ok = ds_learn(
                student_text=sample.student_answer,
                model_text=sample.model_answer,
                actual_score=sample.new_score,
                max_points=sample.max_points,
                feedback=sample.feedback or f"Batch train: {sample.old_score} → {sample.new_score}"
            )
            if ds_ok:
                results["dataset_saved"] += 1
            
            # 2. Update learning engine
            if _learning_available:
                try:
                    engine = get_learning_engine()
                    engine.add_learned_pattern(
                        student_answer=sample.student_answer,
                        model_answer=sample.model_answer,
                        confirmed_score=sample.new_score,
                        max_points=sample.max_points
                    )
                    
                    # Learn synonyms if score increased
                    if sample.new_score > sample.old_score:
                        candidates = [{
                            "student_words": engine._tokenize(sample.student_answer),
                            "model_words": engine._tokenize(sample.model_answer),
                            "ai_score_percent": sample.old_score,
                            "confirmed_score_percent": sample.new_score
                        }]
                        engine._learn_synonyms_from_candidates(candidates)
                    
                    results["legacy_saved"] += 1
                except Exception as e:
                    print(f"[BatchTrain] Legacy engine error for sample {i}: {e}")
            
            # 3. Increment counter (but don't trigger retrain per-item)
            with _retrain_lock:
                _retrain_state["corrections_since_last_retrain"] += 1
                _retrain_state["total_corrections"] += 1
            
            results["success"] += 1
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({"index": i, "error": str(e)})
            print(f"[BatchTrain] Error on sample {i}: {e}")
    
    _save_retrain_history()
    
    # Check if should trigger retrain
    should_retrain = req.trigger_retrain or _retrain_state["corrections_since_last_retrain"] >= RETRAIN_THRESHOLD
    
    if should_retrain:
        print(f"[BatchTrain] 🔄 Triggering retrain after batch of {results['success']} samples...")
        thread = threading.Thread(target=_do_auto_retrain, daemon=True)
        thread.start()
        results["retrain_triggered"] = True
    else:
        results["retrain_triggered"] = False
        results["corrections_until_retrain"] = max(0, RETRAIN_THRESHOLD - _retrain_state["corrections_since_last_retrain"])
    
    print(f"[BatchTrain] ✅ Hoàn tất: {results['success']}/{results['total']} thành công")
    
    return {
        "status": "ok",
        "message": f"Batch trained {results['success']}/{results['total']} samples",
        "results": results
    }


# ===== RETRAIN STATUS ENDPOINT =====

@app.get("/learn/retrain-status")
def get_retrain_status():
    """Xem trạng thái auto-retrain: counter, history, accuracy trước/sau."""
    return {
        "status": "ok",
        "retrain": {
            "threshold": RETRAIN_THRESHOLD,
            "corrections_since_last_retrain": _retrain_state["corrections_since_last_retrain"],
            "corrections_until_next": max(0, RETRAIN_THRESHOLD - _retrain_state["corrections_since_last_retrain"]),
            "total_corrections": _retrain_state["total_corrections"],
            "retrain_count": _retrain_state["retrain_count"],
            "last_retrain_at": _retrain_state["last_retrain_at"],
            "is_retraining": _retrain_state["is_retraining"],
            "accuracy_before_last_retrain": _retrain_state["accuracy_before"],
            "accuracy_after_last_retrain": _retrain_state["accuracy_after"],
        }
    }


@app.post("/learn/force-retrain")
def force_retrain():
    """Bắt retrain ngay lập tức, không cần đợi đủ threshold."""
    if _retrain_state["is_retraining"]:
        return {"status": "error", "message": "Đang retrain, vui lòng đợi..."}
    
    thread = threading.Thread(target=_do_auto_retrain, daemon=True)
    thread.start()
    
    return {
        "status": "ok",
        "message": "Retrain đã bắt đầu trong background",
        "retrain_version": _retrain_state["retrain_count"] + 1
    }


# ===== BEHAVIOR DETECTION ENDPOINT =====
class BehaviorEvent(BaseModel):
    timestamp: int
    event_type: str
    details: dict = {}

class DetectBehaviorRequest(BaseModel):
    student_id: int
    exam_id: int
    events: list[BehaviorEvent]
    window_duration_seconds: int = 10

@app.post("/api/ai/detect-behavior")
async def detect_behavior(req: DetectBehaviorRequest):
    try:
        from app.nlp.behavior_detection import behavior_model
        # Parse events to dict
        raw_events = [e.dict() for e in req.events]
        result = behavior_model.detect_cheating(raw_events)
        return {
            "success": True,
            "is_cheating": result["is_cheating"],
            "confidence": result["confidence"],
            "cheating_type": result["reason"],
            "features": result["features_extracted"]
        }
    except Exception as e:
        import logging
        logging.error(f"Error in detect_behavior: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
