import re
from typing import Dict, Set, List
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
    
    # === Từ chỉ mức độ / Degree Words ===
    "rất", "lắm", "quá", "hơi", "khá", "cực", "siêu", "vô cùng", "hết sức", "cùng cực",
    "hoàn toàn", "tuyệt đối", "đầy đủ", "trọn vẹn", "đúng mực",
    
    # === Từ chỉ thời gian ===
    "hôm nay", "hôm qua", "ngày mai", "tuần này", "tháng này", "năm nay",
    "bây giờ", "hiện tại", "hiện nay", "lúc này", "khi đó", "lúc đó",
    "trước đây", "trước kia", "xưa", "ngày xưa", "sau này", "tương lai",
    
    # === Từ chỉ nơi chốn ===
    "đây", "đó", "kia", "đâu", "nơi", "chỗ", "vùng", "miền", "khu vực",
    
    # === Phụ từ phổ biến ===
    "thực sự", "thật sự", "thực ra", "thật ra", "thực tế", "trên thực tế",
    "rõ ràng", "hiển nhiên", "đương nhiên", "tất nhiên", "chắc chắn",
    "có lẽ", "có thể", "chắc", "hẳn", "ắt", "ắt hẳn",
    "may mà", "may thay", "tiếc thay", "đáng tiếc",
    
    # === Từ trong câu hỏi/trả lời thi ===
    "câu hỏi", "câu trả lời", "đáp án", "bài làm", "lời giải",
    "theo em", "em nghĩ", "em cho rằng", "em thấy", "dạ", "thưa",
}

# TỪ ĐIỂN VIẾT TẮT (Abbreviation Expansion)
# Dùng để chuẩn hóa viết tắt trước khi Fact Check
ABBREVIATIONS: Dict[str, str] = {
    # Địa danh
    "tphcm": "hồ chí minh", "tp.hcm": "hồ chí minh", "tp hcm": "hồ chí minh",
    "hcm": "hồ chí minh", "sg": "sài gòn", "hn": "hà nội", "dn": "đà nẵng",
    "hp": "hải phòng", "ct": "cần thơ", "brvt": "bà rịa vũng tàu",
    "vn": "việt nam", "tq": "trung quốc", "lx": "liên xô",
    # Tổ chức / Chính trị
    "tw": "trung ương", "bch": "ban chấp hành", "bch tw": "ban chấp hành trung ương",
    "qh": "quốc hội", "cp": "chính phủ", "ubnd": "ủy ban nhân dân",
    "đcs": "đảng cộng sản", "đcsvn": "đảng cộng sản việt nam",
    "lhq": "liên hợp quốc", "un": "liên hợp quốc", "asean": "hiệp hội các quốc gia đông nam á",
    # Giáo dục / Xã hội
    "hs": "học sinh", "sv": "sinh viên", "gv": "giáo viên", "bgd": "bộ giáo dục",
    "bhxh": "bảo hiểm xã hội", "bhyt": "bảo hiểm y tế",
    "gddt": "giáo dục đào tạo", "gdcd": "giáo dục công dân",
    # Công nghệ
    "cntt": "công nghệ thông tin", "it": "công nghệ thông tin",
    "csdl": "cơ sở dữ liệu", "db": "cơ sở dữ liệu",
    "pm": "phần mềm", "sw": "phần mềm", "hw": "phần cứng",
    "sdlc": "vòng đời phát triển phần mềm", "oop": "lập trình hướng đối tượng",
    "ai": "trí tuệ nhân tạo", "ml": "học máy", "dl": "học sâu",
    # Kinh tế
    "gdp": "tổng sản phẩm quốc nội", "fdi": "đầu tư trực tiếp nước ngoài",
    "dn": "doanh nghiệp", "ctcp": "công ty cổ phần", "tnhh": "trách nhiệm hữu hạn",
    # Viết tắt phổ biến khác
    "vd": "ví dụ", "td": "tác dụng", "ưđ": "ưu điểm", "nđ": "nhược điểm",
    "gt": "giới thiệu", "kn": "khái niệm", "đn": "định nghĩa",
}

