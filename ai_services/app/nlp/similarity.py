from difflib import SequenceMatcher
from .tokenizer import normalize_text, remove_vietnamese_diacritics

def levenshtein_distance(s1: str, s2: str) -> int:
    """Calculate edit distance between two strings for typo tolerance (Word-level)."""
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
    """Check if two words are similar enough (tolerates typos)."""
    if not word1 or not word2:
        return False
    
    w1, w2 = word1.lower().strip(), word2.lower().strip()
    
    if w1 == w2:
        return True
    
    # Chỉ cho phép substring match nếu chênh lệch độ dài không quá lớn (Chống lỗi "a" in "apple")
    len_ratio = min(len(w1), len(w2)) / max(len(w1), len(w2)) if max(len(w1), len(w2)) > 0 else 0
    if len_ratio > 0.6 and (w1 in w2 or w2 in w1):
        return True
    
    w1_no_dia = remove_vietnamese_diacritics(w1)
    w2_no_dia = remove_vietnamese_diacritics(w2)
    
    if w1_no_dia == w2_no_dia:
        return True
    
    if len_ratio > 0.6 and (w1_no_dia in w2_no_dia or w2_no_dia in w1_no_dia):
        return True
    
    max_len = max(len(w1), len(w2))
    max_len_no_dia = max(len(w1_no_dia), len(w2_no_dia))
    
    distance = levenshtein_distance(w1, w2)
    similarity = 1 - (distance / max_len) if max_len > 0 else 0
    
    distance_no_dia = levenshtein_distance(w1_no_dia, w2_no_dia)
    similarity_no_dia = 1 - (distance_no_dia / max_len_no_dia) if max_len_no_dia > 0 else 0
    
    return max(similarity, similarity_no_dia) >= threshold

def fuzzy_contains(text: str, keyword: str, threshold: float = 0.7) -> bool:
    if not text or not keyword:
        return False
    
    text_lower = text.lower()
    keyword_lower = keyword.lower()
    
    if keyword_lower in text_lower:
        return True
    
    text_words = text_lower.split()
    keyword_words = keyword_lower.split()
    
    if len(keyword_words) == 1:
        return any(fuzzy_match(word, keyword_lower, threshold) for word in text_words)
    else:
        found_count = 0
        for kw in keyword_words:
            for word in text_words:
                if fuzzy_match(word, kw, threshold):
                    found_count += 1
                    break
        return found_count >= len(keyword_words) * 0.8

def string_similarity(s1: str, s2: str) -> float:
    """Calculate overall string similarity combining Jaccard and SequenceMatcher."""
    if not s1 or not s2:
        return 0.0
    
    n1, n2 = normalize_text(s1), normalize_text(s2)
    if n1 == n2: return 1.0
    
    # SequenceMatcher nhanh và an toàn cho câu dài
    seq_sim = SequenceMatcher(None, n1, n2).ratio()
    
    # Jaccard Similarity (Cứu điểm nếu sinh viên viết đúng từ nhưng đảo lộn vị trí)
    words1, words2 = set(n1.split()), set(n2.split())
    if not words1 or not words2:
        return seq_sim
    
    jaccard = len(words1 & words2) / len(words1 | words2)
    return max(seq_sim, jaccard)

def calculate_keyword_match(student_text: str, model_text: str) -> float:
    """Calculate F1-Score of keyword overlap."""
    if not student_text or not model_text:
        return 0.0
    
    s_norm, m_norm = normalize_text(student_text), normalize_text(model_text)
    
    stopwords = {
        "là", "một", "các", "của", "và", "được", "có", "trong", "cho",
        "với", "để", "này", "đó", "những", "không", "từ", "về", "như",
        "rất", "khi", "đã", "sẽ", "cũng", "hay", "hoặc", "thì", "mà",
        "a", "an", "the", "is", "are", "was", "were", "be", "been",
        "to", "of", "in", "for", "on", "with", "as", "at", "by", "it"
    }
    
    student_keywords = {w for w in s_norm.split() if w not in stopwords and len(w) > 1}
    model_keywords = {w for w in m_norm.split() if w not in stopwords and len(w) > 1}
    
    if not student_keywords or not model_keywords:
        return 0.0
    
    matched_keywords = len(model_keywords.intersection(student_keywords))
    precision = matched_keywords / len(student_keywords) # Tránh viết lan man
    recall = matched_keywords / len(model_keywords)      # Tránh viết thiếu ý
    
    if precision + recall == 0:
        return 0.0
        
    f1_score = 2 * (precision * recall) / (precision + recall)
    return f1_score