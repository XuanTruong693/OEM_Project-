from dataclasses import dataclass

@dataclass
class GradingConfig:
    """
    Configuration parameters for the University-Level Grading System.
    These thresholds are tuned to meet the 6-Type Target Matrix.
    """
    # NLI Thresholds
    # If Entailment score > 0.50, consider it a valid paraphrase or logic match.
    entailment_threshold: float = 0.50
    
    # Dynamic Contradiction Thresholds
    # In High Similarity zone (Paraphrase protection), we need extreme confidence to mark as contradiction.
    dynamic_contra_high: float = 0.85
    dynamic_contra_low: float = 0.50
    
    # Keyword Shield Threshold: If keyword match is above this, be very skeptical of contradictions.
    keyword_shield_threshold: float = 0.60
    
    # Exact/Typo Thresholds
    # Levenshtein ratio > 0.95 considered effectively exact match.
    exact_match_threshold: float = 0.95
    
    # Nuanced Logic Penalties (Reduction % if it's a trap vs hard contradiction)
    penalty_temporal: float = 0.25 # Trừ 25% nếu sai thứ tự
    penalty_causal: float = 0.30   # Trừ 30% nếu sai nguyên nhân
    penalty_negation: float = 0.45 # Trừ 45% nếu bẫy phủ định (Case 4)
    
    # Hard Contradiction Threshold
    # If NLI > 0.85 AND keyword match is low, score becomes 0.
    hard_contradiction_threshold: float = 0.85
    
    # Explicit Negation Words (Vietnamese)
    negation_words = [
        "không", "chưa", "chẳng", "chả", "không hề", "chưa hề", "tuyệt đối không",
        "đâu có", "không phải", "trái ngược", "ngược lại", "phủ định", "sai lệch",
        "đéo", "vô lý", "phi lý"
    ]
    
    # Weights for Final Score
    # 30% Global Semantic (overall meaning) + 70% Proposition Match (specific facts)
    weight_semantic: float = 0.30
    weight_propositions: float = 0.70
    # If a critical fact is reversed, cap the total score at this percentage.
    zero_tolerance_cap: float = 0.0 # Absolute zero if fatal logic error

    # Gen Z & Technical Abbreviations for Intelligent Repair
    intelligent_repair_dict = {
        "sv": "sinh viên",
        "gv": "giảng viên",
        "ntn": "như thế nào",
        "đc": "được",
        "đk": "được",
        "ko": "không",
        "k": "không",
        "bt": "biết",
        "th": "trường hợp",
        "vs": "với",
        "ms": "mới",
        "nt": "nhắn tin",
        "ib": "nhắn tin",
        "rep": "trả lời",
        "tl": "trả lời",
        "đh": "đại học",
        "nv": "như vậy",
        "vđ": "vấn đề",
        "qt": "quan trọng",
        "kn": "kỹ năng",
        "trc": "trước",
        "sau": "sau",
        "đt": "điện thoại",
        "mt": "máy tính",
        "pm": "phần mềm",
        "pc": "máy tính",
        "tk": "tài khoản",
        "mk": "mật khẩu",
        "ncl": "nói chung là",
        "ks": "không sao",
        "v": "vậy",
        "ak": "à",
        "uk": "ừ",
        "r": "rồi",
        "j": "gì",
        "cj": "chị",
        "ae": "anh em",
        "m": "mình",
        "t": "tôi"
    }
