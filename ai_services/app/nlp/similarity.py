from .tokenizer import normalize_text, remove_vietnamese_diacritics


def levenshtein_distance(s1: str, s2: str) -> int:
    # Calculate edit distance between two strings for typo tolerance.
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]


def fuzzy_match(word1: str, word2: str, threshold: float = 0.7) -> bool:

    # Check if two words are similar enough (tolerates typos).
    # Threshold: 0.7 = allow 30% character errors
    if not word1 or not word2:
        return False
    
    w1, w2 = word1.lower().strip(), word2.lower().strip()
    
    # Exact match
    if w1 == w2:
        return True
    
    # One contains the other (for compound words)
    if w1 in w2 or w2 in w1:
        return True
    
    # Try matching WITHOUT diacritics
    w1_no_dia = remove_vietnamese_diacritics(w1)
    w2_no_dia = remove_vietnamese_diacritics(w2)
    
    if w1_no_dia == w2_no_dia:
        return True
    
    if w1_no_dia in w2_no_dia or w2_no_dia in w1_no_dia:
        return True
    
    # Levenshtein similarity
    max_len = max(len(w1), len(w2))
    max_len_no_dia = max(len(w1_no_dia), len(w2_no_dia))
    
    if max_len == 0:
        return False
    
    distance = levenshtein_distance(w1, w2)
    similarity = 1 - (distance / max_len)
    
    distance_no_dia = levenshtein_distance(w1_no_dia, w2_no_dia)
    similarity_no_dia = 1 - (distance_no_dia / max_len_no_dia) if max_len_no_dia > 0 else 0
    
    best_similarity = max(similarity, similarity_no_dia)
    
    return best_similarity >= threshold


def fuzzy_contains(text: str, keyword: str, threshold: float = 0.7) -> bool:
    if not text or not keyword:
        return False
    
    text_lower = text.lower()
    keyword_lower = keyword.lower()
    
    # Exact substring match
    if keyword_lower in text_lower:
        return True
    
    # Check each word in text against keyword
    text_words = text_lower.split()
    keyword_words = keyword_lower.split()
    
    # For single word keywords
    if len(keyword_words) == 1:
        for word in text_words:
            if fuzzy_match(word, keyword_lower, threshold):
                return True
    else:
        # For multi-word keywords
        found_count = 0
        for kw in keyword_words:
            for word in text_words:
                if fuzzy_match(word, kw, threshold):
                    found_count += 1
                    break
        if found_count >= len(keyword_words) * 0.8:
            return True
    
    return False


def string_similarity(s1: str, s2: str) -> float:
    if not s1 or not s2:
        return 0.0
    
    n1, n2 = normalize_text(s1), normalize_text(s2)
    if n1 == n2:
        return 1.0
    max_len = max(len(n1), len(n2))
    if max_len == 0:
        return 0.0
    lev_dist = levenshtein_distance(n1, n2)
    lev_sim = 1.0 - (lev_dist / max_len)
    
    # Jaccard Similarity (Word level)
    words1 = set(n1.split())
    words2 = set(n2.split())
    if not words1 or not words2:
        return lev_sim
    
    intersection = len(words1 & words2)
    union = len(words1 | words2)
    jaccard = intersection / union if union > 0 else 0.0
    
    return max(lev_sim, jaccard)


def calculate_keyword_match(student_text: str, model_text: str) -> float:
    if not student_text or not model_text:
        return 0.0
    
    s_norm = normalize_text(student_text)
    m_norm = normalize_text(model_text)
    
    stopwords = {
        "là", "một", "các", "của", "và", "được", "có", "trong", "cho",
        "với", "để", "này", "đó", "những", "không", "từ", "về", "như",
        "rất", "khi", "đã", "sẽ", "cũng", "hay", "hoặc", "thì", "mà",
        "a", "an", "the", "is", "are", "was", "were", "be", "been",
        "to", "of", "in", "for", "on", "with", "as", "at", "by", "it"
    }
    
    s_words = set(s_norm.split())
    m_words = set(m_norm.split())
    
    student_keywords = {w for w in s_words if w not in stopwords and len(w) > 1}
    model_keywords = {w for w in m_words if w not in stopwords and len(w) > 1}
    
    if not student_keywords:
        return 0.0
    
    student_in_model = 0
    for s_kw in student_keywords:
        if s_kw in model_keywords or s_kw in m_norm:
            student_in_model += 1
    
    student_match_ratio = student_in_model / len(student_keywords) if student_keywords else 0
    
    if model_keywords:
        matched_from_model = len(model_keywords.intersection(student_keywords))
        model_match_ratio = matched_from_model / len(model_keywords)
    else:
        model_match_ratio = 0
    
    return max(student_match_ratio, model_match_ratio)
