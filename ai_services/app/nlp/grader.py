"""
UniversityGrader - Advanced Grading Pipeline
Pipeline Order:
1. STRICT EXACT MATCH (Raw & Simple Math)
2. DATASET MEMORY (ML Feedback Loop)
3. TECHNICAL ANSWER CHECK (Code/SQL)
4. AI PRE-CHECK & EARLY DIACRITIC (Smart Bypass)
5. LOGIC GUARDRAILS (Facts, Directional, Antonyms)
6. LENGTH RATIO CHECK (Early Partial Detection)
7. FUZZY TYPO MATCH (Basic string similarity)
8. AI SEMANTIC CHUNKING DEEP ANALYSIS (Sentence-by-sentence)
9. COVERAGE RATIO & BABBLE PENALTY (Keyword coverage & Babbling)
10. LATE TYPO OVERRIDE (Fuzzy rescue for bad spelling)
"""
import logging
import numpy as np
import re
from difflib import SequenceMatcher
from typing import Dict, Any, List, Set, Tuple, Optional
from sentence_transformers import util

from .config import GradingConfig
from .model import get_ai_model
from .contradiction import LogicAnalyzer
from .concepts import extract_propositions
from .code_analyzer import CodeAnalyzer
from .tokenizer import (
    ANTONYM_PAIRS, DIRECTIONAL_VERBS, PASSIVE_MARKERS, HARD_LOCATIONS,
    expand_abbreviations, check_passive_voice, remove_vietnamese_diacritics,
    normalize_synonyms
)

logger = logging.getLogger(__name__)


