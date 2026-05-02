"""
faker_detector.py
Bộ lọc nhận diện câu trả lời đối phó / xin xỏ / vô nghĩa.
Được gọi TRƯỚC TẤT CẢ các pipeline chấm điểm.

Quy tắc:
- Câu trả lời chứa cụm từ đối phó/xin xỏ → 0.0đ
- Câu trả lời < 5 ký tự mà không phải code/số → 0.0đ  
- Câu trả lời ngắn nhưng hợp lệ (ví dụ: "12", "True") → KHÔNG chặn, để pipeline chấm bình thường
"""

import re
import logging

logger = logging.getLogger(__name__)

# === CÂU TRẢ LỜI PLACEHOLDER (Frontend gửi khi SV không trả lời) ===
NO_ANSWER_PLACEHOLDERS = [
    "sinh viên chưa trả lời câu này",
    "sinh vien chua tra loi cau nay",
    "chưa trả lời",
    "chua tra loi",
    "chưa có câu trả lời",
    "no answer",
    "not answered",
    "unanswered",
    "empty",
    "n/a",
    "null",
    "none",
    "undefined",
]

# === DANH SÁCH ĐEN: Các cụm từ đối phó phổ biến ===
FAKER_PHRASES = [
    # =============================================
    # 1. ĐỐI PHÓ TRỰC TIẾP
    # =============================================
    r"\bchịu\b", r"\bchiu\b", r"\bko biết\b", r"\bko biet\b",
    r"\bkhông biết\b", r"\bkhong biet\b", r"\bk biết\b", r"\bk biet\b",
    r"\bkh[oô]ng\s+bi[eế]t\b", r"\bko\s+b[ií]t\b", r"\bko\s+bik\b", r"\bk\s+b[ií]t\b",
    r"\bbỏ qua\b", r"\bbo qua\b", r"\bskip\b",
    r"\bchả biết\b", r"\bcha biet\b", r"\bchả hiểu\b",
    r"\bno idea\b", r"\bi don'?t know\b", r"\bidk\b",
    r"\bkhó quá\b", r"\bkhó quá đi\b",
    r"\bchưa học\b", r"\bchua hoc\b",
    r"\bnhường điểm\b",
    r"\bkh[oô]ng\s+nh[oớ]\b",  # không nhớ
    r"\bquên\s+h[eế]t\b",       # quên hết
    r"\bkh[oô]ng\s+thu[oộ]c\b", # không thuộc
    r"ch[uư]a\s+tr[aả]\s+l[oờ]i",  # chưa trả lời
    r"sinh\s+vi[eê]n\s+ch[uư]a",   # sinh viên chưa...
    
    # =============================================
    # 2. CƯỜI ĐÙA / TROLLING
    # =============================================
    r"\bhihi\b", r"\bhehe\b", r"\bhaha\b", r"\blol\b", r"\bhaha+\b",
    r"\bhuhu\b", r"\bhic\b", r"\bhíc\b",
    r"\bkkk+\b", r"\bwkwk\b",  # Cười kiểu gen Z
    r"\blmao\b", r"\brofl\b", r"\bomg\b",
    r"\bbruh\b", r"\bcap\b", r"\bskibidi\b", r"\briz+\b",  # Meme slang
    r"\bhông\s+biết\b",        # "hông biết"
    r"\bchã\b", r"\bchà\b",
    r"\bôi\s+dồi\b",           # ôi dồi ôi
    r"\btrời\s+ơi\b",          # trời ơi
    
    # =============================================
    # 3. XIN XỎ ĐIỂM (flexible regex)
    # =============================================
    r"xin\s+(?:\w+\s+){0,3}đi[eể]m",     # "xin điểm", "xin ít điểm", "xin tí điểm"
    r"cho\s+(?:\w+\s+){0,3}xin",           # "cho em xin", "cho e xin tí"
    r"th[aầ]y\s+cho\s+(?:\w+\s+){0,3}",    # "thầy cho em"
    r"c[oô]\s+cho\s+(?:\w+\s+){0,3}",      # "cô cho em"
    r"nương\s*tay", r"nuong\s*tay",
    r"thương\s+em", r"thuong\s+em",
    r"cho\s+(?:\w+\s+){0,2}qua\s+m[oô]n",  # "cho ... qua môn"
    r"làm\s+ơn\s+cho", r"lam\s+on\s+cho",
    r"xin\s+th[aầ]y", r"xin\s+c[oô]",
    r"ai\s+cho\s+em", r"ai\s+nương",
    r"em\s+xin\s+(?:l[ỗo]i|c[oô]|th[aầ]y|đi[eể]m|qua|n[uư][oơ]ng)",
    r"cho\s+(?:\w+\s+){0,2}đi[eể]m",       # "cho em điểm", "cho điểm"
    r"t[oô]i\s+xin",                        # "tôi xin"
    r"xin\s+(?:\w+\s+){0,2}qua",            # "xin qua", "xin cho qua"
    r"tha\s+cho",                            # "tha cho em"
    r"b[oỏ]\s+qua\s+cho",                   # "bỏ qua cho em"
    r"gi[uú]p\s+(?:\w+\s+){0,2}v[oớ]i",    # "giúp em với"

    # =============================================
    # 4. THỪA NHẬN KHÔNG LÀM ĐƯỢC
    # =============================================
    r"em\s+không\s+(?:làm|lam)\s+(?:được|duoc)",
    r"em\s+không\s+(?:biết|biet)\s+(?:làm|lam)",
    r"không\s+(?:biết|biet)\s+(?:làm|lam)",
    r"em\s+chịu", r"em\s+chiu", r"ko\s+bik\s+lam", r"ko\s+bit\s+lam", r"k\s+bik\s+lam",
    r"bài\s+này\s+khó", r"bai\s+nay\s+kho",
    r"không\s+(?:làm|lam)\s+(?:được|duoc)",
    r"chưa\s+làm", r"chua\s+lam",
    r"để\s+trống", r"de\s+trong",
    r"không\s+kịp", r"khong\s+kip",
    r"h[eế]t\s+gi[oờ]", r"het\s+gio",
    r"em\s+xin\s+lỗi",
    r"không\s+học", r"khong\s+hoc",
    r"chưa\s+ôn", r"chua\s+on",
    r"không\s+hiểu\s+đề", r"khong\s+hieu\s+de",
    r"đề\s+khó\s+quá",
    r"câu\s+này\s+khó",
    r"không\s+nghĩ\s+ra",

    # =============================================
    # 5. MẤT DẠY / CHỬI BỚI / TỤC TĨU
    # =============================================
    # Tiếng Việt
    r"\bđ[éeê]o\b", r"\bdeo\b",
    r"\bđ[ií]t\b",
    r"\bđm\b", r"\bđkm\b", r"\bdkm\b", r"\bđ[ée]o\s*m[eẹ]\b",
    r"\bd[iị]t\s*m[eẹ]\b", r"\bdit\s*me\b",
    r"\bcl\b", r"\bvcl\b", r"\bvl\b", r"\bvkl\b",
    r"\blồn\b", r"\blon\b", r"\bl[oồ]n\b",
    r"\bcặc\b", # r"\bcac\b" (Loại bỏ vì trùng với từ 'các' số nhiều)
    r"\bcc\b",  # viết tắt chửi
    r"\bđcm\b", r"\bdcm\b",
    r"\bcon\s*m[eẹ]\b",
    r"\bm[eẹ]\s*m[àa]y\b", r"\bme\s*may\b",
    r"\bngu\s+v[cklãả]+\b",
    r"\bth[aằ]ng\s+ngu\b",
    r"\b[đd][oồ]\s+ngu\b",
    r"\bđ[ií]t\s+m[eẹ]\s+m[àa]y\b",
    r"\bf[u]+ck\b", r"\bsh[i]+t\b", r"\bbitch\b", r"\bdamn\b",
    r"\bwtf\b", r"\bstfu\b",
    r"\bass\b", r"\bdick\b",
    r"\bm[eẹ]\s+n[oó]\b",  # "mẹ nó"
    r"\bchó\b.*\bngu\b",    # "đồ chó ngu"
    r"\bn[gu]+\s+v[ãả]+i\b",  # ngu vãi
    r"\bkh[oố]n\s*n[aạ]n\b", # khốn nạn
    r"\bv[oô]\s*d[uụ]ng\b",  # vô dụng (trong ngữ cảnh chửi)
    
    # =============================================
    # 6. TRẢ LỜI VÔ NGHĨA / NHẢM NHÍ
    # =============================================
    # r"^[a-z]{1,3}$",                     # Đã loại bỏ để tránh chặn từ khóa SQL như FOR, TOP
    r"\bblah\s*blah\b",
    r"\byolo\b",
    r"\btest\b.*\btest\b",               # "test test test"
    r"\basdf\b", r"\bqwer\b", r"\bzxcv\b",  # Keyboard mashing
    r"\bjkl\b",
    r"^[a-zA-Z]\s+[a-zA-Z]\s+[a-zA-Z]$",  # "a b c"
    r"\bhm+\b",                           # "hmm", "hmmmm"
    r"\buh+\b",                           # "uhh", "uhhh"
    
    # =============================================
    # 7. ĐIỀN BỪA / SPAM KÝ TỰ
    # =============================================
    r"^\.+$",              # Chỉ toàn dấu chấm
    r"^\?+$",              # Chỉ toàn dấu hỏi  
    r"^!+$",               # Chỉ toàn dấu chấm than
    r"^-+$",               # Chỉ toàn dấu gạch
    r"^[.!?\-\s]+$",       # Chỉ dấu câu + khoảng trắng
    r"^(.)\1{3,}$",        # Cùng 1 ký tự lặp >= 4 lần (aaaa, xxxx, !!!!)
    # r"^[a-z]{1,2}\s*$",    # Đã loại bỏ để tránh chặn từ khóa SQL ngắn
    r"^[\W\s]+$",          # Chỉ ký tự đặc biệt
]

