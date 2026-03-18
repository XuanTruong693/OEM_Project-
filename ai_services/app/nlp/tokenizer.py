import re
from typing import Dict, Set, List

# =========================================================================
# 1. KHO DỮ LIỆU TỪ VỰNG (VOCABULARY DATA)
# =========================================================================

VIETNAMESE_STOPWORDS: Set[str] = {
    # === Liên từ / Connectors ===
    "và", "với", "cùng", "cùng với", "hoặc", "hay", "hay là", "nhưng", "tuy", "tuy nhiên",
    "mà", "nên", "vì", "vì vậy", "do", "do đó", "bởi", "bởi vì", "nếu", "thì", "khi", "lúc",
    "trước khi", "sau khi", "trong khi", "mặc dù", "dù", "dẫu", "dẫu cho", "cho dù",
    "để", "nhằm", "hầu", "ngay", "ngay khi", "miễn là", "trừ khi", "ngoại trừ",
    
    # === Đại từ / Pronouns ===
    "tôi", "tao", "mình", "ta", "chúng tôi", "chúng ta", "chúng mình",
    "bạn", "các bạn", "cậu", "mày", "anh", "chị", "em", "ông", "bà", "cô", "chú", "thầy",
    "nó", "hắn", "họ", "chúng nó", "người ta", "ai", "gì", "nào", "đâu", "sao", "bao nhiêu",
    "này", "đó", "kia", "ấy", "đây", "đấy",
    
    # === Trợ từ / Particles ===
    "là", "có", "được", "bị", "phải", "cần", "nên", "sẽ", "đã", "đang", "vừa", "mới", "sắp",
    "còn", "vẫn", "cũng", "lại", "chỉ", "mà", "thôi", "rồi", "đi", "xong", "hết",
    "quá", "lắm", "rất", "khá", "hơi", "cực", "cực kỳ", "vô cùng", "hết sức",
    
    # === Từ chỉ định / Determiners ===
    "một", "các", "những", "mọi", "tất cả", "toàn bộ", "từng", "mỗi", "vài", "một số",
    "nhiều", "ít", "đầy", "đủ", "thêm", "nữa", "khác", "riêng", "chung",
    
    # === Giới từ / Prepositions ===
    "ở", "tại", "trong", "ngoài", "trên", "dưới", "giữa", "bên", "cạnh", "gần", "xa",
    "trước", "sau", "về", "đến", "từ", "theo", "qua", "sang", "vào", "ra", "lên", "xuống",
    
    # === Từ đệm / Fillers ===
    "à", "ạ", "ơi", "nhé", "nha", "ha", "hả", "nhỉ", "chứ", "đấy", "thế", "vậy",
    "thì", "mà", "thôi", "đi", "nào", "xem", "coi", "thử",
    
    # === Từ nối học thuật / Academic Connectors ===
    "thứ nhất", "thứ hai", "thứ ba", "đầu tiên", "tiếp theo", "cuối cùng", "sau đó",
    "trước hết", "trước tiên", "một là", "hai là", "ba là",
    "ví dụ", "chẳng hạn", "cụ thể", "như", "giống như", "tương tự",
    "nghĩa là", "tức là", "có nghĩa là", "nói cách khác", "hay nói cách khác",
    "tóm lại", "tóm gọn", "nói chung", "nhìn chung", "kết luận",
    "theo đó", "dựa vào", "căn cứ vào", "dựa trên", "căn cứ theo",
    "liên quan đến", "đối với", "về mặt", "xét về", "nói về",
    "bao gồm", "gồm có", "gồm", "thuộc", "thuộc về",
    
    # === Từ khẳng định/phủ định ===
    "đúng", "sai", "có", "không", "chưa", "chẳng", "chả", "đâu", "không hề", "chưa hề",
    "đúng vậy", "không phải", "chính xác", "không đúng",
    
    # === Từ chỉ thời gian & nơi chốn ===
    "hôm nay", "hôm qua", "ngày mai", "tuần này", "tháng này", "năm nay",
    "bây giờ", "hiện tại", "hiện nay", "lúc này", "khi đó", "lúc đó",
    "trước đây", "trước kia", "xưa", "ngày xưa", "sau này", "tương lai",
    "đây", "đó", "kia", "đâu", "nơi", "chỗ", "vùng", "miền", "khu vực",
}