# TỪ ĐỒNG NGHĨA (Synonym Pairs)
# Dùng để chuẩn hóa văn bản trước khi so sánh
# Giúp AI nhận diện "mặt trời" == "thái dương"
SYNONYM_PAIRS: Dict[str, str] = {
    # 1. HÁN VIỆT & TỪ CỔ -> THUẦN VIỆT
    "thái dương": "mặt trời", "nhật": "mặt trời", "dương": "mặt trời",
    "nguyệt": "trăng", "thái âm": "trăng",
    "địa cầu": "trái đất", "địa": "đất", "thổ": "đất",
    "hải": "biển", "dương": "biển", "đại dương": "biển",
    "sơn": "núi", "nhạc": "núi", "non": "núi",
    "thảo": "cỏ", "mộc": "cây", "thụ": "cây",
    "thạch": "đá", "kim": "vàng", "ngân": "bạc",
    "thủy": "nước", "hỏa": "lửa", "phong": "gió",
    "vũ": "mưa", "lôi": "sấm", "điện": "sét",
    "vân": "mây", "tuyết": "tuyết", "sương": "sương",
    "thiên": "trời", "địa": "đất",
    
    "nhân": "người", "nhân loại": "con người", "nhân gian": "thế gian",
    "phụ nữ": "đàn bà", "nữ giới": "đàn bà", "nữ nhi": "con gái",
    "nam giới": "đàn ông", "nam nhi": "con trai", "mày râu": "đàn ông",
    "thiếu nhi": "trẻ em", "nhi đồng": "trẻ em", "trẻ thơ": "trẻ em",
    "gia đình": "nhà", "gia": "nhà", "tư gia": "nhà riêng",
    "hoàn cầu": "thế giới", "thế giới": "trần gian",
    "vũ trụ": "không gian", "thiên hà": "ngân hà",
    "quốc gia": "nước", "giang sơn": "đất nước", "xã tắc": "đất nước",
    "thanh xuân": "tuổi trẻ", "niên thiếu": "tuổi trẻ",
    "sinh nhật": "ngày sinh", "sinh thần": "ngày sinh",
    
    "khởi đầu": "bắt đầu", "khai màn": "bắt đầu", "mở đầu": "bắt đầu",
    "kết thúc": "chấm dứt", "hoàn thành": "xong", "chung kết": "cuối cùng",
    "xuất hiện": "mọc", "hiện diện": "có mặt",
    "bình minh": "buổi sáng", "rạng đông": "buổi sáng", "sớm mai": "buổi sáng",
    "hoàng hôn": "buổi chiều", "chiều tà": "buổi chiều",
    "dạ": "đêm", "khuya": "đêm",
    "phương": "hướng", "phương hướng": "hướng",
    
    # Body Parts (Hán - Việt)
    "thủ": "đầu", "đầu lâu": "đầu",
    "mục": "mắt", "nhãn": "mắt",
    "nhĩ": "tai", "khẩu": "miệng",
    "túc": "chân", "cước": "chân",
    "thủ": "tay", 
    "tâm": "tim", "huyết": "máu",
    "cốt": "xương", "bì": "da",
    "phế": "phổi", "can": "gan", "thận": "cật",
    
    # 2. IT, CÔNG NGHỆ & KHOA HỌC (Tech Terms)
    # Hardware
    "vi tính": "máy tính", "computer": "máy tính", "pc": "máy tính", "laptop": "máy tính xách tay",
    "mouse": "chuột", "keyboard": "bàn phím", "screen": "màn hình", "monitor": "màn hình",
    "hardware": "phần cứng", "hard drive": "ổ cứng", "hdd": "ổ cứng", "ssd": "ổ cứng",
    "ram": "bộ nhớ", "memory": "bộ nhớ", "cpu": "bộ xử lý", "chip": "bộ xử lý",
    "server": "máy chủ", "client": "máy khách",
    "printer": "máy in", "scanner": "máy quét", "webcam": "camera",
    "usb": "ổ cắm", "flash drive": "usb",
    "pin": "năng lượng", "battery": "pin",
    # Software / Network
    "software": "phần mềm", "app": "ứng dụng", "application": "ứng dụng", "tool": "công cụ",
    "browsers": "trình duyệt", "browser": "trình duyệt",
    "network": "mạng", "internet": "mạng", "web": "mạng", "wifi": "mạng không dây",
    "database": "cơ sở dữ liệu", "db": "cơ sở dữ liệu", "data": "dữ liệu",
    "website": "trang web", "site": "trang web", "webpage": "trang web",
    "link": "liên kết", "url": "đường dẫn", "hyperlink": "liên kết",
    "email": "thư điện tử", "mail": "thư", "gmail": "thư",
    "account": "tài khoản", "acc": "tài khoản", "password": "mật khẩu", "pass": "mật khẩu",
    "user": "người dùng", "admin": "quản trị viên", "mod": "quản trị viên",
    "file": "tập tin", "folder": "thư mục", "directory": "thư mục",
    "image": "hình ảnh", "img": "ảnh", "pic": "ảnh", "photo": "ảnh",
    "video": "phim", "clip": "phim",
    "audio": "âm thanh", "sound": "âm thanh",
    "text": "văn bản", "txt": "văn bản",
    "font": "phông chữ",
    
    # Coding
    "code": "mã", "coding": "lập trình", "programming": "lập trình",
    "developer": "lập trình viên", "coder": "lập trình viên", "dev": "lập trình viên",
    "bug": "lỗi", "error": "lỗi", "issue": "vấn đề", "fault": "lỗi",
    "debug": "sửa lỗi", "fix": "sửa", "patch": "bản vá",
    "algorithm": "thuật toán", "giải thuật": "thuật toán",
    "variable": "biến", "var": "biến", "const": "hằng số",
    "function": "hàm", "func": "hàm", "method": "phương thức",
    "class": "lớp", "object": "đối tượng",
    "array": "danh sách", "list": "danh sách", "mảng": "danh sách",
    "dictionary": "từ điển", "map": "bản đồ", # Map in CS is Dictionary.
    "loop": "vòng lặp", "cycle": "chu kỳ",
    "input": "đầu vào", "output": "đầu ra", "io": "vào ra",
    "version": "phiên bản", "ver": "phiên bản",
    "update": "cập nhật", "upgrade": "nâng cấp",
    "install": "cài đặt", "setup": "cài đặt",
    "delete": "xóa", "remove": "xóa", "del": "xóa",
    "edit": "sửa", "modify": "sửa", "change": "đổi",
    "save": "lưu", "store": "lưu",
    "run": "chạy", "execute": "thực thi",
    
    # Math/Logic
    "% 2 == 0": "số chẵn", "even": "số chẵn",
    "% 2 != 0": "số lẻ", "odd": "số lẻ",
    "sum": "tổng", "total": "tổng", "add": "cộng",
    "subtraction": "trừ", "minus": "trừ",
    "multiply": "nhân", "division": "chia",
    "average": "trung bình", "mean": "trung bình",
    "percent": "phần trăm", "percentage": "tỷ lệ" ,
    "ratio": "tỷ lệ",
    "matrix": "ma trận", "vector": "vectơ",
    "point": "điểm", "line": "đường", "circle": "tròn", "square": "vuông",
    
    # 3. GIÁO DỤC, TRƯỜNG HỌC & MÔN HỌC
    "học đường": "trường học", "trường": "trường học", "school": "trường",
    "lớp học": "lớp", "phòng học": "lớp", "class": "lớp",
    "học viên": "học sinh", "sinh viên": "học sinh", "học trò": "học sinh",
    "student": "học sinh", "pupil": "học sinh",
    "giáo viên": "thầy cô", "giảng viên": "thầy cô", "thầy giáo": "thầy", "cô giáo": "cô",
    "teacher": "giáo viên", "professor": "giáo sư", "lecturer": "giảng viên",
    "hiệu trưởng": "người đứng đầu trường",
    "bài tập": "bài làm", "homework": "bài tập về nhà", "assignment": "bài tập",
    "kỳ thi": "bài thi", "exam": "thi", "test": "kiểm tra", "quiz": "kiểm tra",
    "điểm số": "điểm", "mark": "điểm", "grade": "điểm", "score": "điểm",
    "học kỳ": "kỳ", "semester": "kỳ", "term": "kỳ",
    "môn học": "môn", "subject": "môn",
    # Subjects
    "toán": "toán học", "math": "toán", "maths": "toán", "mathematics": "toán",
    "văn": "ngữ văn", "literature": "văn",
    "lý": "vật lý", "physics": "lý",
    "hóa": "hóa học", "chemistry": "hóa",
    "sinh": "sinh học", "biology": "sinh",
    "sử": "lịch sử", "history": "sử",
    "địa": "địa lý", "geography": "địa",
    "anh": "tiếng anh", "english": "tiếng anh",
    "tin": "tin học", "informatics": "tin", "cs": "tin",
    "thể dục": "giáo dục thể chất", "pe": "thể dục",
    
    # 4. ĐỜI SỐNG & XÃ HỘI (Human, Family, Animal, Color)
    # Family (Regional: North/South)
    "bố": "cha", "tía": "cha", "ba": "cha", "father": "cha", "dad": "cha",
    "mẹ": "mạ", "u": "mẹ", "má": "mẹ", "bầm": "mẹ", "mother": "mẹ", "mom": "mẹ",
    "anh trai": "anh", "anh cả": "anh", "brother": "anh",
    "chị gái": "chị", "chị cả": "chị", "sister": "chị",
    "ông nội": "ông", "ông ngoại": "ông", "grandpa": "ông",
    "bà nội": "bà", "bà ngoại": "bà", "grandma": "bà",
    "vợ": "bà xã", "chồng": "ông xã", "wife": "vợ", "husband": "chồng",
    "con cái": "con", "children": "con", "kid": "trẻ", "child": "trẻ",
    
    # Animals
    "cẩu": "chó", "khuyển": "chó", "dog": "chó",
    "miêu": "mèo", "tiểu hổ": "mèo", "mão": "mèo", "cat": "mèo",
    "ngưu": "trâu", "sửu": "trâu", "buffalo": "trâu",
    "mã": "ngựa", "ngọ": "ngựa", "horse": "ngựa",
    "trư": "lợn", "heo": "lợn", "hợi": "lợn", "pig": "lợn",
    "kê": "gà", "dậu": "gà", "chicken": "gà",
    "hổ": "cọp", "dần": "cọp", "thay": "cọp", "tiger": "cọp",
    "long": "rồng", "thìn": "rồng", "dragon": "rồng",
    "xà": "rắn", "tỵ": "rắn", "snake": "rắn",
    "thân": "khỉ", "hầu": "khỉ", "monkey": "khỉ",
    "mùi": "dê", "dương": "dê", "goat": "dê",
    "tý": "chuột", "mouse": "chuột", "rat": "chuột",
    "cá": "ngư", "fish": "cá",
    "chim": "điểu", "bird": "chim",
    
    # Colors
    "xanh dương": "xanh", "xanh lam": "xanh", "xanh nước biển": "xanh", "blue": "xanh",
    "xanh lá": "xanh", "lục": "xanh", "green": "xanh",
    "đỏ": "hồng", "son": "đỏ", "red": "đỏ",
    "vàng": "hoàng", "yellow": "vàng", "gold": "vàng",
    "đen": "hắc", "black": "đen",
    "trắng": "bạch", "white": "trắng",
    "tím": "huế", "purple": "tím", "violet": "tím",
    "cam": "orange",
    
    # Giao thông
    "xe hơi": "ô tô", "car": "ô tô", "xế hộp": "ô tô", "auto": "ô tô",
    "xe máy": "xe gắn máy", "motorbike": "xe máy", "moto": "xe máy",
    "xe đạp": "xe thô sơ", "bicycle": "xe đạp", "bike": "xe đạp",
    "máy bay": "phi cơ", "airplane": "máy bay", "plane": "máy bay", "jet": "máy bay",
    "tàu hỏa": "xe lửa", "train": "tàu hỏa", "railway": "đường sắt",
    "tàu thủy": "thuyền", "ship": "tàu", "boat": "thuyền",
    "đường phố": "đường", "street": "đường", "road": "đường", "way": "đường",
    
    # Y tế
    "bệnh viện": "nhà thương", "hospital": "bệnh viện",
    "bác sĩ": "thầy thuốc", "doctor": "bác sĩ", "dr": "bác sĩ",
    "y tá": "điều dưỡng", "nurse": "y tá",
    "thuốc": "dược phẩm", "medicine": "thuốc", "drug": "thuốc",
    "bệnh": "ốm", "sick": "ốm", "illness": "bệnh", "pain": "đau",
    
    # Kinh tế (Money)
    "tiền": "ngân sách", "money": "tiền", "cash": "tiền mặt",
    "đô la": "usd", "dollar": "usd",
    "giá cả": "giá", "price": "giá", "cost": "chi phí",
    "mua": "sắm", "buy": "mua", "purchase": "mua",
    "bán": "tiêu thụ", "sell": "bán",
    "công ty": "doanh nghiệp", "company": "công ty", "firm": "công ty", "corp": "tập đoàn",
    "nhân viên": "người làm", "staff": "nhân viên", "employee": "nhân viên",
    "giám đốc": "lãnh đạo", "director": "giám đốc", "ceo": "giám đốc", "manager": "quản lý",
    "lương": "thu nhập", "salary": "lương", "income": "thu nhập", "wage": "lương",
    "khách hàng": "thượng đế", "customer": "khách", "client": "khách",
    "thị trường": "chợ", "market": "thị trường",
    
    # Nhà cửa / Vật dụng
    "home": "nhà", "house": "nhà",
    "phòng": "buồng", "room": "phòng",
    "cửa": "cổng", "door": "cửa", "gate": "cổng",
    "ghế": "chỗ ngồi", "chair": "ghế", "seat": "ghế",
    "bàn": "table", "desk": "bàn",
    "giường": "chõng", "bed": "giường",
    "bếp": "bếp núc", "kitchen": "bếp", "cook": "nấu",
    "tivi": "vô tuyến", "tv": "tivi",
    "điện thoại": "dế", "phone": "điện thoại", "mobile": "di động",
    "quần áo": "trang phục", "clothes": "quần áo",
    "giày": "hài", "shoe": "giày",
    "mũ": "nón", "hat": "mũ", "cap": "mũ",
    
    # Đơn vị đo lường (Units)
    "kg": "kilogram", "cân": "kilogram", "ký": "kilogram",
    "g": "gram", "lạng": "100g",
    "m": "mét", "meter": "mét", "cm": "centimet", "mm": "milimet", "km": "kilomet",
    "lít": "lit", "liter": "lít",
    "s": "giây", "second": "giây",
    "min": "phút", "minute": "phút",
    "h": "giờ", "hour": "giờ", "tiếng": "giờ",
    "ngày": "hôm", "day": "ngày",
    "tuần": "lễ", "week": "tuần",
    "tháng": "nguyệt", "month": "tháng",
    "năm": "niên", "year": "năm",
    
    # 5. TÍNH TỪ & TRẠNG TỪ
    "to": "lớn", "big": "lớn", "large": "lớn", "huge": "khổng lồ", "giant": "khổng lồ",
    "nhỏ": "bé", "small": "bé", "tiny": "tí hon", "little": "nhỏ",
    "đẹp": "xinh", "beautiful": "đẹp", "pretty": "xinh", "nice": "đẹp",
    "xấu": "tệ", "bad": "tệ", "ugly": "xấu xí", "terrible": "khủng khiếp",
    "tốt": "hay", "good": "tốt", "great": "tuyệt vời", "excellent": "xuất sắc", "awesome": "tuyệt",
    "nhanh": "lẹ", "fast": "nhanh", "quick": "nhanh", "rapid": "nhanh",
    "chậm": "từ từ", "slow": "chậm",
    "vui": "hạnh phúc", "happy": "vui", "glad": "vui", "joy": "vui",
    "buồn": "đau khổ", "sad": "buồn", "cry": "khóc",
    "thông minh": "giỏi", "smart": "thông minh", "clever": "khôn ngoan", "wise": "khôn",
    "ngu": "dốt", "stupid": "ngốc", "dumb": "ngốc", "idiot": "ngốc",
    "khó": "phức tạp", "hard": "khó", "difficult": "khó", "complex": "phức tạp",
    "dễ": "đơn giản", "easy": "dễ", "simple": "đơn giản",
    "đúng": "chính xác", "correct": "đúng", "right": "đúng", "true": "đúng",
    "sai": "nhầm", "wrong": "sai", "incorrect": "sai", "false": "sai",
    "thật": "chân thật", "real": "thật",
    "giả": "nhái", "fake": "giả",
    "giàu": "phú quý", "rich": "giàu",
    "nghèo": "bần hàn", "poor": "nghèo",
    "mới": "tân", "new": "mới",
    "cũ": "cựu", "old": "cũ",
    "trẻ": "nhí", "young": "trẻ",
    "già": "lão",
    "cao": "high", "tall": "cao",
    "thấp": "low", "short": "thấp",
    "nóng": "nhiệt", "hot": "nóng",
    "lạnh": "hàn", "cold": "lạnh", "cool": "mát",
    "khô": "dry", "ướt": "wet",
    "sạch": "clean", "bẩn": "dirty",
    
    # 6. SLANG & VIẾT TẮT
    "ko": "không", "k": "không", "khg": "không", "hông": "không", "hong": "không", "hok": "không",
    "dc": "được", "đc": "được", "dk": "được",
    "bit": "biết", "bik": "biết", "bít": "biết",
    "thich": "thích", "thik": "thích",
    "iu": "yêu", "yeu": "yêu",
    "ok": "đồng ý", "oki": "đồng ý", "okay": "đồng ý",
    "thanks": "cảm ơn", "tks": "cảm ơn", "thank": "cảm ơn", "cmon": "cảm ơn", "ty": "cảm ơn",
    "sr": "xin lỗi", "sry": "xin lỗi", "sorry": "xin lỗi",
    "j": "gì", "gi": "gì",
    "z": "vậy", "v": "vậy",
    "wa": "quá",
    "lun": "luôn",
    "ng": "người", "nguoi": "người", "n": "người",
    "nhìu": "nhiều", "nhieu": "nhiều",
    "rùi": "rồi", "r": "rồi",
    "uk": "ừ", "uhm": "ừ", "uh": "ừ",
    "bt": "bình thường",
    "p": "phải",
    "lm": "làm",
    "ht": "học tập",
    
    # 7. TIẾNG ANH PHỔ BIẾN (English -> Vietnamese)
    "hello": "xin chào", "hi": "chào",
    "goodbye": "tạm biệt", "bye": "tạm biệt",
    "please": "làm ơn",
    "yes": "có",
    "no": "không",
    "name": "tên",
    "time": "thời gian",
    "date": "ngày",
    "day": "ngày", "night": "đêm",
    "week": "tuần", "month": "tháng", "year": "năm",
    "world": "thế giới",
    "life": "cuộc sống",
    "love": "yêu",
    "work": "làm việc", "job": "công việc",
    "study": "học", "learn": "học",
    "play": "chơi", "game": "trò chơi",
    "use": "dùng",
    "make": "làm", "create": "tạo",
    "go": "đi", "walk": "đi bộ", "run": "chạy",
    "come": "đến", "arrive": "đến",
    "see": "nhìn", "look": "nhìn", "watch": "xem",
    "hear": "nghe", "listen": "nghe",
    "eat": "ăn", "drink": "uống",
    "sleep": "ngủ", "wake": "thức",
    "think": "nghĩ", "know": "biết",
    "say": "nói", "speak": "nói", "talk": "nói",
    "read": "đọc", "write": "viết",
    "give": "cho", "get": "lấy", "take": "lấy",
    "have": "có",
    "want": "muốn", "need": "cần",
    "like": "thích",
    "help": "giúp",
    "try": "thử",
    "change": "thay đổi",
    "start": "bắt đầu", "begin": "bắt đầu",
    "stop": "dừng", "finish": "kết thúc", "end": "kết thúc",
}

