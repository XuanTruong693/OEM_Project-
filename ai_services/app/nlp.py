import re
from typing import Dict, Set, Any
from sentence_transformers import SentenceTransformer, util
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

# Singleton for model
_model = None

def get_model():
    global _model
    if _model is None:
        # Using a good multilingual model or Vietnamese specific
        # 'keepitreal/vietnamese-sbert' is good for VN
        _model = SentenceTransformer('keepitreal/vietnamese-sbert') 
    return _model

def vn_tokenize(text: str) -> str:
    """
    Tokenize Vietnamese text using underthesea with fallback to underthesea_lite.
    Returns space-separated tokens.
    """
    if not text:
        return ""
        
    try:
        from underthesea import word_tokenize
        return word_tokenize(text, format="text")
    except (ImportError, Exception):
        try:
            from underthesea_lite import word_tokenize
            return word_tokenize(text, format="text")
        except (ImportError, Exception):
            # Fallback to simple split if both fail
            return text 


def extract_entities(text: str) -> Dict[str, Set[str]]:
    entities = {
        "dates": set(),
        "locations": set()
    }
    
    if not text:
        return entities

    # 1. Extract Dates
    # Format: dd/mm/yyyy or yyyy
    date_pattern = re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4})\b|\b(19\d{2}|20\d{2})\b")
    # Format: ngày dd tháng mm năm yyyy
    text_date_pattern = re.compile(r"(?:ngày\s+)?(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})", re.IGNORECASE)
    
    for match in date_pattern.finditer(text):
        entities["dates"].add(match.group(0))
        
    for match in text_date_pattern.finditer(text):
        day, month, year = match.groups()
        normalized_date = f"{int(day):02d}/{int(month):02d}/{year}"
        entities["dates"].add(normalized_date)

    # 2. Extract Locations (Heuristic)
    # Prefixes that often precede locations (in Vietnamese)
    prefixes = r"(?:[Tt]hành phố|[Tt]ỉnh|[Qq]uận|[Hh]uyện|[Xx]ã|[Pp]hường|[Tt]hị trấn)\s+"
    markers = r"(?:tại|ở|thành phố|tỉnh|quận|huyện|xã|phường)"
    
    # Regex look for Capitalized words after markers
    loc_markers = f"{markers}\s+(?:{prefixes})?([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)*)"
    loc_pattern = re.compile(loc_markers)
    
    loc_stopwords = {"thành", "phố", "tỉnh", "quận", "huyện", "xã", "phường", "thị", "trấn"}
    
    for match in loc_pattern.finditer(text):
        loc = match.group(1).strip()
        if loc.lower() not in loc_stopwords:
             entities["locations"].add(loc)

    # Try underthesea NER if installed
    try:
        from underthesea import ner
        ner_results = ner(text)
        for result in ner_results:
             # ner return list of tuples (word, pos, chunk, ner) or (word, ner)?
             # underthesea ner returns [(word, pos, chunk, ner), ...] or similar depending on version
             # Actually ner() returns: [('Đại học', 'N', 'B-NP', 'B-LOC'), ...]
             # Let's handle tuple unpacking safely
             if len(result) >= 4:
                word = result[0]
                label = result[3] # standard NER tag is usually last
                if label == "B-LOC" or label == "I-LOC":
                     if word.lower() not in loc_stopwords:
                        entities["locations"].add(word)
    except (ImportError, Exception):
        pass

    return entities

