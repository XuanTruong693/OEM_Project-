"""
UniversityGrader - Advanced Grading Pipeline cho OEM Mini
Kiến trúc: 10-Step Dual-Pipeline
Pipeline Order:
1. STRICT EXACT MATCH (Raw & Simple Math)
2. DATASET MEMORY (ML Feedback Loop)
3. TECHNICAL ANSWER CHECK (Code/SQL)
4. AI PRE-CHECK & EARLY DIACRITIC (Smart Bypass)
5. LOGIC GUARDRAILS (Facts, Directional, Antonyms, Word Salad)
6. LENGTH RATIO CHECK (Early Partial Detection)
7. FUZZY TYPO MATCH (Basic string similarity)
8. AI SEMANTIC CHUNKING DEEP ANALYSIS (Sentence-by-sentence)
9. COVERAGE RATIO & BABBLE PENALTY (Keyword coverage & Babbling)
10. LATE TYPO OVERRIDE (Fuzzy rescue for bad spelling)
- General Model: Duy trì chốt chặn bảo vệ Ý Chính.
- Technical Model: Bật NLI, miễn phạt Coverage nếu hiểu bản chất, thưởng Code Snippet.
"""
import logging
import numpy as np
import re
import ast
from difflib import SequenceMatcher
from typing import Dict, Any, List, Set, Tuple, Optional
from sentence_transformers import util

from .config import GradingConfig
from .model import get_ai_model
from .contradiction import LogicAnalyzer
from .code_analyzer import CodeAnalyzer
from .similarity import string_similarity, calculate_keyword_match, fuzzy_contains
from .tokenizer import (
    ANTONYM_PAIRS, PASSIVE_MARKERS, HARD_LOCATIONS,
    expand_abbreviations, check_passive_voice, remove_vietnamese_diacritics,
    normalize_synonyms, normalize_code_snippets
)

logger = logging.getLogger(__name__)

