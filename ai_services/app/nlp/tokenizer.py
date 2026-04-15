import re
from typing import Dict, Set, List, Optional

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

# =========================================================================
# SAFE_STOPWORDS: Chỉ chứa từ đệm thuần túy, KHÔNG chứa từ phủ định/khẳng định
# Dùng cho pipeline chấm điểm - tránh xóa mất ý nghĩa mâu thuẫn
# =========================================================================
SAFE_STOPWORDS: Set[str] = {
    # Liên từ
    "và", "với", "cùng", "cùng với", "hoặc", "hay", "hay là", "nhưng", "tuy", "tuy nhiên",
    "mà", "nên", "vì", "vì vậy", "do", "do đó", "bởi", "bởi vì", "nếu", "thì", "khi", "lúc",
    "trước khi", "sau khi", "trong khi", "mặc dù", "dù", "dẫu", "cho dù",
    "để", "nhằm", "hầu", "ngay", "ngay khi", "miễn là", "trừ khi",
    # Đại từ
    "tôi", "tao", "mình", "ta", "chúng tôi", "chúng ta", "chúng mình",
    "bạn", "các bạn", "cậu", "mày", "anh", "chị", "em", "ông", "bà", "cô", "chú", "thầy",
    "nó", "hắn", "họ", "chúng nó", "người ta",
    "này", "đó", "kia", "ấy", "đây", "đấy",
    # Trợ từ AN TOÀN (GIỮ LẠI: không, chưa, đã, chẳng, chả, sai, đúng)
    "là", "được", "cần", "nên", "sẽ", "đang", "vừa", "mới", "sắp",
    "còn", "vẫn", "cũng", "lại", "chỉ", "thôi", "rồi", "xong", "hết",
    "quá", "lắm", "rất", "khá", "hơi", "cực", "cực kỳ", "vô cùng", "hết sức",
    # Chỉ định
    "một", "các", "những", "mọi", "tất cả", "toàn bộ", "từng", "mỗi", "vài", "một số",
    "nhiều", "ít", "đầy", "đủ", "thêm", "nữa", "khác", "riêng", "chung",
    # Giới từ
    "ở", "tại", "trong", "ngoài", "trên", "dưới", "giữa", "bên", "cạnh", "gần", "xa",
    "trước", "sau", "về", "đến", "từ", "theo", "qua", "sang", "vào", "ra", "lên", "xuống",
    # Từ đệm
    "à", "ạ", "ơi", "nhé", "nha", "ha", "hả", "nhỉ", "chứ", "thế", "vậy",
    "xem", "coi", "thử",
    # Academic
    "thứ nhất", "thứ hai", "thứ ba", "đầu tiên", "tiếp theo", "cuối cùng", "sau đó",
    "trước hết", "trước tiên", "một là", "hai là", "ba là",
    "ví dụ", "chẳng hạn", "cụ thể", "như", "giống như", "tương tự",
    "nghĩa là", "tức là", "có nghĩa là", "nói cách khác",
    "tóm lại", "tóm gọn", "nói chung", "nhìn chung", "kết luận",
    "theo đó", "dựa vào", "căn cứ vào", "dựa trên",
    "liên quan đến", "đối với", "về mặt", "xét về", "nói về",
    "bao gồm", "gồm có", "gồm", "thuộc", "thuộc về",
    # Thời gian
    "hôm nay", "hôm qua", "ngày mai",
    "bây giờ", "hiện tại", "hiện nay", "lúc này",
    "trước đây", "trước kia", "xưa", "ngày xưa",
    "nơi", "chỗ", "vùng", "miền", "khu vực",
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
    "params": "tham số", "parameter": "tham số", "parm": "tham số", "proc": "thủ tục",
    "trigger": "trình kích hoạt", "func": "hàm", "fn": "hàm",
    "event": "sự kiện", "action": "hành động", "evt": "sự kiện",
    "xin xỏ": "noise", "thầy ơi": "noise", "giúp em": "noise",
    "cảm ơn": "noise", "đáp án": "noise", "bài làm": "noise", "thưa thầy": "noise",
    "thưa cô": "noise", "nới tay": "noise", "giúp con": "noise",
}