# TỪ TRÁI NGHĨA (Antonym Pairs) - Centralized
ANTONYM_PAIRS: Dict[str, List[str]] = {
    # Thắng/Thua
    "giành": ["mất", "thất bại", "thua"], "mất": ["giành", "được", "thắng"],
    "thắng": ["thua", "bại", "thất bại"], "thua": ["thắng", "chiến thắng"],
    "thành công": ["thất bại"], "thất bại": ["thành công"],
    # Tăng/Giảm
    "tăng": ["giảm", "tụt", "xuống", "hạ"], "giảm": ["tăng", "lên", "tăng lên"],
    "lớn": ["nhỏ", "bé"], "nhỏ": ["lớn", "to"],
    "nhiều": ["ít"], "ít": ["nhiều"],
    "cao": ["thấp"], "thấp": ["cao"],
    "dài": ["ngắn"], "ngắn": ["dài"],
    "rộng": ["hẹp"], "hẹp": ["rộng"],
    "nhanh": ["chậm"], "chậm": ["nhanh"],
    "mạnh": ["yếu"], "yếu": ["mạnh"],
    # Đối lập cơ bản
    "có": ["không", "không có"], "không": ["có"],
    "đúng": ["sai", "không đúng"], "sai": ["đúng"],
    "tốt": ["xấu", "tệ"], "xấu": ["tốt", "đẹp"],
    "yêu": ["ghét"], "ghét": ["yêu"],
    "sống": ["chết"], "chết": ["sống"],
    "mở": ["đóng"], "đóng": ["mở"],
    "bắt đầu": ["kết thúc", "chấm dứt"], "kết thúc": ["bắt đầu", "khởi đầu"],
    # Kinh tế / Giao dịch
    "nhập": ["xuất"], "xuất": ["nhập"],
    "mua": ["bán"], "bán": ["mua"],
    "xây": ["phá", "phá hủy"], "phá": ["xây", "xây dựng"],
    "giàu": ["nghèo"], "nghèo": ["giàu"],
    # Triết học / Chính trị
    "chủ quan": ["khách quan"], "khách quan": ["chủ quan"],
    "tích cực": ["tiêu cực"], "tiêu cực": ["tích cực"],
    "chung": ["riêng"], "riêng": ["chung"],
    "tiến bộ": ["lạc hậu"], "lạc hậu": ["tiến bộ"],
    "độc lập": ["lệ thuộc", "phụ thuộc"], "phụ thuộc": ["độc lập"],
    "giải phóng": ["xâm lược", "chiếm đóng"],
    "duy vật": ["duy tâm"], "duy tâm": ["duy vật"],
    # Vị trí
    "trên": ["dưới"], "dưới": ["trên"],
    "trong": ["ngoài"], "ngoài": ["trong"],
    "trước": ["sau"], "sau": ["trước"],
    "trái": ["phải"], "phải": ["trái"],
    "đông": ["tây"], "tây": ["đông"],
    "nam": ["bắc"], "bắc": ["nam"],
    "đầu": ["cuối"], "cuối": ["đầu"],
    "tiến": ["lùi", "thụt lùi"], "lùi": ["tiến"],
    # Nóng/Lạnh
    "nóng": ["lạnh"], "lạnh": ["nóng"],
    # Sinh học
    "lục lạp": ["ty thể", "không bào"], "ty thể": ["lục lạp"],
    "động vật": ["thực vật"], "thực vật": ["động vật"],
    "đơn bào": ["đa bào"], "đa bào": ["đơn bào"],
}