# Compile regex patterns
_FAKER_PATTERNS = [re.compile(p, re.IGNORECASE) for p in FAKER_PHRASES]


def is_meaningless_answer(student_text: str, model_text: str = "", question_text: str = None) -> tuple:
    if not student_text:
        return True, "Câu trả lời trống"
    
    text = student_text.strip()
    m_text = model_text.strip().lower() if model_text else ""
    
    # === 0. Kiểm tra placeholder (SV không trả lời) ===
    if text.lower() in NO_ANSWER_PLACEHOLDERS:
        logger.info(f"[Faker] Placeholder detected: '{text}'")
        return True, "Sinh viên chưa trả lời câu này"
    
    # === 0b. Kiểm tra Copy Đề Bài (Ưu tiên cao) ===
    if question_text:
        is_copy, copy_reason = is_copy_of_question(text, question_text)
        if is_copy:
            logger.info(f"[Faker] Question copy detected: '{text[:50]}...' Reason: {copy_reason}")
            return True, copy_reason

    # === 1. Kiểm tra độ dài tối thiểu ===
    is_valid_short = bool(re.match(r'^[\d\s.+\-×÷*/=,]+$', text))  # Toán / Số lẻ
    is_valid_short = is_valid_short or text.lower() in ('true', 'false', 'yes', 'no', 'đúng', 'sai', 'có', 'không')
    # Whitelist các từ khóa kỹ thuật SQL/Code ngắn
    tech_keywords = {
        'top', 'for', 'in', 'as', 'on', 'sum', 'avg', 'min', 'max', 'join', 
        'after', 'before', 'with', 'exec', 'int', 'bool', 'void'
    }
    is_valid_short = is_valid_short or text.lower() in tech_keywords
    is_valid_short = is_valid_short or bool(re.match(r'^[A-Z]', text) and len(text.split()) <= 3)  # Tên riêng
    
    # TỰ ĐỘNG CHẤP NHẬN NẾU LÀ MỘT PHẦN CỦA ĐÁP ÁN MẪU (Dù ngắn < 4 ký tự)
    if m_text and text.lower() in m_text and len(text) >= 2:
        is_valid_short = True

    if len(text) < 2: # Chỉ chặn nếu < 2 ký tự (1 ký tự thường là vô nghĩa trừ khi là số)
        if not text.isdigit():
            return True, "Câu trả lời quá ngắn (1 ký tự)"

    # Nếu < 4 ký tự mà không nằm trong whitelist hoặc không phải một phần của đáp án mẫu
    if len(text) < 4 and not is_valid_short:
        logger.info(f"[Faker] Câu trả lời quá ngắn ({len(text)} ký tự): '{text}'")
        return True, f"Câu trả lời quá ngắn và không mang ý nghĩa ({len(text)} ký tự)"
    
    # === 2. Kiểm tra danh sách đen ===
    text_lower = text.lower().strip()
    for pattern in _FAKER_PATTERNS:
        if pattern.search(text_lower):
            logger.info(f"[Faker] Phát hiện cụm từ đối phó: '{text}' → Pattern: {pattern.pattern}")
            return True, f"Câu trả lời mang tính đối phó/xin xỏ"
    
    # === 3. Kiểm tra toàn bộ nội dung chỉ là emoji/ký tự đặc biệt ===
    cleaned = re.sub(r'[\s\W_]+', '', text)
    if len(cleaned) == 0 and len(text) > 0:
        logger.info(f"[Faker] Chỉ chứa ký tự đặc biệt: '{text}'")
        return True, "Câu trả lời chỉ chứa ký tự đặc biệt"
    
    # === 4. Kiểm tra spam ký tự lặp lại (aaaaaaa, hhhhh) ===
    cleaned_chars = text.lower().replace(' ', '')
    if len(cleaned_chars) >= 3 and len(set(cleaned_chars)) <= 2:
        logger.info(f"[Faker] Spam ký tự lặp: '{text}'")
        return True, "Câu trả lời spam ký tự lặp lại"
    
    # === 5. Kiểm tra spam từ lặp (abc abc abc abc) ===
    words = text_lower.split()
    if len(words) >= 3:
        unique_words = set(words)
        if len(unique_words) <= 2 and len(words) >= 4:
            logger.info(f"[Faker] Spam từ lặp lại: '{text}'")
            return True, "Câu trả lời spam từ lặp lại"
        
        if len(text) > 30:
            half = len(text) // 2
            if text[:half].strip().lower() == text[half:].strip().lower():
                logger.info(f"[Faker] Lặp lại cả đoạn văn: '{text[:50]}...'")
                return True, "Câu trả lời lặp lại nội dung"
            
            parts = [w for w in re.split(r'[,.\s]+', text_lower) if w]
            if len(parts) >= 10:
                prefix = " ".join(parts[:3])
                if text_lower.count(prefix) >= 3:
                    logger.info(f"[Faker] Lặp lại cụm từ '{prefix}' nhiều lần")
                    return True, "Câu trả lời lặp lại cụm từ nhiều lần"
    
    # === 6. Kiểm tra chuỗi ký tự ngẫu nhiên (keyboard mashing) ===
    text_no_space = re.sub(r'\s+', '', text_lower)
    if len(text_no_space) >= 5: # Hạ ngưỡng từ 8 xuống 5
        vowels = len(re.findall(r'[aeiouyàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵăâđêôơư]', text_no_space))
        consonants = len(re.findall(r'[bcdfghjklmnpqrstvwxz]', text_no_space))
        
        # Nếu không có nguyên âm mà dài >= 5 ký tự (ví dụ: fgdgf) -> Vô nghĩa
        if vowels == 0 and len(text_no_space) >= 5:
            logger.info(f"[Faker] Gibberish (no vowels): '{text}'")
            return True, "Câu trả lời không có nguyên âm (vô nghĩa)"
            
        # Tỷ lệ phụ âm / nguyên âm quá cao
        if vowels > 0:
            ratio = consonants / vowels
            # Chuỗi ngắn (5-10): Ratio > 4
            # Chuỗi trung bình (10-20): Ratio > 3.5
            # Chuỗi dài (>20): Ratio > 3
            if (len(text_no_space) <= 10 and ratio > 4) or \
               (len(text_no_space) <= 20 and ratio > 3.5) or \
               (len(text_no_space) > 20 and ratio > 3):
                logger.info(f"[Faker] Gibberish (consonant ratio {ratio:.1f}): '{text}'")
                return True, "Câu trả lời có cấu trúc từ bất thường (vô nghĩa)"

    # 6b. Sự đa dạng ký tự quá thấp trong chuỗi dài
    char_variety = len(set(text_no_space))
    if len(text_no_space) >= 12:
        variety_ratio = char_variety / len(text_no_space)
        if variety_ratio < 0.25: # Ví dụ 12 ký tự mà chỉ có 2-3 loại chữ
            logger.info(f"[Faker] Low character variety ({variety_ratio:.2f}): '{text}'")
            return True, "Câu trả lời quá ít loại ký tự (nghi ngờ điền bừa)"
    
    # 6c. Chuỗi quá dài không có khoảng trắng
    if len(text) > 20 and ' ' not in text and not text.startswith(('http', 'www', '/')):
        logger.info(f"[Faker] Long string without spaces: '{text}'")
        return True, "Câu trả lời là chuỗi ký tự quá dài không có khoảng trắng"

    # === 8. Kiểm tra nhồi nhét từ khóa (Keyword Spam) ===
    sql_keywords = {"select", "insert", "update", "delete", "where", "from", "join", "group", "order", "having", "distinct", "top", "limit", "offset"}
    s_words = set(text_lower.split())
    if len(s_words) >= 4:
        kw_count = sum(1 for w in s_words if w in sql_keywords)
        if kw_count >= 4 and len(words) <= 12:
            logger.info(f"[Faker] Keyword Spam detected: {kw_count} keywords in {len(words)} words")
            return True, "Câu trả lời nhồi nhét quá nhiều từ khóa (Keyword Spam)"

    return False, ""