# =========================================================================
# COLLOQUIAL / PLEADING NOISE (XIN XỎ)
# =========================================================================
PLEADING_NOISE: Set[str] = {
    "thầy ơi", "cô ơi", "giúp em", "giúp mình", "với ạ", "nhe thầy", "nha thầy",
    "chấm nới tay", "xin điểm", "em cảm ơn", "tôi xin lỗi", "xin lỗi",
    "đây là", "đáp án là", "câu trả lời", "bài làm", "dưới đây", "sau đây",
    "mong thầy", "mong cô", "thưa thầy", "thưa cô",
    "nới tay", "giúp con", "dạ thưa", "dạ thầy", "dạ cô",
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
    
    # LỊCH SỬ & TRIẾT HỌC
    "từ bỏ ngôi vua": "thoái vị", "từ bỏ ngai vàng": "thoái vị",
    "vị hoàng đế cuối cùng": "vua bảo đại",
    "chấm dứt triệt để": "sụp đổ hoàn toàn", "diệt vong": "sụp đổ hoàn toàn",
    "làm phá sản": "đập tan",
    "ép buộc": "buộc", "bắt buộc": "buộc", "ép": "buộc",
    "chiến lược": "kế hoạch",
    "bàn đàm phán": "hội nghị", "thỏa thuận": "đàm phán", "thỏa hiệp": "đàm phán",
    "chấp nhận thỏa hiệp": "ký hiệp định",
    "bãi bỏ": "xóa bỏ", "chấm dứt": "xóa bỏ",
    "kế hoạch hóa tập trung": "bao cấp",
    "cơ chế thị trường": "thị trường",
    "ách cai trị": "chế độ", "vương triều": "triều đại", "triều đại": "chế độ",
    "thắng lợi": "chiến thắng",
    "lòng chảo": "thung lũng",
    
    # TRIẾT HỌC MÁC-LÊNIN
    "nền tảng": "cơ sở",
    "cốt lõi": "bản chất",
    "thước đo": "tiêu chuẩn",
    "đánh giá": "kiểm tra",
    "xuất phát từ": "bắt nguồn",
    "phát triển": "hoàn thiện", "tiến bộ": "hoàn thiện",
    "liên tục": "không ngừng", "mãi": "không ngừng",
    "vạn vật": "sự vật", "hiện tượng": "sự vật",
    "luận điểm": "quan điểm",
    "chủ trương": "chính sách",
    
    # ĐƠN VỊ ĐO LƯỜNG
    "kilomet": "km", "ki lô mét": "km", "cây số": "km",
    "mét": "m", "centimet": "cm", "milimet": "mm",
    "kilogram": "kg", "ki lô gam": "kg",
    "gram": "g", "gam": "g",
    
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
    "user": "người dùng", "admin": "quản trị viên",
    "event": "event", "sự kiện": "event", "evt": "event",
    "parameter": "parameter", "tham số": "parameter", "params": "parameter", "parm": "parameter",
    "column": "column", "cột": "column",
    "table": "table", "bảng": "table",
    "row": "row", "dòng": "row",
    "view": "view", "khung nhìn": "view",
    "procedure": "procedure", "thủ tục": "procedure", "proc": "procedure",
    "trigger": "trigger", "trình kích hoạt": "trigger",
    "inserted": "inserted", "new": "inserted",
    "deleted": "deleted", "old": "deleted",
    "da nang": "da nang", "đà nẵng": "da nang",
    "ha noi": "ha noi", "hà nội": "ha noi",
    "database": "database", "csdl": "database", "cơ sở dữ liệu": "database",
    "descending": "desc", "giảm dần": "desc",
    "ascending": "asc", "tăng dần": "asc",
    "file": "tập tin", "folder": "thư mục",
    "image": "hình ảnh", "video": "phim", "audio": "âm thanh",
    "code": "mã", "coding": "lập trình", "programming": "lập trình",
    "developer": "lập trình viên", "coder": "lập trình viên", "dev": "lập trình viên",
    "bug": "lỗi", "error": "lỗi", "issue": "vấn đề",
    "debug": "sửa lỗi", "fix": "sửa",
    "algorithm": "thuật toán", "giải thuật": "thuật toán",
    "array": "danh sách", "list": "danh sách",
    "loop": "vòng lặp",
    "truy vấn": "select", "tìm kiếm": "select", "liệt kê": "select", "lấy": "select",
    "thêm mới": "insert", "chèn": "insert",
    "hiệu chỉnh": "update", "chỉnh sửa": "update",
    "loại bỏ": "delete", "hủy bỏ": "delete",
    "liên kết": "join", "kết nối": "join",
    "nhóm lại": "group by", "nhóm": "group by",
    "sắp xếp": "order by", "sắp xếp theo": "order by",
    "từ bảng": "from", "trong bảng": "from",
    "order_items": "orderdetails", "orderdetails": "order_items",
    "tham số": "tham so", "tham so": "tham số",
    "điều kiện": "where", "với điều kiện": "where",
    "lớn hơn": ">", "nhỏ hơn": "<", "bằng": "=", "khác": "!=",
    "giảm dần": "desc", "tăng dần": "asc",
    
    # OOP CORES
    "polymorphism": "đa hình", "đa hình": "đa hình",
    "encapsulation": "đóng gói", "đóng gói": "đóng gói",
    "inheritance": "kế thừa", "kế thừa": "kế thừa",
    "abstraction": "trừu tượng", "trừu tượng": "trừu tượng",
    "polymorphic": "đa hình", "encapsulated": "đóng gói",
    "inherited": "kế thừa", "abstracted": "trừu tượng",
    "method": "hàm", "function": "hàm", "phương thức": "hàm",
    "biến thành viên": "thuộc tính", "member variable": "thuộc tính",
    "property": "thuộc tính", "attribute": "thuộc tính",
    
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

# =========================================================================
# SQL HARD CONTRADICTIONS (Opposites that should get 0)
# =========================================================================
SQL_CONTRADICTIONS: Dict[str, List[str]] = {
    "AFTER": ["INSTEAD OF", "BEFORE"],
    "INSTEAD OF": ["AFTER", "BEFORE"],
    "ON": ["IN", "NOT IN", "WHERE"],
    "IN": ["ON", "NOT IN", "NOT EXISTS"],
    "NOT IN": ["IN", "ON", "EXISTS"],
    "ASC": ["DESC"],
    "DESC": ["ASC"],
    "AND": ["OR"],
    "OR": ["AND"],
    "INNER JOIN": ["LEFT JOIN", "RIGHT JOIN", "CROSS JOIN"],
    "LEFT JOIN": ["INNER JOIN", "RIGHT JOIN"],
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

def remove_safe_stopwords(text: str) -> str:
    """Xóa stopwords AN TOÀN - giữ lại từ phủ định (không, chưa, đã, chẳng)
    để bảo toàn khả năng phát hiện contradiction."""
    if not text: return ""
    words = text.lower().split()
    filtered = [w for w in words if w not in SAFE_STOPWORDS]
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
    words = text.lower().split()
    return any(marker in words for marker in PASSIVE_MARKERS)

def deep_clean_text(text: str) -> str:
    """Preprocessing sâu: xử lý edge cases dấu câu, brackets, ký tự đặc biệt.
    Gọi TRƯỚC normalize_text() và normalize_synonyms()."""
    if not text: return ""
    
    # 1. Thêm space trước/sau dấu câu dính chữ
    text = re.sub(r'([a-zA-ZÀ-ỹ]),([a-zA-ZÀ-ỹ])', r'\1 \2', text)
    text = re.sub(r'([a-zA-ZÀ-ỹ]);([a-zA-ZÀ-ỹ])', r'\1 \2', text)
    text = re.sub(r'([a-zA-ZÀ-ỹ])\.\.\.([a-zA-ZÀ-ỹ])', r'\1 \2', text)
    
    # 2. Xóa escaped quotes và brackets
    text = text.replace('\\"', ' ').replace('\\', ' ')
    text = re.sub(r'[\[\]{}]', ' ', text)
    
    # 3. Xóa dấu câu phức tạp nhưng giữ space
    text = re.sub(r'[()"\':;!?…«»\u201c\u201d\u2018\u2019]', ' ', text)
    
    # 3.1. Xóa ngoặc đơn dính vào chữ (chuyên trị SQL strings: 'Đà Nẵng')
    text = text.replace("'", " ").replace('"', ' ')
    
    # 4. Normalize & → và, + → cộng
    text = text.replace('&', ' và ')
    
    # 5. Xóa dấu gạch ngang khi đứng giữa spaces (dùng làm separator)
    text = re.sub(r'\s+-\s+', ' ', text)
    
    # 6. Collapse spaces
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

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


# =========================================================================
# 3. CHUẨN HÓA ĐƠN VỊ ĐO LƯỜNG (UNIT NORMALIZATION)
# =========================================================================

UNIT_MAPPINGS: Dict[str, str] = {
    # Sắp xếp dài → ngắn để tránh partial match
    "mét trên giây bình phương": "m/s2",
    "mét trên giây": "m/s",
    "kilomet vuông": "km2", "km vuông": "km2", "ki lô mét vuông": "km2",
    "mét vuông": "m2",
    "centimet vuông": "cm2",
    "kilomet": "km", "ki lô mét": "km", "cây số": "km",
    "centimet": "cm", "xentimet": "cm",
    "milimet": "mm",
    "kilogram": "kg", "ki lô gam": "kg",
    "gram": "g", "gam": "g",
    "giây": "s",
    "ampe": "a",
    "vôn": "v", "von": "v",
    "niu tơn": "n", "newton": "n",
    "jun": "j", "joule": "j",
    "oát": "w", "watt": "w",
    "héc": "hz", "hertz": "hz",
    "độ c": "°c", "độ xen xi út": "°c", "độ celsius": "°c",
}

def normalize_number_format(text: str) -> str:
    """Chuẩn hóa format số theo quy ước Việt Nam.
    331.212 hoặc 331,212 (hàng nghìn) → 331212"""
    if not text: return ""
    # Nếu sau dấu . hoặc , có đúng 3 chữ số (không có chữ số tiếp) → phân cách hàng nghìn
    text = re.sub(r'(\d)[.](\d{3})(?!\d)', r'\1\2', text)
    text = re.sub(r'(\d)[,](\d{3})(?!\d)', r'\1\2', text)
    # Chuẩn hóa dấu , thập phân thành dấu .
    text = re.sub(r'(\d),(\d{1,2})(?!\d)', r'\1.\2', text)
    return text

def normalize_units(text: str) -> str:
    """Chuyển đổi đơn vị viết bằng chữ sang ký hiệu chuẩn."""
    if not text: return ""
    result = text.lower()
    # Sort dài → ngắn để tránh partial match
    for word_form, symbol in sorted(UNIT_MAPPINGS.items(), key=lambda x: len(x[0]), reverse=True):
        result = result.replace(word_form, symbol)
    return result