"""
code_analyzer.py
Specialized analysis module for Code/Math/SQL/OOP answers.

Implements divide-and-conquer grading strategy:
1. Detect answer type (code, math, SQL, text)
2. Apply specialized analysis per type
3. Return grading result or None to let main grader handle

Supports:
- Python code (functions, algorithms, OOP classes)
- SQL queries
- Mathematical expressions
"""

import re
import difflib
import logging
from typing import Tuple, Dict, Any, Optional, List, Set

from .tokenizer import (
    normalize_synonyms, deep_clean_text, PLEADING_NOISE,
    normalize_code_snippets, expand_abbreviations
)

logger = logging.getLogger(__name__)


class CodeAnalyzer:
    def __init__(self):
        # CODE PATTERNS (Python, JavaScript, Java, C++, OOP)
        self.code_indicators = [
            # Python
            r"\bdef\s+\w+\s*\(",
            r"\breturn\b",
            r"\bfor\s+\w+\s+in\b",
            r"\bif\s+.+:",
            r"\bwhile\s+.+:",
            r"\bimport\s+\w+",
            r"\bfrom\s+\w+\s+import",
            r"\blambda\s+",
            r"\bprint\s*\(",
            # Python OOP
            r"\bclass\s+\w+",
            r"def\s+__init__\s*\(",
            r"\bself\.\w+",
            r"super\(\)\.",
            # JavaScript
            r"\bfunction\s+\w+\s*\(",
            r"\bconst\s+\w+\s*=",
            r"\blet\s+\w+\s*=",
            r"\bvar\s+\w+\s*=",
            r"=>\s*{",
            r"console\.log\s*\(",
            # Java/C++/OOP
            r"\bpublic\s+(static\s+)?void\b",
            r"\bprivate\s+\w+\b",
            r"\bprotected\s+\w+\b",
            r"\bclass\s+\w+\s+(extends|implements|:)\s+\w+",
            r"\bnew\s+\w+\s*\(",
            r"\bint\s+\w+\s*=",
            r"\bString\s+\w+\s*=",
            r"System\.out\.print",
        ]
        
        # SQL PATTERNS
        self.sql_indicators = [
            r"\bSELECT\b", r"\bINSERT\b", r"\bUPDATE\b", r"\bDELETE\b", 
            r"\bCREATE\b", r"\bDROP\b", r"\bALTER\b", r"\bJOIN\b",
            r"\bWHERE\b", r"\bGROUP\s+BY\b", r"\bORDER\s+BY\b", r"\bHAVING\b",
            r"\bSELECT\b.*\bFROM\b", r"\bINSERT\s+INTO\b", r"\bUPDATE\b.*\bSET\b",
            r"\bWITH\b", r"\bTOP\b", r"\bLIMIT\b", r"\bUNION\b", r"\bEXCEPT\b"
        ]
        
        self.sql_procedural_indicators = [
            r"\bCREATE\s+TRIGGER\b",
            r"\bCREATE\s+PROCEDURE\b",
            r"\bCREATE\s+FUNCTION\b",
            r"\bCREATE\s+VIEW\b",
            r"\bFOR\s+EACH\s+ROW\b",
            r"\bBEGIN\b.*\bEND\b",
            r"\bDECLARE\b",
            r"\bIF\b.*\bTHEN\b",
            r"\bRETURNS\b",
            r"\bAS\s+\$?\w+\$?\s+BEGIN\b",
            r"\bAFTER\b", r"\bBEFORE\b", r"\bINSTEAD\s+OF\b", r"\bFOR\b"
        ]

        self.sql_ddl_indicators = [
            r"\bCREATE\s+TABLE\b",
            r"\bALTER\s+TABLE\b",
            r"\bPRIMARY\s+KEY\b",
            r"\bFOREIGN\s+KEY\b",
            r"\bREFERENCES\b",
            r"\bCONSTRAINT\b",
            r"\bDEFAULT\b",
            r"\bUNIQUE\b",
            r"\bNOT\s+NULL\b",
            r"\bON\s+DELETE\b",
            r"\bON\s+UPDATE\b",
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
        
        # FUNCTION / OOP TYPE PATTERNS
        self.function_patterns = {
            "factorial": {
                "names": ["giai_thua", "factorial", "tinh_giai_thua", "giaithua"],
                "patterns": [
                    r"n\s*\*\s*\w+\s*\(\s*n\s*-\s*1\s*\)",  # n * f(n-1)
                    r"for\s+\w+\s+in\s+range\s*\(\s*1\s*,\s*n",  # for i in range(1, n...
                    r"result\s*\*=\s*\w+",  # result *= i
                    r"result\s*=\s*result\s*\*\s*\w+", # result = result * i
                ],
                "anti_patterns": [r"\+="]
            },
            "sum": {
                "names": ["tong", "sum", "tinh_tong", "tinhtong", "total"],
                "patterns": [r"\+=", r"total\s*\+", r"sum\s*\(", r"sum\s*=\s*sum\s*\+"],
                "anti_patterns": [r"\*=", r"n\s*-\s*1\s*\)"]
            },
            "fibonacci": {
                "names": ["fibo", "fibonacci", "fib"],
                "patterns": [r"n\s*-\s*1.*n\s*-\s*2", r"\w+\s*\(\s*n\s*-\s*1\s*\)\s*\+\s*\w+\s*\(\s*n\s*-\s*2\s*\)"],
                "anti_patterns": []
            },
            "prime": {
                "names": ["prime", "so_nguyen_to", "nguyen_to", "is_prime"],
                "patterns": [r"n\s*%\s*\w+\s*==\s*0", r"for\s+\w+\s+in\s+range\s*\(\s*2\s*,"],
                "anti_patterns": []
            },
            "sort": {
                "names": ["sort", "sap_xep", "sapxep", "bubble", "quick", "merge"],
                "patterns": [r"\.sort\s*\(", r"sorted\s*\(", r"swap", r"\[\s*\w+\s*\]\s*,\s*\[\s*\w+\s*\]"],
                "anti_patterns": []
            },
            "search": {
                "names": ["search", "tim_kiem", "timkiem", "binary", "linear"],
                "patterns": [r"mid\s*=", r"low\s*=.*high\s*=", r"if\s+\w+\s*==\s*target"],
                "anti_patterns": []
            },
            # [OOP] Patterns Nhận diện đặc thù Hướng Đối Tượng
            "oop_class": {
                "names": ["class", "lop_doi_tuong", "hinh_chu_nhat", "sinh_vien", "animal", "person", "vehicle"],
                "patterns": [
                    r"\bclass\s+\w+",
                    r"def\s+__init__",
                    r"self\.\w+\s*=",
                    r"\bpublic\s+class",
                ],
                "anti_patterns": []
            },
            "oop_inheritance": {
                "names": ["ke_thua", "extends", "inheritance"],
                "patterns": [
                    r"\bclass\s+\w+\s*\(\s*\w+\s*\):", # Python class Child(Parent):
                    r"class\s+\w+\s+extends\s+\w+",    # Java/JS extends
                    r"class\s+\w+\s*:\s*(public|private|protected)\s+\w+", # C++ inheritance
                    r"super\(\)\.__init__",
                    r"super\(\)\.",
                ],
                "anti_patterns": []
            }
        }
        
        # CRITICAL LOGIC ERROR PATTERNS
        self.logic_errors = [
            {
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
        
        # Check SQL first (Strong indicator: 1 keyword is enough for SQL queries)
        sql_score = sum(1 for p in self.sql_indicators if re.search(p, text, re.IGNORECASE))
        if sql_score >= 1:
            return "sql"
        
        # Check code patterns
        code_score = sum(1 for p in self.code_indicators if re.search(p, text))
        
        strong_code_indicators = r"(def\s+__init__|\bclass\s+\w+|public\s+class|\bvoid\s+\w+|#include|<iostream>|std::)"
        generic_code_syntax = r"([{}();]|\breturn\b|=>|->|//|/\*.*\*/)"
        
        if code_score >= 1 or re.search(strong_code_indicators, text) or len(re.findall(generic_code_syntax, text)) >= 2:
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

    def _is_short_tech_typo(self, model: str, student: str) -> bool:
        """Kiểm tra xem có phải lỗi chính tả của một thuật ngữ kỹ thuật ngắn không."""
        m_c = re.sub(r'[^A-Z0-9]', '', model.upper()).strip()
        s_c = re.sub(r'[^A-Z0-9]', '', student.upper()).strip()
        if not m_c or len(m_c) > 20: return False
        
        import difflib
        sim = difflib.SequenceMatcher(None, m_c, s_c).ratio()
        return sim >= 0.6 or m_c in s_c
    
    # CODE ANALYSIS METHODS
    
    def detect_function_type(self, code: str) -> str:
        """Detect what algorithm/function/OOP concept the code implements."""
        code_lower = code.lower()
        
        # 1. Check function/class name first
        func_matches = re.finditer(r"(?:^|\s)(?:def|class|void|int|float|double|bool|string|char|public|private)\s+(\w+)\s*\(?", code_lower)
        for func_match in func_matches:
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
                # Tránh phạt nhầm khi OOP class và OOP inheritance có thể trộn lẫn
                if not (model_type.startswith("oop_") and student_type.startswith("oop_")):
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
        """Extract structural elements from code (Multi-language)."""
        code_no_comments = re.sub(r'//.*', '', code)
        code_no_comments = re.sub(r'/\*.*?\*/', '', code_no_comments, flags=re.DOTALL)
        
        structure = {
            "classes": re.findall(r"(?:class|struct|interface)\s+(\w+)", code_no_comments),
            "inheritance": re.findall(r"class\s+\w+\s*(?:\(|:\s*(?:public|private|protected)\s+|extends\s+|implements\s+)(\w+)", code_no_comments),
            "constructors": re.findall(r"def\s+(__init__)|(?:^|[\s{}])([A-Z][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?:{|:)", code_no_comments),
            "functions": re.findall(r"(?:def|void|int|float|double|bool|string|char|auto)\s+([a-zA-Z0-9_]+)\s*\(", code_no_comments),
            "main": re.findall(r"(?:int|void|def)\s+main\s*\(", code_no_comments),
            "returns": re.findall(r"return\s+([^;\n]+)", code_no_comments),
            "conditions": re.findall(r"if\s*\(([^)]+)\)|if\s+([^:]+):", code_no_comments),
            "loops": re.findall(r"for\s*\(([^)]+)\)|for\s+([^:]+):", code_no_comments) + re.findall(r"while\s*\(([^)]+)\)|while\s+([^:]+):", code_no_comments),
            "attributes": re.findall(r"self\.(\w+)\s*=|this->(\w+)\s*=", code_no_comments),
            "variables": re.findall(r"([a-zA-Z0-9_]+)\s*=\s*(?!self|this)", code_no_comments),
            "memory": re.findall(r"(?:new\s+|malloc|calloc)", code_no_comments),
            "pointers": re.findall(r"(\w+)\s*\*", code_no_comments),
            "access_modifiers": re.findall(r"\b(private|public|protected|__\w+)\b", code_no_comments),
            "objects": re.findall(r"(?:[A-Z][a-zA-Z0-9_]*\s+[a-zA-Z_]\w*\s*;|[A-Z][a-zA-Z0-9_]*\s*\*\s*[a-zA-Z_]\w*\s*=\s*new)", code_no_comments),
            "method_calls": re.findall(r"(?:\w+\.\w+\(|\w+->\w+\()", code_no_comments),
            "io_operations": re.findall(r"\b(cin|cout|scanf|printf|print|input)\b", code_no_comments),
            "operators": re.findall(r"(\+|-|\*|/|%|&&|\|\||==|!=|>=|<=)", code_no_comments)
        }
        
        for key in structure:
            cleaned = []
            for item in structure[key]:
                if isinstance(item, tuple):
                    cleaned.extend([i.strip() for i in item if i and i.strip() != "def"])
                elif isinstance(item, str) and item.strip():
                    cleaned.append(item.strip())
            structure[key] = cleaned
            
        structure["functions"] = [f for f in structure["functions"] if f not in structure["classes"] and f not in structure["constructors"] and f != "main"]
        
        return structure
    
    def _grade_interface_only(self, m_struct: Dict[str, List[str]], s_struct: Dict[str, List[str]]) -> float:
        """
        Tính điểm vớt cho Interface (Class/Hàm) khi sinh viên tạo đúng cấu trúc OOP
        nhưng đổi tên biến/hàm và bỏ trống ruột (thiếu logic).
        """
        interface_score = 0.0
        
        # 1. So sánh số lượng Class
        m_classes = len(m_struct.get("classes", []))
        s_classes = len(s_struct.get("classes", []))
        class_score = 0.0
        if m_classes > 0:
            class_score = min(1.0, s_classes / m_classes)
        elif s_classes > 0:
            class_score = 1.0
        else:
            class_score = 1.0
            
        # 2. So sánh số lượng Hàm (Methods/Functions)
        m_funcs = len(m_struct.get("functions", [])) + len(m_struct.get("constructors", []))
        s_funcs = len(s_struct.get("functions", [])) + len(s_struct.get("constructors", []))
        func_score = 0.0
        if m_funcs > 0:
            func_score = min(1.0, s_funcs / m_funcs)
        elif s_funcs > 0:
            func_score = 1.0
        else:
            func_score = 1.0
            
        # 3. So sánh số lượng thuộc tính (Attributes/Variables)
        m_attrs = len(m_struct.get("attributes", [])) + len(m_struct.get("pointers", []))
        s_attrs = len(s_struct.get("attributes", [])) + len(s_struct.get("pointers", []))
        attr_score = 0.0
        if m_attrs > 0:
            attr_score = min(1.0, s_attrs / m_attrs)
        elif s_attrs > 0:
            attr_score = 1.0
        else:
            attr_score = 1.0
            
        # Tính Base Score cho Interface
        if m_classes > 0:
            interface_score = (class_score * 0.4) + (func_score * 0.4) + (attr_score * 0.2)
        else:
            interface_score = (func_score * 0.7) + (attr_score * 0.3)
            
        # đúng hoàn toàn -> 0.35 * max_points
        return interface_score * 0.35
    
    def _universal_sanitize(self, code: str) -> str:
        """Step 1: Sanitize - Remove comments, convert all strings to <STR> tags."""
        # Remove C++ block comments and line comments
        code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
        code = re.sub(r'//.*', '', code)
        code = re.sub(r'(?m)^\s*#(?!\s*(include|define|pragma|ifndef|endif)\b).*', '', code)
        
        # Replace Python docstrings
        code = re.sub(r'"""(.*?)"""', '<STR>', code, flags=re.DOTALL)
        code = re.sub(r"'''(.*?)'''", '<STR>', code, flags=re.DOTALL)
        
        # Replace Strings
        code = re.sub(r'".*?(?<!\\)"', '<STR>', code)
        code = re.sub(r"'.*?(?<!\\)'", '<STR>', code)
        code = re.sub(r"`.*?(?<!\\)`", '<STR>', code, flags=re.DOTALL)
        
        return code

    def _universal_normalize(self, code: str) -> str:
        """Step 2: Normalize - Standardize varying operators to a single format."""
        # Convert x++ or ++x to x += 1
        code = re.sub(r'([a-zA-Z_]\w*)\s*\+\+', r'\1 += 1', code)
        code = re.sub(r'\+\+\s*([a-zA-Z_]\w*)', r'\1 += 1', code)
        # Convert x-- or --x to x -= 1
        code = re.sub(r'([a-zA-Z_]\w*)\s*--', r'\1 -= 1', code)
        code = re.sub(r'--\s*([a-zA-Z_]\w*)', r'\1 -= 1', code)
        
        # Convert x = x + y to x += y
        code = re.sub(r'\b([a-zA-Z_]\w*)\s*=\s*\1\s*([+\-*/%])\s*([^;\n]+)', r'\1 \2= \3', code)
        return code

    def _universal_tokenize(self, code: str) -> List[str]:
        """Step 3: Tokenize - Convert into an abstract syntax sequence."""
        code = self._universal_normalize(self._universal_sanitize(code))
        
        # Bảo vệ base case âm trước khi tách
        code = code.replace('-1', '__NEG_ONE__') 
        
        # Add spaces around punctuation/operators for easy splitting
        code = re.sub(r'([()\[\]{}.,:;=+\-*/%<>&|!])', r' \1 ', code)
        
        # Re-group composite operators that got split
        comp_ops = [
            ('=  =', '=='), ('!  =', '!='), ('>  =', '>='), ('<  =', '<='),
            ('+  =', '+='), ('-  =', '-='), ('*  =', '*='), ('/  =', '/='),
            ('%  =', '%='), ('&  &', '&&'), ('|  |', '||')
        ]
        for old, new in comp_ops:
            code = code.replace(old, new)
            
        code = code.replace('__NEG_ONE__', '-1')
        tokens = code.split()
        final_tokens = []
        
        control_flow = {'if', 'else', 'elif', 'for', 'while', 'return', 'break', 'continue', 'switch', 'case', 'default'}
        logic_ops = {'and', 'or', 'not', 'in', 'is', '&&', '||', '!', '==', '!=', '>=', '<=', '>', '<'}
        declarations = {'int', 'float', 'double', 'char', 'bool', 'string', 'void', 'auto', 'var', 'let', 'const', 'public', 'private', 'protected', 'class', 'struct', 'def', 'function', 'static', 'final'}
        math_ops = {'+', '-', '*', '/', '%', '+=', '-=', '*=', '/=', '%=', '='}
        
        for t in tokens:
            if t in control_flow or t in logic_ops or t in math_ops or t == '<STR>':
                final_tokens.append(t)
            elif t in declarations:
                pass
            elif t in ('0', '1', '-1'): 
                final_tokens.append(t)
            elif re.match(r'^-?\d+(\.\d+)?$', t):
                final_tokens.append('<NUM>')
            elif re.match(r'^([a-zA-Z_]\w*)$', t):
                final_tokens.append('<VAR>')
            else:
                if t in (',', ';', '(', ')', '{', '}', '[', ']', '.', ':'):
                    final_tokens.append(t)
                    
        return final_tokens

    def _grade_algorithm_block(self, model: str, student: str) -> Tuple[float, List[str]]:
        """Step 4: Block Matching - Grade the abstract sequences via coverage."""
        m_tokens = self._universal_tokenize(model)
        s_tokens = self._universal_tokenize(student)
        
        if not m_tokens:
            return 1.0, []
            
        matcher = difflib.SequenceMatcher(None, m_tokens, s_tokens)
        matches = sum(triple.size for triple in matcher.get_matching_blocks())
        coverage = matches / len(m_tokens) if len(m_tokens) > 0 else 1.0
        
        penalties = []
        multiplier = 1.0
        if coverage < 0.85:
            missing_segments = []
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                if tag in ('delete', 'replace'):
                    missing_segment = m_tokens[i1:i2]
                    filtered_segment = [t for t in missing_segment if t not in (',', ';', '{', '}', '(', ')', '.', ':', '<VAR>', '<NUM>', '<STR>')]
                    
                    if filtered_segment:
                        expr = " ".join(filtered_segment)
                        msg = ""
                        if 'return' in filtered_segment:
                            msg = f"Thiếu luồng trả về kết quả (Lệnh return)"
                        elif 'for' in filtered_segment or 'while' in filtered_segment:
                            msg = f"Thiếu cấu trúc vòng lặp cốt lõi"
                        elif 'if' in filtered_segment or 'else' in filtered_segment or 'elif' in filtered_segment:
                            msg = f"Thiếu rẽ nhánh điều kiện logic"
                        elif any(op in filtered_segment for op in ('+=', '-=', '*=', '/=', '%=', '=', '+', '-', '*', '/', '%')):
                            msg = f"Thiếu/Sai đoạn thuật toán tính toán/gán giá trị"
                        else:
                            msg = f"Thiếu phần thân xử lý thuật toán (chứa: {expr})"
                            
                        if msg and msg not in penalties:
                            penalties.append(msg)
                            
            if coverage < 0.35:
                multiplier = 0.2
            elif coverage < 0.60:
                multiplier = 0.35
            else:
                multiplier = 0.60
                
            logger.info(f"Block Match Failed: coverage={coverage:.2f}, multiplier={multiplier}, len(m)={len(m_tokens)}")
        else:
            logger.info(f"Block Match Passed: coverage={coverage:.2f}")
            
        return multiplier, penalties, coverage

    def compare_code_structure(self, model: str, student: str) -> Tuple[float, List[str]]:
        # Compare structural similarity of two code snippets using the 6-Tier Code Rubric.
        m_struct = self.extract_code_structure(model)
        s_struct = self.extract_code_structure(student)
        penalties = []
        
        # Nhóm 1: Lỗi Cú pháp (Syntax)
        s_no_comments = re.sub(r'//.*', '', student)
        s_no_comments = re.sub(r'/\*.*?\*/', '', s_no_comments, flags=re.DOTALL)
        if abs((s_no_comments.count('{') + s_no_comments.count('(')) - (s_no_comments.count('}') + s_no_comments.count(')'))) > 1:
            penalties.append("Lỗi Syntax: Thiếu/Thừa ngoặc đóng mở {} () (Lỗi biên dịch)")
            return 0.1, penalties
            
        if "#include" in model and "#include" not in student:
            penalties.append("Lỗi Syntax: Thiếu khai báo thư viện gốc (VD: #include)")

        # 1. Exact Element Match (Strict)
        strict_similarity = 0.0
        weight_count = 0
        
        for key in m_struct:
            m_set = set(m_struct[key])
            s_set = set(s_struct[key])
            if m_set or s_set:
                if m_set:
                    quantity_score = min(1.0, len(s_set) / len(m_set))
                    name_score = len(m_set & s_set) / len(m_set | s_set) if s_set else 0.0
                    similarity = (quantity_score * 0.9) + (name_score * 0.1)
                else:
                    similarity = 1.0 # Tránh phạt oan khi model không có mà student có
                
                weight = 2.0 if key in ["classes", "inheritance", "attributes", "pointers", "memory", "constructors", "main", "objects", "method_calls"] else 1.0
                strict_similarity += similarity * weight
                weight_count += weight
        
        strict_score = strict_similarity / weight_count if weight_count > 0 else 0.2
        
        # 2. Skeleton Match (For Obfuscation / Variable Renaming)
        import difflib
        def get_skeleton(code):
            return re.findall(r"\b(class|struct|interface|public|private|protected|virtual|override|new|delete|malloc|free|def|void|int|float|double|bool|string|char|if|elif|else|for|while|try|except|catch|return|yield|break|continue|super|self|this)\b", code)
            
        m_skeleton = get_skeleton(model)
        s_skeleton = get_skeleton(student)
        
        skeleton_score = 0.0
        if m_skeleton and s_skeleton:
            matcher = difflib.SequenceMatcher(None, m_skeleton, s_skeleton)
            skeleton_score = matcher.ratio()
            
        # 3. Generic Token Match (For C/C++/Java & Snippets)
        def basic_normalize(c):
            c = re.sub(r'//.*', '', c)
            c = re.sub(r'/\*.*?\*/', '', c, flags=re.DOTALL)
            c = re.sub(r'\b(public|private|protected|virtual|abstract|static|inline|final)\b', '', c)
            return re.sub(r'\s+', '', c)
            
        m_norm = basic_normalize(model)
        s_norm = basic_normalize(student)
        
        token_score = 0.0
        if m_norm and s_norm:
            matcher = difflib.SequenceMatcher(None, m_norm, s_norm)
            token_score = matcher.ratio()
            matches = sum(triple.size for triple in matcher.get_matching_blocks())
            containment = matches / len(s_norm) if len(s_norm) > 0 else 0
            len_ratio = len(s_norm) / len(m_norm) if len(m_norm) > 0 else 1
            if containment > 0.6 and len_ratio < 0.8:
                boosted_score = containment * min(1.0, len_ratio * 2.0)
                token_score = max(token_score, boosted_score)
            if m_norm == s_norm: token_score = 1.0
            
        logger.info(f"Structure Check: strict={strict_score:.2f}, skeleton={skeleton_score:.2f}, token={token_score:.2f}")
        
        if len(model.splitlines()) <= 3 and weight_count == 0:
            return token_score, penalties
            
        struct_sim = max(token_score * 0.85, (strict_score * 0.6) + (skeleton_score * 0.4))
        
        # === INTERFACE BASE SCORE ===
        interface_base_score = self._grade_interface_only(m_struct, s_struct)
        
        # === UNIVERSAL TOKENIZER (BLOCK MATCHING) ===
        block_multiplier, block_penalties, block_coverage = self._grade_algorithm_block(model, student)
        
        if block_coverage >= 0.85 and block_multiplier == 1.0:
            struct_sim = max(struct_sim, block_coverage)
            
        if block_multiplier < 1.0:
            struct_sim *= block_multiplier
            penalties.extend(block_penalties)
            logger.info(f"Applied block matching penalty: multiplier={block_multiplier:.2f}, new struct_sim={struct_sim:.2f}")
            
        # Nhóm 6: Lỗi Code Style / Trình bày
        s_lines = student.splitlines()
        s_lines_clean = [l for l in s_lines if l.strip()]
        if len(s_lines_clean) > 0:
            avg_line_len = sum(len(l) for l in s_lines_clean) / len(s_lines_clean)
            if avg_line_len > 100 and len(s_lines_clean) <= 4 and len(m_struct.get("functions", [])) > 0:
                struct_sim *= 0.95
                penalties.append("Lỗi Code Style: Code rối, dài dòng trên một hàng, khó đọc")
        # Áp dụng điểm vớt nếu struct_sim tụt xuống quá thấp do thiếu thuật toán lõi hoặc bị phạt
        if struct_sim < interface_base_score and interface_base_score > 0.1:
            logger.info(f"Rescue: struct_sim ({struct_sim:.2f}) < interface_base_score ({interface_base_score:.2f}). Bumping score.")
            struct_sim = interface_base_score
            penalties.append(f"Điểm vớt cấu trúc (Interface): Sinh viên tạo cấu trúc OOP/Hàm hợp lệ nhưng thiếu logic/vận hành cốt lõi. (Base score: {interface_base_score:.2f})")

        return max(0.0, struct_sim), list(set(penalties))
    
    # SQL ANALYSIS METHODS
    
    def extract_balanced_parentheses(self, text: str, start_index: int) -> str:
        count = 0
        for i in range(start_index, len(text)):
            if text[i] == '(': count += 1
            elif text[i] == ')':
                count -= 1
                if count == 0: return text[start_index:i+1]
        return ""

    def extract_sql_elements(self, sql: str) -> Dict[str, str]:
        sql_u = sql.upper(); elements = {}
        m = re.search(r"SELECT\s+", sql_u)
        if m:
            start = m.end(); depth, f_from = 0, -1
            for i in range(start, len(sql_u)):
                if sql_u[i] == '(': depth += 1
                elif sql_u[i] == ')': depth -= 1
                elif depth == 0 and sql_u[i:i+6] == " FROM ": f_from = i; break
            if f_from != -1: 
                select_text = sql_u[start:f_from].strip()
                top_m = re.search(r"\bTOP\s+(\d+)\b", select_text)
                if top_m:
                    elements["limit_clause"] = f"LIMIT {top_m.group(1)}"
                    select_text = re.sub(r"\bTOP\s+\d+\b", "", select_text).strip()
                elements["select_cols"] = select_text

        others = {
            "from_table": r"FROM\s+(.+?)(?=\bWHERE\b|\bINNER\b|\bLEFT\b|\bRIGHT\b|\bJOIN\b|\bGROUP\b|\bORDER\b|\bHAVING\b|\bLIMIT\b|$)",
            "where_clause": r"WHERE\s+(.+?)(?=\bGROUP\b|\bORDER\b|\bHAVING\b|\bLIMIT\b|$)",
            "join_clause": r"((?:LEFT|RIGHT|INNER|OUTER)?\s*JOIN\s+.+?\bON\b\s+.+?)(?=\bWHERE\b|\bGROUP\b|\bORDER\b|\bHAVING\b|$)",
            "group_by": r"GROUP\s+BY\s+(.+?)(?=\bHAVING\b|\bORDER\b|\bLIMIT\b|$)",
            "having_clause": r"HAVING\s+(.+?)(?=\bORDER\b|\bLIMIT\b|$)",
            "order_by": r"ORDER\s+BY\s+(.+?)(?=\bLIMIT\b|$)",
            "limit_clause": r"\b(LIMIT\s+\d+)\b",
        }
        for k, p in others.items():
            if k not in elements:
                ms = re.search(p, sql_u, re.IGNORECASE | re.DOTALL)
                if ms: elements[k] = ms.group(1).strip()
        return elements

    def calculate_sql_complexity(self, sql: str) -> int:
        """Calculate a complexity score for a SQL query."""
        score = 1
        sql_u = sql.upper()
        
        # 1. Joins (+1 per distinct join)
        joins = len(re.findall(r"\bJOIN\b", sql_u))
        score += joins
        
        # 2. Subqueries (+2 per nested select)
        subqueries = len(re.findall(r"\(SELECT\b", sql_u.replace(" ", "")))
        score += (subqueries * 2)
        
        # 3. Clauses
        if "\bGROUP BY\b" in sql_u: score += 1
        if "\bHAVING\b" in sql_u: score += 1
        if "\bUNION\b" in sql_u: score += 2
        
        # 4. Conditions in WHERE
        where_m = re.search(r"WHERE\s+(.+?)(?=\bGROUP\b|\bORDER\b|\bHAVING\b|\bLIMIT\b|$)", sql_u, re.DOTALL)
        if where_m:
            conditions = len(re.split(r"\bAND\b|\bOR\b", where_m.group(1)))
            if conditions > 2: score += 1
            
        return score

    def compare_sql_queries(self, model: str, student: str) -> Tuple[float, str]:
        # Filter pleading noise (xin xỏ)
        def filter_noise(text):
            t = text.lower()
            for noise in PLEADING_NOISE:
                t = t.replace(noise, " ")
            return " ".join(t.split())

        model = filter_noise(model)
        student = filter_noise(student)
        
        # Pre-normalize synonyms (Vietnamese technical terms)
        model = normalize_synonyms(model)
        student = normalize_synonyms(student)

        m_u, s_u = model.upper(), student.upper()
        
        complexity = self.calculate_sql_complexity(model)
        is_simple = complexity < 3
        
        def fix_sticky_tokens(sql):
            s = re.sub(r'([*(),;=<>!])', r' \1 ', sql)
            sticky_patterns = [
                (r'(?i)\b(LEFT|RIGHT|INNER|OUTER|CROSS)(JOIN)\b', r'\1 \2'),
                (r'(?i)\b(GROUP|ORDER)(BY)\b', r'\1 \2'),
                (r'(?i)\b(DELETE|TRUNCATE)(FROM)\b', r'\1 \2'),
                (r'(?i)\b(NOT)(IN|NULL|EXISTS)\b', r'\1 \2'),
                (r'(?i)\b(SELECT|FROM|WHERE|HAVING|LIMIT)\b', r' \1 '), 
            ]
            for pat, repl in sticky_patterns:
                s = re.sub(pat, repl, s)
            return " ".join(s.split())

        model = fix_sticky_tokens(model)
        student = fix_sticky_tokens(student)

        if any(re.search(p, model, re.IGNORECASE) for p in self.sql_ddl_indicators): return self._grade_sql_ddl(model, student)
        if any(re.search(p, model, re.IGNORECASE) for p in self.sql_procedural_indicators): return self._grade_sql_procedural(model, student)

        def super_normalize(text, aliases=None, table_names=None):
            if not text: return ""
            t = text.upper().strip().rstrip(';')
            cmap = {
                r'\bLEN\(': r'LENGTH(', r'\bGETDATE\(\)': r'CURRENT_TIMESTAMP',
                r'\bNOW\(\)': r'CURRENT_TIMESTAMP', r'\bIFNULL\(': r'COALESCE(', r'\bISNULL\(': r'COALESCE(',
                r'\bNVL\(': r'COALESCE(', r'\bCOUNT\s*\(\s*(\*|1)\s*\)': r'COUNT(1)'
            }
            for p, r in cmap.items(): t = re.sub(p, r, t)
            t = re.sub(r'\bAS\s+\w+\b', ' ', t).replace('(', ' ( ').replace(')', ' ) ')
            if aliases:
                for al_name in sorted(aliases.keys(), key=len, reverse=True):
                    t = re.sub(rf'\b{re.escape(al_name)}\.', '', t); t = re.sub(rf'\b{re.escape(al_name)}\b', ' ', t)
            if table_names:
                for tbl in sorted(table_names, key=len, reverse=True): t = re.sub(rf'\b{re.escape(tbl)}\.', '', t)
            noise = ["INNER", "LEFT", "RIGHT", "OUTER", "FULL", "JOIN", "ON", "DISTINCT"]
            for n in noise: t = re.sub(rf'\b{n}\b', ' ', t)
            t = re.sub(r'[\[\]{}]', ' ', t).replace('<>', '!=')
            if t.count("'") >= 2: t = t.replace(' + ', ' || ')
            return " ".join(t.split()).lower().strip()

        def extract_names(sql):
            al, tbls = {}, set()
            m = re.search(r'FROM\s+(.+?)(?=\bWHERE\b|\bINNER\b|\bLEFT\b|\bRIGHT\b|\bJOIN\b|\bGROUP\b|\bORDER\b|\bHAVING\b|\bLIMIT\b|$)', sql, re.IGNORECASE | re.DOTALL)
            if m:
                body, d, l, cls_l = m.group(1), 0, 0, []
                for i in range(len(body)):
                    if body[i] == '(':
                        if d == 0: cls_l.append(body[l:i])
                        d += 1
                    elif body[i] == ')':
                        d -= 1
                        if d == 0: cls_l.append(" SBQ "); l = i+1
                cls_l.append(body[l:])
                for p in "".join(cls_l).split(','):
                    w = p.strip().split()
                    if w: tbls.add(w[0].upper())
                    if len(w) >= 2 and w[-1].upper() not in ["AS", "ON", "JOIN", "WHERE", "GROUP", "ORDER", "HAVING"]: al[w[-1].upper()] = w[0].upper()
            return al, tbls

        m_el = self.extract_sql_elements(model)
        s_el = self.extract_sql_elements(student)
        m_al, m_tbls = extract_names(model)
        s_al, s_tbls = extract_names(student)
        m_count, t_count, det = 0.0, 0, []
        clauses = ["select_cols", "where_clause", "join_clause", "group_by", "having_clause", "order_by", "limit_clause"]

        has_logic_error = False
        for k in clauses:
            m_v, s_v = m_el.get(k, ""), s_el.get(k, "")
            if not m_v.strip(): continue
            t_count += 1
            
            m_pts = {super_normalize(p, m_al, m_tbls).replace(',', '') for p in m_v.replace(' AND ', ',').replace(' OR ', ',').split(',') if p.strip()}
            s_pts = {super_normalize(p, s_al, s_tbls).replace(',', '') for p in s_v.replace(' AND ', ',').replace(' OR ', ',').split(',') if p.strip()}
            m_n, s_n = super_normalize(m_v, m_al, m_tbls).replace(',', ''), super_normalize(s_v, s_al, s_tbls).replace(',', '')
            
            m_norm_math = m_n.replace(' ', '')
            s_norm_math = s_n.replace(' ', '')
            math_ops = ['+', '-', '*', '/']
            math_error = False
            for op in math_ops:
                if (op in m_norm_math and op not in s_norm_math) or (op in s_norm_math and op not in m_norm_math):
                    math_error = True
                    has_logic_error = True
                    break
            
            negation_error = False
            if ("NOT IN" in m_n.upper() and "NOT IN" not in s_n.upper() and " IN " in s_n.upper()) or \
               ("NOT IN" in s_n.upper() and "NOT IN" not in m_n.upper() and " IN " in m_n.upper()):
                negation_error = True
                has_logic_error = True

            clause_inc = 0.0
            eq_found = False
            
            if m_n == s_n or (m_pts and m_pts == s_pts): 
                clause_inc = 1.0
                eq_found = True
            elif m_pts and s_pts:
                found_pts = 0
                for mp in m_pts:
                    best_sim = 0
                    for sp in s_pts:
                        sim = difflib.SequenceMatcher(None, mp, sp).ratio()
                        if sim > best_sim: best_sim = sim
                    if best_sim >= 0.85: found_pts += 1
                    elif best_sim >= 0.7 and len(mp) >= 4: found_pts += 0.8
                rat = found_pts / len(m_pts)
                clause_inc = max(rat, 0.4)
                if rat >= 0.9: clause_inc = 1.0
                else: det.append(f"Khớp logic {k} ({int(rat*100)}%)")
                eq_found = True
            elif k == "select_cols" and (s_n == "*" or m_n == "*"):
                clause_inc = 0.95; det.append("Chấp nhận: Sử dụng SELECT * thay cho liệt kê cột cụ thể."); eq_found = True
            elif s_pts and m_pts.intersection(s_pts):
                rat = len(m_pts.intersection(s_pts)) / len(m_pts)
                clause_inc = max(rat, 0.4); det.append(f"Khớp {k} ({int(rat*100)}%)"); eq_found = True
            else:
                if k == "join_clause" and m_pts:
                    m_on = re.search(r'ON\s+(.+)', m_v, re.IGNORECASE)
                    m_on_n = super_normalize(m_on.group(1), m_al, m_tbls).replace(',', '') if m_on else m_n
                    s_w_n = super_normalize(s_el.get("where_clause", ""), s_al, s_tbls).replace(',', '')
                    if (m_on_n and s_w_n and (m_on_n in s_w_n or s_w_n in m_on_n)) or any(p in s_w_n for p in m_pts):
                        clause_inc = 0.95; det.append("Chấp nhận: Sử dụng Comma-Join thay cho INNER JOIN."); eq_found = True
                elif k == "where_clause" and m_pts:
                    s_j_n = super_normalize(s_el.get("join_clause", ""), s_al, s_tbls).replace(',', '')
                    if any(p in s_j_n for p in m_pts):
                        clause_inc = 0.95; det.append("Chấp nhận: Điều kiện lọc đặt ở JOIN (ON) thay vì WHERE."); eq_found = True

            if not eq_found:
                clause_names = {"select_cols": "SELECT", "where_clause": "WHERE", "join_clause": "JOIN", "group_by": "GROUP BY", "order_by": "ORDER BY"}
                det.append(f"Thiếu hoặc sai {clause_names.get(k, k)}")

            if math_error: clause_inc *= 0.4; det.append(f"Lỗi {k}: Sai phép toán (+, -, *, /)")
            if negation_error: clause_inc *= 0.3; det.append(f"Lỗi {k}: Sai logic phủ định (IN vs NOT IN)")
            m_count += clause_inc

        if t_count == 0:
            m_clean = re.sub(r'[^A-Z0-9]', '', model.upper()).strip()
            s_clean = re.sub(r'[^A-Z0-9]', '', student.upper()).strip()
            if not m_clean: return 0.5, "Không thể xác định thuật ngữ mẫu"
            if m_clean == s_clean or m_clean in s_clean: return 1.0, "Khớp thuật ngữ SQL"
            sim = difflib.SequenceMatcher(None, m_clean, s_clean).ratio()
            if sim >= 0.7 and len(m_clean) >= 2: return 0.9, "Khớp thuật ngữ SQL (có lỗi chính tả nhẹ)"
            return 0.0, f"Không khớp thuật ngữ SQL yêu cầu (Mong đợi: {m_clean})"

        score = m_count / t_count
        important_clauses = ["join_clause", "group_by", "where_clause"]
        missing_important = [c for c in important_clauses if c in m_el and c not in s_el]
        
        # TIERED SCORING - Priority: Matching -> Logic Reasoning Fallback
        if score < 0.9:
            if not missing_important and not has_logic_error:
                if is_simple:
                    score = max(score, 0.8)
                    det.append("Suy luận: Cấu trúc cơ bản chính xác (Fallback < 90%)")
                else:
                    # For complex queries, use the standard 0.75 structural boost
                    score = max(score, 0.75)
                    det.append("Suy luận: Tư duy logic cấu trúc phức tạp chính xác (Fallback < 90%)")
        
        is_agg = any(x in m_el.get("select_cols", "").upper() for x in ["SUM(", "COUNT(", "AVG(", "MIN(", "MAX("])
        if is_agg and m_el.get("group_by") and not s_el.get("group_by"): 
            return 0.15, "Lỗi Chí Tử: Truy vấn có Aggregate nhưng thiếu GROUP BY"
        
        if "NOT IN" in m_u and ("NOT EXISTS" in s_u or "EXCEPT" in s_u): 
            score = max(score, 0.98); det.append("Chấp nhận: Sử dụng logic NOT EXISTS/EXCEPT thay cho NOT IN.")
        
        if score >= 0.95: 
            return 1.0, "SQL Match: Chính xác hoàn toàn về logic.\nAI Reasoning:\n- " + "\n- ".join([d for d in det if "Chấp nhận" in d or "Khớp" in d]) if det else "SQL Match: Chính xác"
        
        reasoning = "AI Reasoning:\n- " + "\n- ".join(det) if det else ""
        return score, f"SQL Match: {int(score*100)}%\n{reasoning}"

    def _grade_sql_ddl(self, model: str, student: str) -> Tuple[float, str]:
        def tok(s): s = s.upper(); s = re.sub(r'--.*|/\*.*?\*/', '', s, flags=re.DOTALL); s = re.sub(r'([(),;=<>!+*/])', r' \1 ', s); return [t for t in s.split() if t.strip()]
        m_t, s_t = tok(model), tok(student); sc, pens = 1.0, []
        if "CREATE" in m_t and "TABLE" in m_t and ("CREATE" not in s_t or "TABLE" not in s_t): return 0.05, "Thiếu CREATE TABLE"
        for cc in ["PRIMARY KEY", "FOREIGN KEY", "REFERENCES"]:
            if cc in " ".join(m_t) and cc not in " ".join(s_t): sc -= 0.25; pens.append(f"Thiếu {cc}")
        return max(0.1, sc), "|".join(pens) if pens else "DDL hợp lệ"

    def _grade_sql_procedural(self, model: str, student: str) -> Tuple[float, str]:
        def tok(s): s = s.upper(); s = re.sub(r'--.*|/\*.*?\*/', '', s, flags=re.DOTALL); s = re.sub(r'([(),;=<>!+*/])', r' \1 ', s); return [t for t in s.split() if t.strip()]
        m_t, s_t = tok(model), tok(student); m_txt, s_txt = " ".join(m_t), " ".join(s_t)
        if ("TRIGGER" in m_txt and "TRIGGER" not in s_txt) or ("PROCEDURE" in m_txt and "PROCEDURE" not in s_txt): return 0.1, "Sai loại đối tượng"
        sc, pens = 1.0, []
        if "BEGIN" in m_t and "END" in m_t and "BEGIN" in s_t and "END" in s_t:
            m_b = m_t[m_t.index("BEGIN")+1 : len(m_t)-1-m_t[::-1].index("END")]
            s_b = s_t[s_t.index("BEGIN")+1 : len(s_t)-1-s_t[::-1].index("END")]
            cov = len(set(m_b) & set(s_b)) / len(set(m_b)) if m_b else 1.0
            if cov < 0.6: sc *= cov; pens.append(f"Nội dung không khớp ({int(cov*100)}%)")
        return max(0.1, sc), "|".join(pens) if pens else "Procedural hợp lệ"
    
    # MATH ANALYSIS METHODS
    
    def normalize_math_expression(self, expr: str) -> str:
        expr = re.sub(r'\s+', '', expr)
        expr = expr.replace('×', '*').replace('÷', '/')
        expr = expr.replace('^', '**')
        return expr.lower()
    
    def compare_math_answers(self, model: str, student: str) -> Tuple[float, str]:
        m_norm = self.normalize_math_expression(model)
        s_norm = self.normalize_math_expression(student)
        
        if m_norm == s_norm:
            return 1.0, "Đáp án chính xác"
        
        def extract_result(expr: str) -> str:
            if '=' in expr:
                result = expr.split('=')[-1].strip()
                result = re.sub(r'[^0-9.\-]+$', '', result)
                return result
            return expr
        
        def clean_filler(expr: str) -> str:
            fillers = ['ạ', 'nhé', 'nha', 'ha', 'vậy', 'thế', 'đó']
            for filler in fillers:
                expr = re.sub(rf'\s*{filler}\s*$', '', expr, flags=re.IGNORECASE)
            return expr.strip()
        
        s_cleaned = clean_filler(s_norm)
        m_cleaned = clean_filler(m_norm)
        
        if s_cleaned == m_cleaned:
            return 1.0, "Đáp án chính xác"
        
        s_result = extract_result(s_cleaned)
        m_result = extract_result(m_cleaned)
        
        if s_result == m_result:
            return 1.0, "Đáp án đúng (viết đầy đủ phép tính)"
        
        m_nums = set(re.findall(r'-?\d+\.?\d*', m_result))
        s_nums = set(re.findall(r'-?\d+\.?\d*', s_result))
        
        if m_nums and s_nums:
            if m_nums == s_nums:
                return 0.98, "Giá trị đúng, cách viết khác"
            
            if m_nums.issubset(s_nums) or s_nums.issubset(m_nums):
                return 0.95, "Đáp án đúng"
            
            common = m_nums & s_nums
            if common:
                ratio = len(common) / len(m_nums)
                return 0.5 + (ratio * 0.3), f"Đúng một phần: {len(common)}/{len(m_nums)} giá trị"
        
        return 0.3, "Không thể so khớp đáp án toán học"
    
    # MAIN GRADING METHOD
    def grade(self, model_text: str, student_text: str, max_points: float) -> Optional[Dict[str, Any]]:
        # 1. EARLY FAKER CHECK (Always check even if type unknown)
        from .faker_detector import is_meaningless_answer
        is_faker, faker_reason = is_meaningless_answer(student_text)
        if is_faker:
            return {
                "score": 0.0,
                "type": "Đối phó",
                "explanation": f"Reasoning: {faker_reason}. Không chấm điểm cho bài làm đối phó/vô nghĩa."
            }

        model_type = self.detect_answer_type(model_text)
        student_type = self.detect_answer_type(student_text)
        is_tech = model_type in ["code", "sql", "math"]
        
        logger.info(f"CodeAnalyzer: model_type={model_type}, student_type={student_type}")
        
        if model_type == "text":
            return None
        
        if model_type != "text" and student_type == "text":
            if self._is_short_tech_typo(model_text, student_text):
                logger.info(f"Global Typo Rescue: {model_text} vs {student_text}")
                pass # Cho phép đi tiếp
            else:
                return {
                    "score": 0.0,
                    "type": "Wrong Format",
                    "explanation": f"Sai bản chất: Yêu cầu trả lời dạng {model_type}, sinh viên viết văn bản thường không chứa thuật ngữ chuyên môn."
                }
        
        # CODE GRADING
        if model_type == "code":
            # Kiểm tra xin xỏ/đối phó ẩn trong bài code
            from .faker_detector import contains_faker_in_code
            has_f_in_c, f_c_reas = contains_faker_in_code(student_text)
            if has_f_in_c:
                return {"score": 0.0, "type": "Đối phó", "explanation": f"Reasoning: {f_c_reas}. Không chấm điểm cho bài code chứa nội dung đối phó."}
                
            has_error, error_msg = self.check_logic_errors(model_text, student_text)
            if has_error:
                return {
                    "score": max_points * 0.1,
                    "type": "Logic Error",
                    "explanation": error_msg
                }
            
            model_func = self.detect_function_type(model_text)
            student_func = self.detect_function_type(student_text)
            
            if model_func != "unknown" and student_func != "unknown":
                # Cho phép overlap giữa các bài OOP
                if model_func != student_func and not (model_func.startswith("oop_") and student_func.startswith("oop_")):
                    return {
                        "score": max_points * 0.15,
                        "type": "Wrong Algorithm",
                        "explanation": f"Yêu cầu {model_func}, sinh viên làm {student_func}"
                    }
            
            struct_sim, penalties = self.compare_code_structure(model_text, student_text)
            is_same_algo = (model_func != "unknown" and student_func != "unknown" and model_func == student_func)
            
            if struct_sim < 0.45 and not is_same_algo:
                val = 0.0 if struct_sim < 0.25 else struct_sim * 0.5
                penalties.append(f"Lỗi Tổng quan: Cú pháp/Cấu trúc sai lệch quá nhiều so với đáp án (Similarity: {struct_sim:.0%})")
                struct_sim = val
            elif is_same_algo and struct_sim < 0.3:
                logger.info(f"Code structure differs ({struct_sim:.2f}) but algorithm matches ({model_func}). Allowing.")
            
            def strip_comments_and_blank_lines(c):
                no_cmt = re.sub(r'//.*', '', c)
                no_cmt = re.sub(r'/\*.*?\*/', '', no_cmt, flags=re.DOTALL)
                return "\n".join([line for line in no_cmt.splitlines() if line.strip()])

            m_clean = strip_comments_and_blank_lines(model_text)
            s_clean = strip_comments_and_blank_lines(student_text)
            
            m_lines = len(m_clean.splitlines())
            s_lines = len(s_clean.splitlines())
            
            logger.info(f"Code Length Check: student={s_lines}, model={m_lines}, ratio={s_lines/m_lines if m_lines else 0:.2f}")

            placeholder_patterns = [
                r"#.*đệ quy", r"#.*viết tiếp", r"#.*\bTODO\b", r"#.*\.{3}",
                r"//.*\bTODO\b", r"/\*.*\bTODO\b"
            ]
            for p in placeholder_patterns:
                if re.search(p, student_text, re.IGNORECASE) and (s_lines / m_lines) < 0.5:
                    penalties.append("Lỗi Nửa chừng: Code chưa hoàn thiện (chứa comment placeholder và quá ngắn)")
                    struct_sim *= 0.4

            if m_lines > 2 and s_lines / m_lines < 0.4:
                 val = 0.0 if struct_sim < 0.3 else 0.4 * struct_sim
                 penalties.append(f"Lỗi Độ Dài Bất Thường: Code nộp quá nguyên thủy hoặc thiếu nhiều function so với đáp án ({s_lines}/{m_lines} dòng)")
                 struct_sim = val

            # Áp dụng Hình thức phạt nặng nếu sai cấu trúc (Đặc biệt với lỗi OOP/Code style)
            if struct_sim > 0.8:
                final_score_ratio = min(1.0, struct_sim * 1.25)
            elif struct_sim >= 0.5:
                final_score_ratio = struct_sim * 0.8
            else:
                final_score_ratio = struct_sim * 0.3
                
            if struct_sim < 1.0 and penalties:
                explanation = "Các lỗi vi phạm (AI Rubric):\n- " + "\n- ".join(penalties) + f"\n(Code Match: {struct_sim:.2f} / Score Ratio: {final_score_ratio:.2f})"
            else:
                explanation = f"Code hợp lệ hoàn toàn (Structure Match: {struct_sim:.2f})"

            return {
                "score": max_points * final_score_ratio,
                "type": "Code Match",
                "explanation": explanation
            }
        
        # SQL GRADING
        if model_type == "sql":
            # Kiểm tra xin xỏ/đối phó ẩn trong SQL
            from .faker_detector import contains_faker_in_code
            has_f_in_s, f_s_reas = contains_faker_in_code(student_text)
            if has_f_in_s:
                return {"score": 0.0, "type": "Đối phó", "explanation": f"Reasoning: {f_s_reas}. Không chấm điểm cho SQL chứa nội dung đối phó."}

            if student_type != "sql" and not self._is_short_tech_typo(model_text, student_text):
                return {
                    "score": 0.0,
                    "type": "Wrong Format",
                    "explanation": "Sai định dạng: Yêu cầu trả lời bằng câu lệnh hoặc thuật ngữ SQL chuyên môn."
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
        
        return None

def analyze_technical_answer(model: str, student: str, max_points: float) -> Optional[Dict[str, Any]]:
    analyzer = CodeAnalyzer()
    return analyzer.grade(model, student, max_points)