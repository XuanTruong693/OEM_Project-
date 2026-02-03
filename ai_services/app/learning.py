import os
import json
import re
from typing import Dict, List, Optional, Tuple, Set
from sentence_transformers import SentenceTransformer, util
from datetime import datetime
from underthesea import word_tokenize as vn_word_tokenize


SYNONYMS_FILE = os.path.join(os.path.dirname(__file__), "learned_synonyms.json")

VIETNAMESE_SYNONYMS = {
    "xe máy": ["xe gắn máy", "xe mô tô", "honda"],
    "quả": ["trái"],
    "bắp": ["ngô"],
    "thìa": ["muỗng"],
    "dép": ["dép lê", "dép tông"],
    "áo thun": ["áo phông"],
    "cốc": ["ly"],
    "bát": ["chén", "tô"],
    "xoong": ["nồi"],
    "khoai tây": ["củ khoai tây"],
    "củ cải": ["cà rốt trắng"],
    "dứa": ["thơm", "khóm"],
    "mít": ["trái mít"],
    "ổi": ["trái ổi"],
    "sầu riêng": ["sầu"],
    "chôm chôm": ["trái chôm chôm"],
    "cá rô": ["cá rô phi"],
    "vịt": ["con vịt"],
    "gà": ["con gà"],
    "heo": ["lợn"],
    "bò": ["trâu bò", "con bò"],
    "ớt": ["trái ớt"],
    "hành": ["củ hành", "hành tây"],
    "tỏi": ["củ tỏi"],
    "gừng": ["củ gừng"],
    "nghệ": ["củ nghệ"],
    "rau muống": ["rau"],
    "cải": ["rau cải", "cải xanh"],
    "xà lách": ["rau xà lách", "salad"],

    "đi": ["bước", "đi bộ", "di chuyển"],
    "chạy": ["chạy bộ", "phi"],
    "nhảy": ["nhảy lên", "bật nhảy"],
    "ăn": ["dùng bữa", "ăn uống", "xơi"],
    "uống": ["uống nước", "dùng"],
    "ngủ": ["nghỉ ngơi", "ngủ nghỉ", "đi ngủ"],
    "thức": ["thức dậy", "tỉnh dậy", "dậy"],
    "nói": ["nói chuyện", "trò chuyện", "trao đổi"],
    "nghe": ["lắng nghe", "nghe thấy"],
    "nhìn": ["xem", "ngắm", "quan sát", "nhìn thấy"],
    "đọc": ["đọc sách", "xem"],
    "viết": ["ghi", "ghi chép", "chép"],
    "học": ["học tập", "học hành", "nghiên cứu"],
    "dạy": ["giảng dạy", "hướng dẫn", "chỉ dạy"],
    "làm": ["thực hiện", "tiến hành", "làm việc"],
    "tạo": ["tạo ra", "sinh ra", "sáng tạo"],
    "xây": ["xây dựng", "kiến tạo"],
    "phá": ["phá hủy", "hủy hoại", "tiêu diệt"],
    "mở": ["mở ra", "khai mở"],
    "đóng": ["đóng lại", "khép"],
    "bắt đầu": ["khởi đầu", "bắt đầu", "khởi sự", "mở đầu"],
    "kết thúc": ["chấm dứt", "hoàn thành", "xong"],
    "giúp": ["giúp đỡ", "hỗ trợ", "trợ giúp"],
    "yêu": ["yêu thương", "thương yêu", "mến"],
    "ghét": ["căm ghét", "ghét bỏ"],
    "sợ": ["sợ hãi", "lo sợ", "hoảng sợ"],
    "vui": ["vui vẻ", "vui mừng", "hạnh phúc"],
    "buồn": ["buồn bã", "u buồn", "đau buồn"],

    "đẹp": ["xinh", "xinh đẹp", "đẹp đẽ", "tuyệt đẹp"],
    "xấu": ["xấu xí", "tồi tệ"],
    "tốt": ["tốt đẹp", "tốt lành", "tuyệt vời", "xuất sắc"],
    "hay": ["thú vị", "hấp dẫn"],
    "dở": ["tệ", "kém"],
    "lớn": ["to", "to lớn", "khổng lồ", "vĩ đại"],
    "nhỏ": ["bé", "nhỏ bé", "bé nhỏ", "tí hon"],
    "cao": ["cao lớn", "cao ráo"],
    "thấp": ["lùn", "thấp bé"],
    "dài": ["dài dằng dặc"],
    "ngắn": ["ngắn ngủi", "vắn"],
    "rộng": ["rộng lớn", "bao la", "mênh mông"],
    "hẹp": ["chật", "chật hẹp"],
    "nhanh": ["nhanh chóng", "mau", "mau chóng", "tốc độ"],
    "chậm": ["chậm chạp", "chậm rãi", "thong thả"],
    "mới": ["mới mẻ", "tân", "tiên tiến"],
    "cũ": ["cũ kỹ", "lạc hậu"],
    "trẻ": ["trẻ trung", "thanh niên"],
    "già": ["già cả", "lớn tuổi", "cao tuổi"],
    "giàu": ["giàu có", "giàu sang", "phú quý"],
    "nghèo": ["nghèo khổ", "nghèo nàn", "khó khăn"],
    "khỏe": ["khỏe mạnh", "cường tráng", "mạnh khỏe"],
    "yếu": ["yếu đuối", "ốm yếu"],
    "nóng": ["nóng nực", "oi bức", "nóng bức"],
    "lạnh": ["lạnh lẽo", "giá lạnh", "băng giá"],
    "sáng": ["sáng sủa", "rạng rỡ", "chói lọi"],
    "tối": ["tối tăm", "tăm tối", "u ám"],

    "và": ["cùng", "cùng với", "với"],
    "hoặc": ["hay", "hay là", "hoặc là"],
    "nhưng": ["tuy nhiên", "song", "thế nhưng", "mặc dù"],
    "vì": ["bởi vì", "do", "bởi", "vì rằng"],
    "nên": ["cho nên", "vì vậy", "do đó", "vậy nên", "bởi vậy"],
    "nếu": ["nếu như", "giả sử", "nếu mà"],
    "thì": ["thì là"],
    "mà": ["nhưng mà", "thế mà"],
    "để": ["để mà", "nhằm", "hầu"],
    "khi": ["lúc", "khi mà", "trong khi"],
    "sau": ["sau khi", "sau đó"],
    "trước": ["trước khi", "trước đó"],
    "rất": ["rất là", "hết sức", "vô cùng", "cực kỳ"],
    "quá": ["quá mức", "quá đỗi"],
    "lắm": ["nhiều lắm", "rất nhiều"],
    "cũng": ["cũng vậy", "giống vậy"],
    "đã": ["đã từng", "từng"],
    "sẽ": ["sẽ phải"],
    "đang": ["đang tiến hành"],

    "ví dụ": ["thí dụ", "chẳng hạn", "như là", "cụ thể"],
    "đầu tiên": ["trước hết", "trước tiên", "thứ nhất", "đầu tiên là"],
    "thứ hai": ["tiếp theo", "kế tiếp"],
    "cuối cùng": ["sau cùng", "cuối hết", "sau hết"],
    "quan trọng": ["trọng yếu", "thiết yếu", "cần thiết", "cốt yếu"],
    "phát triển": ["tiến bộ", "phát đạt", "phát trưởng"],
    "nghiên cứu": ["tìm hiểu", "khảo sát", "điều tra"],
    "phân tích": ["phân giải", "mổ xẻ"],
    "tổng hợp": ["tổng kết", "khái quát"],
    "đánh giá": ["nhận xét", "phê bình", "bình giá"],
    "kết luận": ["kết thúc", "tóm lại", "tóm tắt"],
    "nguyên nhân": ["lý do", "căn nguyên"],
    "kết quả": ["hậu quả", "thành quả", "kết cục"],
    "mục đích": ["mục tiêu", "đích đến"],
    "phương pháp": ["cách thức", "biện pháp", "phương thức"],
    "giải pháp": ["cách giải quyết", "biện pháp"],
    "vấn đề": ["thắc mắc", "câu hỏi", "bài toán"],
    "khái niệm": ["định nghĩa", "ý niệm"],
    "lý thuyết": ["học thuyết", "lý luận"],
    "thực hành": ["thực tế", "thực tiễn"],

    "việt nam": ["vn", "nước việt nam", "nước ta", "đất nước việt nam", "tổ quốc"],
    "hà nội": ["thủ đô hà nội", "thủ đô", "hn"],
    "thành phố hồ chí minh": ["tp hcm", "sài gòn", "hcm", "tphcm", "sg"],
    "đà nẵng": ["thành phố đà nẵng"],
    "hải phòng": ["thành phố hải phòng", "hp"],
    "cần thơ": ["thành phố cần thơ"],
    "huế": ["thành phố huế", "cố đô huế"],
    
    # ===== IT/TECHNOLOGY TERMS =====
    "machine learning": ["ml", "học máy", "máy học", "học tự động"],
    "artificial intelligence": ["ai", "trí tuệ nhân tạo", "trí thông minh nhân tạo"],
    "deep learning": ["dl", "học sâu"],
    "neural network": ["nn", "mạng nơ-ron", "mạng thần kinh nhân tạo"],
    "database": ["db", "cơ sở dữ liệu", "csdd", "dữ liệu"],
    "framework": ["khung làm việc", "bộ khung", "khung phần mềm"],
    "software": ["phần mềm", "ứng dụng", "chương trình"],
    "hardware": ["phần cứng"],
    "algorithm": ["thuật toán", "giải thuật"],
    "programming": ["lập trình", "viết code", "coding"],
    "programming language": ["ngôn ngữ lập trình", "ngôn ngữ lt"],
    "python": ["python3", "py", "ngôn ngữ python"],
    "javascript": ["js", "nodejs", "node.js"],
    "data": ["dữ liệu", "số liệu", "thông tin", "data"],
    "server": ["máy chủ", "server"],
    "client": ["máy khách", "client"],
    "internet": ["mạng internet", "internet", "mạng", "in-tơ-nét"],
    "website": ["web", "trang web", "site"],
    "application": ["ứng dụng", "app", "phần mềm ứng dụng"],
    "function": ["hàm", "chức năng", "tính năng"],
    "variable": ["biến", "biến số"],
    "object": ["đối tượng", "vật thể", "object"],
    "class": ["lớp", "class"],
    "method": ["phương thức", "method"],
    "api": ["giao diện lập trình ứng dụng", "application programming interface"],
    "cpu": ["bộ xử lý trung tâm", "vi xử lý", "central processing unit"],
    "ram": ["bộ nhớ", "bộ nhớ tạm", "random access memory"],
    "ssd": ["ổ cứng thể rắn", "solid state drive"],
    "hdd": ["ổ cứng", "hard disk drive"],
    
    # ===== ACADEMIC TERMS =====
    "ý thức": ["nhận thức", "tư duy", "tinh thần"],
    "vật chất": ["thể chất", "vật thể", "thực thể"],
    "pháp luật": ["luật pháp", "luật", "quy định pháp luật"],
    "bảo vệ": ["bảo hộ", "che chở", "bảo vệ quyền"],
    "quyền lợi": ["quyền", "lợi ích", "quyền và lợi ích"],
    "xã hội": ["cộng đồng", "xã hội loài người"],
    "quan hệ xã hội": ["các mối quan hệ", "quan hệ giữa người với người"],
    "điều chỉnh": ["quản lý", "chi phối", "điều tiết"],
    "phản ánh": ["thể hiện", "biểu hiện", "phản chiếu"],
    "khách quan": ["thực tế khách quan", "khách quan", "thế giới khách quan"],
    "chủ quan": ["ý chí chủ quan", "quan điểm cá nhân"],
    "biện chứng": ["phép biện chứng", "biện chứng pháp"],
    "duy vật": ["chủ nghĩa duy vật", "duy vật luận"],
    "thực tiễn": ["thực tế", "thực hành"],
    

    "ngày": ["hôm", "ngày hôm"],
    "hôm nay": ["ngày hôm nay", "bữa nay"],
    "hôm qua": ["ngày hôm qua"],
    "ngày mai": ["mai", "ngày hôm sau"],
    "tuần": ["tuần lễ"],
    "tháng": ["tháng này"],
    "năm": ["năm nay"],
    "sáng": ["buổi sáng", "sáng sớm"],
    "trưa": ["buổi trưa", "giữa trưa"],
    "chiều": ["buổi chiều", "xế chiều"],
    "tối": ["buổi tối", "đêm"],
    "đêm": ["ban đêm", "đêm khuya"],
    "luôn luôn": ["mãi mãi", "luôn", "lúc nào cũng"],
    "thường": ["thường xuyên", "hay"],
    "đôi khi": ["thỉnh thoảng", "thỉnh thoảng"],
    "hiếm khi": ["ít khi", "hiếm"],
    
    "điện thoại": ["điện thoại di động", "đt", "phone", "dế"],
    "máy tính": ["computer", "pc", "laptop", "máy vi tính"],
    "xe đạp": ["xe đạp điện"],
    "ô tô": ["xe hơi", "xe ô tô", "xe bốn bánh"],
    "máy bay": ["phi cơ", "tàu bay"],
    "tàu": ["tàu thủy", "thuyền"],
    "nhà": ["căn nhà", "ngôi nhà", "nhà cửa"],
    "phòng": ["căn phòng", "buồng"],
    "cửa": ["cánh cửa"],
    "bàn": ["cái bàn", "bàn học"],
    "ghế": ["cái ghế", "ghế ngồi"],
    "giường": ["cái giường", "giường ngủ"],
    "sách": ["quyển sách", "cuốn sách"],
    "vở": ["quyển vở", "tập vở"],
    "bút": ["cái bút", "viết"],
    "áo": ["cái áo", "áo quần"],
    "quần": ["cái quần"],
    "giày": ["đôi giày", "giày dép"],
    "mũ": ["nón", "cái mũ"],
    "kính": ["cặp kính", "kính mắt"],
    "đồng hồ": ["cái đồng hồ"],
    "tiền": ["tiền bạc", "kim tiền"],
    

    "người": ["con người", "nhân loại"],
    "bố": ["cha", "ba", "tía", "bọ"],
    "mẹ": ["má", "mạ", "u"],
    "anh": ["anh trai"],
    "chị": ["chị gái"],
    "em": ["em trai", "em gái"],
    "ông": ["ông nội", "ông ngoại"],
    "bà": ["bà nội", "bà ngoại"],
    "chú": ["bác", "cậu"],
    "cô": ["dì", "bác gái"],
    "bạn": ["bạn bè", "người bạn"],
    "thầy": ["thầy giáo", "giáo viên nam"],
    "cô giáo": ["giáo viên nữ", "cô"],
    "học sinh": ["sinh viên", "người học", "học viên"],
    "bác sĩ": ["y sĩ", "thầy thuốc"],
    "công nhân": ["người lao động", "thợ"],
    "nông dân": ["người nông dân", "bà con nông dân"],

    "hạnh phúc": ["sung sướng", "vui sướng", "mãn nguyện"],
    "đau khổ": ["khổ sở", "thống khổ", "đau đớn"],
    "lo lắng": ["lo âu", "bồn chồn", "lo ngại"],
    "tự hào": ["kiêu hãnh", "hãnh diện"],
    "xấu hổ": ["mắc cỡ", "thẹn thùng", "ngượng ngùng"],
    "tức giận": ["giận dữ", "phẫn nộ", "nổi giận"],
    "ngạc nhiên": ["kinh ngạc", "bất ngờ", "sửng sốt"],
    "thất vọng": ["chán nản", "thất chí"],
 
    "nhiều": ["rất nhiều", "đa số", "phần lớn", "vô số"],
    "ít": ["một ít", "chút ít", "thiểu số"],
    "tất cả": ["toàn bộ", "hết thảy", "đầy đủ"],
    "một số": ["một vài", "một ít"],
    "hầu hết": ["đa số", "phần lớn", "gần hết"],
    "không có": ["không hề", "chẳng có"],
    
    # Tech abbreviations
    "ml": ["machine learning"],
    "ai": ["artificial intelligence"],
}