def contains_faker_in_code(student_text: str) -> tuple:
    """
    Kiểm tra xem trong bài code của sinh viên có chứa nội dung xin xỏ/đối phó không.
    Dùng cho trường hợp sinh viên viết vài dòng code rồi thêm text xin điểm.
    
    Returns:
        (has_faker: bool, reason: str)
    """
    if not student_text:
        return False, ""
    
    text_lower = student_text.lower()
    
    # Tách phần text thuần (không phải code) ra khỏi bài làm
    # Loại bỏ các dòng code hợp lệ (bắt đầu bằng #include, using, class, def, int, void, ...)
    code_line_patterns = [
        r'^\s*#\s*include', r'^\s*using\s+namespace', r'^\s*class\s+',
        r'^\s*def\s+', r'^\s*int\s+', r'^\s*void\s+', r'^\s*float\s+',
        r'^\s*double\s+', r'^\s*string\s+', r'^\s*char\s+', r'^\s*bool\s+',
        r'^\s*public', r'^\s*private', r'^\s*protected',
        r'^\s*return\b', r'^\s*if\s*[\(]', r'^\s*for\s*[\(]', r'^\s*while\s*[\(]',
        r'^\s*cout\s*<<', r'^\s*cin\s*>>', r'^\s*print\s*\(',
        r'^\s*[{}();]', r'^\s*$',
        r'^\s*SELECT\b', r'^\s*FROM\b', r'^\s*WHERE\b', r'^\s*CREATE\b',
        r'^\s*INSERT\b', r'^\s*UPDATE\b', r'^\s*DELETE\b',
    ]
    
    non_code_lines = []
    for line in student_text.splitlines():
        line_stripped = line.strip()
        if not line_stripped:
            continue
        is_code_line = any(re.match(p, line_stripped, re.IGNORECASE) for p in code_line_patterns)
        if not is_code_line:
            non_code_lines.append(line_stripped)
    
    # Ghép phần text không phải code lại, kiểm tra faker
    non_code_text = " ".join(non_code_lines)
    if non_code_text:
        for pattern in _FAKER_PATTERNS:
            if pattern.search(non_code_text.lower()):
                logger.info(f"[Faker-in-Code] Phát hiện xin xỏ trong bài code: '{non_code_text[:60]}'")
                return True, f"Bài code chứa nội dung xin xỏ/đối phó: \"{non_code_text[:50]}\""
    
    return False, ""