ABBREVIATIONS: Dict[str, str] = {
    "tphcm": "hồ chí minh", "tp.hcm": "hồ chí minh", "tp hcm": "hồ chí minh",
    "hcm": "hồ chí minh", "sg": "sài gòn", "hn": "hà nội", "dn": "đà nẵng",
    "vn": "việt nam", "tq": "trung quốc", "lx": "liên xô",
    "tw": "trung ương", "bch": "ban chấp hành", "bch tw": "ban chấp hành trung ương",
    "qh": "quốc hội", "cp": "chính phủ", "ubnd": "ủy ban nhân dân",
    "đcs": "đảng cộng sản", "đcsvn": "đảng cộng sản việt nam",
    "lhq": "liên hợp quốc", "un": "liên hợp quốc", "asean": "hiệp hội các quốc gia đông nam á",
    "hs": "học sinh", "sv": "sinh viên", "gv": "giáo viên", "bgd": "bộ giáo dục",
    "cntt": "công nghệ thông tin", "it": "công nghệ thông tin",
    "csdl": "cơ sở dữ liệu", "db": "cơ sở dữ liệu",
    "pm": "phần mềm", "sw": "phần mềm", "hw": "phần cứng",
    "oop": "lập trình hướng đối tượng",
    "gdp": "tổng sản phẩm quốc nội", "fdi": "đầu tư trực tiếp nước ngoài",
    "dn": "doanh nghiệp", "vd": "ví dụ", "td": "tác dụng", "ưđ": "ưu điểm", "nđ": "nhược điểm",
}

SYNONYM_PAIRS: Dict[str, str] = {
    # HÁN VIỆT
    "thái dương": "mặt trời", "nhật": "mặt trời",
    "nguyệt": "trăng",
    "địa cầu": "trái đất",
    "hải": "biển", "đại dương": "biển",
    "thủy": "nước", "hỏa": "lửa", "phong": "gió",
    "nhân loại": "con người",
    "phụ nữ": "đàn bà", "nam giới": "đàn ông",
    "thiếu nhi": "trẻ em", "nhi đồng": "trẻ em",
    "gia đình": "nhà",
    "quốc gia": "nước", "giang sơn": "đất nước",
    "khởi đầu": "bắt đầu", "mở đầu": "bắt đầu",
    "kết thúc": "chấm dứt", "hoàn thành": "xong",
    
    # IT & TECH
    "vi tính": "máy tính", "computer": "máy tính", "pc": "máy tính", "laptop": "máy tính xách tay",
    "mouse": "chuột", "keyboard": "bàn phím", "screen": "màn hình", "monitor": "màn hình",
    "hardware": "phần cứng", "hard drive": "ổ cứng", "hdd": "ổ cứng", "ssd": "ổ cứng",
    "ram": "bộ nhớ", "memory": "bộ nhớ", "cpu": "bộ xử lý", "chip": "bộ xử lý",
    "server": "máy chủ", "client": "máy khách",
    "software": "phần mềm", "app": "ứng dụng", "application": "ứng dụng", "tool": "công cụ",
    "network": "mạng", "internet": "mạng", "wifi": "mạng không dây",
    "database": "cơ sở dữ liệu", "data": "dữ liệu",
    "website": "trang web", "site": "trang web",
    "link": "liên kết", "url": "đường dẫn",
    "email": "thư điện tử", "mail": "thư",
    "account": "tài khoản", "password": "mật khẩu",
    "user": "người dùng", "admin": "quản trị viên",
    "file": "tập tin", "folder": "thư mục",
    "image": "hình ảnh", "video": "phim", "audio": "âm thanh",
    "code": "mã", "coding": "lập trình", "programming": "lập trình",
    "developer": "lập trình viên", "coder": "lập trình viên", "dev": "lập trình viên",
    "bug": "lỗi", "error": "lỗi", "issue": "vấn đề",
    "debug": "sửa lỗi", "fix": "sửa",
    "algorithm": "thuật toán", "giải thuật": "thuật toán",
    "array": "danh sách", "list": "danh sách",
    "loop": "vòng lặp",
    
    # SLANG & VIẾT TẮT
    "ko": "không", "k": "không", "khg": "không", "hông": "không", "hong": "không", "hok": "không",
    "dc": "được", "đc": "được", "dk": "được",
    "bit": "biết", "bik": "biết", "bít": "biết",
    "thich": "thích", "thik": "thích",
    "iu": "yêu", "yeu": "yêu",
    "ok": "đồng ý", "oki": "đồng ý", "okay": "đồng ý",
    "thanks": "cảm ơn", "tks": "cảm ơn", "thank": "cảm ơn", "cmon": "cảm ơn",
    "sr": "xin lỗi", "sry": "xin lỗi", "sorry": "xin lỗi",
    "j": "gì", "gi": "gì",
    "z": "vậy", "v": "vậy",
    "wa": "quá", "lun": "luôn",
    "uk": "ừ", "uhm": "ừ", "uh": "ừ",
    "bt": "bình thường",
}

