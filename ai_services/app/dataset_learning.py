"""
Dataset Learning Module for AI Grading (Rubric-based)
Supports new format with rubrics, matched/missing concepts, and detailed feedback.
"""
import json
import os
from typing import Dict, List, Optional, Tuple

# Path to unified training data file
UNIFIED_DATA_PATH = os.path.join(os.path.dirname(__file__), 'ai_training_data.json')

# Singleton
_data = None
_synonyms = None
_contradictions = None
_questions = None
_model_index: Dict[str, Dict] = {} # Map normalized model answer -> question object

def _normalize_key(text: str) -> str:
    """Normalize text for indexing (remove punctuation, lower, compact spaces)."""
    if not text:
        return ""
    import re
    # Lowercase and strip
    text = text.lower().strip()
    # Remove all punctuation/special chars
    text = re.sub(r'[^\w\s]', '', text)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text)
    return text

def load_data() -> dict:
    """Load unified training data from JSON file."""
    global _data, _synonyms, _contradictions, _questions, _model_index
    
    if _data is not None:
        return _data
    
    try:
        with open(UNIFIED_DATA_PATH, 'r', encoding='utf-8') as f:
            _data = json.load(f)
        
        # Extract components
        _synonyms = _data.get('synonyms', {})
        _contradictions = _data.get('contradictions', {})
        _questions = _data.get('grading_questions', [])
        
        # Build Index
        _model_index = {}
        for q in _questions:
            m_ans = q.get('model_answer', '')
            if m_ans:
                norm_key = _normalize_key(m_ans)
                if norm_key:
                    _model_index[norm_key] = q
        
        print(f"[AI Training] Loaded rubric-based data:")
        print(f"   - {len(_questions)} grading questions")
        print(f"   - {len(_model_index)} indexed model answers")
        print(f"   - {len(_synonyms)} synonym groups")
        print(f"   - {len(_contradictions)} contradiction pairs")
        
        # Count total samples
        total_samples = sum(len(q.get('grading_samples', [])) for q in _questions)
        print(f"   - {total_samples} total grading samples")
        
        return _data
    except Exception as e:
        print(f"[AI Training] Error loading data: {e}")
        return {}


def get_synonyms(word: str) -> List[str]:
    """Get synonyms for a word."""
    if _synonyms is None:
        load_data()
    
    word_lower = word.lower()
    
    # Direct lookup
    if word_lower in _synonyms:
        return _synonyms[word_lower]
    
    # Reverse lookup (find the word in synonym lists)
    for key, synonyms in _synonyms.items():
        if word_lower in [s.lower() for s in synonyms]:
            return [key] + [s for s in synonyms if s.lower() != word_lower]
    
    return []


def get_contradictions(word: str) -> List[str]:
    """Get contradicting terms for a word."""
    if _contradictions is None:
        load_data()
    
    word_lower = word.lower()
    
    if word_lower in _contradictions:
        return _contradictions[word_lower]
    
    return []


def find_similar_grading(
    student_answer: str, 
    model_answer: str,
    max_points: float
) -> Optional[Dict]:
    """
    Find a similar grading sample from the training data.
    Uses rubric-based matching for better accuracy.
    """
    if _questions is None:
        load_data()
    
    if not _questions:
        return None
    
    student_lower = student_answer.lower().strip()
    # Normalize model answer effectively for key lookup
    model_key = _normalize_key(model_answer)
    
    best_match = None
    best_similarity = 0.0
    
    # Optimizer: Use O(1) lookup
    target_questions = []
    if model_key in _model_index:
        target_questions = [_model_index[model_key]]
        # print(f"[Dataset] O(1) Hit for model answer: {model_key[:20]}...")
    else:
        # Fallback to linear scan (slow but safe if model answer text varies slightly)
        # print(f"[Dataset] O(1) Miss for model answer: {model_key[:20]}... Scanning {_questions} questions")
        target_questions = _questions

    # Search through target questions (1 if hit, all if miss)
    for question in target_questions:
        question_model = question.get('model_answer', '').lower()
        
        # Only check similarity if we are in fallback mode (linear scan)
        # If we hit O(1), we know it matches
        if len(target_questions) > 1:
            model_sim = _text_similarity(model_answer.lower(), question_model)
            if model_sim <= 0.5:
                continue

        # Search grading samples within this question
        for sample in question.get('grading_samples', []):
            sample_student = sample.get('student_answer', '').lower()
            student_sim = _text_similarity(student_lower, sample_student)
            
            if student_sim > best_similarity and student_sim > 0.6:
                best_similarity = student_sim
                
                # Calculate scaled score
                original_score = sample.get('score', 0)
                original_max = question.get('max_points', 2.0)
                scaled_score = (original_score / original_max) * max_points
                
                best_match = {
                    'score': round(scaled_score, 2),
                    'confidence': round(student_sim, 2),
                    'feedback': sample.get('feedback', 'Matched training sample'),
                    'matched_concepts': sample.get('matched_concepts', []),
                    'missing_concepts': sample.get('missing_concepts', []),
                    'question_id': question.get('id', 'unknown')
                }
    
    return best_match