def is_copy_of_question(student_text: str, question_text: str) -> tuple:
    """
    Phát hiện sinh viên copy lại đề bài để lấy điểm "vớt".
    """
    if not student_text or not question_text:
        return False, ""
        
    # Chuẩn hóa (Loại bỏ các tiền tố như "Câu 1:", "Câu 2:", "Question 1:", v.v.)
    def normalize_for_copy(t):
        t = t.lower()
        # Loại bỏ tiền tố "Câu X:"
        t = re.sub(r'^(?:câu|question|q|c)\s*\d+\s*[:.-]?\s*', '', t, flags=re.IGNORECASE)
        # Loại bỏ điểm số "(2đ)", "[2 pts]" ở cuối hoặc đầu
        t = re.sub(r'\(?\d+\s*(?:đ|pts|điểm|diem)\)?', '', t, flags=re.IGNORECASE)
        t = re.sub(r'[^\w\s]', '', t)
        return " ".join(t.split())
        
    s_norm = normalize_for_copy(student_text)
    q_norm = normalize_for_copy(question_text)
    
    if len(q_norm) < 10: 
        return False, ""
        
    # 1. Kiểm tra chứa đề bài (Containment) - Xử lý trường hợp "sdfsdf + Đề bài"
    if q_norm in s_norm:
        # Nếu phần dư ra không quá nhiều (dưới 50% độ dài đề hoặc < 100 ký tự)
        extra_len = len(s_norm) - len(q_norm)
        if extra_len < len(q_norm) * 0.5 or extra_len < 100:
             return True, "Nội dung chủ yếu là lặp lại đề bài (Copy-paste)"

    # 2. Ngược lại: Đề bài chứa bài làm (Trường hợp SV copy 1 đoạn đề)
    if len(s_norm) > 15 and s_norm in q_norm:
        return True, "Nội dung là một phần của đề bài"

    # 3. Kiểm tra tỷ lệ trùng lặp từ (Overlap)
    s_words = s_norm.split()
    q_words = q_norm.split()
    
    if not q_words or not s_words: return False, ""
    
    s_set = set(s_words)
    q_set = set(q_words)
    
    intersection = s_set.intersection(q_set)
    overlap_ratio = len(intersection) / len(q_set)
    
    # Nếu trùng > 80% số từ của đề bài
    if overlap_ratio > 0.80:
        # Và bài làm không quá dài so với đề (chứng tỏ không có ý mới)
        if len(s_set) <= len(q_set) * 1.3:
            return True, f"Nội dung trùng lặp {int(overlap_ratio*100)}% với đề bài"
            
    # 4. Kiểm tra Longest Common Substring (Xử lý chèn rác ở giữa)
    if len(s_norm) > 20 and len(q_norm) > 20:
        from difflib import SequenceMatcher
        match = SequenceMatcher(None, s_norm, q_norm).find_longest_match(0, len(s_norm), 0, len(q_norm))
        if match.size > len(q_norm) * 0.8:
            return True, "Phát hiện đoạn copy từ đề bài quá lớn"

    return False, ""