def normalize_text(text: str) -> str:
    """Normalize text for comparison: lowercase, remove extra spaces, strip punctuation."""
    if not text:
        return ""
    # Remove punctuation except Vietnamese diacritics
    text = re.sub(r'[^\w\s\u00C0-\u1EF9]', '', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip().lower()
    return text

def string_similarity(s1: str, s2: str) -> float:
    """Calculate simple string similarity ratio (0-1)."""
    if not s1 or not s2:
        return 0.0
    
    n1, n2 = normalize_text(s1), normalize_text(s2)
    if n1 == n2:
        return 1.0
    
    # Check if one contains the other
    if n1 in n2 or n2 in n1:
        return max(len(n1), len(n2)) / (len(n1) + len(n2)) * 2
    
    # Simple word overlap ratio
    words1 = set(n1.split())
    words2 = set(n2.split())
    if not words1 or not words2:
        return 0.0
    
    intersection = len(words1 & words2)
    union = len(words1 | words2)
    return intersection / union if union > 0 else 0.0

def calculate_score(student_text: str, model_text: str, max_points: float) -> Dict[str, Any]:
    if not student_text or not model_text:
        return {"score": 0.0, "confidence": 0.0, "explanation": "Missing text.", "fact_multiplier": 1.0}

    # ===== STEP 1: Check for exact/near-exact match FIRST =====
    str_sim = string_similarity(student_text, model_text)
    
    # Exact match = full score
    if str_sim >= 0.95:
        return {
            "score": round(float(max_points), 2),
            "confidence": 1.0,
            "explanation": "Exact match.",
            "fact_multiplier": 1.0
        }
    
    # Near-exact match (>80% string similarity) = high score
    if str_sim >= 0.8:
        score = round(str_sim * float(max_points), 2)
        return {
            "score": score,
            "confidence": round(str_sim, 2),
            "explanation": "Near-exact match.",
            "fact_multiplier": 1.0
        }

    # ===== STEP 2: Semantic similarity for longer answers =====
    s_proc = vn_tokenize(student_text.lower().strip())
    m_proc = vn_tokenize(model_text.lower().strip())
    
    student_word_count = len(s_proc.split())
    model_word_count = len(m_proc.split())
    
    # For very short answers that didn't match exactly, use string similarity
    if student_word_count < 3 and model_word_count < 3:
        # Both are short - use string similarity directly
        semantic_sim = str_sim
    elif student_word_count < 3:
        # Student answer too short compared to expected - penalize but not zero
        semantic_sim = str_sim * 0.5  # Partial credit based on overlap
    else:
        # Normal case: use embedding similarity
        model = get_model()
        emb_a = model.encode(s_proc, normalize_embeddings=True)
        emb_b = model.encode(m_proc, normalize_embeddings=True)
        semantic_sim = float(util.cos_sim(emb_a, emb_b).item())
        semantic_sim = max(0.0, min(1.0, semantic_sim))
        
        # Blend with string similarity for better accuracy
        semantic_sim = 0.7 * semantic_sim + 0.3 * str_sim

    # ===== STEP 3: Context-aware fact checking (dates only - more reliable) =====
    # Only check dates, not locations - dates are more reliable and universal
    model_entities = extract_entities(model_text)
    student_entities = extract_entities(student_text)
    
    fact_multiplier = 1.0
    fact_explanation = []

    # Check Dates - only if model explicitly has dates
    if model_entities["dates"]:
        common_dates = model_entities["dates"].intersection(student_entities["dates"])
        if not common_dates:
            # Check for partial date match (e.g., same year)
            partial_match = False
            for m_d in model_entities["dates"]:
                for s_d in student_entities["dates"]:
                    # Extract year from dates for comparison
                    m_year = re.search(r'(19\d{2}|20\d{2})', m_d)
                    s_year = re.search(r'(19\d{2}|20\d{2})', s_d)
                    if m_year and s_year and m_year.group() == s_year.group():
                        partial_match = True
                        break
                if partial_match:
                    break
            
            if not partial_match and student_entities["dates"]:
                # Student has wrong dates
                fact_multiplier -= 0.3
                fact_explanation.append("Date mismatch.")
            elif not student_entities["dates"] and len(model_entities["dates"]) > 0:
                # Student missing important dates - smaller penalty
                fact_multiplier -= 0.15
                fact_explanation.append("Missing date(s).")

    # Note: Location checking removed - too unreliable across different subjects
    # Semantic similarity already captures whether key concepts are present

    fact_multiplier = max(0.0, fact_multiplier)

    # ===== STEP 4: Final Calculation =====
    final_sim = semantic_sim * fact_multiplier
    final_score = round(final_sim * float(max_points), 2)
    
    # Generate explanation
    if fact_explanation:
        explanation = "Fact check: " + " ".join(fact_explanation)
    elif semantic_sim >= 0.8:
        explanation = "High similarity."
    elif semantic_sim >= 0.6:
        explanation = "Moderate similarity."
    elif semantic_sim >= 0.3:
        explanation = "Low similarity."
    else:
        explanation = "Very low similarity."

    return {
        "score": final_score,
        "confidence": round(semantic_sim, 2),
        "explanation": explanation,
        "fact_multiplier": round(fact_multiplier, 2)
    }