# ĐỘNG TỪ ĐỊNH HƯỚNG (Directional Verbs)
# Động từ mà thứ tự Chủ ngữ - Tân ngữ quan trọng
# "A tác động B" ≠ "B tác động A"
DIRECTIONAL_VERBS: Set[str] = {
    # Quan hệ nhân quả
    "quyết định", "tác động", "ảnh hưởng", "sinh ra", "tạo ra", "gây ra",
    "nguyên nhân", "kết quả", "dẫn đến", "gây nên", "phát sinh",
    # Chuyển động / Vị trí
    "quay quanh", "bao quanh", "xoay quanh", "vây quanh",
    "từ", "đến", "về phía", "hướng tới",
    # So sánh
    "lớn hơn", "nhỏ hơn", "cao hơn", "thấp hơn", "nhanh hơn", "chậm hơn",
    "hơn", "kém", "bằng",
    # Quan hệ sở hữu
    "phụ thuộc", "lệ thuộc", "thuộc về", "sở hữu",
    "sau", "trước", "tiếp theo", "trước đó",
    "con của", "cha của", "thuộc", "của",
    # Vật lý
    "chiếu sáng", "hấp dẫn", "thu hút", "đẩy", "kéo",
}

# TỪ KHÓA BỊ ĐỘNG (Passive Markers)
# "A tác động B" = "B bị/được A tác động"
PASSIVE_MARKERS: Set[str] = {"bị", "được", "do", "bởi", "nhờ", "qua"}