LEARNED_DATA_PATH = os.path.join(os.path.dirname(__file__), "learned_data.json")

class LearningEngine:

    # AI Learning Engine that learns from instructor feedback.
    def __init__(self, model: SentenceTransformer = None):
        self.model = model
        self.patterns_cache: List[Dict] = []  # Cached confirmed patterns
        self.synonyms: Dict[str, Set[str]] = {}  # Learned synonyms
        self.last_reload: datetime = None
        
        # Load base Vietnamese synonyms
        self._load_base_synonyms()
        

        # Load learned patterns from file
        self._load_patterns_from_file()
    
    def _load_base_synonyms(self):
        # Load base Vietnamese synonym knowledge
        for key, values in VIETNAMESE_SYNONYMS.items():
            normalized_key = self._normalize(key)
            if normalized_key not in self.synonyms:
                self.synonyms[normalized_key] = set()
            for v in values:
                self.synonyms[normalized_key].add(self._normalize(v))
            
            # Also add reverse mappings
            for v in values:
                normalized_v = self._normalize(v)
                if normalized_v not in self.synonyms:
                    self.synonyms[normalized_v] = set()
                self.synonyms[normalized_v].add(normalized_key)


    def _load_patterns_from_file(self):
        # Load learned patterns from JSON file
        try:
            if os.path.exists(LEARNED_DATA_PATH):
                with open(LEARNED_DATA_PATH, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        self.patterns_cache = data
                        print(f"[Learning] Loaded {len(self.patterns_cache)} learned patterns from file")
                    else:
                        print("[Learning] Warning: learned_data.json is not a list")
        except Exception as e:
            print(f"[Learning] Could not load patterns file: {e}")

    def _save_patterns_to_file(self):
        # Save learned patterns to JSON file
        try:
            with open(LEARNED_DATA_PATH, 'w', encoding='utf-8') as f:
                json.dump(self.patterns_cache, f, ensure_ascii=False, indent=2)
            print(f"[Learning] Saved {len(self.patterns_cache)} patterns to file")
        except Exception as e:
            print(f"[Learning] Could not save patterns file: {e}")
    
    def _normalize(self, text: str) -> str:
        """Normalize text for comparison"""
        if not text:
            return ""
        text = text.lower().strip()
        text = re.sub(r'[^\w\s\u00C0-\u1EF9]', '', text)
        text = re.sub(r'\s+', ' ', text)
        return text
    
    def _remove_diacritics(self, text: str) -> str:
        # Vietnamese diacritics mapping
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
            # Uppercase
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
            'Đ': 'D',
        }
        result = []
        for char in text:
            result.append(diacritics_map.get(char, char))
        return ''.join(result)
    
    def _tokenize(self, text: str) -> List[str]:
        
        # Vietnamese word tokenization using underthesea.
        normalized = self._normalize(text)
        try:
            # Use underthesea (Stable version 6.8.4 verified on Windows)
            tokens = vn_word_tokenize(normalized, format="text")
            return tokens.split()
        except:
            # Fallback only if strictly necessary
            return normalized.split()
    
    def load_patterns_from_db(self, db_connection) -> int:
        
        # Load confirmed patterns from database.
        try:
            cursor = db_connection.cursor(dictionary=True)
            
            # Get confirmed patterns with score difference
            query = """
                SELECT 
                    al.id,
                    al.student_answer,
                    al.model_answer,
                    al.ai_suggested_score,
                    sa.score as confirmed_score,
                    eq.points as max_points
                FROM ai_logs al
                JOIN student_answers sa ON al.question_id = sa.question_id 
                                        AND al.student_id = sa.student_id
                JOIN submissions s ON sa.submission_id = s.id
                JOIN exam_questions eq ON al.question_id = eq.id
                WHERE s.instructor_confirmed = 1
                  AND sa.status IN ('confirmed', 'graded')
                  AND al.student_answer IS NOT NULL
                  AND al.model_answer IS NOT NULL
            """
            print("[Learning] Executing DB query...")
            cursor.execute(query)
            results = cursor.fetchall()
            print(f"[Learning] DB Query returned {len(results)} rows")
            synonym_candidates = []
            count_new = 0
            
            for row in results:
                pattern = {
                    "student_answer": row["student_answer"],
                    "model_answer": row["model_answer"],
                    "confirmed_score": float(row["confirmed_score"]) if row["confirmed_score"] else 0,
                    "ai_score": float(row["ai_suggested_score"]) if row["ai_suggested_score"] else 0,
                    "max_points": float(row["max_points"]) if row["max_points"] else 1.0
                }
                
                # Check for duplicates efficiently
                is_duplicate = False
                p_stud_norm = self._normalize(pattern["student_answer"])
                p_mod_norm = self._normalize(pattern["model_answer"])

                for existing in self.patterns_cache:
                    if (self._normalize(existing["student_answer"]) == p_stud_norm and
                        self._normalize(existing["model_answer"]) == p_mod_norm):
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    self.patterns_cache.append(pattern)
                    count_new += 1
                
                # Detect potential synonyms (logic remains same)
                if pattern["max_points"] > 0:
                    ai_ratio = pattern["ai_score"] / pattern["max_points"]
                    confirmed_ratio = pattern["confirmed_score"] / pattern["max_points"]
                    
                    if ai_ratio < 0.6 and confirmed_ratio > 0.8:
                        synonym_candidates.append({
                            "student_words": self._tokenize(row["student_answer"]),
                            "model_words": self._tokenize(row["model_answer"]),
                            "score_diff": confirmed_ratio - ai_ratio
                        })

            # Save merged result to file
            if count_new > 0:
                self._save_patterns_to_file()
                print(f"[Learning] DB Sync: Merged {count_new} new patterns from DB. Total cache: {len(self.patterns_cache)}")
            
            # Learn synonyms from candidates
            print(f"[Learning] Processing {len(synonym_candidates)} synonym candidates...")
            try:
                self._learn_synonyms_from_candidates(synonym_candidates)
            except Exception as e:
                print(f"[Learning] ⚠️ Error learning synonyms: {e}")
                import traceback
                traceback.print_exc()
            
            cursor.close()
            self.last_reload = datetime.now()
            
            return len(self.patterns_cache)
            
        except Exception as e:
            print(f"[Learning] Error loading patterns: {e}")
            return 0
    
    def _learn_synonyms_from_candidates(self, candidates: List[Dict]):
        # Learn synonyms using underthesea compound words + semantic similarity.
        # Only learns pairs with similarity > 70%.
        new_synonyms_count = 0
        try:
            from app.nlp import get_model
            model = get_model()
        except:
            print("[Learning] ⚠️ Could not load model for semantic similarity check")
            return
        
        SIMILARITY_THRESHOLD = 0.60  # Learn if similarity > 60% (lowered to catch real synonyms)
        MIN_WORD_LENGTH = 6  # Skip single-syllable words (dưới, giỏi = 4 chars) to avoid false positives
        
        for candidate in candidates:
            student_words = candidate["student_words"]  # Already tokenized with underthesea
            model_words = candidate["model_words"]
            
            # Use underthesea compound words directly (already properly segmented)
            student_phrases = set()
            model_phrases = set()
            
            # Only add words/compounds with length >= MIN_WORD_LENGTH
            for w in student_words:
                # Convert underscore to space for display but keep as single unit
                phrase = w.replace("_", " ")
                if len(phrase) >= MIN_WORD_LENGTH:
                    student_phrases.add(phrase)
            
            for w in model_words:
                phrase = w.replace("_", " ")
                if len(phrase) >= MIN_WORD_LENGTH:
                    model_phrases.add(phrase)
            
            # Find unique words/phrases in each
            unique_student = student_phrases - model_phrases
            unique_model = model_phrases - student_phrases
            
            print(f"[Learning] 🔍 Checking {len(unique_student)} student × {len(unique_model)} model words (min {MIN_WORD_LENGTH} chars, >65% sim)")
            print(f"[Learning] 📝 Student unique: {list(unique_student)[:10]}")
            print(f"[Learning] 📝 Model unique: {list(unique_model)[:10]}")
            
            if not unique_student or not unique_model:
                print("[Learning] ⏭️ Skipping: no unique phrases found")
                continue
            
            # Encode all phrases
            student_list = list(unique_student)
            model_list = list(unique_model)
            
            try:
                # Remove diacritics for better similarity matching
                student_nodiacritics = [self._remove_diacritics(s) for s in student_list]
                model_nodiacritics = [self._remove_diacritics(m) for m in model_list]
                
                student_embeddings = model.encode(student_nodiacritics, convert_to_tensor=True)
                model_embeddings = model.encode(model_nodiacritics, convert_to_tensor=True)
                
                # Compute similarity matrix
                similarities = util.cos_sim(student_embeddings, model_embeddings)
                # Debug: Show TOP 5 similarity pairs (regardless of threshold)
                all_pairs = []
                for i, s_phrase in enumerate(student_list):
                    for j, m_phrase in enumerate(model_list):
                        sim = similarities[i][j].item()
                        all_pairs.append((sim, s_phrase, m_phrase))
                
                all_pairs.sort(reverse=True)
                print(f"[Learning] 📊 Top 5 similarity pairs:")
                for sim, s, m in all_pairs[:5]:
                    status = "✅" if sim >= SIMILARITY_THRESHOLD else "❌"
                    print(f"[Learning]   {status} {sim:.0%}: '{s}' ↔ '{m}'")
                
                # Find pairs with similarity > threshold
                for i, s_phrase in enumerate(student_list):
                    for j, m_phrase in enumerate(model_list):
                        sim = similarities[i][j].item()
                        
                        if sim >= SIMILARITY_THRESHOLD:
                            # Log all pairs that meet threshold
                            print(f"[Learning] 🎯 Pair meets threshold ({sim:.0%}): '{s_phrase}' ↔ '{m_phrase}'")
                            
                            # Skip if already known
                            if m_phrase in self.synonyms and s_phrase in self.synonyms[m_phrase]:
                                print(f"[Learning] ⏭️ Skipping (already known): '{s_phrase}' ↔ '{m_phrase}'")
                                continue
                            
                            # Skip if same phrase
                            if s_phrase == m_phrase:
                                print(f"[Learning] ⏭️ Skipping (same phrase): '{s_phrase}'")
                                continue
                            
                            # Add bidirectional mapping
                            if m_phrase not in self.synonyms:
                                self.synonyms[m_phrase] = set()
                            self.synonyms[m_phrase].add(s_phrase)
                            
                            if s_phrase not in self.synonyms:
                                self.synonyms[s_phrase] = set()
                            self.synonyms[s_phrase].add(m_phrase)
                            
                            new_synonyms_count += 1
                            print(f"[Learning] ✅ NEW synonym added: '{s_phrase}' ↔ '{m_phrase}'")
                            
            except Exception as e:
                print(f"[Learning] ⚠️ Error computing similarity: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        if new_synonyms_count > 0:
            # self._save_learned_synonyms() # Disabled file saving
            print(f"[Learning] Found {new_synonyms_count} potential synonym pairs (in-memory only)")
    
    def expand_with_synonyms(self, text: str) -> str:
        words = self._tokenize(text)
        expanded_words = []
        
        for word in words:
            expanded_words.append(word)
            # Add synonyms if available
            if word in self.synonyms:
                for syn in self.synonyms[word]:
                    if syn not in expanded_words:
                        expanded_words.append(syn)
        
        return " ".join(expanded_words)
    
    def find_similar_pattern(self, student_answer: str, model_answer: str, 
                            threshold: float = 0.88) -> Optional[Dict]:
        if not self.patterns_cache:
            return None
        
        student_norm = self._normalize(student_answer)
        model_norm = self._normalize(model_answer)
        
        # Encode current answer if model is available
        student_emb = None
        if self.model:
            student_emb = self.model.encode(student_norm, normalize_embeddings=True)
        
        best_match = None
        best_sim = 0.0
        
        for pattern in self.patterns_cache:
            # Check if model answer matches (same question context)
            pattern_model_norm = self._normalize(pattern["model_answer"])
            if pattern_model_norm != model_norm:
                continue
            
            # Compare student answers
            pattern_student_norm = self._normalize(pattern["student_answer"])
            
            # Quick exact match check
            if student_norm == pattern_student_norm:
                return {
                    "confirmed_score": pattern["confirmed_score"],
                    "confidence": 1.0,
                    "match_type": "exact"
                }
            
            # Semantic similarity check (only if model available)
            if self.model and student_emb is not None:
                pattern_emb = self.model.encode(pattern_student_norm, normalize_embeddings=True)
                sim = float(util.cos_sim(student_emb, pattern_emb).item())
                
                if sim > best_sim and sim >= threshold:
                    best_sim = sim
                    best_match = pattern
        
        if best_match:
            return {
                "confirmed_score": best_match["confirmed_score"],
                "confidence": round(best_sim, 2),
                "match_type": "semantic"
            }
        
        return None

    def add_learned_pattern(self, student_answer: str, model_answer: str, 
                           confirmed_score: float, max_points: float = 1.0) -> None:
        pattern = {
            "student_answer": student_answer,
            "model_answer": model_answer,
            "confirmed_score": float(confirmed_score),
            "ai_score": 0.0, # Not needed for matching
            "max_points": float(max_points)
        }
        
        # Check if already exists to avoid duplicates
        stud_norm = self._normalize(student_answer)
        mod_norm = self._normalize(model_answer)
        
        updated = False
        for p in self.patterns_cache:
            if (self._normalize(p["student_answer"]) == stud_norm and 
                self._normalize(p["model_answer"]) == mod_norm):
                # Update existing score
                p["confirmed_score"] = float(confirmed_score)
                updated = True
                print(f"[Learning] Updated existing pattern in cache: '{student_answer[:20]}...'")
                break

        if not updated:
            self.patterns_cache.append(pattern)
            print(f"[Learning] Added new live pattern to cache: '{student_answer[:20]}...' (Score: {confirmed_score})")
            
        # Save to file immediately
        self._save_patterns_to_file()
    
    def get_stats(self) -> Dict:
        #Get learning statistics
        return {
            "total_patterns": len(self.patterns_cache),
            "total_synonym_groups": len(self.synonyms),
            "base_synonyms": len(VIETNAMESE_SYNONYMS),
            "learned_synonyms": len(self.synonyms) - len(VIETNAMESE_SYNONYMS),
            "last_reload": self.last_reload.isoformat() if self.last_reload else None
        }


# Singleton instance
_learning_engine: Optional[LearningEngine] = None


def get_learning_engine(model: SentenceTransformer = None) -> LearningEngine:
    """Get or create the singleton learning engine"""
    global _learning_engine
    if _learning_engine is None:
        _learning_engine = LearningEngine(model)
    elif model is not None and _learning_engine.model is None:
        _learning_engine.model = model
    return _learning_engine
