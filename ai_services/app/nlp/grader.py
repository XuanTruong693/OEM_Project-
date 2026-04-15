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
from .similarity import string_similarity, calculate_keyword_match, fuzzy_contains, fuzzy_match
from .faker_detector import is_meaningless_answer
from .tokenizer import (
    ANTONYM_PAIRS, PASSIVE_MARKERS, HARD_LOCATIONS,
    expand_abbreviations, check_passive_voice, remove_vietnamese_diacritics,
    normalize_synonyms, normalize_code_snippets, deep_clean_text,
    remove_safe_stopwords, normalize_units, normalize_number_format, SQL_CONTRADICTIONS
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
            "dẫn đến", "phụ thuộc", "lệ thuộc", "kế thừa", "thống trị", "kiểm soát", "điều chỉnh",
            # Sinh học / Khoa học
            "tổng hợp", "phiên mã", "dịch mã", "tạo nên", "sản xuất", "chuyển hóa",
            "mã hóa", "biểu hiện", "điều hòa", "tiết ra", "kích thích", "ức chế",
            "làm khuôn mẫu", "làm khuôn",
            # Hóa học
            "phản ứng với", "oxi hóa", "khử",
            # Vật lý
            "truyền", "chuyển hóa thành", "biến đổi thành",
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
            "constructor": "hàm tạo", "khởi tạo": "hàm tạo",
            "parameter": "tham số", "input parameters": "tham số",
            "procedure": "thủ tục", "stored procedure": "thủ tục",
            "trigger": "trình kích hoạt", "bộ kích hoạt": "trình kích hoạt"
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
        text_lower = deep_clean_text(text_lower)
        text_lower = expand_abbreviations(text_lower)
        text_lower = " ".join(normalize_synonyms(text_lower).split())
        
        syn_dict = self.technical_synonyms if mode == "technical" else self.general_synonyms
        for alias, standard in syn_dict.items():
            text_lower = text_lower.replace(alias, standard)
        return text_lower
    
    def _extract_keywords(self, text: str, min_len: int = 1) -> Set[str]:
        words = re.findall(r'[a-zA-Z0-9À-ỹ_]+', text.lower())
        from .tokenizer import SAFE_STOPWORDS
        stopwords = {"là", "và", "của", "có", "các", "một", "được", "trong", "đã", "để", "này", "theo", "với", "không", "cho", "sự", "những", "bởi", "do", "ra", "từ", "vốn"}
        stopwords.update(SAFE_STOPWORDS)
        return {w for w in words if len(w) >= min_len and w not in stopwords}

    def _chunk_into_sentences(self, text: str) -> List[str]:
        if not text: return []
        return [c.strip() for c in re.split(r'(?<=[.!?])\s+', text.strip()) if len(c.strip()) > 5]

    def _get_fuzzy_coverage(self, m_kws: Set[str], s_kws: Set[str]) -> float:
        if not m_kws: return 1.0
        
        matched = 0
        for m_kw in m_kws:
            # Exact match
            if m_kw in s_kws:
                matched += 1
                continue
            # Fuzzy match (cho phép typo / từ gần giống)
            for s_kw in s_kws:
                if fuzzy_match(m_kw, s_kw, threshold=0.75):
                    matched += 1
                    break
        
        return matched / len(m_kws)
        
    def _calculate_coverage_ratio(self, student_text: str, model_text: str) -> float:
        m_kws = self._extract_keywords(model_text, min_len=1)
        s_kws = self._extract_keywords(student_text, min_len=1)
        return self._get_fuzzy_coverage(m_kws, s_kws)
    
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

    def _check_sql_hard_contradiction(self, student_text: str, model_text: str) -> bool:
        """Kiểm tra xem sinh viên có dùng từ khóa mâu thuẫn ngược lại hoàn toàn không."""
        s_u, m_u = student_text.upper(), model_text.upper()
        
        for m_word, opposites in SQL_CONTRADICTIONS.items():
            if m_word in m_u:
                for opp in opposites:
                    pattern = rf"\b{re.escape(opp)}\b"
                    if re.search(pattern, s_u):
                        return True
        return False

    def _sigmoid(self, x: float) -> float:
        """Normalizes Reranker logits to [0, 1] range."""
        return 1 / (1 + np.exp(-x))

    def _build_result(self, score: float, explanation: str, result_type: str) -> Dict[str, Any]:
        return {"score": round(score, 2), "explanation": explanation, "type": result_type, "confidence": 1.0, "fact_multiplier": 1.0}

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
        if kw_overlap > 0.65 and seq_ratio < 0.50:
            # Nếu phát hiện cấu trúc bị động (được, bởi), nới lỏng yêu cầu seq_ratio
            # Vì câu bị động đảo lộn hoàn toàn cấu trúc câu nhưng vẫn giữ đúng nghĩa.
            if self._contains_passive_markers(student_text) and seq_ratio >= 0.10:
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

    def _check_template_reversal(self, student_text: str, model_text: str) -> bool:
        """Phát hiện đảo chiều pattern: 'A làm khuôn/mẫu để tổng hợp B' vs 'B làm khuôn tổng hợp A'."""
        template_pattern = re.compile(
            r'(\b[A-Za-zÀ-ỹ]+\b)\s+(?:làm\s+khuôn(?:\s+mẫu)?|là\s+khuôn)\s+(?:để\s+)?(?:tổng\s+hợp|tạo(?:\s+nên)?|sản\s+xuất)\s+(?:nên\s+)?(?:phân\s+tử\s+)?(\b[A-Za-zÀ-ỹ]+\b)',
            re.IGNORECASE
        )
        m_match = template_pattern.search(model_text)
        s_match = template_pattern.search(student_text)
        
        if m_match and s_match:
            m_source, m_target = m_match.group(1).lower(), m_match.group(2).lower()
            s_source, s_target = s_match.group(1).lower(), s_match.group(2).lower()
            # Nếu A→B trong model nhưng B→A trong student → đảo chiều
            if m_source == s_target and m_target == s_source:
                return True
        return False

    def _check_numeric_with_units(self, student_text: str, model_text: str, max_points: float):
        # Chuẩn hóa cả 2 bên
        s_norm = normalize_units(normalize_number_format(student_text.lower()))
        m_norm = normalize_units(normalize_number_format(model_text.lower()))
        
        # Extract số
        s_nums = set()
        for x in re.findall(r'-?\d+(?:\.\d+)?', s_norm):
            try: s_nums.add(float(x))
            except: pass
        m_nums = set()
        for x in re.findall(r'-?\d+(?:\.\d+)?', m_norm):
            try: m_nums.add(float(x))
            except: pass
        
        # Chỉ áp dụng khi model answer chủ yếu là số + đơn vị
        if not m_nums:
            return None
        s_units = set(re.findall(r'[a-zA-Z°/²³]+', re.sub(r'[\d.]+', '', s_norm).strip()))
        m_units = set(re.findall(r'[a-zA-Z°/²³]+', re.sub(r'[\d.]+', '', m_norm).strip()))
        
        from .tokenizer import UNIT_MAPPINGS
        m_real_units = {u for u in m_units if u in UNIT_MAPPINGS.values() or u in UNIT_MAPPINGS.keys()}
        s_real_units = {u for u in s_units if u in UNIT_MAPPINGS.values() or u in UNIT_MAPPINGS.keys()}
        
        nums_match = s_nums == m_nums or m_nums.issubset(s_nums)
        # Bỏ qua các từ vựng filler nếu model_answer không chứa đơn vị chính quy
        units_match = bool(s_real_units & m_real_units) or (not m_real_units)
        
        if nums_match and units_match:
            return self._build_result(max_points, "Đáp án số + đơn vị chính xác.", "Exact")
        elif nums_match and not units_match:
            return self._build_result(max_points * 0.8, "Số đúng, đơn vị khác format.", "Partial")
        return None

    def _check_antonym_contradiction(self, student_text: str, model_text: str) -> bool:
        s_lower, m_lower = student_text.lower(), model_text.lower()
        all_antonyms = {**ANTONYM_PAIRS, **self.custom_antonyms}
        for word, antonyms in all_antonyms.items():
            if word in m_lower:
                for ant in antonyms:
                    if ant in s_lower:
                        if ant in m_lower and word in s_lower:
                            continue
                        return True
        return False

    # =========================================================================
    # MODEL 1: ĐẠI CƯƠNG (GENERAL PIPELINE)
    # =========================================================================
    def _grade_general_model(self, student_text: str, model_text: str, s_clean: str, m_syn: str, s_norm: str, m_norm: str, max_points: float, is_long_answer: bool) -> Dict[str, Any]:
        if self._check_template_reversal(student_text, model_text):
            return self._build_result(0.0, "Đảo ngược chiều logic (A tổng hợp B vs B tổng hợp A).", "Logic Reversal")
        is_rev, verb = self._check_directional_logic(student_text, model_text)
        if is_rev: return self._build_result(max_points * 0.10, f"Đảo ngược logic ('{verb}').", "Logic Reversal")

        length_ratio = len(s_clean) / len(model_text) if len(model_text) > 0 else 0
        if is_long_answer and length_ratio < 0.4:
            return self._build_result(max_points * 0.30, "Câu trả lời quá ngắn.", "Partial")

        lev_ratio = SequenceMatcher(None, s_norm, m_norm).ratio()
        if lev_ratio >= 0.95: return self._build_result(max_points, "Khớp hoàn toàn.", "Typo")

        model_ideas = self._analyze_core_ideas(m_norm)
        student_chunks = self._chunk_into_sentences(s_norm) or [s_norm]
        student_kws = self._extract_keywords(s_norm, min_len=1)
        
        # [1. PHẦN TỔNG (Σ) - Khởi tạo]
        total_score = 0
        feedback_details = []
        is_fully_entailed = False
        
        # [Vòng lặp duyệt qua từng ý chính của đáp án mẫu]
        for i, idea in enumerate(model_ideas):
            chunk_max_points = max_points * idea["point_ratio"]
            m_chunk = idea["text"]
            # [s_i: Tính toán độ tương đồng (Similarity) bằng Cross-Encoder Reranker]
            # B1: Tìm chunk tiềm năng nhất bằng Bi-Encoder (nhanh)
            emb_m = self.ai.bi_encoder.encode(m_chunk, convert_to_tensor=True)
            best_sim_bi, best_s_chunk = -1, ""
            for s_chunk in student_chunks:
                sim = util.cos_sim(self.ai.bi_encoder.encode(s_chunk, convert_to_tensor=True), emb_m).item()
                if sim > best_sim_bi: best_sim_bi, best_s_chunk = sim, s_chunk
            
            # B2: Cải tế: Dùng Cross-Encoder (Reranker) để tính điểm chính xác cho cặp câu này
            # Đây là bước "đưa cả 2 câu vào cùng lúc"
            if best_s_chunk:
                rerank_prob = self.ai.reranker.predict([(best_s_chunk, m_chunk)])
                best_sim = float(rerank_prob[0])
            else:
                best_sim = 0.0

            # [l_i: Kiểm tra tầng Logic NLI để điều chỉnh điểm]
            # (Giữ nguyên NLI để check mâu thuẫn/confirm)
            logic_label, logic_conf = self.logic_analyzer.analyze(best_s_chunk, m_chunk)
            chunk_kws_cov = self._get_fuzzy_coverage(idea["keywords"], student_kws)
            
            if logic_label == 'entailment' and chunk_kws_cov < 0.60: logic_label = 'neutral' 
            # Safe Guard: Nếu thiếu từ khóa cốt lõi, không cho phép đạt điểm Tốt (Capped at Khá)
            if idea["is_core"] and chunk_kws_cov < 0.60 and best_sim < 0.80: best_sim = min(best_sim, 0.65) 
            
            if best_sim < 0.35:
                feedback_details.append(f"Ý {i+1} (TRỌNG TÂM): Thiếu." if idea["is_core"] else f"Ý {i+1}: Thiếu.")
                continue
                
            if logic_label == 'contradiction' and logic_conf > 0.65 and not self._contains_passive_markers(best_s_chunk):
                feedback_details.append(f"Ý {i+1}: Ngược ý.")
                continue

            if logic_label == 'entailment' and logic_conf > 0.55:
                is_fully_entailed = True
                best_sim = max(best_sim, 0.90)

            # [f(s_i, l_i): Tổng hợp điểm cho từng ý (Ý chính có trọng số point_ratio)]
            if best_sim >= 0.80:
                total_score += chunk_max_points; feedback_details.append(f"Ý {i+1}: Tốt.")
            elif best_sim >= 0.40:
                boost_factor = 1.3 if chunk_kws_cov >= 0.65 else 1.0 
                if chunk_kws_cov < 0.65:
                    best_sim = min(best_sim, 0.65)
                total_score += chunk_max_points * min(1.0, best_sim * boost_factor)
                feedback_details.append(f"Ý {i+1}: Khá." if chunk_kws_cov >= 0.60 else f"Ý {i+1}: Thiếu vế/keyword.")
            else:
                total_score += chunk_max_points * (best_sim * 0.6); feedback_details.append(f"Ý {i+1}: Mờ nhạt.")

        # [2. HỆ SỐ BAO PHỦ C (Coverage Factor)]
        coverage_ratio = self._calculate_coverage_ratio(s_norm, m_norm) 
        base_ratio = total_score / max_points if max_points > 0 else 0
        coverage_multiplier = 1.0
        
        if (is_fully_entailed or base_ratio >= 0.75) and coverage_ratio >= 0.65:
            coverage_multiplier = 1.0
            feedback_details.append(f"(Chấp nhận diễn đạt tương đương)")
        else:
            if coverage_ratio < 0.20: coverage_multiplier = 0.40 
            elif coverage_ratio < 0.40: coverage_multiplier = 0.60 
            elif coverage_ratio < 0.60: coverage_multiplier = 0.80
            elif coverage_ratio < 0.80: coverage_multiplier = 0.90
            elif coverage_ratio < 0.90: coverage_multiplier = 0.95

        # [3. HỆ SỐ PHẠT B (Babble Penalty)]
        babble_penalty = 1.0
        if len(student_chunks) > len(model_ideas):
            penalty = min(0.6, (len(student_chunks) - len(model_ideas)) * 0.15)
            babble_penalty = 1.0 - penalty
            feedback_details.append(f"(Trừ {int(penalty*100)}% lan man)")
            
        # [4. CÔNG THỨC TỔNG HỢP CUỐI CÙNG (Final Score)]
        final_score = total_score * coverage_multiplier * babble_penalty

        if self._is_number_mismatch(student_text, model_text):
            final_score = min(final_score, max_points * 0.50)
            feedback_details.append("(Sai số liệu/Năm)")

        diac_ratio = self._get_diacritic_ratio(s_clean, model_text)
        s_no_diac = remove_vietnamese_diacritics(s_clean).lower()
        m_no_diac = remove_vietnamese_diacritics(model_text).lower()

        if s_no_diac == m_no_diac:
             # Neutralizing diacritic penalty (Tham số vs tham so match 100%)
             return self._build_result(max_points, "Khớp chính xác (Bao gồm đồng bộ dấu Tiếng Việt).", "Exact Match")

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
        strong_code = r"(def\s+__init__|\bclass\s+\w+|public\s+class|\bvoid\s+\w+|#include|<iostream>|std::)"
        generic_code = r"([{}();]|\breturn\b|=>|->|//|/\*.*\*/)"
        
        is_model_code = bool(re.search(strong_code, model_text)) or len(re.findall(generic_code, model_text)) >= 2
        is_student_code = bool(re.search(strong_code, student_text)) or len(re.findall(generic_code, student_text)) >= 2
        
        if is_model_code or is_student_code:
            tech_result = self.code_analyzer.grade(model_text, student_text, max_points)
            if tech_result:
                # Nếu code_analyzer trả về điểm (kể cả 0), return
                return self._build_result(tech_result["score"], tech_result["explanation"], tech_result["type"])
            
        s_code, m_code = student_text.strip().rstrip(":"), model_text.strip().rstrip(":")
        try:
            if ast.dump(ast.parse(s_code)) == ast.dump(ast.parse(m_code)):
                return self._build_result(max_points, "Biểu thức code tương đương logic (AST).", "AST Match")
        except Exception: pass 

        is_rev, verb = self._check_directional_logic(student_text, model_text)
        if is_rev: return self._build_result(max_points * 0.10, f"Đảo ngược logic OOP/Code ('{verb}').", "Logic Reversal")

        length_ratio = len(s_clean) / len(model_text) if len(model_text) > 0 else 0
        if is_long_answer and length_ratio < 0.4: return self._build_result(max_points * 0.3, "Câu trả lời lý thuyết quá ngắn.", "Partial")
        
        lev_ratio = SequenceMatcher(None, s_norm, m_norm).ratio()
        if lev_ratio >= 0.95: return self._build_result(max_points, "Khớp hoàn toàn.", "Typo")

        model_ideas = self._analyze_core_ideas(m_norm)
        student_chunks = self._chunk_into_sentences(s_norm) or [s_norm]
        student_kws = self._extract_keywords(s_norm, min_len=1)
        
        # [1. PHẦN TỔNG (Σ) - Khởi tạo Technical]
        total_score = 0
        feedback_details = []
        is_fully_entailed = False
        
        # [Vòng lặp duyệt qua từng ý chính của đáp án mẫu]
        for i, idea in enumerate(model_ideas):
            chunk_max_points = max_points * idea["point_ratio"]
            m_chunk = idea["text"]
            
            # [s_i: Tính toán độ tương đồng (Similarity) bằng Cross-Encoder Reranker]
            # B1: Tìm chunk tiềm năng nhất bằng Bi-Encoder (nhanh)
            emb_m = self.ai.bi_encoder.encode(m_chunk, convert_to_tensor=True)
            best_sim_bi, best_s_chunk = -1, ""
            for s_chunk in student_chunks:
                sim = util.cos_sim(self.ai.bi_encoder.encode(s_chunk, convert_to_tensor=True), emb_m).item()
                if sim > best_sim_bi: best_sim_bi, best_s_chunk = sim, s_chunk
            
            # B2: Dùng Cross-Encoder (Reranker) để tính điểm chính xác
            if best_s_chunk:
                rerank_prob = self.ai.reranker.predict([(best_s_chunk, m_chunk)])
                best_sim = float(rerank_prob[0])
            else:
                best_sim = 0.0

            # Bật NLI để nhận diện sinh viên giải thích đúng bản chất dù khác từ
            # [l_i: Kiểm tra tầng Logic NLI để điều chỉnh điểm]
            logic_label, logic_conf = self.logic_analyzer.analyze(best_s_chunk, m_chunk)
            
            # Tính Coverage THÔNG MINH (Fuzzy Coverage) thay vì khớp tuyệt đối
            chunk_kws_cov = self._get_fuzzy_coverage(idea["keywords"], student_kws)
            
            if (is_model_code or is_student_code):
                best_sim = min(1.0, best_sim * 1.3) # Thưởng nóng Code Snippet (Điều chỉnh tỷ lệ cho Cross-Encoder)
                
            if logic_label == 'entailment' and logic_conf > 0.50:
                if chunk_kws_cov < 0.65 and not is_model_code:
                    is_fully_entailed = False
                    best_sim = max(best_sim, 0.60)
                else:
                    is_fully_entailed = True
                    best_sim = max(best_sim, 0.85)

            is_any_code = is_model_code or is_student_code
            
            # [SCORING THRESHOLDS]
            is_strict = len(m_chunk) < 15 or len(m_chunk.split()) <= 2
            min_sim_threshold = 0.50 if is_strict else 0.25
            min_kws_threshold = 0.40 if is_strict else 0.20

            if best_sim < min_sim_threshold or (best_sim < (min_sim_threshold + 0.1) and chunk_kws_cov < min_kws_threshold):
                feedback_details.append(f"Ý {i+1} (QUAN TRỌNG): Thiếu thuật ngữ." if idea["is_core"] else f"Ý {i+1}: Thiếu.")
                continue

            # f(s_i, l_i): Tổng hợp điểm cho từng ý (Ý chính có trọng số points_ratio)
            if best_sim >= 0.70:
                total_score += chunk_max_points; feedback_details.append(f"Ý {i+1}: Tốt." if not is_any_code else f"Ý {i+1}: Tốt (Code).")
            elif best_sim >= 0.45:
                if is_strict and chunk_kws_cov < 0.5:
                    # Rất nghiêm ngặt với keyword ngắn: Sim cao nhưng KW thấp -> Không cho điểm khá
                    total_score += chunk_max_points * (best_sim * 0.3)
                    feedback_details.append(f"Ý {i+1}: Sai thuật ngữ kỹ thuật.")
                else:
                    # Boost cho các câu trả lời diễn đạt theo ý hiểu (IT Paraphrase)
                    boost_factor = 1.2 if chunk_kws_cov >= 0.50 else 1.0
                    best_sim_boosted = min(1.0, best_sim * boost_factor)
                    total_score += chunk_max_points * best_sim_boosted
                    feedback_details.append(f"Ý {i+1}: Khá." if chunk_kws_cov >= 0.50 else f"Ý {i+1}: Thiếu thuật ngữ kỹ thuật.")
            else:
                # Fallback cho Technical (Không nới tay cho Keyword ngắn)
                fallback_weight = 0.1 if is_strict else 0.5
                total_score += chunk_max_points * (best_sim * fallback_weight)
                feedback_details.append(f"Ý {i+1}: Lập luận kỹ thuật yếu.")
        # [2. HỆ SỐ BAO PHỦ C (Coverage Factor)]
        coverage_ratio = self._calculate_coverage_ratio(s_norm, m_norm)
        base_ratio = total_score / max_points if max_points > 0 else 0
        coverage_multiplier = 1.0
        
        if not is_model_code:
            if is_fully_entailed or base_ratio >= 0.80:
                coverage_multiplier = 1.0
                feedback_details.append(f"(Hiểu đúng bản chất)")
        # Quy trình gán hệ số nhân C dựa trên tỷ lệ bao phủ
            else:
                if coverage_ratio < 0.10: coverage_multiplier = 0.0  # Technical: No keywords = No points
                elif coverage_ratio < 0.30: coverage_multiplier = 0.30
                elif coverage_ratio < 0.50: coverage_multiplier = 0.60
                elif coverage_ratio < 0.70: coverage_multiplier = 0.80
                elif coverage_ratio < 0.90: coverage_multiplier = 0.95
        # Hệ số Phạt B (Lan man)
        babble_penalty = 1.0
        if len(student_chunks) > len(model_ideas):
            penalty = min(0.6, (len(student_chunks) - len(model_ideas)) * 0.15)
            babble_penalty = 1.0 - penalty
            feedback_details.append(f"(Trừ {int(penalty*100)}% lan man)")
        if self._check_sql_hard_contradiction(s_norm, m_norm):
             return self._build_result(0.0, "Sai hoàn toàn bản chất hoặc mâu thuẫn từ khóa (VD: AFTER vs INSTEAD OF).", "Hard Contradiction")

        # Công thức tổng hợp Cuối cùng
        final_score = total_score * coverage_multiplier * babble_penalty

        if self._is_number_mismatch(student_text, model_text) and not (is_model_code or is_student_code):
            final_score = min(final_score, max_points * 0.50)
            feedback_details.append("(Sai thông số/số liệu cốt lõi)")

        diac_ratio = self._get_diacritic_ratio(s_clean, model_text)
        s_no_diac = remove_vietnamese_diacritics(s_clean).lower()
        m_no_diac = remove_vietnamese_diacritics(model_text).lower()

        if s_no_diac == m_no_diac:
             # Neutralizing diacritic penalty (Tham số vs tham so match 100%)
             return self._build_result(max_points, "Khớp chính xác (Bao gồm đồng bộ dấu Tiếng Việt).", "Exact Match")

        if diac_ratio >= 0.85 and (final_score / max_points) < 0.85:
            final_score = max(final_score, max_points * 0.75)
            return self._build_result(final_score, "Đúng ý nhưng sai lỗi chính tả.", "Typo")

        feedback = " | ".join(feedback_details)
        if coverage_multiplier < 1.0 and not is_model_code: feedback += f" (Coverage thấp: {int(coverage_ratio*100)}%)"
        return self._build_result(final_score, feedback, "Technical Model")

    # =========================================================================
    # ROUTER ĐIỀU HƯỚNG TỪ API 
    # =========================================================================
    def grade(self, student_text: str, model_text: str, max_points: float, grading_mode: str = "general", question_text: str = None) -> Dict[str, Any]:
        if not student_text or not model_text: return self._build_result(0.0, "Missing input text.", "None")
        
        # === STEP -1: PLACEHOLDER / KHÔNG TRẢ LỜI ===
        from .faker_detector import NO_ANSWER_PLACEHOLDERS, is_meaningless_answer, is_copy_of_question
        
        if student_text.strip().lower() in NO_ANSWER_PLACEHOLDERS:
            logger.info(f"[No Answer] Score=0.0 | Placeholder: '{student_text.strip()[:50]}'")
            return self._build_result(0.0, "Sinh viên chưa trả lời câu này.", "Không trả lời")

        # === STEP -0.5: COPY ĐỀ BÀI ===
        if question_text:
            is_copy, copy_reason = is_copy_of_question(student_text, question_text)
            if is_copy:
                logger.info(f"[Copy Question] Score=0.0 | Reason: {copy_reason}")
                return self._build_result(0.0, f"Sinh viên copy lại câu hỏi: {copy_reason}", "Copy Question")

        # === STEP -0.4: FAKER / MEANINGLESS CHECK ===
        is_faker, faker_reason = is_meaningless_answer(student_text)
        is_tech = self.code_analyzer.is_technical_answer(student_text) or self.code_analyzer.is_technical_answer(model_text)

        if is_faker:
            # Nếu là technical answer (SQL/Code/Math) và bị chặn vì các lý do "lành tính" của SV yếu -> Bỏ qua faker block
            f_reason_l = faker_reason.lower()
            if is_tech and any(k in f_reason_l for k in ["quá ngắn", "vô nghĩa", "nhồi nhét", "spam"]):
                logger.info(f"[Faker Bypass] Technical candidate detected ({faker_reason}), bypassing faker block: '{student_text[:50]}'")
            else:
                logger.info(f"[Faker Block] Score=0.0 | Reason: {faker_reason} | Text: '{student_text[:50]}'")
                return self._build_result(0.0, f"Reasoning: {faker_reason}. Không chấm điểm cho câu trả lời đối phó.", "Đối phó")

        # === SUPPORT ALTERNATIVE MODEL ANSWERS (;) ===
        # Do not split Code or SQL by semicolon, as it breaks syntax structure
        m_type = self.code_analyzer.detect_answer_type(model_text)
        if m_type in ["code", "sql"]:
            model_options = [model_text.strip()]
        else:
            model_options = [opt.strip() for opt in model_text.split(';') if opt.strip()]
        
        if len(model_options) > 1:
            best_result = None
            for opt in model_options:
                res = self._grade_single_option(student_text, opt, max_points, grading_mode, question_text)
                if best_result is None or res['score'] > best_result['score']:
                    best_result = res
            return best_result
        
        return self._grade_single_option(student_text, model_text, max_points, grading_mode, question_text)

    def _grade_single_option(self, student_text: str, model_text: str, max_points: float, grading_mode: str, question_text: str = None) -> Dict[str, Any]:
        # === 1. FAKER DETECTION (With model context) ===
        is_faker, reason = is_meaningless_answer(student_text, model_text)
        if is_faker:
            return self._build_result(0, f"Reasoning: {reason}. Không chấm điểm cho câu trả lời đối phó.", "Faker")

        # === 2. KEYWORD SPAM GUARD ===
        s_words = student_text.strip().lower().split()
        m_words = model_text.strip().lower().split()
        if len(m_words) > 15 and len(s_words) <= 2:
            sql_keywords = {"select", "from", "where", "join", "update", "delete", "create", "insert"}
            if all(w in sql_keywords for w in s_words):
                return self._build_result(0, "Reasoning: Câu trả lời quá ngắn (chỉ chứa từ khóa khung). Không đủ dữ kiện để chấm điểm logic.", "SpamGuard")

        # === 3. WORD SALAD GUARD (Structural Check) ===
        if not (self.code_analyzer.is_technical_answer(student_text) or self.code_analyzer.is_technical_answer(model_text)):
            if self._is_word_salad(student_text, model_text):
                return self._build_result(0.0, "Phát hiện nhồi từ vô nghĩa (Word Salad). Không thành câu hoàn chỉnh.", "WordSalad")

        s_norm = self._standardize_text(student_text, grading_mode)
        m_norm = self._standardize_text(model_text, grading_mode)
        
        s_code_norm, m_code_norm = normalize_code_snippets(student_text), normalize_code_snippets(model_text)
        s_clean = self.logic_analyzer.preprocess(s_code_norm)
        m_syn = normalize_synonyms(m_code_norm)
        is_long_answer = len(model_text) > 300

        # Exact match (Standardized)
        if s_norm == m_norm: 
            return self._build_result(max_points, "Khớp chính xác tuyệt đối (Logic & Keywords).", "Exact")

        # 6. Branching based on Grading Mode (Mandatory Isolation)
        if grading_mode == "technical":
            res = self._grade_technical_pipeline(student_text, model_text, s_clean, m_syn, s_norm, m_norm, max_points, is_long_answer)
        else:
            res = self._grade_general_pipeline(student_text, model_text, s_clean, m_syn, s_norm, m_norm, max_points, is_long_answer)
        return res

    def _grade_technical_pipeline(self, student_text: str, model_text: str, s_clean: str, m_syn: str, s_norm: str, m_norm: str, max_points: float, is_long_answer: bool):
        is_faker, reason = is_meaningless_answer(student_text, model_text)
        if is_faker:
            return self._build_result(0, f"Reasoning: {reason}. Không chấm điểm cho câu trả lời đối phó.", "Faker")

        s_words = student_text.strip().lower().split()
        m_words = model_text.strip().lower().split()
        if len(m_words) > 5 and len(s_words) <= 2:
            sql_keywords = {"select", "from", "where", "join", "update", "delete", "create", "insert", "select*from"}
            if all(w in sql_keywords for w in s_words):
                return self._build_result(0, "Reasoning: Câu trả lời quá ngắn (chỉ chứa từ khóa khung). Không đủ dữ kiện để chấm điểm logic.", "SpamGuard")

        # B. Technical Dataset Learning (ML Feedback Loop)
        try:
            from app.dataset_learning import find_similar_to_grading
            dataset_result = find_similar_to_grading(student_text, model_text, max_points)
            if dataset_result and dataset_result.get("score") is not None:
                # Require high confidence for dataset match in technical mode
                if dataset_result.get('confidence', 0) >= 0.98 or dataset_result.get('type') == 'Dataset Match (Exact)':
                    reasoning = dataset_result['feedback']
                    # Nếu feedback chỉ là mặc định, thêm hậu tố để phân biệt nguồn
                    if reasoning == "Learned Pattern (Instructor Confirmed)":
                        reasoning += " (AI Technical Dataset)"
                    return self._build_result(dataset_result['score'], reasoning, "Dataset Match")
        except: pass

        # B. Code / Math / SQL Analyzer (Direct Structural/Logic Analysis)
        if self.code_analyzer:
            analyzer_result = self.code_analyzer.grade(model_text, student_text, max_points)
            if analyzer_result:
                return self._build_result(
                    analyzer_result["score"], 
                    analyzer_result["explanation"], 
                    analyzer_result.get("type", "Code/Technical Analysis")
                )

        # C. Detailed Technical Model (Deep analysis of keywords, structure, and symbols)
        return self._grade_technical_model(student_text, model_text, s_clean, m_syn, s_norm, m_norm, max_points, is_long_answer)

    def _grade_general_pipeline(self, student_text: str, model_text: str, s_clean: str, m_syn: str, s_norm: str, m_norm: str, max_points: float, is_long_answer: bool):
        # A. Numeric + Units Shortcut
        unit_result = self._check_numeric_with_units(student_text, model_text, max_points)
        if unit_result: return unit_result
        
        # B. Pure Math Shortcut (Heuristic)
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
                if m_nums == s_nums:
                    return self._build_result(max_points, "Đáp án toán chính xác.", "Exact")
                elif m_nums.issubset(s_nums):
                    if len(s_nums) > len(m_nums) + 1: 
                        return self._build_result(max_points * 0.5, "Chứa đáp án đúng nhưng dư thừa số liệu.", "Partial Math")
                    return self._build_result(max_points * 0.9, "Đáp án toán chính xác.", "Exact")
                else:
                    return self._build_result(0.0, "Kết quả toán học sai.", "Wrong")

        # C. Dataset Learning
        try:
            from app.dataset_learning import find_similar_to_grading
            dataset_result = find_similar_to_grading(student_text, model_text, max_points)
            if dataset_result and dataset_result.get("score") is not None:
                return self._build_result(dataset_result['score'], f"{dataset_result['feedback']} (AI learned)", "Dataset Match")
        except: pass

        # D. AI Fast-Track (V3)
        try:
            if self.ai.finetuned_encoder is not None:
                emb_model = self.ai.finetuned_encoder.encode(m_norm, convert_to_tensor=True)
                emb_student = self.ai.finetuned_encoder.encode(s_norm, convert_to_tensor=True)
                sim_score = util.cos_sim(emb_model, emb_student).item()
                
                # Tightened thresholds for Fast-Track
                if sim_score >= 0.93:
                    return self._build_result(max_points, f"Khớp ý chính hoàn toàn (AI V3: {int(sim_score*100)}%).", "AI Fast-Track (V3)")
                elif sim_score < 0.10:
                    return self._build_result(0.0, f"Dữ liệu sai lệch hoàn toàn (AI V3: {int(sim_score*100)}%).", "Contradiction")
        except: pass

        # E. Detailed General Model
        return self._grade_general_model(student_text, model_text, s_clean, m_syn, s_norm, m_norm, max_points, is_long_answer)

_GLOBAL_GRADER = None

def calculate_score(student_text: str, model_text: str, max_points: float, grading_mode: str = "general", question_text: str = None) -> Dict[str, Any]:
    global _GLOBAL_GRADER
    if _GLOBAL_GRADER is None: _GLOBAL_GRADER = UniversityGrader()
    return _GLOBAL_GRADER.grade(student_text, model_text, max_points, grading_mode, question_text)