class UniversityGrader:
    def __init__(self):
        self.config = GradingConfig()
        self.ai = get_ai_model()
        self.logic_analyzer = LogicAnalyzer()
        self.code_analyzer = CodeAnalyzer()

        # DIRECTIONAL VERBS: 
        self.directional_verbs = {
            "quyết định", "tác động", "ảnh hưởng", "sinh ra", "tạo ra", "gây ra",
            "quay quanh", "bao quanh", "xoay quanh", "vây quanh",
            "lớn hơn", "nhỏ hơn", "cao hơn", "thấp hơn", "nhanh hơn", "chậm hơn",
            "nguyên nhân", "kết quả", "dẫn đến", "gây nên",
            "phụ thuộc", "lệ thuộc", "thuộc về", "sở hữu",
            "sau", "trước", "tiếp theo", "trước đó",
            "từ", "đến", "về phía", "hướng tới",
            "con của", "cha của", "thuộc", "của",
            "chiếu sáng", "hấp dẫn", "thu hút",
        }
        
        # Passive voice markers (Vietnamese) 
        self.passive_markers = PASSIVE_MARKERS
        # ANTONYM MAP
        self.antonym_map = ANTONYM_PAIRS
        # ANTONYM MAP
        self.antonym_map = ANTONYM_PAIRS
        # HARD LOCATIONS
        self.hard_locations = HARD_LOCATIONS
        # Precompiled regex
        self.year_pattern = re.compile(r'\b(19\d{2}|20\d{2})\b')
        # Smart Bypass threshold
        self.smart_bypass_threshold = 0.96

    # HELPER METHODS
    def _normalize_text(self, text: str) -> str:
       # Normalize text for comparison, including synonym replacement.
        if not text:
            return ""
        # Apply Synonym Mapping first
        text = normalize_synonyms(text)
        return " ".join(text.lower().split())
    
    def _extract_keywords(self, text: str, min_len: int = 2) -> Set[str]:
        # Extract significant keywords from text (words > min_len chars).
        words = re.findall(r'\b[a-zA-ZÀ-ỹ]+\b', text.lower())
        # Filter out common stopwords and short words
        stopwords = {"là", "và", "của", "có", "các", "một", "được", "trong", "đã", "để", "này", "theo", "với", "không"}
        return {w for w in words if len(w) > min_len and w not in stopwords}
    
    def _calculate_keyword_overlap(self, text1: str, text2: str) -> float:
        # Calculate keyword overlap ratio between two texts.
        kw1 = self._extract_keywords(text1)
        kw2 = self._extract_keywords(text2)
        if not kw1 or not kw2:
            return 0.0
        intersection = kw1.intersection(kw2)
        return len(intersection) / len(kw1)  # Ratio of kw1 found in kw2

    def _chunk_into_sentences(self, text: str) -> List[str]:
        # Split text into logical chunks/sentences
        if not text:
            return []
        # Split by periods, question marks, and exclamation points, keeping them attached to the chunk
        chunks = re.split(r'(?<=[.!?])\s+', text.strip())
        return [c.strip() for c in chunks if len(c.strip()) > 5]

    def _calculate_coverage_ratio(self, student_text: str, model_text: str) -> float:
        # Measure what percentage of core concepts in the model answer are present in the student answer
        model_keywords = self._extract_keywords(model_text, min_len=2)
        student_keywords = self._extract_keywords(student_text, min_len=2)
        
        if not model_keywords:
            return 1.0 # Nothing to cover
            
        covered = model_keywords.intersection(student_keywords)
        return len(covered) / len(model_keywords)
    
    def _contains_passive_markers(self, text: str) -> bool:
        # Check if text contains passive voice markers.
        return check_passive_voice(text)
    
    def _check_directional_logic(self, student_text: str, model_text: str) -> Tuple[bool, str]:
        # Check if student reversed the Subject-Object relationship of directional verbs.
        # Returns (is_reversed, verb_found).
        m_lower = model_text.lower()
        s_lower = student_text.lower()
        
        # Step 1: Find directional verb in model
        verb_found = None
        verb_pos_model = -1
        for verb in self.directional_verbs:
            if verb in m_lower:
                verb_found = verb
                verb_pos_model = m_lower.find(verb)
                break
        
        if not verb_found or verb_pos_model == -1:
            return False, ""  # No directional verb, skip check
        
        # Step 2: Check if student has the same verb
        verb_pos_student = s_lower.find(verb_found)
        if verb_pos_student == -1:
            return False, verb_found  # Student doesn't use the verb, can't compare
        
        # Step 3: Check for passive voice markers (allows reversal)
        if self._contains_passive_markers(student_text):
            logger.info(f"Passive voice detected in student answer, skipping reversal check")
            return False, verb_found
        
        # Step 4: Split model into pre and post verb parts
        model_pre = m_lower[:verb_pos_model]
        model_post = m_lower[verb_pos_model + len(verb_found):]
        
        # Step 5: Extract key entities (nouns) from each part
        model_pre_keywords = self._extract_keywords(model_pre, min_len=3)
        model_post_keywords = self._extract_keywords(model_post, min_len=3)
        
        if not model_pre_keywords or not model_post_keywords:
            return False, verb_found  # Not enough entities to compare
        
        # Step 6: Split student into pre and post verb parts
        student_pre = s_lower[:verb_pos_student]
        student_post = s_lower[verb_pos_student + len(verb_found):]
        
        # Step 7: Check for reversal
        # Ignore keywords that appear in BOTH Pre and Post of the Model
        common_model_kws = model_pre_keywords.intersection(model_post_keywords)
        
        # Unique directional markers
        pre_unique = model_pre_keywords - common_model_kws
        post_unique = model_post_keywords - common_model_kws
        
        pre_in_post = any(kw in student_post for kw in pre_unique)
        post_in_pre = any(kw in student_pre for kw in post_unique)
        
        if pre_in_post or post_in_pre:
            logger.info(f"Directional logic REVERSED: verb='{verb_found}', pre_in_post={pre_in_post}, post_in_pre={post_in_pre}")
            return True, verb_found
        
        return False, verb_found

    def _check_antonym_contradiction(self, student_text: str, model_text: str) -> bool:
        # Check for antonym contradiction with context awareness.
        s_lower = student_text.lower()
        m_lower = model_text.lower()
        
        s_lower = student_text.lower()
        m_lower = model_text.lower()
        strong_antonyms = {"ty thể", "lục lạp", "động vật", "thực vật", "đơn bào", "đa bào"}
        
        for word, antonyms in self.antonym_map.items():
            if word in m_lower:
                for antonym in antonyms:
                    # Normal check: antonym present AND word absent
                    # Strong check: antonym present (regardless of word presence, unless valid comparison detected?)
                    if antonym in s_lower:
                        is_strong = (word in strong_antonyms or antonym in strong_antonyms)
                        
                        if word not in s_lower or is_strong:
                            # Context-aware check - verify this is a key concept replacement
                            # SKIP this check for strong antonyms (they are always key concepts)
                            if is_strong or self._is_key_concept_antonym(word, antonym, m_lower, s_lower):
                                logger.info(f"Antonym detected: model='{word}', student='{antonym}'")
                                return True
        return False
    
    def _is_key_concept_antonym(self, word: str, antonym: str, model: str, student: str) -> bool:
        # Check if antonym replaces a key concept vs supporting word.
        # Returns False if most words match (indicating paraphrase, not contradiction).
        m_words = set(model.split())
        s_words = set(student.split())
        common = len(m_words & s_words)
        total = len(m_words | s_words)
        # If > 70% words are same, this is likely a false positive
        if total > 0 and common / total > 0.7:
            logger.debug(f"Antonym '{word}/{antonym}' bypassed: high word overlap {common}/{total}")
            return False
        return True
    
    def _extract_locations(self, text: str) -> Set[str]:
        # Extract hard locations from text. Strict mode to avoid false positives.
        text_lower = text.lower()
        found = {loc for loc in self.hard_locations if loc in text_lower}
        
        # Heuristic: Only add if capitalized in original text (for non-hard-coded locations)
        return found
    
    def _extract_years(self, text: str) -> Set[str]:
        # Extract years from text.
        return set(self.year_pattern.findall(text))
    
    def _check_factual_consistency(self, student_text: str, model_text: str) -> Tuple[bool, str]:
        # Year Conflict
        model_years = self._extract_years(model_text)
        student_years = self._extract_years(student_text)
        if model_years and student_years:
            if not model_years.intersection(student_years):
                return True, "Year"
        
        # Location Conflict
        model_locs = self._extract_locations(model_text)
        student_locs = self._extract_locations(student_text)
        generic_locs = {"việt nam", "đông nam á", "châu á", "châu âu", "châu mỹ", "châu phi"}
        model_specific = model_locs - generic_locs
        student_specific = student_locs - generic_locs
        if model_specific and student_specific:
            conflicting_locs = student_specific - model_specific
            if conflicting_locs:
                if not model_specific.intersection(student_specific):
                     return True, "Location"
        return False, ""
    
    def _get_diacritic_ratio(self, student_text: str, model_text: str) -> float:
        # Get similarity ratio ignoring Vietnamese diacritics.
        try:
            from .tokenizer import remove_vietnamese_diacritics
            s_no_diac = self._normalize_text(remove_vietnamese_diacritics(student_text))
            m_no_diac = self._normalize_text(remove_vietnamese_diacritics(model_text))
            return SequenceMatcher(None, s_no_diac, m_no_diac).ratio()
        except ImportError:
            return 0.0

    def _build_result(self, score: float, explanation: str, type_cls: str) -> Dict[str, Any]:
        # Build standardized result dictionary.
        return {
            "score": round(score, 2),
            "explanation": explanation,
            "type": type_cls,
            "confidence": 1.0,
            "fact_multiplier": 1.0
        }

    def _hybrid_proposition_match(self, student_text: str, props: List[str]) -> Tuple[int, List[int]]:
        # Hybrid proposition matching combining NLI with Keyword Overlap.
        matched_count = 0
        missing_indices = []
        
        if not props:
            return 0, []
        
        prop_inputs = [(student_text, p) for p in props]
        prop_scores = self.ai.cross_encoder.predict(prop_inputs)
        prop_probs = np.exp(prop_scores) / np.sum(np.exp(prop_scores), axis=1, keepdims=True)
        
        for i, (prop, p_prob) in enumerate(zip(props, prop_probs)):
            nli_score = p_prob[0]  # Entailment probability
            keyword_overlap = self._calculate_keyword_overlap(prop, student_text)
            
            # Hybrid Decision
            is_matched = False
    
            # Rule A: Anti-Hallucination
            if nli_score > 0.8 and keyword_overlap < 0.2:
                is_matched = False  # NLI hallucinating, reject
                logger.debug(f"Prop[{i}] REJECTED (hallucination): NLI={nli_score:.2f}, KW={keyword_overlap:.2f}")
            
            # Rule B: Anti-Strictness
            elif nli_score < 0.5 and keyword_overlap > 0.7:
                is_matched = True  # NLI too strict, accept based on keywords
                logger.debug(f"Prop[{i}] ACCEPTED (keywords override): NLI={nli_score:.2f}, KW={keyword_overlap:.2f}")
            
            # Default
            else:
                is_matched = nli_score > 0.5
            
            if is_matched:
                matched_count += 1
            else:
                missing_indices.append(i)
        
        return matched_count, missing_indices
    
    def grade(self, student_text: str, model_text: str, max_points: float) -> Dict[str, Any]:
        if not student_text or not model_text:
            return self._build_result(0.0, "Missing input text.", "None")
        
        # Preprocess
        
        # 0. RAW EXACT MATCH CHECK (Fastest path)
        if student_text.strip() == model_text.strip():
             return self._build_result(max_points, "Exact match.", "Exact")

        # Apply Synonym Normalization BEFORE preprocessing for Logic/AI
        s_syn = normalize_synonyms(student_text)
        m_syn = normalize_synonyms(model_text)
        
        s_clean = self.logic_analyzer.preprocess(s_syn)
        s_norm = self._normalize_text(s_clean)
        m_norm = self._normalize_text(m_syn)
        
        # Calculate length ratio for partial detection
        length_ratio = len(s_clean) / len(model_text) if len(model_text) > 0 else 0
        is_long_answer = len(model_text) > 300
        
        # =========================================================
        # STEP 1: STRICT EXACT MATCH
        # =========================================================
        
        if s_norm == m_norm:
            return self._build_result(max_points, "Exact match.", "Exact")
        
        # =========================================================
        # STEP 1.5: SIMPLE MATH ANSWER MATCHING
        # =========================================================
        
        def extract_math_result(text: str) -> str:
            """Extract numeric result from expression like '1+7=8' -> '8' or '8.' -> '8'"""
            text = text.strip()
            # Remove trailing punctuation and fillers
            text = re.sub(r'[.!?,\s]*(ạ|nhé|nha|vậy|thế)?\s*$', '', text, flags=re.IGNORECASE)
            # If contains '=', get the part after last '='
            if '=' in text:
                text = text.split('=')[-1].strip()
            # Extract just numeric value
            match = re.search(r'^-?\d+\.?\d*', text)
            return match.group(0) if match else text
        
        # Check if both texts are simple numeric answers
        model_is_simple = re.match(r'^[\d\s.+\-×÷*/=]+[.!?]?$', model_text.strip())
        student_has_num = re.search(r'\d+', student_text)
        
        if model_is_simple and student_has_num:
            m_result = extract_math_result(model_text)
            s_result = extract_math_result(student_text)
            if m_result == s_result:
                return self._build_result(max_points, "Đáp án chính xác.", "Exact")
        
        # STEP 2: DATASET MEMORY
        try:
            from app.dataset_learning import find_similar_to_grading
            dataset_result = find_similar_to_grading(student_text, model_text, max_points)
            if dataset_result:
                return self._build_result(
                    score=dataset_result['score'],
                    explanation=f"{dataset_result['feedback']} (From Dataset)",
                    type_cls=dataset_result.get('type', 'Learned Pattern')
                )
        except ImportError:
            pass
        
        # STEP 2.5: TECHNICAL ANSWER CHECK (Code/SQL/Math)
        tech_result = self.code_analyzer.grade(model_text, student_text, max_points)
        if tech_result:
            logger.info(f"CodeAnalyzer handled: type={tech_result['type']}, score={tech_result['score']}")
            return self._build_result(
                tech_result['score'],
                tech_result['explanation'],
                tech_result['type']
            )
        
        # STEP 3: AI PRE-CHECK (for Smart Bypass decision)
        # Calculate semantic similarity BEFORE guardrails
        emb_s = self.ai.bi_encoder.encode(s_clean, convert_to_tensor=True)
        emb_m = self.ai.bi_encoder.encode(m_syn, convert_to_tensor=True)
        cosine_sim = util.cos_sim(emb_s, emb_m).item()
        current_bypass_threshold = 0.85 if is_long_answer else self.smart_bypass_threshold
        
        smart_bypass_active = cosine_sim >= current_bypass_threshold
        
        if smart_bypass_active:
            logger.info(f"Smart Bypass ACTIVE: cosine_sim={cosine_sim:.3f} >= {current_bypass_threshold}")
        
        # STEP 3.5: EARLY DIACRITIC CHECK FOR LONG TEXTS
        diac_ratio = self._get_diacritic_ratio(s_clean, model_text)
        
        # Early typo detection for long texts
        if is_long_answer and diac_ratio >= 0.65:
            smart_bypass_active = True
            logger.info(f"Early Typo Detection: diac_ratio={diac_ratio:.2f} for long text ({len(model_text)} chars)")
        
        # STEP 4: LOGIC GUARDRAILS (with Smart Bypass + Context-aware)
        
        # Expand abbreviations for better fact check (TPHCM -> hồ chí minh)
        s_expanded = expand_abbreviations(s_clean)
        
        # 4a. Antonym Contradiction (5% max) - CAN BE BYPASSED (unless Strong)
        # Check if we have a strong antonym (which should NOT be bypassed)
        has_strong_antonym = False
        antonym_penalty = self._check_antonym_contradiction(s_clean, model_text)
        if antonym_penalty:
            strong_set = {"ty thể", "lục lạp", "động vật", "thực vật", "đơn bào", "đa bào"}
            for strong in strong_set:
                 if strong in s_clean and strong not in model_text:
                      has_strong_antonym = True
                      break
            
            # If smart bypass active, only allow bypass if NOT strong
            if smart_bypass_active and not has_strong_antonym:
                 logger.info("Antonym penalty BYPASSED by Smart Bypass or Early Typo Detection")
            else:
                 return self._build_result(
                    max_points * 0.05,
                    "Phát hiện mâu thuẫn ngữ nghĩa nghiêm trọng (False Antonym).",
                    "Contradiction"
                )
        
        # 4b. Factual Consistency (10% max) - NEVER BYPASSED (facts are absolute)
        is_fact_error, error_type = self._check_factual_consistency(s_expanded, model_text)
        if is_fact_error:
            return self._build_result(
                max_points * 0.10,
                f"Sai lệch thông tin quan trọng ({error_type}).",
                "Fact Error"
            )
        
        # 4c. Directional Logic Check (20% max) - CAN BE BYPASSED
        is_reversed, verb_used = self._check_directional_logic(s_clean, model_text)
        if is_reversed and not smart_bypass_active:
            return self._build_result(
                max_points * 0.20,
                f"Đảo ngược quan hệ logic ('{verb_used}'). A→B ≠ B→A.",
                "Logic Reversal"
            )
        elif is_reversed and smart_bypass_active:
            logger.info(f"Directional logic penalty BYPASSED by Smart Bypass for verb '{verb_used}'")
        
        # STEP 4.5: LENGTH RATIO CHECK FOR PARTIAL DETECTION
        # Short answers for long questions should be marked as partial
        if is_long_answer and length_ratio < 0.4:
             # Too short for a long question
            key_overlap = self._calculate_keyword_overlap(model_text, s_clean)
            if key_overlap > 0.35:
                 # Has significant key concepts
                prop_score = max(0.2, key_overlap)
                score = max_points * (0.15 + prop_score * 0.40) # 15-55% range
                return self._build_result(
                    score,
                    f"Câu trả lời quá ngắn so với yêu cầu ({int(length_ratio*100)}%).",
                    "Partial"
                )
        
        # Case 2: Short/Medium Answer Question (< 300 chars)
        # Prevent "Off-topic" for valid partial answers
        if not is_long_answer and length_ratio < 0.5:
             key_overlap = self._calculate_keyword_overlap(model_text, s_clean)
             if key_overlap > 0.3:
                 return self._build_result(
                     max_points * 0.5,
                     "Trả lời đúng một phần (thiếu chi tiết).",
                     "Partial"
                 )
        
        # STEP 5: FUZZY / TYPO MATCH
        lev_ratio = SequenceMatcher(None, s_norm, m_norm).ratio()        
        if lev_ratio >= 0.95:
            score = max_points * (0.95 + (lev_ratio - 0.95) * 1.0)
            return self._build_result(min(score, max_points), "Near-exact match.", "Typo")
        
        if diac_ratio >= 0.95:
            return self._build_result(max_points * 0.95, "Correct answer with diacritic typos.", "Typo")
        
        if lev_ratio >= 0.90:
            return self._build_result(max_points * 0.90, "High similarity.", "Typo")
        
        # NEW: Additional diacritic check for long texts
        if is_long_answer and diac_ratio >= 0.80:
            return self._build_result(max_points * 0.85, "Câu trả lời đúng với lỗi chính tả.", "Typo")
        
        # =========================================================
        # STEP 5: AI SEMANTIC CHUNKING DEEP ANALYSIS
        # =========================================================
        
        model_chunks = self._chunk_into_sentences(m_syn)
        student_chunks = self._chunk_into_sentences(s_clean)
        
        # Fallback if chunking yields nothing
        if not model_chunks:
             model_chunks = [m_syn]
        if not student_chunks:
             student_chunks = [s_clean]
             
        chunk_points = max_points / len(model_chunks)
        total_semantic_score = 0
        feedback_details = []
        is_global_contradiction = False
        
        for i, m_chunk in enumerate(model_chunks):
            best_chunk_score = 0
            best_chunk_feedback = ""
            best_logic_label = 'neutral'
            
            emb_m_chunk = self.ai.bi_encoder.encode(m_chunk, convert_to_tensor=True)
            
            # Find best matching student chunk
            best_s_chunk = ""
            best_sim = -1
            
            for s_chunk in student_chunks:
                emb_s_chunk = self.ai.bi_encoder.encode(s_chunk, convert_to_tensor=True)
                sim = util.cos_sim(emb_s_chunk, emb_m_chunk).item()
                if sim > best_sim:
                    best_sim = sim
                    best_s_chunk = s_chunk
            
            # Threshold to consider the point "addressed" at all
            if best_sim < 0.35:
                # Student missed this point completely
                feedback_details.append(f"Ý {i+1}: Thiếu ý.")
                continue
                
            # Perform Logic Analysis on the matched chunk pair
            logic_label, logic_conf = self.logic_analyzer.analyze(best_s_chunk, m_chunk)
            has_directional_verb = any(v in m_chunk.lower() for v in self.directional_verbs)
            
            # Reversals
            is_reversed, verb_used = self._check_directional_logic(best_s_chunk, m_chunk)
            
            if is_reversed and not smart_bypass_active:
                chunk_score = 0
                best_chunk_feedback = f"Ý {i+1}: Sai logic hướng ('{verb_used}')."
            elif logic_label == 'contradiction' and logic_conf > self.config.contradiction_threshold:
                chunk_score = 0
                best_chunk_feedback = f"Ý {i+1}: Sai lệch logic/Ngược ý."
                is_global_contradiction = True
            else:
                # Acceptable point
                chunk_score = chunk_points * min(1.0, (best_sim * 1.1)) # Give a slight boost, cap at max
                if best_sim > 0.85:
                    best_chunk_feedback = f"Ý {i+1}: Tốt."
                else:
                    best_chunk_feedback = f"Ý {i+1}: Chấp nhận được (Độ khớp: {best_sim:.2f})."
                    
            total_semantic_score += chunk_score
            feedback_details.append(best_chunk_feedback)
            
        # =========================================================
        # STEP 6: COVERAGE RATIO & BABBLE PENALTY
        # =========================================================
        coverage_ratio = self._calculate_coverage_ratio(s_clean, m_syn)
        coverage_multiplier = 1.0
        
        # Relax coverage penalty only if it's a LONG text with typos, OR an incredibly high typo match
        if (diac_ratio >= 0.65 and is_long_answer) or diac_ratio >= 0.85:
             coverage_multiplier = 1.0
             feedback_details.append(f"(Bỏ qua phạt từ khóa do cấu trúc giống nhau: Coverage={int(coverage_ratio*100)}%)")
        else:
             if coverage_ratio < 0.35:
                  coverage_multiplier = 0.3 # Heavy penalty for catching only 1-2 words
             elif coverage_ratio < 0.55:
                  coverage_multiplier = 0.5
             elif coverage_ratio < 0.75:
                  coverage_multiplier = 0.8
                  
        # Babble Penalty: Punish students who write too many extra things (Trộn lẫn / Chém gió)
        babble_penalty = 1.0
        if len(student_chunks) > len(model_chunks):
            extra_chunks = len(student_chunks) - len(model_chunks)
            # 15% penalty for each extra unmatched chunk, max 60% penalty
            penalty = min(0.6, extra_chunks * 0.15)
            babble_penalty = 1.0 - penalty
            feedback_details.append(f"(Trừ {int(penalty*100)}% điểm do viết lan man/thừa ý)")
             
        final_score = total_semantic_score * coverage_multiplier * babble_penalty
        
        # 5d. Off-topic Veto (Post-chunking)
        if coverage_ratio < 0.1 and final_score < (max_points * 0.2):
            return self._build_result(
                0.0, 
                f"Câu trả lời hoàn toàn lạc đề (Độ bao phủ: {coverage_ratio:.2f}).", 
                "Off-topic"
            )
        
        # =========================================================
        # STEP 7: BUILD FINAL RESULT
        # =========================================================
        
        final_type = "Paraphrase" if final_score >= (max_points * 0.7) else "Partial"
        if is_global_contradiction:
            final_type = "Contradiction"
            
        # Late Typo Override (Strict for short texts)
        if diac_ratio >= 0.85 and (final_score / max_points) < 0.85:
            final_score = max(final_score, max_points * 0.75) # Ensure it scores at least 7.5
            final_type = "Typo"
            feedback = "Câu trả lời đúng ý nhưng có một số lỗi chính tả." 
        else:
            feedback = " | ".join(feedback_details)
            if coverage_multiplier < 1.0:
                 feedback += f" (Coverage quá thấp: {int(coverage_ratio*100)}%)."
                 
        return self._build_result(final_score, feedback, final_type)

def calculate_score(student_text: str, model_text: str, max_points: float) -> Dict[str, Any]:
    grader = UniversityGrader()
    return grader.grade(student_text, model_text, max_points)
