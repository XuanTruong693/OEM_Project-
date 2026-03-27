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
        
        # Check SQL first
        sql_score = sum(1 for p in self.sql_indicators if re.search(p, text, re.IGNORECASE))
        if sql_score >= 2:
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
            class_score = 1.0 # Model ko có class, student có -> Thưởng nhẹ hoặc giữ nguyên
        else:
            class_score = 1.0 # Cả 2 đều ko có class -> pass
            
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
            
        # Tính Base Score cho Interface (Tối đa 0.3 -> 0.4 điểm)
        # Tức là nếu viết đúng interface 100%, được vớt khoảng 30% - 40% số điểm của phần code structure
        if m_classes > 0:
            interface_score = (class_score * 0.4) + (func_score * 0.4) + (attr_score * 0.2)
        else:
            interface_score = (func_score * 0.7) + (attr_score * 0.3)
            
        # Điều chỉnh tỷ lệ rớt: Interface đúng hoàn toàn -> 0.35 * max_points
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
                # final_tokens.append('<DECL>') # Avoid polluting the sequence with too many DECLs
                pass # Eliminating declaration noise completely works even better
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
        
        # Allow 15% slack for acceptable structural deviations
        if coverage < 0.85:
            missing_segments = []
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                if tag in ('delete', 'replace'):
                    missing_segment = m_tokens[i1:i2]
                    # Filter out purely noisy/non-informative tokens for error display
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
        # Điểm vớt nếu sinh viên viết đúng cấu trúc OOP/Hàm nhưng trống rỗng
        interface_base_score = self._grade_interface_only(m_struct, s_struct)
        
        # === UNIVERSAL TOKENIZER (BLOCK MATCHING) ===
        # Sử dụng Tokenizer để phân tích cú pháp trừu tượng, tìm kiếm block bị thiếu
        block_multiplier, block_penalties, block_coverage = self._grade_algorithm_block(model, student)
        
        # Mã Hóa Vạn Năng: Nếu Tokenizer xác nhận thuật toán khớp (coverage cao), 
        # dùng nó làm điểm base đè lên mọi điểm số string/skeleton cũ vốn thiếu chính xác
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
        
        def normalize_sql_val(text):
            if not text: return ""
            text = text.lower().strip()
            text = re.sub(r'\b\w+\.', '', text)
            text = re.sub(r'\s+as\s+\w+', '', text)
            text = re.sub(r'\s+', ' ', text)
            return text

        m_table = m_elements.get("from_table", "").lower()
        s_table = s_elements.get("from_table", "").lower()
        
        if m_table and s_table and m_table != s_table:
            return 0.1, f"Sai tên bảng: yêu cầu '{m_table}', sinh viên dùng '{s_table}'"
        
        match_count = 0
        total_count = 0
        
        for key in m_elements:
            if m_elements.get(key):
                total_count += 1
                if key in s_elements:
                    m_val = normalize_sql_val(m_elements[key])
                    s_val = normalize_sql_val(s_elements.get(key, ""))
                    
                    m_parts = set(x.strip() for x in m_val.split(','))
                    s_parts = set(x.strip() for x in s_val.split(','))
                    
                    if m_val == s_val or m_parts == s_parts:
                        match_count += 1
        
        score = match_count / total_count if total_count > 0 else 0.5
        return score, f"SQL match: {match_count}/{total_count} elements"
    
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
        model_type = self.detect_answer_type(model_text)
        student_type = self.detect_answer_type(student_text)
        
        logger.info(f"CodeAnalyzer: model_type={model_type}, student_type={student_type}")
        
        if model_type == "text":
            return None
        
        if model_type != "text" and student_type == "text":
            return {
                "score": max_points * 0.1,
                "type": "Wrong Format",
                "explanation": f"Yêu cầu trả lời dạng {model_type}, sinh viên viết văn bản thường"
            }
        
        # CODE GRADING
        if model_type == "code":
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
        
        return None

def analyze_technical_answer(model: str, student: str, max_points: float) -> Optional[Dict[str, Any]]:
    analyzer = CodeAnalyzer()
    return analyzer.grade(model, student, max_points)