# Tự bảo vệ các từ kết quả khỏi bị thay thế chuỗi con (ngăn đệ quy vô hạn)
for _k, _v in list(SYNONYM_PAIRS.items()):
    SYNONYM_PAIRS[_v] = _v

ANTONYM_PAIRS: Dict[str, List[str]] = {
    "giành": ["mất", "thất bại", "thua"], "mất": ["giành", "được", "thắng"],
    "thắng": ["thua", "bại", "thất bại"], "thua": ["thắng", "chiến thắng"],
    "thành công": ["thất bại"], "thất bại": ["thành công"],
    "tăng": ["giảm", "tụt", "xuống", "hạ"], "giảm": ["tăng", "lên", "tăng lên"],
    "lớn": ["nhỏ", "bé"], "nhỏ": ["lớn", "to"],
    "nhiều": ["ít"], "ít": ["nhiều"],
    "cao": ["thấp"], "thấp": ["cao"],
    "có": ["không", "không có"], "không": ["có"],
    "đúng": ["sai", "không đúng"], "sai": ["đúng"],
    "tốt": ["xấu", "tệ"], "xấu": ["tốt", "đẹp"],
    "chủ quan": ["khách quan"], "khách quan": ["chủ quan"],
    "tích cực": ["tiêu cực"], "tiêu cực": ["tích cực"],
    "tiến bộ": ["lạc hậu"], "lạc hậu": ["tiến bộ"],
    "độc lập": ["lệ thuộc", "phụ thuộc"], "phụ thuộc": ["độc lập"],
    "duy vật": ["duy tâm"], "duy tâm": ["duy vật"],
}

DIRECTIONAL_VERBS: Set[str] = {
    "quyết định", "tác động", "ảnh hưởng", "sinh ra", "tạo ra", "gây ra",
    "nguyên nhân", "kết quả", "dẫn đến", "gây nên", "phát sinh",
    "thống trị", "điều chỉnh", "quản lý", "kiểm soát", "thể hiện", "ch đạo", "ban hành",
    "kế thừa", "triển khai", "ghi đè", "trả về", "gọi", "khởi tạo",
}

PASSIVE_MARKERS: Set[str] = {"bị", "được", "do", "bởi", "nhờ", "qua"}

HARD_LOCATIONS: Set[str] = {
    "hà nội", "hồ chí minh", "sài gòn", "đà nẵng", "hải phòng", "cần thơ",
    "việt nam", "trung quốc", "mỹ", "hoa kỳ", "nhật bản", "liên xô",
}

CODE_SNIPPETS_MAP: Dict[str, str] = {
    r"\bdef\s+__init__\b|\bconstructor\b": "hàm khởi tạo",
    r"\bextends\b|\binherits?\b": "kế thừa",
    r"\bimplements\b": "triển khai",
    r"\boverride\b": "ghi đè",
    r"\boverload\b": "nạp chồng",
    r"\bthis\b|\bself\b": "đối tượng hiện tại",
    r"\bsuper\b": "lớp cha",
    r"\breturn\b": "trả về",
    r"\bnew\b": "tạo mới",
    r"\binterface\b": "giao diện",
    r"\babstract\b": "trừu tượng",
    r"\bselect\b": "lấy dữ liệu",
    r"\binsert\b": "thêm dữ liệu",
    r"\bupdate\b": "cập nhật dữ liệu",
    r"\bdelete\b": "xóa dữ liệu",
    r"\bjoin\b": "kết nối",
}