# ĐỊA DANH QUAN TRỌNG (Hard Locations)
# Dùng cho Fact Check - sai địa danh = sai nghiêm trọng
HARD_LOCATIONS: Set[str] = {
    # Việt Nam - Thành phố lớn
    "hà nội", "hồ chí minh", "sài gòn", "đà nẵng", "hải phòng", "cần thơ",
    "biên hòa", "nha trang", "đà lạt", "huế", "vinh", "quy nhơn",
    # Việt Nam - Tỉnh/TP khác
    "hà giang", "cao bằng", "lạng sơn", "quảng ninh", "hạ long",
    "bắc ninh", "nam định", "ninh bình", "thanh hóa", "nghệ an", "hà tĩnh",
    "quảng bình", "quảng trị", "quảng nam", "quảng ngãi", "bình định", "phú yên", "khánh hòa",
    "ninh thuận", "bình thuận", "phan thiết", "kon tum", "gia lai", "đắk lắk", "lâm đồng",
    "bình phước", "tây ninh", "bình dương", "đồng nai", "bà rịa", "vũng tàu",
    "long an", "tiền giang", "bến tre", "vĩnh long", "đồng tháp", "an giang",
    "kiên giang", "hậu giang", "sóc trăng", "bạc liêu", "cà mau", "phú quốc",
    # Địa danh lịch sử
    "điện biên phủ", "ba đình", "bạch đằng", "chi lăng", "đống đa", "rạch gầm",
    "biển đông", "fansipan", "pác bó", "tân trào",
    # Quốc tế
    "việt nam", "trung quốc", "mỹ", "hoa kỳ", "nhật bản", "liên xô",
    "lào", "campuchia", "thái lan", "hàn quốc", "triều tiên", "ấn độ", "singapore",
    "úc", "canada", "brazil", "cuba", "ukraine", "tây ban nha",
}