def get_rubric_for_answer(model_answer: str) -> Optional[List[Dict]]:
    # Get rubric for a model answer if available.
    if _questions is None:
        load_data()
    
    if not _questions:
        return None
    
    model_key = _normalize_key(model_answer)
    
    # Optimizer: Use O(1) lookup
    if model_key in _model_index:
        return _model_index[model_key].get('rubric', [])
    
    # Fallback to linear scan
    model_lower = model_answer.lower().strip()
    for question in _questions:
        question_model = question.get('model_answer', '').lower()
        if _text_similarity(model_lower, question_model) > 0.7:
            return question.get('rubric', [])
    
    return None


def grade_by_rubric(
    student_answer: str,
    model_answer: str,
    max_points: float
) -> Optional[Dict]:
    if _questions is None:
        load_data()
    
    if not _questions:
        return None
    
    student_lower = student_answer.lower().strip()
    model_key = _normalize_key(model_answer)
    
    # Optimizer: Use O(1) lookup
    target_questions = []
    if model_key in _model_index:
        target_questions = [_model_index[model_key]]
    else:
        target_questions = _questions
    
    # Find matching question
    for question in target_questions:
        question_model = question.get('model_answer', '').lower()
        
        # Only check similarity if fallback
        if len(target_questions) > 1:
            if _text_similarity(model_answer.lower(), question_model) <= 0.6:
                continue

        rubric = question.get('rubric', [])
        if not rubric:
            continue
        
        question_max = question.get('max_points', 2.0)
        matched = []
        missing = []
        total_score = 0.0
        
        # Check each rubric concept
        for item in rubric:
            concept = item.get('concept', '')
            points = item.get('points', 0)
            
            # Check if concept is in student answer
            if _concept_in_text(concept, student_lower):
                matched.append(concept)
                total_score += points
            else:
                missing.append(concept)
        
        # Scale score to max_points
        scaled_score = (total_score / question_max) * max_points
        
        # Generate feedback
        feedback_parts = []
        for item in rubric:
            concept = item.get('concept', '')
            points = item.get('points', 0)
            if concept in matched:
                feedback_parts.append(f"✅ {concept} (+{points}đ)")
            else:
                feedback_parts.append(f"❌ {concept} (0đ)")
        
        return {
            'score': round(scaled_score, 2),
            'confidence': round(total_score / question_max, 2),
            'feedback': ' | '.join(feedback_parts),
            'matched_concepts': matched,
            'missing_concepts': missing,
            'rubric_used': True
        }
    
    return None


def _concept_in_text(concept: str, text: str) -> bool:
    # Check if a concept is present in text, including synonyms.
    concept_lower = concept.lower()
    
    # Direct match
    if concept_lower in text:
        return True
    
    # Check synonyms
    synonyms = get_synonyms(concept)
    for syn in synonyms:
        if syn.lower() in text:
            return True
    
    return False


