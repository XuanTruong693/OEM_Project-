from dataclasses import dataclass

@dataclass
class GradingConfig:
    """
    Configuration parameters for the University-Level Grading System.
    These thresholds are tuned to meet the 6-Type Target Matrix.
    """
    # NLI Thresholds
    # If Entailment score > 0.50, we consider it a valid paraphrase or logic match.
    entailment_threshold: float = 0.50
    
    # If Contradiction score > 0.75, it's a hard contradiction (max score 10%).
    contradiction_threshold: float = 0.75
    
    # Semantic Similarity Thresholds
    # If Cosine Similarity < 0.60 (and NLI is Neutral), it's likely off-topic.
    off_topic_threshold: float = 0.60
    
    # If Semantic Similarity > 0.65 (and Entailment high), it's a good paraphrase.
    paraphrase_threshold: float = 0.65
    
    # Exact/Typo Thresholds
    # Levenshtein ratio > 0.95 considered effectively exact match.
    exact_match_threshold: float = 0.95
    
    # Weights for Final Score
    # 30% Global Semantic (overall meaning) + 70% Proposition Match (specific facts)
    weight_semantic: float = 0.30
    weight_propositions: float = 0.70
