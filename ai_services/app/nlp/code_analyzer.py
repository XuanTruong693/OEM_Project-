"""
code_analyzer.py
Specialized analysis module for Code/Math/SQL answers.

Implements divide-and-conquer grading strategy:
1. Detect answer type (code, math, SQL, text)
2. Apply specialized analysis per type
3. Return grading result or None to let main grader handle

Supports:
- Python code (functions, algorithms)
- SQL queries
- Mathematical expressions
"""

import re
import difflib
import logging
from typing import Tuple, Dict, Any, Optional, List, Set

logger = logging.getLogger(__name__)


class CodeAnalyzer:
    def __init__(self):
        # CODE PATTERNS (Python, JavaScript, Java, C)
        self.code_indicators = [
            # Python
            r"\bdef\s+\w+\s*\(",
            r"\breturn\b",
            r"\bfor\s+\w+\s+in\b",
            r"\bif\s+.+:",
            r"\bwhile\s+.+:",
            r"\bclass\s+\w+",
            r"\bimport\s+\w+",
            r"\bfrom\s+\w+\s+import",
            r"\blambda\s+",
            r"\bprint\s*\(",
            # JavaScript
            r"\bfunction\s+\w+\s*\(",
            r"\bconst\s+\w+\s*=",
            r"\blet\s+\w+\s*=",
            r"\bvar\s+\w+\s*=",
            r"=>\s*{",
            r"console\.log\s*\(",
            # Java/C
            r"\bpublic\s+(static\s+)?void\b",
            r"\bprivate\s+\w+\b",
            r"\bint\s+\w+\s*=",
            r"\bString\s+\w+\s*=",
            r"System\.out\.print",
        ]
        
        # SQL PATTERNS
        self.sql_indicators = [
            r"\bSELECT\b.*\bFROM\b",
            r"\bINSERT\s+INTO\b",
            r"\bUPDATE\b.*\bSET\b",
            r"\bDELETE\s+FROM\b",
            r"\bCREATE\s+TABLE\b",
            r"\bDROP\s+TABLE\b",
            r"\bALTER\s+TABLE\b",
            r"\bJOIN\b.*\bON\b",
            r"\bWHERE\b",
            r"\bGROUP\s+BY\b",
            r"\bORDER\s+BY\b",
            r"\bHAVING\b",
        ]
        
        # MATH PATTERNS
        self.math_indicators = [
            r"[xyz]\s*=\s*[\d\-+*/()]+",  # x = expression
            r"f\s*\(\s*[xyz]\s*\)\s*=",    # f(x) =
            r"\b\d+\s*[+\-*/^]\s*\d+",     # basic arithmetic
            r"\\frac\{",                    # LaTeX fraction
            r"\\sqrt\{",                    # LaTeX sqrt
            r"\bsin\b|\bcos\b|\btan\b",    # trig functions
            r"\blog\b|\bln\b",             # logarithms
            r"\blim\b|\bsum\b|\bint\b",    # calculus
            r"\d+\s*[kmcμ]?m\b",           # units
            r"\d+\s*km/h\b|\d+\s*m/s\b",   # speed units
        ]
        
        # FUNCTION TYPE PATTERNS
        self.function_patterns = {
            "factorial": {
                "names": ["giai_thua", "factorial", "tinh_giai_thua", "giaithua"],
                "patterns": [
                    r"n\s*\*\s*\w+\s*\(\s*n\s*-\s*1\s*\)",  # n * f(n-1)
                    r"for\s+\w+\s+in\s+range\s*\(\s*1\s*,\s*n",  # for i in range(1, n...
                    r"result\s*\*=\s*\w+",  # result *= i
                    r"result\s*=\s*result\s*\*\s*\w+", # result = result * i
                ],
                "anti_patterns": [
                    r"\+=",  # Sum pattern (unless unrelated)
                ]
            },
            "sum": {
                "names": ["tong", "sum", "tinh_tong", "tinhtong", "total"],
                "patterns": [
                    r"\+=",
                    r"total\s*\+",
                    r"sum\s*\(",
                    r"sum\s*=\s*sum\s*\+",
                ],
                "anti_patterns": [
                    r"\*=",  # Factorial pattern
                    r"n\s*-\s*1\s*\)",  # Recursion pattern
                ]
            },
            "fibonacci": {
                "names": ["fibo", "fibonacci", "fib"],
                "patterns": [
                    r"n\s*-\s*1.*n\s*-\s*2",
                    r"\w+\s*\(\s*n\s*-\s*1\s*\)\s*\+\s*\w+\s*\(\s*n\s*-\s*2\s*\)",
                ],
                "anti_patterns": []
            },
            "prime": {
                "names": ["prime", "so_nguyen_to", "nguyen_to", "is_prime"],
                "patterns": [
                    r"n\s*%\s*\w+\s*==\s*0",
                    r"for\s+\w+\s+in\s+range\s*\(\s*2\s*,",
                ],
                "anti_patterns": []
            },
            "sort": {
                "names": ["sort", "sap_xep", "sapxep", "bubble", "quick", "merge"],
                "patterns": [
                    r"\.sort\s*\(",
                    r"sorted\s*\(",
                    r"swap",
                    r"\[\s*\w+\s*\]\s*,\s*\[\s*\w+\s*\]",
                ],
                "anti_patterns": []
            },
            "search": {
                "names": ["search", "tim_kiem", "timkiem", "binary", "linear"],
                "patterns": [
                    r"mid\s*=",
                    r"low\s*=.*high\s*=",
                    r"if\s+\w+\s*==\s*target",
                ],
                "anti_patterns": []
            }
        }
        
        # CRITICAL LOGIC ERROR PATTERNS
        self.logic_errors = [
            {
                # Only match if preceded by function call-like syntax or return
                "pattern": r"(?:\w+\s*\(|return\s+.*)\s*n\s*\+\s*1\s*\)",
                "context": "factorial",
                "type": "infinite_recursion",
                "message": "Sử dụng n+1 thay vì n-1 gây đệ quy vô hạn"
            },
            {
                "pattern": r"n\s*\*\s*2",
                "context": "factorial",
                "type": "wrong_operation",
                "message": "Nhân với 2 thay vì nhân với n"
            },
            {
                "pattern": r"return\s+0\s*$",
                "context": "factorial",
                "type": "wrong_base_case",
                "message": "Base case trả về 0 thay vì 1"
            },
            {
                "pattern": r"result\s*=\s*0",
                "context": "factorial",
                "type": "wrong_init",
                "message": "Khởi tạo result = 0 thay vì 1 cho phép nhân"
            },
        ]
        
        # SQL ELEMENT PATTERNS
        self.sql_elements = {
            "select_cols": r"SELECT\s+(.+?)\s+FROM",
            "from_table": r"FROM\s+(\w+)",
            "where_clause": r"WHERE\s+(.+?)(?:GROUP|ORDER|HAVING|LIMIT|$)",
            "join_clause": r"(LEFT|RIGHT|INNER|OUTER)?\s*JOIN\s+(\w+)\s+ON\s+(.+?)(?:WHERE|GROUP|ORDER|$)",
            "group_by": r"GROUP\s+BY\s+(.+?)(?:HAVING|ORDER|LIMIT|$)",
            "order_by": r"ORDER\s+BY\s+(.+?)(?:LIMIT|$)",
        }

    # TYPE DETECTION METHODS
    
    def detect_answer_type(self, text: str) -> str:
        """
        Detect the type of answer: code, sql, math, or text.
        Uses pattern matching to categorize.
        """
        if not text:
            return "text"
        
        # Check SQL first
        sql_score = sum(1 for p in self.sql_indicators if re.search(p, text, re.IGNORECASE))
        if sql_score >= 2:
            return "sql"
        
        # Check code patterns
        code_score = sum(1 for p in self.code_indicators if re.search(p, text))
        if code_score >= 2:
            return "code"
        
        # Check math patterns
        math_score = sum(1 for p in self.math_indicators if re.search(p, text, re.IGNORECASE))
        if math_score >= 2:
            return "math"
        
        # Default to text
        return "text"
    
    def is_technical_answer(self, text: str) -> bool:
        """Check if answer is technical (code/sql/math)."""
        return self.detect_answer_type(text) != "text"
    
    # CODE ANALYSIS METHODS
    
    def detect_function_type(self, code: str) -> str:
        """Detect what algorithm/function the code implements."""
        code_lower = code.lower()
        
        # 1. Check function name first
        func_match = re.search(r"def\s+(\w+)", code_lower)
        if func_match:
            func_name = func_match.group(1)
            for func_type, info in self.function_patterns.items():
                if any(name in func_name for name in info["names"]):
                    return func_type
        
        # 2. Check patterns in code body
        scores = {}
        for func_type, info in self.function_patterns.items():
            score = 0
            for pattern in info["patterns"]:
                if re.search(pattern, code_lower):
                    score += 1
            for anti in info.get("anti_patterns", []):
                if re.search(anti, code_lower):
                    score -= 1
            if score > 0:
                scores[func_type] = score
        
        if scores:
            return max(scores, key=scores.get)
        
        return "unknown"
    
    def check_logic_errors(self, model_code: str, student_code: str) -> Tuple[bool, str]:

        # Check for critical logic errors in student code.
        model_type = self.detect_function_type(model_code)
        student_type = self.detect_function_type(student_code)
        
        # Type mismatch check
        if model_type != "unknown" and student_type != "unknown":
            if model_type != student_type:
                logger.info(f"Function type mismatch: model={model_type}, student={student_type}")
                return True, f"Code giải quyết bài toán khác: yêu cầu {model_type}, sinh viên làm {student_type}"
        
        # Check for specific logic errors matching the context
        for error in self.logic_errors:
            if error["context"] == model_type or error["context"] == "any":
                if re.search(error["pattern"], student_code, re.IGNORECASE):
                    # Check if model also has it (e.g. some trick questions)
                    if not re.search(error["pattern"], model_code, re.IGNORECASE):
                        logger.info(f"Logic error detected: {error['type']} - Pattern: {error['pattern']}")
                        return True, error["message"]
        
        return False, ""
    
    def extract_code_structure(self, code: str) -> Dict[str, List[str]]:
        # Extract structural elements from code.
        structure = {
            "functions": re.findall(r"def\s+(\w+)\s*\(", code),
            "returns": re.findall(r"return\s+(.+?)(?:\n|$)", code),
            "conditions": re.findall(r"if\s+(.+?):", code),
            "loops": re.findall(r"for\s+(.+?):", code) + re.findall(r"while\s+(.+?):", code),
            "variables": re.findall(r"(\w+)\s*=\s*", code),
        }
        return structure
    
    def compare_code_structure(self, model: str, student: str) -> float:
        # Compare structural similarity of two code snippets.
        # Uses both exact element matching and skeleton/token matching (for obfuscation).
        # 1. Exact Element Match (Strict)
        m_struct = self.extract_code_structure(model)
        s_struct = self.extract_code_structure(student)
        
        strict_similarity = 0.0
        weight_count = 0
        
        for key in m_struct:
            m_set = set(m_struct[key])
            s_set = set(s_struct[key])
            
            if m_set or s_set:
                if m_set and s_set:
                    similarity = len(m_set & s_set) / len(m_set | s_set)
                else:
                    similarity = 0.0
                strict_similarity += similarity
                weight_count += 1
        
        strict_score = strict_similarity / weight_count if weight_count > 0 else 0.5
        
        # 2. Skeleton Match (For Obfuscation / Variable Renaming)
        # Extracts just the keywords sequence to see if algorithm structure is identical
        def get_skeleton(code):
            return re.findall(r"\b(def|class|if|elif|else|for|while|try|except|return|yield|break|continue)\b", code)
            
        m_skeleton = get_skeleton(model)
        s_skeleton = get_skeleton(student)
        
        skeleton_score = 0.0
        if not m_skeleton and not s_skeleton:
            skeleton_score = 1.0
        elif m_skeleton and s_skeleton:
            matcher = difflib.SequenceMatcher(None, m_skeleton, s_skeleton)
            skeleton_score = matcher.ratio()
            
        logger.info(f"Structure Check: strict={strict_score:.2f}, skeleton={skeleton_score:.2f}")
        return max(strict_score, skeleton_score)
    
    # SQL ANALYSIS METHODS
    
    def extract_sql_elements(self, sql: str) -> Dict[str, str]:
        #Extract key elements from SQL query.
        sql_upper = sql.upper()
        elements = {}
        
        for name, pattern in self.sql_elements.items():
            match = re.search(pattern, sql_upper, re.IGNORECASE | re.DOTALL)
            if match:
                elements[name] = match.group(1).strip() if match.groups() else ""
        
        return elements
    
    def compare_sql_queries(self, model: str, student: str) -> Tuple[float, str]:
        #Compare two SQL queries for logical equivalence.
        m_elements = self.extract_sql_elements(model)
        s_elements = self.extract_sql_elements(student)
        
        # Helper to normalize SQL values (remove aliases like 't1.', 's.', and 'AS alias')
        def normalize_sql_val(text):
            if not text: return ""
            text = text.lower().strip()
            # Remove table aliases (e.g., "s.name" -> "name")
            text = re.sub(r'\b\w+\.', '', text)
            # Remove AS aliases (e.g., "count(*) as total" -> "count(*)")
            text = re.sub(r'\s+as\s+\w+', '', text)
            # Normalize spaces
            text = re.sub(r'\s+', ' ', text)
            return text

        # Check table name
        m_table = m_elements.get("from_table", "").lower()
        s_table = s_elements.get("from_table", "").lower()
        
        if m_table and s_table and m_table != s_table:
            return 0.1, f"Sai tên bảng: yêu cầu '{m_table}', sinh viên dùng '{s_table}'"
        
        # Compare elements
        match_count = 0
        total_count = 0
        
        for key in m_elements:
            if m_elements.get(key):
                total_count += 1
                if key in s_elements:
                    # Normalize and compare
                    m_val = normalize_sql_val(m_elements[key])
                    s_val = normalize_sql_val(s_elements.get(key, ""))
                    
                    # Split by comma for lists (select, group by)
                    m_parts = set(x.strip() for x in m_val.split(','))
                    s_parts = set(x.strip() for x in s_val.split(','))
                    
                    if m_val == s_val or m_parts == s_parts:
                        match_count += 1
        
        score = match_count / total_count if total_count > 0 else 0.5
        return score, f"SQL match: {match_count}/{total_count} elements"
    
    # MATH ANALYSIS METHODS
    
    def normalize_math_expression(self, expr: str) -> str:
        #Normalize math expression for comparison.
        # Remove whitespace
        expr = re.sub(r'\s+', '', expr)
        # Normalize common variations
        expr = expr.replace('×', '*').replace('÷', '/')
        expr = expr.replace('^', '**')
        return expr.lower()
    
    def compare_math_answers(self, model: str, student: str) -> Tuple[float, str]:
        """
        Compare math answers, handling different notations.
        Handles cases like:
        - Student: "1 + 7 = 8" vs Model: "8"
        - Student: "= 8" vs Model: "8"
        - Student: "8 ạ" vs Model: "8"
        Returns (similarity_score, feedback).
        """
        m_norm = self.normalize_math_expression(model)
        s_norm = self.normalize_math_expression(student)
        
        # Exact normalized match
        if m_norm == s_norm:
            return 1.0, "Đáp án chính xác"
        
        # NEW: Extract final result from expressions like "1+7=8" -> "8"
        def extract_result(expr: str) -> str:
            """Extract the result part after '=' sign"""
            if '=' in expr:
                # Get the part after the last '='
                result = expr.split('=')[-1].strip()
                # Remove any trailing non-numeric characters (like 'ạ', 'nhé', etc.)
                result = re.sub(r'[^0-9.\-]+$', '', result)
                return result
            return expr
        
        # NEW: Clean Vietnamese filler from end
        def clean_filler(expr: str) -> str:
            """Remove Vietnamese fillers from the expression"""
            fillers = ['ạ', 'nhé', 'nha', 'ha', 'vậy', 'thế', 'đó']
            for filler in fillers:
                expr = re.sub(rf'\s*{filler}\s*$', '', expr, flags=re.IGNORECASE)
            return expr.strip()
        
        # Clean student answer
        s_cleaned = clean_filler(s_norm)
        m_cleaned = clean_filler(m_norm)
        
        # Check if cleaned versions match
        if s_cleaned == m_cleaned:
            return 1.0, "Đáp án chính xác"
        
        # Extract result from student if they wrote full expression
        s_result = extract_result(s_cleaned)
        m_result = extract_result(m_cleaned)
        
        # Compare just the results
        if s_result == m_result:
            return 1.0, "Đáp án đúng (viết đầy đủ phép tính)"
        
        # Extract all numeric values
        m_nums = set(re.findall(r'-?\d+\.?\d*', m_result))
        s_nums = set(re.findall(r'-?\d+\.?\d*', s_result))
        
        if m_nums and s_nums:
            # Check if main answer values match
            if m_nums == s_nums:
                return 0.98, "Giá trị đúng, cách viết khác"
            
            # Check if the result number appears in student answer
            if m_nums.issubset(s_nums) or s_nums.issubset(m_nums):
                return 0.95, "Đáp án đúng"
            
            # Partial match
            common = m_nums & s_nums
            if common:
                ratio = len(common) / len(m_nums)
                return 0.5 + (ratio * 0.3), f"Đúng một phần: {len(common)}/{len(m_nums)} giá trị"
        
        return 0.3, "Không thể so khớp đáp án toán học"
    
    # MAIN GRADING METHOD
    def grade(self, model_text: str, student_text: str, max_points: float) -> Optional[Dict[str, Any]]:
        model_type = self.detect_answer_type(model_text)
        student_type = self.detect_answer_type(student_text)
        
        logger.info(f"CodeAnalyzer: model_type={model_type}, student_type={student_type}")
        
        # If model is not technical, let main grader handle
        if model_type == "text":
            return None
        
        # Type mismatch: student gave text answer for code question
        if model_type != "text" and student_type == "text":
            return {
                "score": max_points * 0.1,
                "type": "Wrong Format",
                "explanation": f"Yêu cầu trả lời dạng {model_type}, sinh viên viết văn bản thường"
            }
        
        # CODE GRADING
        if model_type == "code":
            # Check for logic errors
            has_error, error_msg = self.check_logic_errors(model_text, student_text)
            if has_error:
                return {
                    "score": max_points * 0.1,
                    "type": "Logic Error",
                    "explanation": error_msg
                }
            
            # Check function type match
            model_func = self.detect_function_type(model_text)
            student_func = self.detect_function_type(student_text)
            
            if model_func != "unknown" and student_func != "unknown":
                if model_func != student_func:
                    return {
                        "score": max_points * 0.15,
                        "type": "Wrong Algorithm",
                        "explanation": f"Yêu cầu thuật toán {model_func}, sinh viên làm {student_func}"
                    }
            
            # Compare structure
            struct_sim = self.compare_code_structure(model_text, student_text)
            
            # Allow different structures if function type is identified and matches
            # e.g. Recursive vs Iterative factorial
            is_same_algo = (model_func != "unknown" and student_func != "unknown" and model_func == student_func)
            
            if struct_sim < 0.3 and not is_same_algo:
                return {
                    "score": max_points * 0.25,
                    "type": "Structure Mismatch",
                    "explanation": f"Cấu trúc code khác biệt nhiều (similarity: {struct_sim:.0%})"
                }
            elif is_same_algo and struct_sim < 0.3:
                # Same algorithm but different structure -> Paraphrase/Implementation variation
                logger.info(f"Code structure differs ({struct_sim:.2f}) but algorithm matches ({model_func}). Allowing.")
            
            # Code Length/Complexity Check for Partial Detection
            # If student code is much shorter than model (lines of code), it's likely partial
            m_lines = len([l for l in model_text.splitlines() if l.strip()])
            s_lines = len([l for l in student_text.splitlines() if l.strip()])
            
            logger.info(f"Code Length Check: student={s_lines}, model={m_lines}, ratio={s_lines/m_lines if m_lines else 0:.2f}")

            # Detect incomplete code / placeholder comments
            placeholder_patterns = [
                r"#.*đệ quy", r"#.*viết tiếp", r"#.*TODO", r"#.*... ",
                r"//.*TODO", r"/\*.*TODO"
            ]
            for p in placeholder_patterns:
                if re.search(p, student_text, re.IGNORECASE):
                    return {
                        "score": max_points * 0.4,
                        "type": "Partial Code",
                        "explanation": "Code chưa hoàn thiện (chứa comment placeholder)."
                    }

            if m_lines > 2 and s_lines / m_lines < 0.4:
                 return {
                    "score": max_points * 0.4,
                    "type": "Partial Code",
                    "explanation": f"Code quá ngắn so với đáp án ({s_lines}/{m_lines} dòng)."
                }

            # If checks passed, return valid code score
            # Bonus for high structure similarity
            final_score_ratio = max(0.9, struct_sim) if struct_sim > 0.6 else 0.85
            return {
                "score": max_points * final_score_ratio,
                "type": "Code Match",
                "explanation": f"Code hợp lệ (Structure: {struct_sim:.2f})"
            }
        
        # SQL GRADING
        if model_type == "sql":
            # Type mismatch
            if student_type != "sql":
                return {
                    "score": max_points * 0.1,
                    "type": "Wrong Format",
                    "explanation": "Yêu cầu câu truy vấn SQL"
                }
            
            score, feedback = self.compare_sql_queries(model_text, student_text)
            if score < 0.5:
                return {
                    "score": max_points * score,
                    "type": "SQL Error",
                    "explanation": feedback
                }
            
            return {
                "score": max_points * score,
                "type": "SQL Match",
                "explanation": feedback
            }
        
        # MATH GRADING
        if model_type == "math":
            score, feedback = self.compare_math_answers(model_text, student_text)
            if score < 0.5:
                return {
                    "score": max_points * score,
                    "type": "Math Error",
                    "explanation": feedback
                }
            
            return {
                "score": max_points * score,
                "type": "Math Match",
                "explanation": feedback
            }
        
        # Default: let main grader handle
        return None


def analyze_technical_answer(model: str, student: str, max_points: float) -> Optional[Dict[str, Any]]:
    #Analyze technical answer and return grading result.
    analyzer = CodeAnalyzer()
    return analyzer.grade(model, student, max_points)