# =========================================================================
# 2. HÀM XỬ LÝ (HELPER FUNCTIONS)
# =========================================================================

def get_vietnamese_stopwords() -> Set[str]:
    return VIETNAMESE_STOPWORDS.copy()

def remove_stopwords(text: str) -> str:
    if not text: return ""
    words = text.lower().split()
    filtered = [w for w in words if w not in VIETNAMESE_STOPWORDS]
    return " ".join(filtered)

def is_stopword(word: str) -> bool:
    return word.lower() in VIETNAMESE_STOPWORDS

def expand_abbreviations(text: str) -> str:
    if not text: return ""
    words = text.lower().split()
    expanded_words = [ABBREVIATIONS.get(w, w) for w in words]
    return " ".join(expanded_words)

def check_passive_voice(text: str) -> bool:
    if not text: return False
    return any(marker in text.lower() for marker in PASSIVE_MARKERS)

def normalize_text(text: str) -> str:
    if not text: return ""
    text = re.sub(r'[^\w\s\u00C0-\u1EF9]', '', text)
    return re.sub(r'\s+', ' ', text).strip().lower()

def remove_vietnamese_diacritics(text: str) -> str:
    if not text: return ""
    diacritics_map = {
        'à':'a', 'á':'a', 'ả':'a', 'ã':'a', 'ạ':'a', 'ă':'a', 'ằ':'a', 'ắ':'a', 'ẳ':'a', 'ẵ':'a', 'ặ':'a',
        'â':'a', 'ầ':'a', 'ấ':'a', 'ẩ':'a', 'ẫ':'a', 'ậ':'a', 'è':'e', 'é':'e', 'ẻ':'e', 'ẽ':'e', 'ẹ':'e',
        'ê':'e', 'ề':'e', 'ế':'e', 'ể':'e', 'ễ':'e', 'ệ':'e', 'ì':'i', 'í':'i', 'ỉ':'i', 'ĩ':'i', 'ị':'i',
        'ò':'o', 'ó':'o', 'ỏ':'o', 'õ':'o', 'ọ':'o', 'ô':'o', 'ồ':'o', 'ố':'o', 'ổ':'o', 'ỗ':'o', 'ộ':'o',
        'ơ':'o', 'ờ':'o', 'ớ':'o', 'ở':'o', 'ỡ':'o', 'ợ':'o', 'ù':'u', 'ú':'u', 'ủ':'u', 'ũ':'u', 'ụ':'u',
        'ư':'u', 'ừ':'u', 'ứ':'u', 'ử':'u', 'ữ':'u', 'ự':'u', 'ỳ':'y', 'ý':'y', 'ỷ':'y', 'ỹ':'y', 'ỵ':'y',
        'đ':'d'
    }
    return ''.join([diacritics_map.get(c, c) for c in text])

def normalize_synonyms(text: str) -> str:
    if not text: return ""
    sorted_synonyms = sorted(SYNONYM_PAIRS.keys(), key=len, reverse=True)
    escaped_keys = [re.escape(k) for k in sorted_synonyms]
    # [VÁ LỖI REGEX]: Bỏ \b, dùng lookbehind/lookahead hỗ trợ tiếng Việt
    pattern = re.compile(r'(?<![a-zA-ZÀ-ỹ])(' + '|'.join(escaped_keys) + r')(?![a-zA-ZÀ-ỹ])', re.IGNORECASE)
    
    def replace_match(match): 
        return SYNONYM_PAIRS[match.group(0).lower()]
        
    return pattern.sub(replace_match, text.lower())

def normalize_code_snippets(text: str) -> str:
    if not text: return ""
    text_processed = text
    for pattern, replacement in CODE_SNIPPETS_MAP.items():
        text_processed = re.sub(pattern, replacement, text_processed, flags=re.IGNORECASE)
    return text_processed