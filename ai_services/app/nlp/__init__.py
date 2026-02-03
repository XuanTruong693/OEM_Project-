"""
NLP Module - Vietnamese NLP for Essay Grading
Refactored to Model-based Architecture (Bi-Encoder + Cross-Encoder).
"""

# Import new components
from .model import get_ai_model, AIModel
from .grader import UniversityGrader, calculate_score

# Keep tokenizer/similarity utilities if they exist and are valid
try:
    from .tokenizer import (
        vn_tokenize,
        normalize_text,
        remove_vietnamese_diacritics
    )
except ImportError:
    pass

try:
    from .similarity import (
        levenshtein_distance,
        fuzzy_match,
        string_similarity
    )
except ImportError:
    pass

# New concepts/contradiction modules (class-based or functional)
from .concepts import extract_propositions
from .contradiction import LogicAnalyzer

# Backward Compatibility
# get_model should return the Bi-Encoder for vector operations
def get_model():
    return get_ai_model().bi_encoder

__all__ = [
    'UniversityGrader',
    'calculate_score',
    'get_model',
    'get_ai_model',
    'extract_propositions',
    'LogicAnalyzer',
    'vn_tokenize',
    'normalize_text',
    'remove_vietnamese_diacritics',
    'levenshtein_distance'
]