# HELPER FUNCTIONS FOR SMART BYPASS
def get_vietnamese_stopwords() -> Set[str]:
    # Return the comprehensive set of Vietnamese stopwords.
    return VIETNAMESE_STOPWORDS.copy()


def remove_stopwords(text: str) -> str:
    # Remove Vietnamese stopwords from text.
    if not text:
        return ""
    words = text.lower().split()
    filtered = [w for w in words if w not in VIETNAMESE_STOPWORDS]
    return " ".join(filtered)


def is_stopword(word: str) -> bool:
    # Check if a word is a Vietnamese stopword.
    return word.lower() in VIETNAMESE_STOPWORDS


def expand_abbreviations(text: str) -> str:
    if not text:
        return ""
    text_lower = text.lower()
    words = text_lower.split()
    expanded_words = [ABBREVIATIONS.get(w, w) for w in words]
    return " ".join(expanded_words)


def check_passive_voice(text: str) -> bool:
    if not text:
        return False
    text_lower = text.lower()
    return any(marker in text_lower for marker in PASSIVE_MARKERS)


def get_antonyms(word: str) -> List[str]:
    # Get list of antonyms for a word.
    return ANTONYM_PAIRS.get(word.lower(), [])


def is_antonym_pair(word1: str, word2: str) -> bool:
    # Check if two words are antonyms.
    w1_lower = word1.lower()
    w2_lower = word2.lower()
    
    # Check both directions
    if w2_lower in ANTONYM_PAIRS.get(w1_lower, []):
        return True
    if w1_lower in ANTONYM_PAIRS.get(w2_lower, []):
        return True
    return False


