import re
import logging
import numpy as np
from typing import Tuple
from .model import get_ai_model

from .tokenizer import expand_abbreviations

logger = logging.getLogger(__name__)

class LogicAnalyzer:
    # Analyzes the logical relationship between student answer and model answer using NLI.
    # Output Labels: 'contradiction', 'entailment', 'neutral'

    def __init__(self):
        self.ai = get_ai_model()
        # NLI Label Mapping for symanto/xlm-roberta-base-snli-mnli-anli-xnli
        # Standard SNLI/MNLI map: 0: Entailment, 1: Neutral, 2: Contradiction
        self.label_map = {0: 'entailment', 1: 'neutral', 2: 'contradiction'}

    def preprocess(self, text: str) -> str:
        if not text:
            return ""
            
    
        # Comprehensive list of ignored patterns (fillers, politeness, redundancy)
        self.ignore_patterns = [
            # 1. Politeness / Addressing (Chào hỏi, xưng hô)
            r"^\s*dạ\s+thưa\s+thầy\s+cô\s*,?", r"^\s*dạ\s+thưa\s+thầy\s*,?", r"^\s*dạ\s+thưa\s+cô\s*,?",
            r"^\s*thưa\s+thầy\s*,?", r"^\s*thưa\s+cô\s*,?", r"^\s*kính\s+thưa\s+thầy\s+cô\s*,?",
            r"^\s*dạ\s+em\s+chào\s+thầy\s*,?", r"^\s*em\s+chào\s+cô\s*,?", r"^\s*chào\s+thầy\s*,?",
            r"^\s*dạ\s*,?", r"^\s*vâng\s*,?", r"\bạ\b[.!?]?\s*$", r"\bnhé\b[.!?]?\s*$", 
            r"\bnha\b[.!?]?\s*$", r"\bha\b[.!?]?\s*$",

            # 2. Opinion Starters (Mở đầu quan điểm)
            r"^\s*theo\s+em\s+thì\s*,?", r"^\s*theo\s+em\s*,?", r"^\s*theo\s+ý\s+kiến\s+của\s+em\s*,?",
            r"^\s*theo\s+quan\s+điểm\s+của\s+em\s*,?", r"^\s*đối\s+với\s+em\s*,?",
            r"^\s*em\s+nghĩ\s+là\s*,?", r"^\s*em\s+cho\s+rằng\s*,?", r"^\s*em\s+thấy\s+rằng\s*,?",
            r"^\s*em\s+tin\s+là\s*,?", r"^\s*em\s+dự\s+đoán\s+là\s*,?",
            r"^\s*cá\s+nhân\s+em\s+nghĩ\s*,?", r"^\s*theo\s+sự\s+hiểu\s+biết\s+của\s+em\s*,?",

            # 3. Answer Prefixes (Mở đầu câu trả lời)
            r"^\s*câu\s+trả\s+lời\s+của\s+em\s+là\s*:?\s*", r"^\s*đáp\s+án\s+là\s*:?\s*",
            r"^\s*em\s+xin\s+trả\s+lời\s+là\s*:?\s*", r"^\s*em\s+xin\s+trả\s+lời\s*:?\s*",
            r"^\s*trả\s+lời\s*:?\s*", r"^\s*bài\s+làm\s*:?\s*", r"^\s*kết\s+quả\s+là\s*:?\s*",
            r"^\s*ý\s+chính\s+là\s*:?\s*", r"^\s*nội\s+dung\s+là\s*:?\s*",
            # Short prefixes (Common in short answers)
            r"^\s*là\s+", r"^\s*đó\s+là\s+", r"^\s*cái\s+này\s+là\s+",
            r"^\s*thì\s+là\s+", r"^\s*nghĩa\s+là\s+", r"^\s*tức\s+là\s+",
            r"^\s*thì\s+", r"^\s*nó\s+là\s+",

            # 4. Fillers / Hesitation (Từ đệm, ngập ngừng)
            r"\bthì\s+là\s+mà\b", r"\bthực\s+ra\s+là\b", r"\bthực\s+sự\s+là\b",
            r"\bquả\s+thực\s+là\b", r"\bđại\s+loại\s+là\b", r"\bhình\s+như\s+là\b",
            r"\bchắc\s+chắn\s+là\b", r"\bchắc\s+là\b", r"\bcó\s+lẽ\s+là\b",
            r"\bkiểu\s+như\s+là\b", r"\bkiểu\s+như\b", r"\bkiểu\s+kiểu\b",
            r"\bnói\s+chung\s+là\b", r"\btóm\s+lại\s+là\b", r"\bcơ\s+bản\s+là\b",
            r"\bvề\s+cơ\s+bản\b", r"\bnhư\s+thế\s+này\b", r"\bnhư\s+vậy\s+nè\b",

            # 5. Redundant Adverbs/Phrases (Trạng từ thừa)
            r"\btuy\s+nhiên\s+thì\b", r"\bnhưng\s+mà\s+thì\b", r"\bmặc\s+dù\s+vậy\b",
            r"\bthật\s+sự\b", r"\bthật\s+lòng\b", r"\brõ\s+ràng\s+là\b",
            r"\bđương\s+nhiên\s+là\b", r"\btất\s+nhiên\s+là\b", r"\bhiển\s+nhiên\s+là\b",
            r"\bkhông\s+thể\s+phủ\s+nhận\b", r"\btrên\s+thực\s+tế\b", r"\bthực\s+tế\s+cho\s+thấy\b",

            # 6. Self-Correction / Confusion (Tự sửa/Bối rối - nên bỏ để check ý chính)
            r"\bý\s+em\s+là\b", r"\btức\s+là\b", r"\bnghĩa\s+là\b",
            r"\bhay\s+nói\s+cách\s+khác\b", r"\bà\s+nhầm\b", r"\bà\s+quên\b",
            r"\bxin\s+lỗi\s+thầy\b", r"\bxin\s+lỗi\s+cô\b",

            # 7. Hedging / Uncertainty Expressions (Cụm từ thể hiện không chắc chắn)
            r"\btheo\s+em\s+nghĩ\s+là\s+vậy\b", r"\btheo\s+em\s+nghĩ\s+vậy\b",
            r"\bem\s+nghĩ\s+là\s+vậy\b", r"\bem\s+nghĩ\s+vậy\b", r"\bem\s+đoán\s+là\b",
            r"\bem\s+đoán\s+vậy\b", r"\bem\s+đoán\b", r"\bem\s+cho\s+là\s+vậy\b",
            r"\bchắc\s+vậy\b", r"\bchắc\s+là\s+vậy\b", r"\bnên\s+là\s+vậy\b",
            r"\bhay\s+là\s+vậy\b", r"\bthì\s+là\s+vậy\b", r"\bnhư\s+vậy\s+đó\b",
            r"\bcó\s+lẽ\s+vậy\b", r"\bcó\s+thể\s+là\s+vậy\b", r"\bcó\s+thể\s+vậy\b",
            r"\bhình\s+như\s+vậy\b", r"\bhình\s+như\s+là\s+vậy\b",
            r"\btheo\s+em\s+nghĩ\b", r"\btheo\s+em\s+biết\b", r"\btheo\s+hiểu\s+biết\s+của\s+em\b",
            r"\btheo\s+em\s+đoán\b", r"\btheo\s+suy\s+luận\s+của\s+em\b",
            r"\btheo\s+em\s+thấy\b", r"\btheo\s+ý\s+em\b",
            
            # 8. End-of-sentence fillers (Từ đệm cuối câu)
            r"\bạ\s*[.!?]?$", r"\bnhé\s*[.!?]?$", r"\bnha\s*[.!?]?$", 
            r"\bha\s*[.!?]?$", r"\bđó\s*[.!?]?$", r"\bvậy\s*[.!?]?$",
            r"\bthế\s*[.!?]?$", r"\brồi\s*[.!?]?$", r"\bnhỉ\s*[.!?]?$",

            # 9. Common Exam Fillers
            r"^\s*câu\s+\d+\s*[:.]\s*",  # "Câu 1:", "Câu 2."
            r"^\s*bài\s+\d+\s*[:.]\s*",  # "Bài 1:"
            r"^\s*ý\s+[abcd]\s*[:.)]\s*", # "Ý a)", "a."
            r"^\s*gạch\s+đầu\s+dòng\s*[:.]\s*",
            r"^\s*[+-]\s*", # Bullet points set at start
        ]
        
        cleaned_text = text
        for pattern in self.ignore_patterns:
            cleaned_text = re.sub(pattern, " ", cleaned_text, flags=re.IGNORECASE)
            
        # Expand abbreviation
        cleaned_text = expand_abbreviations(cleaned_text)
        
        # Collapse multiple spaces
        cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
            
        return cleaned_text

    def analyze(self, student_text: str, model_text: str) -> Tuple[str, float]:
        """
        Determine if student_text contradicts, entails, or is neutral to model_text.
        Returns: (label, confidence_score)
        """
        # 1. Preprocess
        s_clean = self.preprocess(student_text)
        m_clean = self.preprocess(model_text) # Typically model text is clean, but safe to run
        
        if not s_clean or not m_clean:
            return 'neutral', 0.0

        # 2. Prepare for Cross-Encoder
        # Input format: [(sentence_A, sentence_B)]
        pair = (s_clean, m_clean)
        
        # 3. Predict
        try:
            # Returns logits
            scores = self.ai.cross_encoder.predict([pair])[0]
            
            # Convert to probabilities (Softmax)
            probs = np.exp(scores) / np.sum(np.exp(scores))
            
            # Get argmax label
            label_idx = np.argmax(probs)
            confidence = probs[label_idx]
            
            return self.label_map.get(label_idx, 'neutral'), float(confidence)
            
        except Exception as e:
            logger.error(f"Logic Analysis failed: {e}")
            return 'neutral', 0.0