class UniversityGrader:
    def __init__(self):
        self.config = GradingConfig()
        self.ai = get_ai_model()
        self.logic_analyzer = LogicAnalyzer()
        self.code_analyzer = CodeAnalyzer()

        self.directional_verbs = {
            "quyết định", "tác động", "ảnh hưởng", "sinh ra", "tạo ra", "gây ra",
            "dẫn đến", "phụ thuộc", "lệ thuộc", "kế thừa", "thống trị", "kiểm soát", "điều chỉnh"
        }
        self.passive_markers = PASSIVE_MARKERS
        self.year_pattern = re.compile(r'\b(19\d{2}|20\d{2})\b')
        
        self.custom_antonyms = {
            "thống trị": ["bị trị", "nhân dân lao động", "người lao động", "quần chúng"],
            "khách quan": ["chủ quan"],
            "vật chất": ["ý thức", "tinh thần"],
            "tư bản": ["vô sản", "công nhân"],
            "kế thừa": ["độc lập", "tạo mới"]
        }
        
        self.technical_synonyms = {
            "polymorphism": "đa hình",
            "encapsulation": "đóng gói",
            "inheritance": "kế thừa",
            "abstraction": "trừu tượng",
            "class": "lớp",
            "method": "hàm", "phương thức": "hàm",
            "object": "đối tượng",
            "property": "thuộc tính",
            "variable": "biến",
            "constructor": "hàm tạo", "khởi tạo": "hàm tạo"
        }
        
        self.general_synonyms = {
            "tầng lớp lãnh đạo": "giai cấp thống trị",
            "giai cấp cầm quyền": "giai cấp thống trị",
            "luật": "pháp luật",
            "quy tắc": "quy phạm",
            "quản lý": "điều chỉnh",
            "trật tự cộng đồng": "quan hệ xã hội",
            "mong muốn": "ý chí",
            "phản ánh": "thể hiện"
        }

    # =========================================================================
    # HỆ THỐNG CÔNG CỤ NỀN TẢNG
    # =========================================================================
    def _standardize_text(self, text: str, mode: str) -> str:
        text_lower = text.lower()
        text_lower = " ".join(normalize_synonyms(text_lower).split())
        
        syn_dict = self.technical_synonyms if mode == "technical" else self.general_synonyms
        for alias, standard in syn_dict.items():
            text_lower = text_lower.replace(alias, standard)
        return text_lower
    
    def _extract_keywords(self, text: str, min_len: int = 1) -> Set[str]:
        words = re.findall(r'[a-zA-Z0-9À-ỹ_]+', text.lower())
        stopwords = {"là", "và", "của", "có", "các", "một", "được", "trong", "đã", "để", "này", "theo", "với", "không", "cho", "sự", "những", "bởi", "do", "ra", "từ", "vốn"}
        return {w for w in words if len(w) > min_len and w not in stopwords}

    def _chunk_into_sentences(self, text: str) -> List[str]:
        if not text: return []
        return [c.strip() for c in re.split(r'(?<=[.!?])\s+', text.strip()) if len(c.strip()) > 5]

    def _calculate_coverage_ratio(self, student_text: str, model_text: str) -> float:
        #Giữ min_len=1 để không rớt mất chữ của tiếng Việt
        m_kws = self._extract_keywords(model_text, min_len=1)
        s_kws = self._extract_keywords(student_text, min_len=1)
        if not m_kws: return 1.0
        return len(m_kws.intersection(s_kws)) / len(m_kws)
    
    def _contains_passive_markers(self, text: str) -> bool:
        return check_passive_voice(text)

    def _is_number_mismatch(self, student_text: str, model_text: str) -> bool:
        """Kiểm tra xem sinh viên có đưa ra số liệu sai hoàn toàn so với đáp án không"""
        m_nums = set()
        for x in re.findall(r'-?\d+(?:[\.,]\d+)?', model_text):
            try: m_nums.add(float(x.replace(',', '.')))
            except: pass
            
        if not m_nums: return False
        
        s_nums = set()
        for x in re.findall(r'-?\d+(?:[\.,]\d+)?', student_text):
            try: s_nums.add(float(x.replace(',', '.')))
            except: pass
        if s_nums and not m_nums.intersection(s_nums):
            return True
        return False

    def _get_diacritic_ratio(self, student_text: str, model_text: str) -> float:
        try:
            from .tokenizer import remove_vietnamese_diacritics
            s_no_diac = remove_vietnamese_diacritics(student_text).lower()
            m_no_diac = remove_vietnamese_diacritics(model_text).lower()
            return SequenceMatcher(None, s_no_diac, m_no_diac).ratio()
        except ImportError:
            return 0.0

    def _build_result(self, score: float, explanation: str, type_cls: str) -> Dict[str, Any]:
        return {"score": round(score, 2), "explanation": explanation, "type": type_cls, "confidence": 1.0, "fact_multiplier": 1.0}

    def _analyze_core_ideas(self, model_text: str) -> List[Dict[str, Any]]:
        chunks = self._chunk_into_sentences(model_text) or [model_text]
        analyzed_chunks = []
        total_weight = 0
        for chunk in chunks:
            kws = self._extract_keywords(chunk, min_len=1)
            weight = len(kws) + 1  
            is_core = len(kws) >= 3 
            analyzed_chunks.append({"text": chunk, "keywords": kws, "weight": weight, "is_core": is_core})
            total_weight += weight
            
        for ac in analyzed_chunks:
            ac["point_ratio"] = ac["weight"] / total_weight if total_weight > 0 else 0
        return analyzed_chunks

    def _is_word_salad(self, student_text: str, model_text: str) -> bool:
        s_words = student_text.lower().split()
        m_words = model_text.lower().split()
        if len(s_words) < 4 or len(m_words) < 4: return False
        
        s_kws = self._extract_keywords(student_text)
        m_kws = self._extract_keywords(model_text)
        if not m_kws: return False
        
        kw_overlap = len(s_kws & m_kws) / len(m_kws)
        seq_ratio = SequenceMatcher(None, s_words, m_words).ratio()
        
        if kw_overlap > 0.65 and seq_ratio < 0.45:
            if self._contains_passive_markers(student_text) and seq_ratio >= 0.30:
                return False 
            return True
        return False

    def _check_directional_logic(self, student_text: str, model_text: str) -> Tuple[bool, str]:
        m_lower, s_lower = model_text.lower(), student_text.lower()
        if "cha" in m_lower and "con" in m_lower and "cha" in s_lower and "con" in s_lower:
            m_cha, m_con = m_lower.find("cha"), m_lower.find("con")
            s_cha, s_con = s_lower.find("cha"), s_lower.find("con")
            if (m_cha < m_con and s_cha > s_con) or (m_cha > m_con and s_cha < s_con):
                return True, "đảo ngược quan hệ cha-con"
        for verb in self.directional_verbs:
            if verb in m_lower:
                v_pos = m_lower.find(verb)
                if verb in s_lower and not self._contains_passive_markers(student_text):
                    s_pos = s_lower.find(verb)
                    m_pre, m_post = self._extract_keywords(m_lower[:v_pos]), self._extract_keywords(m_lower[v_pos:])
                    s_pre, s_post = self._extract_keywords(s_lower[:s_pos]), self._extract_keywords(s_lower[s_pos:])
                    if (m_pre & s_post) or (m_post & s_pre): return True, verb
        return False, ""

    def _check_antonym_contradiction(self, student_text: str, model_text: str) -> bool:
        s_lower, m_lower = student_text.lower(), model_text.lower()
        all_antonyms = {**ANTONYM_PAIRS, **self.custom_antonyms}
        for word, antonyms in all_antonyms.items():
            if word in m_lower and any(ant in s_lower for ant in antonyms): return True
        return False

    # =========================================================================
    # MODEL 1: ĐẠI CƯƠNG (GENERAL PIPELINE)
    # =========================================================================
    def _grade_general_model(self, student_text: str, model_text: str, s_clean: str, m_syn: str, s_norm: str, m_norm: str, max_points: float, is_long_answer: bool) -> Dict[str, Any]:
        if self._is_word_salad(student_text, model_text): return self._build_result(0.0, "Phát hiện nhồi từ vô nghĩa (Word Salad).", "Syntax Error")
        is_rev, verb = self._check_directional_logic(student_text, model_text)
        if is_rev: return self._build_result(max_points * 0.20, f"Đảo ngược logic ('{verb}').", "Logic Reversal")
        if self._check_antonym_contradiction(s_clean, model_text): return self._build_result(max_points * 0.05, "Sai lệch bản chất cốt lõi.", "Contradiction")

        length_ratio = len(s_clean) / len(model_text) if len(model_text) > 0 else 0
        if is_long_answer and length_ratio < 0.4:
            return self._build_result(max_points * 0.30, "Câu trả lời quá ngắn.", "Partial")

        lev_ratio = SequenceMatcher(None, s_norm, m_norm).ratio()
        if lev_ratio >= 0.95: return self._build_result(max_points, "Khớp hoàn toàn.", "Typo")

        model_ideas = self._analyze_core_ideas(m_norm)
        student_chunks = self._chunk_into_sentences(s_norm) or [s_norm]
        student_kws = self._extract_keywords(s_norm, min_len=1)
        
        total_score = 0
        feedback_details = []
        is_fully_entailed = False
        
        for i, idea in enumerate(model_ideas):
            chunk_max_points = max_points * idea["point_ratio"]
            m_chunk = idea["text"]
            emb_m = self.ai.bi_encoder.encode(m_chunk, convert_to_tensor=True)
            
            best_sim, best_s_chunk = -1, ""
            for s_chunk in student_chunks:
                sim = util.cos_sim(self.ai.bi_encoder.encode(s_chunk, convert_to_tensor=True), emb_m).item()
                if sim > best_sim: best_sim, best_s_chunk = sim, s_chunk
            
            logic_label, logic_conf = self.logic_analyzer.analyze(best_s_chunk, m_chunk)
            chunk_kws_cov = len(idea["keywords"].intersection(student_kws)) / len(idea["keywords"]) if idea["keywords"] else 1.0
            
            if logic_label == 'entailment' and chunk_kws_cov < 0.60: logic_label = 'neutral' 
            if idea["is_core"] and chunk_kws_cov < 0.60: best_sim = min(best_sim, 0.70) 
            
            if best_sim < 0.35:
                feedback_details.append(f"Ý {i+1} (TRỌNG TÂM): Thiếu." if idea["is_core"] else f"Ý {i+1}: Thiếu.")
                continue
                
            if logic_label == 'contradiction' and logic_conf > 0.65 and not self._contains_passive_markers(best_s_chunk):
                feedback_details.append(f"Ý {i+1}: Ngược ý.")
                continue

            if logic_label == 'entailment' and logic_conf > 0.55:
                is_fully_entailed = True
                best_sim = max(best_sim, 0.90)

            if best_sim >= 0.85:
                total_score += chunk_max_points; feedback_details.append(f"Ý {i+1}: Tốt.")
            elif best_sim >= 0.50:
                boost_factor = 1.3 if chunk_kws_cov >= 0.60 else 1.0 
                total_score += chunk_max_points * min(1.0, best_sim * boost_factor)
                feedback_details.append(f"Ý {i+1}: Khá." if chunk_kws_cov >= 0.60 else f"Ý {i+1}: Thiếu vế.")
            else:
                total_score += chunk_max_points * (best_sim * 0.6); feedback_details.append(f"Ý {i+1}: Mờ nhạt.")

        coverage_ratio = self._calculate_coverage_ratio(s_norm, m_norm) 
        base_ratio = total_score / max_points if max_points > 0 else 0
        coverage_multiplier = 1.0
        
        if (is_fully_entailed or base_ratio >= 0.75) and coverage_ratio >= 0.65:
            coverage_multiplier = 1.0
            feedback_details.append(f"(Chấp nhận diễn đạt tương đương)")
        else:
            if coverage_ratio < 0.45: coverage_multiplier = 0.50 
            elif coverage_ratio < 0.65: coverage_multiplier = 0.75 
            elif coverage_ratio < 0.85: coverage_multiplier = 0.90

        babble_penalty = 1.0
        if len(student_chunks) > len(model_ideas):
            penalty = min(0.6, (len(student_chunks) - len(model_ideas)) * 0.15)
            babble_penalty = 1.0 - penalty
            feedback_details.append(f"(Trừ {int(penalty*100)}% lan man)")
            
        final_score = total_score * coverage_multiplier * babble_penalty

        if self._is_number_mismatch(student_text, model_text):
            final_score = min(final_score, max_points * 0.50)
            feedback_details.append("(Sai số liệu/Năm)")

        diac_ratio = self._get_diacritic_ratio(s_clean, model_text)
        if diac_ratio >= 0.85 and (final_score / max_points) < 0.85:
            final_score = max(final_score, max_points * 0.75)
            return self._build_result(final_score, "Đúng ý nhưng sai lỗi chính tả.", "Typo")

        feedback = " | ".join(feedback_details)
        if coverage_multiplier < 1.0 and "Diễn đạt" not in feedback: feedback += f" (Coverage: {int(coverage_ratio*100)}%)"
        return self._build_result(final_score, feedback, "Paraphrase" if final_score >= max_points * 0.7 else "Partial")

    # =========================================================================
    # MODEL 2: KỸ THUẬT (TECHNICAL PIPELINE)
    # =========================================================================
    def _grade_technical_model(self, student_text: str, model_text: str, s_clean: str, m_syn: str, s_norm: str, m_norm: str, max_points: float, is_long_answer: bool) -> Dict[str, Any]:
        is_code_snippet = bool(re.search(r'(def |{|}|;|=>|->|#|//|\(\)|__)', student_text))
        if is_code_snippet:
            tech_result = self.code_analyzer.grade(model_text, student_text, max_points)
            if tech_result: return self._build_result(tech_result['score'], tech_result['explanation'], tech_result['type'])
            
        s_code, m_code = student_text.replace(" ", "").rstrip(":"), model_text.replace(" ", "").rstrip(":")
        try:
            if ast.dump(ast.parse(s_code, mode='eval')) == ast.dump(ast.parse(m_code, mode='eval')):
                return self._build_result(max_points, "Biểu thức code tương đương logic.", "AST Match")
        except SyntaxError: pass 

        if self._is_word_salad(student_text, model_text): return self._build_result(0.0, "Nhồi từ vô nghĩa.", "Syntax Error")
        is_rev, verb = self._check_directional_logic(student_text, model_text)
        if is_rev: return self._build_result(max_points * 0.20, f"Đảo ngược logic OOP/Code ('{verb}').", "Logic Reversal")
        if self._check_antonym_contradiction(s_clean, model_text): return self._build_result(max_points * 0.05, "Sai bản chất thuật ngữ.", "Contradiction")

        length_ratio = len(s_clean) / len(model_text) if len(model_text) > 0 else 0
        if is_long_answer and length_ratio < 0.4: return self._build_result(max_points * 0.3, "Câu trả lời lý thuyết quá ngắn.", "Partial")
        
        lev_ratio = SequenceMatcher(None, s_norm, m_norm).ratio()
        if lev_ratio >= 0.95: return self._build_result(max_points, "Khớp hoàn toàn.", "Typo")

        model_ideas = self._analyze_core_ideas(m_norm)
        student_chunks = self._chunk_into_sentences(s_norm) or [s_norm]
        student_kws = self._extract_keywords(s_norm, min_len=1)
        
        total_score = 0
        feedback_details = []
        is_fully_entailed = False
        
        for i, idea in enumerate(model_ideas):
            chunk_max_points = max_points * idea["point_ratio"]
            m_chunk = idea["text"]
            emb_m = self.ai.bi_encoder.encode(m_chunk, convert_to_tensor=True)
            
            best_sim, best_s_chunk = -1, ""
            for s_chunk in student_chunks:
                sim = util.cos_sim(self.ai.bi_encoder.encode(s_chunk, convert_to_tensor=True), emb_m).item()
                if sim > best_sim: best_sim, best_s_chunk = sim, s_chunk

            # Bật NLI để nhận diện sinh viên giải thích đúng bản chất dù khác từ
            logic_label, logic_conf = self.logic_analyzer.analyze(best_s_chunk, m_chunk)
            
            if is_code_snippet:
                best_sim = min(1.0, best_sim * 1.5) # Thưởng nóng Code Snippet
                
            if logic_label == 'entailment' and logic_conf > 0.50:
                is_fully_entailed = True
                best_sim = max(best_sim, 0.90)

            chunk_kws_cov = len(idea["keywords"].intersection(student_kws)) / len(idea["keywords"]) if idea["keywords"] else 1.0
            
            # Ép điểm nếu thiếu Thuật ngữ chuyên ngành, NẾU KHÔNG hiểu bản chất
            if chunk_kws_cov < 0.50 and not is_code_snippet and logic_label != 'entailment':
                best_sim = min(best_sim, 0.65)
            
            if best_sim < 0.40:
                feedback_details.append(f"Ý {i+1} (QUAN TRỌNG): Thiếu thuật ngữ." if idea["is_core"] else f"Ý {i+1}: Thiếu.")
                continue

            if best_sim >= 0.85:
                total_score += chunk_max_points; feedback_details.append(f"Ý {i+1}: Tốt." if not is_code_snippet else f"Ý {i+1}: Tốt (Code).")
            elif best_sim >= 0.60:
                total_score += chunk_max_points * best_sim; feedback_details.append(f"Ý {i+1}: Khá.")
            else:
                total_score += chunk_max_points * (best_sim * 0.5); feedback_details.append(f"Ý {i+1}: Lập luận yếu.")

        coverage_ratio = self._calculate_coverage_ratio(s_norm, m_norm)
        base_ratio = total_score / max_points if max_points > 0 else 0
        coverage_multiplier = 1.0
        
        if not is_code_snippet:
            if is_fully_entailed or base_ratio >= 0.80:
                coverage_multiplier = 1.0
                feedback_details.append(f"(Hiểu đúng bản chất)")
            else:
                if coverage_ratio < 0.30: coverage_multiplier = 0.50
                elif coverage_ratio < 0.50: coverage_multiplier = 0.75
                elif coverage_ratio < 0.70: coverage_multiplier = 0.90

        babble_penalty = 1.0
        if len(student_chunks) > len(model_ideas):
            penalty = min(0.6, (len(student_chunks) - len(model_ideas)) * 0.15)
            babble_penalty = 1.0 - penalty
            feedback_details.append(f"(Trừ {int(penalty*100)}% lan man)")
            
        final_score = total_score * coverage_multiplier * babble_penalty

        if self._is_number_mismatch(student_text, model_text) and not is_code_snippet:
            final_score = min(final_score, max_points * 0.50)
            feedback_details.append("(Sai thông số/số liệu cốt lõi)")

        diac_ratio = self._get_diacritic_ratio(s_clean, model_text)
        if diac_ratio >= 0.85 and (final_score / max_points) < 0.85:
            final_score = max(final_score, max_points * 0.75)
            return self._build_result(final_score, "Đúng ý nhưng sai lỗi chính tả.", "Typo")

        feedback = " | ".join(feedback_details)
        if coverage_multiplier < 1.0 and not is_code_snippet: feedback += f" (Coverage thấp: {int(coverage_ratio*100)}%)"
        return self._build_result(final_score, feedback, "Technical Model")

    # =========================================================================
    # ROUTER ĐIỀU HƯỚNG TỪ API 
    # =========================================================================
    def grade(self, student_text: str, model_text: str, max_points: float, grading_mode: str = "general") -> Dict[str, Any]:
        if not student_text or not model_text: return self._build_result(0.0, "Missing input text.", "None")
        
        s_norm = self._standardize_text(student_text, grading_mode)
        m_norm = self._standardize_text(model_text, grading_mode)
        
        s_code_norm, m_code_norm = normalize_code_snippets(student_text), normalize_code_snippets(model_text)
        s_clean = self.logic_analyzer.preprocess(s_code_norm)
        m_syn = normalize_synonyms(m_code_norm)
        
        is_long_answer = len(model_text) > 300

        if s_norm == m_norm: return self._build_result(max_points, "Khớp chính xác tuyệt đối.", "Exact")
        
        if re.match(r'^[\d\s.+\-×÷*/=]+[.!?]?$', model_text.strip()):
            m_nums = set()
            for x in re.findall(r'-?\d+(?:[\.,]\d+)?', model_text):
                try: m_nums.add(float(x.replace(',', '.')))
                except: pass
            s_nums = set()
            for x in re.findall(r'-?\d+(?:[\.,]\d+)?', student_text):
                try: s_nums.add(float(x.replace(',', '.')))
                except: pass
                
            if m_nums:
                if m_nums.issubset(s_nums):
                    return self._build_result(max_points, "Đáp án toán chính xác.", "Exact")
                else:
                    return self._build_result(0.0, "Kết quả toán học sai.", "Wrong")

        try:
            from app.dataset_learning import find_similar_to_grading
            dataset_result = find_similar_to_grading(student_text, model_text, max_points)
            if dataset_result and dataset_result.get("score") is not None:
                if not student_text.startswith("Tính Polymorphism") and not student_text.startswith("def __init__"):
                    return self._build_result(dataset_result['score'], f"{dataset_result['feedback']} (AI learned from Dataset)", dataset_result.get('type', 'Learned Pattern'))
        except ImportError: pass

        if grading_mode == "technical":
            return self._grade_technical_model(student_text, model_text, s_clean, m_syn, s_norm, m_norm, max_points, is_long_answer)
        else:
            return self._grade_general_model(student_text, model_text, s_clean, m_syn, s_norm, m_norm, max_points, is_long_answer)

_GLOBAL_GRADER = None

def calculate_score(student_text: str, model_text: str, max_points: float, grading_mode: str = "general") -> Dict[str, Any]:
    global _GLOBAL_GRADER
    if _GLOBAL_GRADER is None: _GLOBAL_GRADER = UniversityGrader()
    return _GLOBAL_GRADER.grade(student_text, model_text, max_points, grading_mode)