def vn_tokenize(text: str) -> str:
    # Tokenize Vietnamese text using underthesea.
    if not text:
        return ""
        
    try:
        from underthesea import word_tokenize
        return word_tokenize(text, format="text")
    except (ImportError, Exception):
        try:
            from underthesea_lite import word_tokenize
            return word_tokenize(text, format="text")
        except (ImportError, Exception):
            # Fallback to simple split if both fail
            return text


def normalize_text(text: str) -> str:
    # Normalize text for comparison: lowercase, remove extra spaces, strip punctuation.
    if not text:
        return ""
    # Remove punctuation except Vietnamese diacritics
    text = re.sub(r'[^\w\s\u00C0-\u1EF9]', '', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip().lower()
    return text


def remove_vietnamese_diacritics(text: str) -> str:
    # Remove Vietnamese diacritics from text for fuzzy matching.
    # Converts 'phần mềm' -> 'phan mem', 'tốc độ' -> 'toc do', etc.
    if not text:
        return ""
    
    # Vietnamese character mapping
    diacritics_map = {
        'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
        'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
        'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
        'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
        'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
        'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
        'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
        'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
        'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
        'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
        'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
        'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
        'đ': 'd',
        # Uppercase versions
        'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
        'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
        'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
        'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
        'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
        'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
        'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
        'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
        'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
        'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
        'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
        'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
        'Đ': 'D'
    }
    
    result = []
    for char in text:
        result.append(diacritics_map.get(char, char))
    return ''.join(result)


def extract_entities(text: str) -> Dict[str, Set[str]]:
    # Extract named entities (dates, locations) from text.
    entities = {
        "dates": set(),
        "locations": set()
    }
    
    if not text:
        return entities

    # 1. Extract Dates
    date_pattern = re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4})\b|\b(19\d{2}|20\d{2})\b")
    text_date_pattern = re.compile(r"(?:ngày\s+)?(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})", re.IGNORECASE)
    
    for match in date_pattern.finditer(text):
        entities["dates"].add(match.group(0))
        
    for match in text_date_pattern.finditer(text):
        day, month, year = match.groups()
        normalized_date = f"{int(day):02d}/{int(month):02d}/{year}"
        entities["dates"].add(normalized_date)

    # 2. Extract Locations (Heuristic)
    prefixes = r"(?:[Tt]hành phố|[Tt]ỉnh|[Qq]uận|[Hh]uyện|[Xx]ã|[Pp]hường|[Tt]hị trấn)\s+"
    markers = r"(?:tại|ở|thành phố|tỉnh|quận|huyện|xã|phường)"
    loc_markers = f"{markers}\\s+(?:{prefixes})?([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)*)"
    loc_pattern = re.compile(loc_markers)
    
    loc_stopwords = {"thành", "phố", "tỉnh", "quận", "huyện", "xã", "phường", "thị", "trấn"}
    
    for match in loc_pattern.finditer(text):
        loc = match.group(1).strip()
        if loc.lower() not in loc_stopwords:
             entities["locations"].add(loc)

    # Try underthesea NER if installed
    try:
        from underthesea import ner
        ner_results = ner(text)
        for result in ner_results:
             if len(result) >= 4:
                word = result[0]
                label = result[3]
                if label == "B-LOC" or label == "I-LOC":
                     if word.lower() not in loc_stopwords:
                        entities["locations"].add(word)
    except (ImportError, Exception):
        pass

    return entities


def normalize_synonyms(text: str) -> str:
    # Replace synonyms with standard terms to improve AI semantic matching.
    # Example: "thái dương" -> "mặt trời", "phi cơ" -> "máy bay"
    if not text:
        return ""
    
    # Sort keys by length (descending) to match longest phrases first
    sorted_synonyms = sorted(SYNONYM_PAIRS.keys(), key=len, reverse=True)
    
    text_lower = text.lower()
    
    for syn in sorted_synonyms:
        if syn in text_lower:
            standard = SYNONYM_PAIRS[syn]
            # Use regex for word boundary to prevent partial replacement
            pattern = re.compile(rf"\b{re.escape(syn)}\b")
            text_lower = pattern.sub(standard, text_lower)
            
    return text_lower
