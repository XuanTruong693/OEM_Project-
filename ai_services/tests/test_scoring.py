"""
Test cases for AI scoring logic
Run: pytest tests/test_scoring.py -v
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.nlp import calculate_score, normalize_text, string_similarity, extract_entities


class TestNormalizeText:
    """Test text normalization"""
    
    def test_exact_same(self):
        assert normalize_text("Xin chào") == normalize_text("Xin chào")
    
    def test_case_insensitive(self):
        assert normalize_text("HELLO") == normalize_text("hello")
    
    def test_punctuation_removed(self):
        assert normalize_text("ccnv.") == normalize_text("ccnv")
    
    def test_whitespace_normalized(self):
        assert normalize_text("xin   chào") == normalize_text("xin chào")
    
    def test_vietnamese_diacritics_preserved(self):
        assert "việt" in normalize_text("Việt Nam")


class TestStringSimilarity:
    """Test string similarity calculation"""
    
    def test_exact_match(self):
        assert string_similarity("ccnv.", "ccnv.") == 1.0
    
    def test_exact_match_with_spaces(self):
        assert string_similarity("Xin chào", "Xin chào") == 1.0
    
    def test_case_difference(self):
        assert string_similarity("Hello", "hello") == 1.0
    
    def test_partial_match(self):
        sim = string_similarity("Hà Nội", "Thủ đô Hà Nội")
        assert sim > 0.3  # Should have some overlap
    
    def test_no_match(self):
        sim = string_similarity("abc", "xyz")
        assert sim < 0.1


class TestCalculateScore:
    """Test the main scoring function"""
    
    # ===== EXACT MATCH CASES =====
    def test_exact_match_short(self):
        """Case: "ccnv." == "ccnv." should be 100%"""
        result = calculate_score("ccnv.", "ccnv.", 1.0)
        assert result["score"] == 1.0
        assert result["confidence"] == 1.0
        assert "Exact" in result["explanation"]
    
    def test_exact_match_vietnamese(self):
        """Case: "Xin chào" == "Xin chào" should be 100%"""
        result = calculate_score("Xin chào", "Xin chào", 1.0)
        assert result["score"] == 1.0
        assert result["confidence"] == 1.0
    
    def test_exact_match_with_punctuation(self):
        """Case: "Hello!" vs "Hello" should be 100% (punctuation ignored)"""
        result = calculate_score("Hello!", "Hello", 1.0)
        assert result["score"] == 1.0
    
    # ===== SHORT ANSWER CASES =====
    def test_short_different_answers(self):
        """Short but different answers should get low score"""
        result = calculate_score("abc", "xyz", 1.0)
        assert result["score"] < 0.3
    
    def test_short_partial_match(self):
        """Short partial match should get partial credit"""
        result = calculate_score("Việt Nam", "Nước Việt Nam", 1.0)
        assert result["score"] > 0.3
    
    # ===== SEMANTIC SIMILARITY CASES =====
    def test_semantic_similar_vietnamese(self):
        """Semantically similar Vietnamese text"""
        result = calculate_score(
            "Việt Nam là một quốc gia ở Đông Nam Á",
            "Việt Nam nằm ở khu vực Đông Nam Á",
            1.0
        )
        assert result["score"] > 0.5
    
    def test_semantic_different(self):
        """Semantically different text should get low score"""
        result = calculate_score(
            "Mèo là động vật có vú",
            "Toán học là môn khoa học cơ bản",
            1.0
        )
        assert result["score"] < 0.4
    
    # ===== DATE EXTRACTION CASES =====
    def test_date_match(self):
        """Same year should not be penalized"""
        result = calculate_score(
            "Sự kiện xảy ra năm 1945",
            "Năm 1945 là năm quan trọng",
            1.0
        )
        assert result["fact_multiplier"] == 1.0  # No date penalty
    
    def test_date_mismatch(self):
        """Wrong year should be penalized"""
        result = calculate_score(
            "Sự kiện xảy ra năm 1950",
            "Sự kiện xảy ra năm 1945",
            1.0
        )
        assert result["fact_multiplier"] < 1.0
    
    # ===== DYNASTY NAME (NOT LOCATION) CASES =====
    def test_dynasty_not_penalized_as_location(self):
        """Dynasty names like Trần should not be penalized as missing location"""
        result = calculate_score(
            "Lịch sử Việt Nam có 8 vị vua",
            "Trong lịch sử Việt Nam có 8 vị vua thuộc các triều đại Nguyễn, Lý, Trần, Lê",
            1.0
        )
        # Should not have location penalty in explanation
        assert "Missing location" not in result["explanation"]
    
    # ===== EDGE CASES =====
    def test_empty_student_answer(self):
        result = calculate_score("", "Some model answer", 1.0)
        assert result["score"] == 0.0
    
    def test_empty_model_answer(self):
        result = calculate_score("Some student answer", "", 1.0)
        assert result["score"] == 0.0
    
    def test_max_points_scaling(self):
        """Score should scale with max_points"""
        result1 = calculate_score("test", "test", 1.0)
        result2 = calculate_score("test", "test", 2.0)
        assert result2["score"] == result1["score"] * 2


class TestExtractEntities:
    """Test entity extraction"""
    
    def test_extract_year(self):
        entities = extract_entities("Năm 1945 là năm quan trọng")
        assert "1945" in entities["dates"]
    
    def test_extract_full_date(self):
        entities = extract_entities("Ngày 02/09/1945")
        assert "02/09/1945" in entities["dates"]
    
    def test_extract_text_date(self):
        entities = extract_entities("Ngày 2 tháng 9 năm 1945")
        assert "02/09/1945" in entities["dates"]


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
