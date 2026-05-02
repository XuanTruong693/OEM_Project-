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
from .faker_detector import is_meaningless_answer, is_copy_of_question
from .tokenizer import (
    ANTONYM_PAIRS, PASSIVE_MARKERS, HARD_LOCATIONS,
    expand_abbreviations, check_passive_voice, remove_vietnamese_diacritics,
    normalize_synonyms, normalize_code_snippets, deep_clean_text, strip_student_preamble,
    remove_safe_stopwords, normalize_units, normalize_number_format, SQL_CONTRADICTIONS,
    repair_text_for_ai, unicode_normalize
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
        
        # Cặp từ trái nghĩa đặc thù cho hệ thống OEM (Bẫy Case 1, 2, 3)
        self.custom_antonyms = {
            "không công bố ngay": ["hiển thị ngay", "công bố ngay", "hiển thị kết quả ngay", "biết điểm ngay", "hiển thị cho sinh viên ngay"],
            "không được công bố": ["hiển thị cho sinh viên", "hiển thị kết quả", "biết điểm", "công bố kết quả ngay"],
            "chưa hoàn toàn chính xác": ["đã đảm bảo độ chính xác cao", "hoàn toàn chính xác", "đã chính xác", "đảm bảo tính chính xác"],
            "cần xem xét": ["không cần xem xét", "bỏ qua xem xét", "xác nhận ngay"],
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

    def _chunk_into_sentences(self, text: str, split_connectors: bool = False) -> List[str]:
        if not text: return []
        chunks = [c.strip() for c in re.split(r'(?<=[.!?])\s+', text.strip()) if len(c.strip()) > 5]
        
        if split_connectors and len(chunks) <= 2:
            # Nếu câu quá dài và không có dấu chấm, nỗ lực chia nhỏ bằng liên từ để đánh giá từng vế
            connector_pattern = r'\s+(và|đồng thời|mà|nhằm|để|vốn là)\s+'
            parts = re.split(connector_pattern, text.strip())
            new_chunks = []
            current = ""
            for i, p in enumerate(parts):
                if i % 2 == 0: # Nội dung
                    current += p
                else: # Liên từ
                    if len(current.strip()) > 15: # Chỉ split nếu vế trước đủ dài
                        new_chunks.append(current.strip())
                        current = p + " "
                    else:
                        current += " " + p + " "
            if current.strip():
                new_chunks.append(current.strip())
            if len(new_chunks) > len(chunks):
                return [c for c in new_chunks if len(c) > 5]
        return chunks

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

    def _calculate_semantic_coverage(self, student_text: str, model_text: str) -> float:
        """Vector Semantic Coverage: So sánh bao phủ ngữ nghĩa bằng Bi-Encoder.
        Thay vì chỉ đếm từ khóa trùng nhau (string match), hàm này encode từng
        ý chính của đáp án mẫu thành vector, rồi tìm vùng ngữ nghĩa tương đương
        trong câu trả lời của sinh viên. Điều này cho phép sinh viên diễn đạt theo
        cách hiểu (paraphrase) mà vẫn được ghi nhận là 'bao phủ đúng ý'."""
        try:
            model_chunks = self._chunk_into_sentences(model_text, split_connectors=True) or [model_text]
            student_chunks = self._chunk_into_sentences(student_text, split_connectors=True) or [student_text]
            
            if not model_chunks or not student_chunks:
                return self._calculate_keyword_coverage(student_text, model_text)
            
            # Encode all chunks
            m_embs = [self.ai.bi_encoder.encode(c, convert_to_tensor=True) for c in model_chunks]
            s_embs = [self.ai.bi_encoder.encode(c, convert_to_tensor=True) for c in student_chunks]
            
            # For each model concept, find the best matching student chunk
            concept_scores = []
            for m_emb in m_embs:
                best_sim = max(util.cos_sim(m_emb, s_emb).item() for s_emb in s_embs)
                concept_scores.append(best_sim)
            
            # Concept is "covered" if similarity > 0.55 (soft threshold)
            covered = sum(1 for s in concept_scores if s >= 0.55)
            semantic_ratio = covered / len(concept_scores)
            
            # Blend: 60% semantic + 40% keyword (giữ keyword để chống hallucination)
            keyword_ratio = self._calculate_keyword_coverage(student_text, model_text)
            blended = 0.60 * semantic_ratio + 0.40 * keyword_ratio
            
            logger.debug(f"[SemanticCov] semantic={semantic_ratio:.2f} keyword={keyword_ratio:.2f} blended={blended:.2f}")
            return blended
        except Exception as e:
            logger.warning(f"[SemanticCov] Fallback to keyword: {e}")
            return self._calculate_keyword_coverage(student_text, model_text)

    def _calculate_keyword_coverage(self, student_text: str, model_text: str) -> float:
        """Keyword-based coverage (legacy fallback)."""
        m_kws = self._extract_keywords(model_text, min_len=1)
        s_kws = self._extract_keywords(student_text, min_len=1)
        return self._get_fuzzy_coverage(m_kws, s_kws)
        
    def _calculate_coverage_ratio(self, student_text: str, model_text: str) -> float:
        """Main coverage: sử dụng Semantic Coverage cho General mode."""
        return self._calculate_semantic_coverage(student_text, model_text)
    
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

    def _analyze_core_ideas(self, model_text: str, mode: str = "general") -> List[Dict[str, Any]]:
        # Đối với môn đại cương (general), ưu tiên chia nhỏ ý bằng liên từ if no periods
        split_conn = (mode == "general")
        chunks = self._chunk_into_sentences(model_text, split_connectors=split_conn) or [model_text]
        analyzed_chunks = []
        total_weight = 0
        for chunk in chunks:
            kws = self._extract_keywords(chunk, min_len=1)
            weight = len(kws) + 1  
            # Nếu vế câu dài hoặc chứa nhiều keyword
            is_core = len(kws) >= 3 or len(chunk.split()) > 6
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
            # Nếu phát hiện cấu trúc bị động, nới lỏng yêu cầu seq_ratio
            # Vì câu bị động đảo lộn hoàn toàn cấu trúc câu nhưng vẫn giữ đúng nghĩa.
            if self._contains_passive_markers(student_text) and seq_ratio >= 0.10:
                return False 
            return True
        return False

    def _check_directional_logic(self, student_text: str, model_text: str) -> Tuple[bool, str]:
        """
        [V27] Robust Directional Logic Check.
        Detects if the relationship direction A -> B is flipped to B -> A.
        Handles both explicit verbs (quyết định, tạo ra) and implicit roles (khuôn mẫu).
        """
        m_lower, s_lower = model_text.lower(), student_text.lower()
        
        # 1. Quan hệ Cha - Con (Special case)
        if "cha" in m_lower and "con" in m_lower and "cha" in s_lower and "con" in s_lower:
            m_cha, m_con = m_lower.find("cha"), m_lower.find("con")
            s_cha, s_con = s_lower.find("cha"), s_lower.find("con")
            if (m_cha < m_con and s_cha > s_con) or (m_cha > m_con and s_cha < s_con):
                return True, "quan hệ cha-con bị đảo ngược"

        # 2. Quan hệ Tác động / Quyết định / Tổng hợp (A -> B)
        # Danh sách các cặp từ khóa "Zero Tolerance" trong Triết học/Khoa học
        zero_tolerance_pairs = [
            ("vật chất", "ý thức"),
            ("mạch gốc", "marn"),
            ("adn", "marn"),
            ("cơ sở hạ tầng", "kiến trúc thượng tầng"),
            ("tồn tại xã hội", "ý thức xã hội")
        ]

        best_error = ""
        for verb in self.directional_verbs:
            if verb in m_lower and verb in s_lower:
                if self._contains_passive_markers(student_text): continue
                
                m_parts = m_lower.split(verb, 1)
                s_parts = s_lower.split(verb, 1)
                
                m_pre, m_post = m_parts[0], m_parts[1]
                s_pre, s_post = s_parts[0], s_parts[1]
                
                m_pre_kws = self._extract_keywords(m_pre)
                m_post_kws = self._extract_keywords(m_post)
                s_pre_kws = self._extract_keywords(s_pre)
                s_post_kws = self._extract_keywords(s_post)
                
                # Check swap using keywords
                if (m_pre_kws & s_post_kws) and (m_post_kws & s_pre_kws):
                    current_error = f"đảo ngược quan hệ '{verb}'"
                    # Check Zero Tolerance using raw text parts for multi-word support
                    for a, b in zero_tolerance_pairs:
                        # Check if a is in pre and b is in post (or vice versa) in model
                        # AND check if they are swapped in student
                        m_a_pre = a in m_pre; m_b_post = b in m_post
                        m_b_pre = b in m_pre; m_a_post = a in m_post
                        
                        s_a_post = a in s_post; s_b_pre = b in s_pre
                        s_b_post = b in s_post; s_a_pre = a in s_pre
                        
                        if (m_a_pre and m_b_post and s_a_post and s_b_pre) or \
                           (m_b_pre and m_a_post and s_b_post and s_a_pre):
                            return True, f"LỖI CHI MẠNG: Đảo ngược bản chất '{a}' và '{b}'"
                    
                    best_error = current_error
        
        if best_error:
            return True, best_error
        
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
        # [V7] GLOBAL LOGIC MESH: Kiểm tra mâu thuẫn toàn văn để bắt lỗi xuyên ý (Cross-idea)
        global_penalty_mult = 1.0
        global_feedback = []
        
        # 1. Quét mâu thuẫn từ trái nghĩa toàn văn
        s_lower, m_lower = student_text.lower(), model_text.lower()
        all_pairs = list(self.custom_antonyms.items()) + list(ANTONYM_PAIRS.items())
        
        trap_penalties = {
            "không công bố ngay": 0.50, # Case 1/2: Stronger hit for blatant lies (50% penalty)
            "không được công bố": 0.50,
            "cần xem xét": 0.85, 
            "chưa hoàn toàn chính xác": 0.80
        }

        for word_key, antonym_list in all_pairs:
            # Exclude common negation words from global full-text match
            if word_key in ["không", "có", "chưa"]: continue
            
            word_kws = word_key.split()
            if all(re.search(rf"\b{re.escape(wk)}\b", m_lower) for wk in word_kws):
                for ant_phrase in antonym_list:
                    if all(re.search(rf"\b{re.escape(ak)}\b", s_lower) for ak in ant_phrase.split()):
                        penalty = trap_penalties.get(word_key, 0.95)
                        global_penalty_mult = min(global_penalty_mult, penalty)
                        
                        # [V26] Nâng cấp AI Reasoning chi tiết
                        explanation_map = {
                            "không công bố ngay": "Cảnh báo bẫy logic: Hệ thống OEM Mini KHÔNG cho phép hiển thị điểm tự luận ngay lập tức. Câu trả lời của bạn mâu thuẫn với quy trình bảo mật điểm số.",
                            "không được công bố": "Lỗi quy trình: Điểm tự luận chỉ được công bố sau khi giảng viên duyệt. Việc khẳng định hiển thị ngay là sai bản chất hệ thống.",
                            "cần xem xét": "Mâu thuẫn trạng thái: Bạn nhầm lẫn giữa việc 'xác nhận ngay' và 'cần xem xét'. Hệ thống yêu cầu sự can thiệp của giảng viên.",
                            "chưa hoàn toàn chính xác": "Sai lệch mục đích: AI chỉ đóng vai trò gợi ý vì độ chính xác chưa tuyệt đối. Việc khẳng định AI đã chính xác cao là hiểu sai vai trò của công cụ."
                        }
                        msg = explanation_map.get(word_key, f"Mâu thuẫn logic: '{word_key}' vs '{ant_phrase}'.")
                        global_feedback.append(msg)
                        break
        
        # 3. NLI Toàn văn (Global Sense)
        g_label, g_conf = self.logic_analyzer.analyze(student_text, model_text)
        if g_label == 'contradiction' and g_conf > 0.80:
            global_penalty_mult = min(global_penalty_mult, 0.90)
            global_feedback.append("Nội dung tổng thể có dấu hiệu mâu thuẫn logic cao.")

        length_ratio = len(s_clean) / len(model_text) if len(model_text) > 0 else 0
        if is_long_answer and length_ratio < 0.4:
            return self._build_result(max_points * 0.30, f"Câu trả lời quá ngắn ({int(length_ratio*100)}% so với đáp án). Thiếu nhiều ý chính, chỉ chấm tối đa 30%.", "Partial")

        lev_ratio = SequenceMatcher(None, s_norm, m_norm).ratio()
        if lev_ratio >= 0.95: 
            res = self._build_result(max_points * global_penalty_mult, "Khớp hoàn toàn.", "Typo")
            if global_penalty_mult < 1.0: res['reasoning'] = " | ".join(global_feedback) + " || " + res['reasoning']
            return res

        # [AI Fast-Track (V3)] - Đặt sau Guardrails để không bị lừa bởi câu có từ vựng giống nhưng sai logic
        try:
            if self.ai.finetuned_encoder is not None:
                emb_model = self.ai.finetuned_encoder.encode(m_norm, convert_to_tensor=True)
                emb_student = self.ai.finetuned_encoder.encode(s_norm, convert_to_tensor=True)
                sim_score = util.cos_sim(emb_model, emb_student).item()
                if sim_score >= 0.93: return self._build_result(max_points, f"Khớp ý chính hoàn toàn (AI V3: {int(sim_score*100)}%).", "AI Fast-Track (V3)")
                if sim_score < 0.10: 
                    # V24: Total contradiction should get near-zero or very low score (10-20% max)
                    # This satisfies the "Total contradiction should be low/0" requirement
                    reason = f"Lỗi nghiêm trọng: Câu trả lời có xu hướng phủ định hoặc mâu thuẫn hoàn toàn với đáp án mẫu (Độ tương đồng AI V3: {int(sim_score*100)}%)."
                    return self._build_result(max_points * 0.15 * global_penalty_mult, reason, "Contradiction")
        except: pass

        model_ideas = self._analyze_core_ideas(m_norm, mode="general")
        student_chunks = self._chunk_into_sentences(s_norm, split_connectors=True) or [s_norm]
        student_kws = self._extract_keywords(s_norm, min_len=1)
        
        # [1. PHẦN TỔNG (Σ) - Khởi tạo]
        total_score = 0
        feedback_details = []
        is_fully_entailed = False
        
        # Tối ưu: Encode sẵn toàn bộ student chunks
        student_embs = [self.ai.bi_encoder.encode(s, convert_to_tensor=True) for s in student_chunks]
        
        # [Vòng lặp duyệt qua từng ý chính của đáp án mẫu]
        for i, idea in enumerate(model_ideas):
            chunk_max_points = max_points * idea["point_ratio"]
            m_chunk = idea["text"]
            
            # [s_i: Similarity Calculation]
            emb_m = self.ai.bi_encoder.encode(m_chunk, convert_to_tensor=True)
            best_sim_bi, best_s_chunk = -1, ""
            for idx, s_chunk in enumerate(student_chunks):
                sim = util.cos_sim(student_embs[idx], emb_m).item()
                if sim > best_sim_bi:
                    best_sim_bi, best_s_chunk = sim, s_chunk
            
            # [Tính toán các chỉ số phụ trước]
            chunk_kws_cov = self._get_fuzzy_coverage(idea["keywords"], student_kws)
            core_tag = "TRỌNG TÂM" if idea["is_core"] else "phụ"

            # [l_i: Logic Analysis & Dynamic Gate]
            logic_label, logic_conf = self.logic_analyzer.analyze(best_s_chunk, m_chunk)
            
            # CHỐT CHẶN MÂU THUẪN ĐỘNG (Dynamic Contradiction Gate)
            is_high_sim = best_sim_bi >= 0.60
            dynamic_threshold = self.config.dynamic_contra_high if is_high_sim else self.config.dynamic_contra_low

            # [V6] CƯỠNG CHẾ KIỂM TRA LOGIC CHO CÁC CÂU CÓ SIM CAO (Bẫy copy-paste)
            error_type = self.logic_analyzer.detect_logic_error_type(best_s_chunk, m_chunk)
            
            # Kiểm tra xem có trúng bẫy từ trái nghĩa đặc thù (custom_antonyms) không
            is_antonym_trap = False
            for word, ants in self.custom_antonyms.items():
                if word in m_chunk.lower():
                    for ant in ants:
                        if ant in best_s_chunk.lower():
                            is_antonym_trap = True
                            break
                if is_antonym_trap: break

            if (logic_label == 'contradiction' and logic_conf >= dynamic_threshold) or error_type != 'hard' or is_antonym_trap:
                # Nếu là mâu thuẫn cứng (Keyword thấp + NLI cao) -> 0 điểm
                if logic_label == 'contradiction' and logic_conf >= self.config.hard_contradiction_threshold and chunk_kws_cov < self.config.keyword_shield_threshold:
                    feedback_details.append(f"Ý {i+1} ({core_tag}): SAI BẢN CHẤT — Mâu thuẫn logic hoàn toàn (NLI={int(logic_conf*100)}%).")
                    logger.info(f"[Hard-Contradiction] Ý {i+1}: logic=contradiction, conf={logic_conf:.2f} -> Score 0")
                    continue
                
                # Áp dụng mức phạt linh hoạt
                penalty = 0.50 
                if is_antonym_trap: penalty = 0.25 # Case 1: hiển thị vs công bố -> Trừ 25%
                elif error_type == 'temporal': penalty = self.config.penalty_temporal
                elif error_type == 'causal': penalty = self.config.penalty_causal
                elif error_type == 'negation': penalty = self.config.penalty_negation
                
                penalty_score = best_sim_bi * (1 - penalty)
                total_score += chunk_max_points * penalty_score
                feedback_details.append(f"Ý {i+1} ({core_tag}): NHẦM LẪN — Đúng ý chính nhưng sai logic {error_type} (Trừ {int(penalty*100)}%).")
                logger.info(f"[Nuanced-Penalty] Ý {i+1}: error={error_type}, trap={is_antonym_trap} -> Final={penalty_score:.2f}")
                continue

            # [FAST-TRACK: ƯU TIÊN BI-ENCODER (Semantic First)]
            # Chỉ chốt điểm nhanh nếu không mâu thuẫn
            if best_sim_bi >= 0.65:
                bonus = 0.10 if chunk_kws_cov >= 0.60 else 0.0
                bi_final_score = min(1.0, best_sim_bi + bonus)
                total_score += chunk_max_points * bi_final_score
                feedback_details.append(f"Ý {i+1} ({core_tag}): ĐẠT (Hiểu ý - BiEnc {int(best_sim_bi*100)}%).")
                logger.info(f"[FastTrack-Bi-General] Ý {i+1}: BiEnc={best_sim_bi:.2f} >= 0.65 → CHỐT ĐIỂM")
                continue

            if best_s_chunk:
                rerank_prob = self.ai.reranker.predict([(best_s_chunk, m_chunk)])
                best_sim = float(rerank_prob[0])
            else:
                best_sim = 0.0

            # [l_i: Logic Analysis]
            logic_label, logic_conf = self.logic_analyzer.analyze(best_s_chunk, m_chunk)
            
            # Nới lỏng keyword cap nếu NLI cực kỳ tự tin (SV giỏi diễn đạt theo cách hiểu)
            if logic_label == 'entailment' and chunk_kws_cov < 0.60:
                if logic_conf >= 0.80:
                    # NLI rất tự tin SV nói đúng ý -> giữ entailment, chỉ giảm nhẹ sim
                    best_sim = max(best_sim, 0.75)
                    logger.debug(f"[NLI Override] Keeping entailment despite low kw_cov={chunk_kws_cov:.2f}, conf={logic_conf:.2f}")
                else:
                    logic_label = 'neutral'
            if idea["is_core"] and chunk_kws_cov < 0.60 and best_sim < 0.80 and logic_conf < 0.80:
                best_sim = min(best_sim, 0.65) 
            
            # Trích xuất ngắn gọn ý chính để hiển thị cho GV
            m_chunk_short = m_chunk[:50] + '...' if len(m_chunk) > 50 else m_chunk
            core_tag = "TRỌNG TÂM" if idea["is_core"] else "phụ"
            sim_pct = int(best_sim * 100)
            kw_pct = int(chunk_kws_cov * 100)
            
            if best_sim < 0.35:
                # [SEMANTIC RESCUE - 3 TẦNG PHÂN XỬ] cho General Pipeline
                if best_sim_bi >= 0.55 and chunk_kws_cov >= 0.45:
                    
                    if logic_label == 'contradiction' and logic_conf > 0.50:
                        feedback_details.append(f"Ý {i+1} ({core_tag}): NGƯỢC Ý — NLI phát hiện mâu thuẫn với '{m_chunk_short}' (NLI={int(logic_conf*100)}%).")
                        logger.info(f"[SemanticRescue-General] Ý {i+1}: BiEnc={best_sim_bi:.2f} nhưng NLI=contradiction → KHÔNG CỨU")
                        continue
                    elif logic_label == 'entailment':
                        rescue_score = (best_sim_bi * 0.60) + (chunk_kws_cov * 0.20) + (logic_conf * 0.20)
                        total_score += chunk_max_points * rescue_score
                        feedback_details.append(f"Ý {i+1} ({core_tag}): HIỂU Ý — Đúng bản chất '{m_chunk_short}' (NLI={int(logic_conf*100)}%, BiEnc={int(best_sim_bi*100)}%).")
                        logger.info(f"[SemanticRescue-General] Ý {i+1}: NLI=entailment + BiEnc={best_sim_bi:.2f} → rescue={rescue_score:.2f}")
                        continue
                    else:
                        rescue_score = (best_sim_bi * 0.50) + (chunk_kws_cov * 0.30)
                        total_score += chunk_max_points * rescue_score
                        feedback_details.append(f"Ý {i+1} ({core_tag}): CÓ LIÊN QUAN — Hiểu một phần '{m_chunk_short}' (BiEnc={int(best_sim_bi*100)}%, KW={kw_pct}%).")
                        logger.info(f"[SemanticRescue-General] Ý {i+1}: NLI=neutral + BiEnc={best_sim_bi:.2f} → partial={rescue_score:.2f}")
                        continue
                feedback_details.append(f"Ý {i+1} ({core_tag}): THIẾU — Không tìm thấy nội dung tương ứng với '{m_chunk_short}' (similarity {sim_pct}%, keywords {kw_pct}%).")
                continue
                
            if logic_label == 'contradiction' and logic_conf > 0.65 and not self._contains_passive_markers(best_s_chunk):
                s_chunk_short = best_s_chunk[:50] + '...' if len(best_s_chunk) > 50 else best_s_chunk
                feedback_details.append(f"Ý {i+1} ({core_tag}): NGƯỢC Ý — SV viết '{s_chunk_short}' nhưng đáp án yêu cầu '{m_chunk_short}' (NLI: contradiction {int(logic_conf*100)}%).")
                continue

            if logic_label == 'entailment' and logic_conf > 0.55:
                is_fully_entailed = True
                best_sim = max(best_sim, 0.90)

            # [f(s_i, l_i): Final chunk scoring]
            if best_sim >= 0.80:
                total_score += chunk_max_points
                feedback_details.append(f"Ý {i+1} ({core_tag}): ĐẠT — Khớp tốt với '{m_chunk_short}' (similarity {sim_pct}%, keywords {kw_pct}%).")
            elif best_sim >= 0.40:
                boost_factor = 1.3 if chunk_kws_cov >= 0.65 else 1.0 
                if chunk_kws_cov < 0.65:
                    best_sim = min(best_sim, 0.65)
                earned = chunk_max_points * min(1.0, best_sim * boost_factor)
                total_score += earned
                if chunk_kws_cov >= 0.60:
                    feedback_details.append(f"Ý {i+1} ({core_tag}): KHÁ — Đúng hướng nhưng chưa đầy đủ '{m_chunk_short}' (similarity {sim_pct}%, keywords {kw_pct}%).")
                else:
                    feedback_details.append(f"Ý {i+1} ({core_tag}): THIẾU TỪ KHÓA — Có đề cập nhưng thiếu thuật ngữ quan trọng cho '{m_chunk_short}' (similarity {sim_pct}%, keywords {kw_pct}%).")
            else:
                total_score += chunk_max_points * (best_sim * 0.6)
                feedback_details.append(f"Ý {i+1} ({core_tag}): MỜ NHẠT — Đề cập rất sơ sài '{m_chunk_short}' (similarity {sim_pct}%, keywords {kw_pct}%).")

        # [2. HỆ SỐ BAO PHỦ C (Coverage Factor)]
        coverage_ratio = self._calculate_coverage_ratio(s_norm, m_norm) 
        base_ratio = total_score / max_points if max_points > 0 else 0
        coverage_multiplier = 1.0
        
        # Nếu NLI đã xác nhận entailment HOẶC đa số ý đã đạt tốt
        if is_fully_entailed and coverage_ratio >= 0.25:
            coverage_multiplier = 1.0
            feedback_details.append(f"(Chấp nhận diễn đạt tương đương - NLI confirmed)")
        elif base_ratio >= 0.60 and coverage_ratio >= 0.25:
            coverage_multiplier = max(0.85, min(1.0, coverage_ratio + 0.35))
            feedback_details.append(f"(Diễn đạt theo cách hiểu, coverage semantic: {int(coverage_ratio*100)}%)")
        else:
            # SIẾT CHẶT COVERAGE CHO GENERAL MODE: Social Science requires precision
            if coverage_ratio < 0.15: coverage_multiplier = 0.10 
            elif coverage_ratio < 0.35: coverage_multiplier = 0.40 
            elif coverage_ratio < 0.55: coverage_multiplier = 0.70
            elif coverage_ratio < 0.70: coverage_multiplier = 0.78
            elif coverage_ratio < 0.85: coverage_multiplier = 0.88
            elif coverage_ratio < 0.95: coverage_multiplier = 0.95

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
             # [V11] Áp dụng hình phạt toàn cục ngay cả khi khớp chính xác không dấu
             penalized_score = max_points * global_penalty_mult
             explanation = "Khớp chính xác (Bao gồm đồng bộ dấu Tiếng Việt)."
             if global_penalty_mult < 1.0:
                 explanation = " | ".join(global_feedback) + " || " + explanation
             return self._build_result(penalized_score, explanation, "Exact Match")

        if diac_ratio >= 0.85 and (final_score / max_points) < 0.85 and final_score > 0:
            final_score = max(final_score, max_points * 0.75)
            # Không quên nhân penalty ở đây nếu cần (thường typo ko dính logic nặng)
            final_score *= global_penalty_mult 
            return self._build_result(final_score, "Đúng ý nhưng sai lỗi chính tả.", "Typo")

        # [V25] Final Penalty Application & Absolute Cap for Logic Traps
        final_score *= global_penalty_mult
        
        # Nếu dính bẫy logic nặng (Custom Antonyms), ép điểm tối đa xuống 50%
        if global_penalty_mult <= 0.60:
            final_score = min(final_score, max_points * 0.50)
            
        feedback = " | ".join(feedback_details)
        
        if global_penalty_mult < 1.0:
            feedback = " | ".join(global_feedback) + " || Detail: " + feedback
            
        return self._build_result(final_score, feedback, "Paraphrase" if final_score >= max_points * 0.7 else "Partial")

    # =========================================================================
    # MODEL 2: KỸ THUẬT (TECHNICAL PIPELINE)
    # =========================================================================
    def _grade_technical_model(self, student_text: str, model_text: str, s_clean: str, m_syn: str, s_norm: str, m_norm: str, max_points: float, is_long_answer: bool) -> Dict[str, Any]:
        strong_code = r"(def\s+__init__|\bclass\s+\w+|public\s+class|\bvoid\s+\w+|#include|<iostream>|std::)"
        generic_code = r"([{}();]|\breturn\b|=>|->|//|/\*.*\*/)"
        
        is_model_code = bool(re.search(strong_code, model_text)) or len(re.findall(generic_code, model_text)) >= 2
        
        # [V12] UNIFIED GLOBAL LOGIC MESH (Technical)
        global_penalty_mult = 1.0
        global_feedback = []
        
        # 1. Kiểm tra mâu thuẫn từ trái nghĩa đặc thù (Technical)
        s_lower, m_lower = student_text.lower(), model_text.lower()
        all_tech_pairs = list(self.custom_antonyms.items())
        
        # [V25] Synchronized penalties for technical
        trap_penalties = {
            "không công bố ngay": 0.50,
            "không được công bố": 0.50,
            "cần xem xét": 0.85, 
            "chưa hoàn toàn chính xác": 0.80
        }

        for word_key, antonym_list in all_tech_pairs:
            word_kws = word_key.split()
            if all(re.search(rf"\b{re.escape(wk)}\b", m_lower) for wk in word_kws):
                for ant_phrase in antonym_list:
                    if all(re.search(rf"\b{re.escape(ak)}\b", s_lower) for ak in ant_phrase.split()):
                        penalty = trap_penalties.get(word_key, 0.75)
                        global_penalty_mult = min(global_penalty_mult, penalty)
                        global_feedback.append(f"Kỹ thuật: Mâu thuẫn '{word_key}' vs '{ant_phrase}'.")
                        break

        # 2. Kiểm tra đảo ngược thứ tự quy trình (OEM Specific / Technical)
        is_rev, verb = self._check_directional_logic(student_text, model_text)
        if is_rev:
            penalty = 0.25 # Phạt 75%
            if "LỖI CHI MẠNG" in verb:
                penalty = 0.10 # Phạt 90%
            global_penalty_mult = min(global_penalty_mult, penalty)
            global_feedback.append(f"Kỹ thuật: {verb}.")

        # 3. Kiểm tra đảo ngược thứ tự quy trình (Sequence)
        pub_keywords = ["công bố", "hiển thị", "publish", "public"]
        audit_keywords = ["phê duyệt", "xem xét", "kiểm duyệt", "audit", "approve"]
        s_pub_pos = min([s_lower.find(k) for k in pub_keywords if k in s_lower] + [float('inf')])
        s_audit_pos = min([s_lower.find(k) for k in audit_keywords if k in s_lower] + [float('inf')])
        
        m_pub_pos = min([m_lower.find(k) for k in pub_keywords if k in m_lower] + [float('inf')])
        m_audit_pos = min([m_lower.find(k) for k in audit_keywords if k in m_lower] + [float('inf')])
        
        if s_pub_pos != float('inf') and s_audit_pos != float('inf') and m_pub_pos != float('inf') and m_audit_pos != float('inf'):
            s_order = s_pub_pos < s_audit_pos # SV: Công bố trước xem xét
            m_order = m_pub_pos < m_audit_pos # Model: Công bố sau xem xét (m_order is False)
            
            if s_order != m_order:
                global_penalty_mult = min(global_penalty_mult, 1.0 - self.config.penalty_temporal)
                global_feedback.append("Kỹ thuật: Sai thứ tự quy trình.")
                logger.warning("[Global-Temporal-Tech] Procedural reversal detected via position analysis")

        # 3. NLI Toàn văn cho Technical
        g_label, g_conf = self.logic_analyzer.analyze(student_text, model_text)
        if g_label == 'contradiction' and g_conf > 0.85:
            global_penalty_mult = min(global_penalty_mult, 0.70)
            global_feedback.append("Kỹ thuật: Tổng thể nội dung mâu thuẫn logic.")
        is_student_code = bool(re.search(strong_code, student_text)) or len(re.findall(generic_code, student_text)) >= 2
        is_any_code = is_model_code or is_student_code
        
        if is_any_code:
            tech_result = self.code_analyzer.grade(model_text, student_text, max_points)
            if tech_result:
                # [V11] Áp dụng hình phạt toàn cục ngay cả khi CodeAnalyzer trả về điểm
                penalized_score = tech_result["score"] * global_penalty_mult
                explanation = tech_result["explanation"]
                if global_penalty_mult < 1.0:
                    explanation = " | ".join(global_feedback) + " || Detail: " + explanation
                return self._build_result(penalized_score, explanation, tech_result["type"])
            
        s_code, m_code = student_text.strip().rstrip(":"), model_text.strip().rstrip(":")
        try:
            if ast.dump(ast.parse(s_code)) == ast.dump(ast.parse(m_code)):
                # Áp dụng hình phạt cho AST match
                penalized_score = max_points * global_penalty_mult
                explanation = "Biểu thức code tương đương logic (AST)."
                if global_penalty_mult < 1.0:
                    explanation = " | ".join(global_feedback) + " || " + explanation
                return self._build_result(penalized_score, explanation, "AST Match")
        except Exception: pass 

        is_rev, verb = self._check_directional_logic(student_text, model_text)
        if is_rev: 
            penalized_score = (max_points * 0.10) * global_penalty_mult
            return self._build_result(penalized_score, f"Đảo ngược logic OOP/Code ('{verb}').", "Logic Reversal")

        length_ratio = len(s_clean) / len(model_text) if len(model_text) > 0 else 0
        if is_long_answer and length_ratio < 0.4: return self._build_result(max_points * 0.3, "Câu trả lời lý thuyết quá ngắn.", "Partial")
        
        lev_ratio = SequenceMatcher(None, s_norm, m_norm).ratio()
        if lev_ratio >= 0.95: 
            res = self._build_result(max_points * global_penalty_mult, "Khớp hoàn toàn.", "Typo")
            if global_penalty_mult < 1.0: res['reasoning'] = " | ".join(global_feedback) + " || " + res['reasoning']
            return res

        model_ideas = self._analyze_core_ideas(m_norm, mode="technical")
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
            
            # [Tính toán các chỉ số phụ trước để phục vụ Fast-track]
            # Tính Coverage THÔNG MINH (Fuzzy Coverage) thay vì khớp tuyệt đối
            chunk_kws_cov = self._get_fuzzy_coverage(idea["keywords"], student_kws)
            # [SCORING THRESHOLDS]
            is_strict = len(m_chunk) < 15 or len(m_chunk.split()) <= 2

            # [l_i: Logic Analysis & Dynamic Gate]
            logic_label, logic_conf = self.logic_analyzer.analyze(best_s_chunk, m_chunk)
            
            # CƯỠNG CHẾ KIỂM TRA LOGIC
            error_type = self.logic_analyzer.detect_logic_error_type(best_s_chunk, m_chunk)
            
            # Kiểm tra xem có trúng bẫy từ trái nghĩa đặc thù (custom_antonyms) không
            is_antonym_trap = False
            for word, ants in self.custom_antonyms.items():
                if word in m_chunk.lower():
                    for ant in ants:
                        if ant in best_s_chunk.lower():
                            is_antonym_trap = True
                            break
                if is_antonym_trap: break

            # CHỐT CHẶN MÂU THUẪN ĐỘNG (Dynamic Contradiction Gate)
            is_high_sim = best_sim_bi >= 0.60
            dynamic_threshold = self.config.dynamic_contra_high if is_high_sim else self.config.dynamic_contra_low
            
            if (logic_label == 'contradiction' and logic_conf >= dynamic_threshold) or error_type != 'hard' or is_antonym_trap:
                # [V27] KHÁNH KIỆT LOGIC TRONG CODE/TECHNICAL
                # Nếu là Code và NLI báo mâu thuẫn -> Kiểm tra lại bằng Bi-Encoder
                # NLI thường hiểu nhầm đổi tên hàm là mâu thuẫn.
                if is_any_code and logic_conf < 0.95:
                    if best_sim_bi >= 0.50: # Hạ ngưỡng rescue cho code xuống 0.50
                        feedback_details.append(f"Ý {i+1}: Chấp nhận biến thể Code (BiEnc {int(best_sim_bi*100)}%).")
                        total_score += chunk_max_points * max(best_sim_bi, 0.85) # Thưởng điểm vì hiểu bản chất
                        continue

                # Nếu NLI cực cao (>85%) và Keyword thấp -> Sai hoàn toàn (0 điểm)
                if logic_label == 'contradiction' and logic_conf >= self.config.hard_contradiction_threshold and chunk_kws_cov < self.config.keyword_shield_threshold:
                    feedback_details.append(f"Ý {i+1}: Sai hoàn toàn bản chất (Mâu thuẫn {int(logic_conf*100)}%).")
                    logger.info(f"[Hard-Contradiction-Tech] Ý {i+1}: logic=contradiction, conf={logic_conf:.2f} -> Score 0")
                    if idea["is_core"]: global_penalty_mult = 0.0
                    continue
                
                # Áp dụng mức phạt linh hoạt
                penalty = 0.50 
                if is_antonym_trap: penalty = 0.25
                elif error_type == 'temporal': penalty = self.config.penalty_temporal
                elif error_type == 'causal': penalty = self.config.penalty_causal
                elif error_type == 'negation': penalty = self.config.penalty_negation
                
                penalty_score = best_sim_bi * (1 - penalty)
                total_score += chunk_max_points * penalty_score
                feedback_details.append(f"Ý {i+1}: Nhầm lẫn logic {error_type} (Trừ {int(penalty*100)}%).")
                continue

            # [FAST-TRACK: ƯU TIÊN BI-ENCODER (Semantic First)]
            # Nếu Bi-Encoder thấy tương đồng cao (>=65%), chốt điểm ngay + điểm thưởng
            if best_sim_bi >= 0.65 and not is_strict:
                # Tính điểm dựa trên Bi-Encoder + Bonus dựa trên Keyword Coverage
                bonus = 0.15 if chunk_kws_cov >= 0.60 else 0.0
                bi_final_score = min(1.0, best_sim_bi + bonus)
                total_score += chunk_max_points * bi_final_score
                feedback_details.append(f"Ý {i+1}: Tốt (Diễn đạt tương đương - BiEnc {int(best_sim_bi*100)}%).")
                logger.info(f"[FastTrack-Bi-Tech] Ý {i+1}: BiEnc={best_sim_bi:.2f} >= 0.65 → CHỐT ĐIỂM")
                continue

            # Nếu Bi-Encoder < ngưỡng ưu tiên, đưa xuống 2 tầng còn lại để phân tích sâu
            # B2: Dùng Cross-Encoder (Reranker) để tính điểm chính xác
            if best_s_chunk:
                rerank_prob = self.ai.reranker.predict([(best_s_chunk, m_chunk)])
                best_sim = float(rerank_prob[0])
            else:
                best_sim = 0.0

            # Bật NLI để nhận diện sinh viên giải thích đúng bản chất dù khác từ
            # [l_i: Kiểm tra tầng Logic NLI để điều chỉnh điểm]
            logic_label, logic_conf = self.logic_analyzer.analyze(best_s_chunk, m_chunk)
            min_sim_threshold = 0.65 if is_strict else 0.45 
            min_kws_threshold = 0.60 if is_strict else 0.40

            if best_sim < min_sim_threshold or (best_sim < (min_sim_threshold + 0.1) and chunk_kws_cov < min_kws_threshold):
                if best_sim_bi >= 0.70 and chunk_kws_cov >= 0.70 and not is_strict:
                    if logic_label == 'contradiction' and logic_conf > 0.65:
                        feedback_details.append(f"Ý {i+1}: Sai bản chất kỹ thuật (NLI={logic_conf:.0%}).")
                        continue
                    elif logic_label == 'entailment':
                        rescue_score = (best_sim_bi * 0.40) + (logic_conf * 0.60)
                        total_score += chunk_max_points * rescue_score
                        feedback_details.append(f"Ý {i+1}: Tương đồng logic (NLI={logic_conf:.0%}).")
                        continue
                    else:
                        feedback_details.append(f"Ý {i+1}: Thiếu từ khóa kỹ thuật then chốt.")
                        continue
                feedback_details.append(f"Ý {i+1} (QUAN TRỌNG): Thiếu thuật ngữ/cú pháp." if idea["is_core"] else f"Ý {i+1}: Thiếu.")
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

        # [V25] Final Technical Formula - Ensure absolute cap for logic violations
        final_score = total_score * coverage_multiplier * babble_penalty * global_penalty_mult
        
        # Chốt chặn tuyệt đối cho lỗi kỹ thuật logic
        if global_penalty_mult <= 0.60:
            final_score = min(final_score, max_points * 0.50)
            
        if global_penalty_mult < 1.0:
            final_explanation = " | ".join(global_feedback) + " || Detail: " + " | ".join(feedback_details)
        else:
            final_explanation = " | ".join(feedback_details)

        diac_ratio = self._get_diacritic_ratio(s_clean, model_text)
        s_no_diac = remove_vietnamese_diacritics(s_clean).lower()
        m_no_diac = remove_vietnamese_diacritics(model_text).lower()

        if s_no_diac == m_no_diac:
             # Neutralizing diacritic penalty
             res = self._build_result(max_points, "Khớp chính xác (Bao gồm đồng bộ dấu Tiếng Việt).", "Exact Match")
             res['score'] *= global_penalty_mult
             if global_penalty_mult < 1.0: res['reasoning'] = " | ".join(global_feedback) + " || " + res['reasoning']
             return res

        if diac_ratio >= 0.85 and (final_score / max_points) < 0.85 and final_score > 0:
            final_score = max(final_score, max_points * 0.75)
            final_score *= global_penalty_mult
            return self._build_result(final_score, "Đúng ý nhưng sai lỗi chính tả.", "Typo")

        if coverage_multiplier < 1.0 and not is_model_code: final_explanation += f" (Coverage thấp: {int(coverage_ratio*100)}%)"
        return self._build_result(final_score, final_explanation, "Technical Model")

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
        is_faker, reason = is_meaningless_answer(student_text, model_text, question_text)
        if is_faker:
            return self._build_result(0, f"Reasoning: {reason}. Không chấm điểm cho câu trả lời đối phó.", "Faker")

        # AUTO-SWITCH LOGIC: Respect instructor mode, but switch for specific content mismatch
        is_actually_tech = self.code_analyzer.is_technical_answer(student_text) or self.code_analyzer.is_technical_answer(model_text)
        
        # 1. Mode General: Switch to Technical ONLY if code/SQL is found.
        # 2. Mode Technical: Switch to General ONLY if PURE theory (no code/SQL) is found.
        
        original_mode = grading_mode
        if grading_mode == "general":
            if is_actually_tech:
                grading_mode = "technical"
                logger.info(f"General mode selected, but Technical content detected. TEMPORARILY switching to technical for this question.")
        elif grading_mode == "technical":
            if not is_actually_tech:
                grading_mode = "general"
                logger.info(f"Technical mode selected, but Pure Theory detected. TEMPORARILY switching to general for this question.")
        elif grading_mode in [None, "", "auto"]:
            grading_mode = "technical" if is_actually_tech else "general"
            logger.info(f"Auto-detecting mode: {grading_mode}")
        
        if original_mode != grading_mode:
            logger.info(f"Mode adjusted: {original_mode} -> {grading_mode}")
        else:
            logger.info(f"Using instructor-selected mode: {grading_mode}")

        # === 2. KEYWORD SPAM GUARD ===
        s_words = student_text.strip().lower().split()
        m_words = model_text.strip().lower().split()
        if len(m_words) > 15 and len(s_words) <= 2:
            sql_keywords = {"select", "from", "where", "join", "update", "delete", "create", "insert"}
            if all(w in sql_keywords for w in s_words):
                return self._build_result(0, "Reasoning: Câu trả lời quá ngắn (chỉ chứa từ khóa khung). Không đủ dữ kiện để chấm điểm logic.", "SpamGuard")

        # === 3. WORD SALAD GUARD (Structural Check) ===
        if not is_actually_tech:
            if self._is_word_salad(student_text, model_text):
                return self._build_result(0.0, "Phát hiện nhồi từ vô nghĩa (Word Salad). Không thành câu hoàn chỉnh.", "WordSalad")

        # === 4. PREPARE INPUTS ===
        # s_norm: Dùng cho Keyword Coverage và Heuristics (đã chuẩn hóa mạnh, gọt dấu phụ)
        s_norm = self._standardize_text(student_text, grading_mode)
        m_norm = self._standardize_text(model_text, grading_mode)
        
        # s_ai: Dùng cho Transformer (Sbert, NLI, Reranker) - Giữ dấu, sửa lỗi viết tắt
        s_ai = repair_text_for_ai(student_text)
        m_ai = repair_text_for_ai(model_text)
        
        s_code_norm, m_code_norm = normalize_code_snippets(student_text), normalize_code_snippets(model_text)
        s_clean = self.logic_analyzer.preprocess(s_code_norm)
        m_syn = normalize_synonyms(m_code_norm)
        is_long_answer = len(model_text) > 300

        # Exact match (Standardized)
        if s_norm == m_norm: 
            return self._build_result(max_points, "Khớp chính xác tuyệt đối (Logic & Keywords).", "Exact")

        # 6. Branching based on Grading Mode (Mandatory Isolation)
        if grading_mode == "technical":
            res = self._grade_technical_pipeline(s_ai, m_ai, s_clean, m_syn, s_norm, m_norm, max_points, is_long_answer)
        else:
            res = self._grade_general_pipeline(s_ai, m_ai, s_clean, m_syn, s_norm, m_norm, max_points, is_long_answer)
        return res

    def _grade_technical_pipeline(self, student_text: str, model_text: str, s_clean: str, m_syn: str, s_norm: str, m_norm: str, max_points: float, is_long_answer: bool):
        # (Faker detection already handled in _grade_single_option)

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
        res = self._grade_technical_model(student_text, model_text, s_clean, m_syn, s_norm, m_norm, max_points, is_long_answer)
        
        # [V27] Apply Zero Tolerance Cap for Technical Reversals
        is_rev, verb = self._check_directional_logic(student_text, model_text)
        if is_rev and "LỖI CHI MẠNG" in verb:
            max_allowed = max_points * self.config.zero_tolerance_cap
            if res["score"] > max_allowed:
                res["score"] = max_allowed
                res["explanation"] = f"LỖI CHI MẠNG: {verb}. " + res["explanation"]
        
        return res

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

        # D. AI Fast-Track (V3) đã được di chuyển vào trong _grade_general_model để đứng sau Logic Guardrails

        # E. Detailed General Model
        res = self._grade_general_model(student_text, model_text, s_clean, m_syn, s_norm, m_norm, max_points, is_long_answer)
        
        # [V27] Apply Zero Tolerance Cap for General Reversals (Philosophy/Science)
        is_rev, verb = self._check_directional_logic(student_text, model_text)
        if is_rev and "LỖI CHI MẠNG" in verb:
            max_allowed = max_points * self.config.zero_tolerance_cap
            if res["score"] > max_allowed:
                res["score"] = max_allowed
                res["explanation"] = f"LỖI CHI MẠNG: {verb}. " + res["explanation"]
        
        return res

_GLOBAL_GRADER = None

def calculate_score(student_text: str, model_text: str, max_points: float, grading_mode: str = "general", question_text: str = None) -> Dict[str, Any]:
    global _GLOBAL_GRADER
    if _GLOBAL_GRADER is None: _GLOBAL_GRADER = UniversityGrader()
    return _GLOBAL_GRADER.grade(student_text, model_text, max_points, grading_mode, question_text)