def _text_similarity(s1: str, s2: str) -> float:
    # Simple word overlap similarity.
    if not s1 or not s2:
        return 0.0
    
    words1 = set(s1.split())
    words2 = set(s2.split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = len(words1 & words2)
    union = len(words1 | words2)
    
    return intersection / union if union > 0 else 0.0


def expand_with_synonyms(text: str) -> str:
    # Expand text with synonyms.
    if _synonyms is None:
        load_data()
    
    if not _synonyms:
        return text
    
    expanded = text
    text_lower = text.lower()
    
    for word, syns in _synonyms.items():
        if word in text_lower and syns:
            syn_str = f' ({syns[0]})'
            expanded = expanded.replace(word, word + syn_str)
            break
    
    return expanded


def check_for_contradictions(student_text: str, model_text: str) -> Tuple[bool, str]:
    # Check if student answer contradicts model answer.
    # Returns (has_contradiction, reason)
    if _contradictions is None:
        load_data()
    
    student_lower = student_text.lower()
    model_lower = model_text.lower()
    
    for model_term, wrong_terms in _contradictions.items():
        if model_term in model_lower:
            for wrong in wrong_terms:
                if wrong in student_lower:
                    return True, f"Sử dụng '{wrong}' thay vì '{model_term}'"
    
    return False, ""


# Auto-load on import
# load_data()
def load_all_datasets() -> Dict:
    global _data, _synonyms, _contradictions, _questions, _model_index
    # Initialize containers
    _questions = []
    _model_index = {}
    _synonyms = {}
    _contradictions = {}
    
    # 1. Load Base Data (ai_training_data.json)
    try:
        if os.path.exists(UNIFIED_DATA_PATH):
            with open(UNIFIED_DATA_PATH, 'r', encoding='utf-8') as f:
                base_data = json.load(f)
                _questions.extend(base_data.get('grading_questions', []))
                _synonyms.update(base_data.get('synonyms', {}))
                _contradictions.update(base_data.get('contradictions', {}))
                print(f"[Dataset] Loaded {len(base_data.get('grading_questions', []))} base questions")
    except Exception as e:
        print(f"[Dataset] Error loading base data: {e}")

    # 2. Load University Data
    uni_path = os.path.join(os.path.dirname(__file__), 'university_training_data.json')
    try:
        if os.path.exists(uni_path):
            with open(uni_path, 'r', encoding='utf-8') as f:
                uni_data = json.load(f)
                _questions.extend(uni_data.get('grading_questions', []))
                print(f"[Dataset] Loaded {len(uni_data.get('grading_questions', []))} university questions")
    except Exception as e:
        print(f"[Dataset] Error loading university data: {e}")

    # 3. Load Learned Data (Learned Patterns)
    learned_path = os.path.join(os.path.dirname(__file__), 'learned_data.json')
    try:
        if os.path.exists(learned_path):
            with open(learned_path, 'r', encoding='utf-8') as f:
                learned_list = json.load(f)
                if isinstance(learned_list, list):
                    print(f"[Dataset] Loaded {len(learned_list)} learned patterns")
                    # Convert to grading_questions format for consistency
                    for item in learned_list:
                        # Create a pseudo question object
                        q_obj = {
                            "id": "learned_" + str(hash(item.get('model_answer', ''))),
                            "model_answer": item.get('model_answer', ''),
                            "max_points": item.get('max_points', 1.0),
                            "grading_samples": [{
                                "student_answer": item.get('student_answer', ''),
                                "score": item.get('confirmed_score', 0.0),
                                "feedback": "Learned Pattern (Instructor Confirmed)",
                                "answer_type": "learned_pattern"
                            }]
                        }
                        _questions.append(q_obj)
    except Exception as e:
        print(f"[Dataset] Error loading learned data: {e}")

    # 4. Re-Build Index (Model Answer -> Question List)
    _model_index = {}
    for q in _questions:
        m_ans = q.get('model_answer', '')
        if m_ans:
            norm_key = _normalize_key(m_ans)
            if norm_key:
                if norm_key not in _model_index:
                    _model_index[norm_key] = []
                _model_index[norm_key].append(q)
    
    print(f"[Dataset] Final Index: {len(_model_index)} unique model answers from {len(_questions)} total questions")
    return _model_index

# Load once on start
load_all_datasets()

def find_similar_to_grading(
    student_answer: str, 
    model_answer: str,
    max_points: float
) -> Optional[Dict]:

    # PRIORITY LOOKUP: Find existing graded sample in ALL datasets.
    # Returns result if match found, else None.
    if not _model_index:
        load_all_datasets()
        
    normalized_model = _normalize_key(model_answer)
    normalized_student = _normalize_key(student_answer)
    
    # 1. Direct Model Lookup (O(1))
    candidate_questions = []
    if normalized_model in _model_index:
        candidate_questions = _model_index[normalized_model]
    else:
        # Fallback: fuzzy search model answer (slower)
        from difflib import SequenceMatcher
        model_lower = model_answer.lower().strip()
        for key, q_list in _model_index.items():
            if q_list:
                ref_model = q_list[0].get('model_answer', '')
                # Use SequenceMatcher for better fuzzy matching
                ratio = SequenceMatcher(None, model_lower, ref_model.lower()).ratio()
                if ratio > 0.90:
                    candidate_questions.extend(q_list)
    
    if not candidate_questions:
        return None
        
    # 2. Search Student Answer in Candidates
    from difflib import SequenceMatcher
    
    for q in candidate_questions:
        # Scale factor if max_points differ
        q_max = float(q.get('max_points', 1.0))
        scale_factor = max_points / q_max if q_max > 0 else 1.0
        
        for sample in q.get('grading_samples', []):
            sample_student = sample.get('student_answer', '')
            sample_norm = _normalize_key(sample_student)
            
            # A. Exact/Normalized Match
            if normalized_student == sample_norm:
                return {
                    'score': round(float(sample.get('score', 0)) * scale_factor, 2),
                    'feedback': sample.get('feedback', 'Matched dataset pattern'),
                    'type': 'Dataset Match (Exact)',
                    'confidence': 1.0
                }
            
            # B. High Similarity Match (> 0.95) using SequenceMatcher
            ratio = SequenceMatcher(None, normalized_student, sample_norm).ratio()
            if ratio > 0.95:
                return {
                    'score': round(float(sample.get('score', 0)) * scale_factor, 2),
                    'feedback': sample.get('feedback', 'Matched dataset pattern'),
                    'type': 'Dataset Match (High Sim)',
                    'confidence': ratio
                }
    
    return None

# ACTIVE LEARNING: Learn from Teacher Corrections
import threading
_learn_lock = threading.Lock()
LEARNED_DATA_PATH = os.path.join(os.path.dirname(__file__), 'learned_data.json')


def learn_correction(
    student_text: str,
    model_text: str,
    actual_score: float,
    max_points: float,
    feedback: str = ""
) -> bool:
    # Learn from teacher correction. Saves the correction to learned_data.json
    # so AI repeats this grading for future similar answers.
    global _model_index, _questions
    
    if not student_text or not model_text:
        return False
    
    # Calculate score ratio (0.0 to 1.0)
    score_ratio = actual_score / max_points if max_points > 0 else 0.0
    score_ratio = max(0.0, min(1.0, score_ratio))  # Clamp
    
    # Create learning record
    record = {
        "student_answer": student_text.strip(),
        "model_answer": model_text.strip(),
        "confirmed_score": actual_score,
        "max_points": max_points,
        "score_ratio": score_ratio,
        "feedback": feedback if feedback else f"Teacher confirmed: {actual_score}/{max_points}",
        "learned_at": __import__('datetime').datetime.now().isoformat()
    }
    
    # Thread-safe file write
    with _learn_lock:
        try:
            # Load existing data
            learned_data = []
            if os.path.exists(LEARNED_DATA_PATH):
                with open(LEARNED_DATA_PATH, 'r', encoding='utf-8') as f:
                    try:
                        learned_data = json.load(f)
                        if not isinstance(learned_data, list):
                            learned_data = []
                    except json.JSONDecodeError:
                        learned_data = []
            
            # Check for duplicates and update if exists
            normalized_student = _normalize_key(student_text)
            normalized_model = _normalize_key(model_text)
            
            updated = False
            for i, existing in enumerate(learned_data):
                existing_student = _normalize_key(existing.get('student_answer', ''))
                existing_model = _normalize_key(existing.get('model_answer', ''))
                
                if existing_student == normalized_student and existing_model == normalized_model:
                    # Update existing record
                    learned_data[i] = record
                    updated = True
                    print(f"[AI Learning] Updated existing pattern for: {model_text[:30]}...")
                    break
            
            if not updated:
                # Add new record
                learned_data.append(record)
                print(f"[AI Learning] Learned new pattern for: {model_text[:30]}...")
            
            # Save back to file
            with open(LEARNED_DATA_PATH, 'w', encoding='utf-8') as f:
                json.dump(learned_data, f, ensure_ascii=False, indent=2)
            
            # Update in-memory index (hot reload)
            _reload_learned_patterns()
            
            return True
            
        except Exception as e:
            print(f"[AI Learning] Error saving correction: {e}")
            return False


def _reload_learned_patterns():

    # Hot-reload learned patterns into the in-memory index.
    global _model_index, _questions
    
    try:
        if not os.path.exists(LEARNED_DATA_PATH):
            return
        
        with open(LEARNED_DATA_PATH, 'r', encoding='utf-8') as f:
            learned_list = json.load(f)
            if not isinstance(learned_list, list):
                return
        
        # Convert to grading_questions format and add to index
        for item in learned_list:
            model_ans = item.get('model_answer', '')
            if not model_ans:
                continue
                
            norm_key = _normalize_key(model_ans)
            if not norm_key:
                continue
            
            # Create pseudo question object
            q_obj = {
                "id": "learned_" + str(hash(model_ans)),
                "model_answer": model_ans,
                "max_points": item.get('max_points', 1.0),
                "grading_samples": [{
                    "student_answer": item.get('student_answer', ''),
                    "score": item.get('confirmed_score', 0.0),
                    "feedback": item.get('feedback', 'Learned Pattern'),
                    "answer_type": "learned_pattern"
                }]
            }
            
            # Initialize key if not exists
            if norm_key not in _model_index:
                _model_index[norm_key] = []
            
            # Check if this student answer already exists in the list
            existing_students = set()
            for q in _model_index[norm_key]:
                for sample in q.get('grading_samples', []):
                    existing_students.add(_normalize_key(sample.get('student_answer', '')))
            
            student_norm = _normalize_key(item.get('student_answer', ''))
            if student_norm not in existing_students:
                _model_index[norm_key].append(q_obj)
                if q_obj not in _questions:
                    _questions.append(q_obj)
    
    except Exception as e:
        print(f"[AI Learning] Error reloading patterns: {e}")


def get_learning_stats() -> Dict:
    # Get statistics about learned patterns.
    try:
        if not os.path.exists(LEARNED_DATA_PATH):
            return {"total": 0, "by_question": {}}
        
        with open(LEARNED_DATA_PATH, 'r', encoding='utf-8') as f:
            learned_list = json.load(f)
            if not isinstance(learned_list, list):
                return {"total": 0, "by_question": {}}
        
        by_question = {}
        for item in learned_list:
            model_short = item.get('model_answer', '')[:50]
            if model_short not in by_question:
                by_question[model_short] = 0
            by_question[model_short] += 1
        
        return {
            "total": len(learned_list),
            "by_question": by_question
        }
    
    except Exception as e:
        return {"total": 0, "error": str(e)}


def clear_learned_patterns() -> bool:
    """
    Clear all learned patterns. Use with caution!
    """
    global _model_index, _questions
    
    with _learn_lock:
        try:
            if os.path.exists(LEARNED_DATA_PATH):
                os.remove(LEARNED_DATA_PATH)
            
            # Reload datasets without learned data
            load_all_datasets()
            
            print("[AI Learning] Cleared all learned patterns")
            return True
        except Exception as e:
            print(f"[AI Learning] Error clearing patterns: {e}")
            return False


