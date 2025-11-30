import cv2
import pytesseract
import re
import unicodedata
from typing import Dict, List, Tuple, Optional
try:
    import numpy as np  # used for bytes decoding
    _HAS_NUMPY = True
except Exception:
    np = None
    _HAS_NUMPY = False

# Đường dẫn Tesseract
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Các trường quan trọng (tiếng Việt + tiếng Anh + lỗi OCR phổ biến)
FIELDS: Dict[str, List[str]] = {
    "student_card": ["the sinh vien", "thẻ sinh viên", "the sv", "student card", "student id", "sinh vien", "sinhvien"],
    "university": [
        # Tiếng Việt chuẩn
        "dai hoc", "đại học", "truong dai hoc", "trường đại học",
        # Biến thể OCR nhầm
        "dai học", "dại hoc", "daihoc", "đaihoc", "university",
        # Tên trường phổ biến
        "duy tan", "duytan", "dtu", "dai hoc duy tan",
        # Keyword liên quan
        "truong", "trường"
    ],
    "faculty": ["khoa", "khoaa", "faculty"],
    "major": ["nganh", "ngành", "major", "field"],
    "class": ["lop", "lớp", "class"],
    "mssv": ["ma sinh vien", "mã sinh viên", "student code", "mssv", "masv"],
    "cccd": ["cccd", "can cuoc cong dan", "căn cước công dân", "citizen id"],
    "cmnd": ["cmnd", "chung minh nhan dan", "chứng minh nhân dân", "identity card"],
    "edu_domain": [".edu.vn", ".edu", "edu.vn", "edu", "eduvn"]
}

# Hàm chuẩn hóa text OCR
def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    text = re.sub(r"[^a-zA-Z0-9áàảãạăâđéèẻẽẹêíìỉĩịóòỏõọôơúùủũụýỳỷỹỵ\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

# Fuzzy match
def fuzzy_contains(text: str, keyword: str, threshold: int = 65) -> bool:
    t = text.lower()
    k = keyword.lower()
    # Simple partial check and crude token overlap ratio (no external deps)
    if k in t:
        return True
    # crude ratio: common token overlap
    t_tokens = set(re.split(r"\W+", t))
    k_tokens = set(re.split(r"\W+", k))
    inter = len(t_tokens & k_tokens)
    total = max(1, len(k_tokens))
    return (inter * 100 / total) >= threshold

# Tiền xử lý ảnh
def preprocess_image(image_path: str):
    img = cv2.imread(image_path)
    if img is None:
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Adaptive threshold
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 2
    )
    # Dilation + Erosion
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    return processed

# Kiểm tra CCCD (12 chữ số)
def extract_cccd(text: str) -> Optional[str]:
    # Tìm cả số dính vào chữ và số riêng biệt
    matches = re.findall(r"\d{12}", text.replace(" ", "").replace("-", ""))
    return matches[0] if matches else None

# Kiểm tra MSSV (8-11 số, KHÔNG phải 12 số CCCD)
def extract_mssv(text: str) -> Optional[str]:
    # Loại bỏ khoảng trắng và dấu gạch ngang
    clean_text = text.replace(" ", "").replace("-", "")
    # Tìm tất cả dãy số 8-11 chữ số
    matches = re.findall(r"\d{8,11}", clean_text)
    # Loại bỏ các số 12 chữ số (CCCD)
    matches = [m for m in matches if len(m) >= 8 and len(m) <= 11]
    return matches[0] if matches else None

# Kiểm tra có chữ CCCD hoặc CMND
def has_cccd_or_cmnd_keyword(text: str) -> bool:
    for kw in FIELDS["cccd"] + FIELDS["cmnd"]:
        if fuzzy_contains(text, kw, threshold=30):
            return True
    return False

# Kiểm tra URL .edu.vn hoặc .edu
def has_edu_domain(text: str) -> bool:
    # Tìm domain .edu.vn hoặc .edu
    return bool(re.search(r"\.edu(\.vn)?", text, re.IGNORECASE))

# Hàm kiểm tra thẻ sinh viên
def is_student_card(image_path: str) -> Tuple[bool, Dict[str, object]]:
    """Verify student card from an image path.

    Returns (valid, details) where details includes:
      - fields_matched: List[str]
      - mssv: Optional[str]
      - ocr_text: str
      - reasons: List[str]
    """
    img = preprocess_image(image_path)
    if img is None:
        return False, {"error": "Không đọc được ảnh", "fields_matched": [], "mssv": None, "ocr_text": "", "reasons": ["Ảnh không hợp lệ hoặc đường dẫn sai"]}

    text = pytesseract.image_to_string(img, lang="vie+eng")
    text = normalize_text(text)

    matched_fields: List[str] = []
    reasons: List[str] = []
    for field, keywords in FIELDS.items():
        if field == "edu_domain":
            # Kiểm tra riêng cho edu domain
            if has_edu_domain(text):
                matched_fields.append(field)
        else:
            for kw in keywords:
                if fuzzy_contains(text, kw):
                    matched_fields.append(field)
                    break

    # Kiểm tra MSSV (8-11 chữ số)
    mssv = extract_mssv(text)
    if mssv:
        if "mssv" not in matched_fields:
            matched_fields.append("mssv")
    else:
        reasons.append("Không tìm thấy mã số sinh viên (8–11 chữ số)")

    # Kiểm tra có "Thẻ sinh viên" hoặc "Student card"
    if "student_card" not in matched_fields:
        reasons.append("Không tìm thấy chữ 'Thẻ sinh viên' hoặc 'Student Card'")

    # Kiểm tra có "Đại học" hoặc "University"
    if "university" not in matched_fields:
        reasons.append("Không tìm thấy chữ 'Đại học' hoặc 'University'")

    # Kiểm tra có domain .edu.vn hoặc .edu
    if "edu_domain" not in matched_fields:
        reasons.append("Không tìm thấy domain .edu.vn hoặc .edu")

    # Heuristic: cần ít nhất 2 trong các trường bắt buộc
    # (student_card, university, edu_domain, mssv)
    required_fields = ["student_card", "university", "edu_domain", "mssv"]
    matched_required = [f for f in matched_fields if f in required_fields]
    valid = len(matched_required) >= 2
    
    if not valid:
        reasons.append(f"Chỉ tìm thấy {len(matched_required)}/4 trường bắt buộc (cần ít nhất 2)")

    return valid, {
        "fields_matched": list(set(matched_fields)),
        "mssv": mssv,
        "ocr_text": text,
        "reasons": reasons,
    }

def verify_student_card_from_bytes(image_bytes: bytes) -> Tuple[bool, Dict[str, object]]:
    """Verify student card from raw image bytes (e.g., uploaded file).

    Decodes bytes, preprocesses, runs OCR and fuzzy match.
    TỐI ƯU NHANH: Chỉ giữ preprocessing tối thiểu để OCR nhanh nhất
    """
    import sys
    
    if not _HAS_NUMPY:
        return False, {"error": "Thiếu thư viện numpy để giải mã ảnh bytes", "fields_matched": [], "mssv": None, "ocr_text": "", "reasons": ["Vui lòng cài đặt numpy"]}
    
    print("[OCR] 📥 Đang decode ảnh...", file=sys.stderr, flush=True)
    try:
        nparr = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    except Exception:
        return False, {"error": "Không giải mã được ảnh từ bytes", "fields_matched": [], "mssv": None, "ocr_text": "", "reasons": ["Dữ liệu ảnh không hợp lệ"]}

    # NHANH 1: Resize về kích thước TỐI ƯU (300px) ngay từ đầu
    h, w = nparr.shape[:2]
    print(f"[OCR] Progress: 10% - Kích thước gốc: {w}x{h}", file=sys.stderr, flush=True)
    
    max_dim = max(h, w)
    target_size = 300  # Giảm xuống 300px để xử lý cực nhanh
    
    if max_dim != target_size:
        scale = target_size / max_dim
        new_w = int(w * scale)
        new_h = int(h * scale)
        nparr = cv2.resize(nparr, (new_w, new_h), interpolation=cv2.INTER_AREA)
        print(f"[OCR] Progress: 20% - Resize xuống {new_w}x{new_h}", file=sys.stderr, flush=True)
    
    # NHANH 2: Grayscale + Tiền xử lý để cải thiện OCR
    print("[OCR] Progress: 30% - Chuyển grayscale và tiền xử lý", file=sys.stderr, flush=True)
    gray = cv2.cvtColor(nparr, cv2.COLOR_BGR2GRAY)
    
    # Tăng độ tương phản nhẹ cho text rõ hơn
    gray = cv2.convertScaleAbs(gray, alpha=1.2, beta=10)
    
    # NHANH 3: OCR với VIỆT NAM + ANH
    print("[OCR] Progress: 40% - Bắt đầu Tesseract OCR (vie+eng)", file=sys.stderr, flush=True)
    # --oem 1: LSTM only
    # --psm 6: uniform text block (tốt cho thẻ SV)
    # Dùng "vie+eng" để đọc tiếng Việt
    text = pytesseract.image_to_string(gray, lang="vie+eng", config="--oem 1 --psm 6")
    print("[OCR] Progress: 100% - OCR hoàn tất", file=sys.stderr, flush=True)
    text = normalize_text(text)
    
    # Log text đã phân tích (RAW + Normalized)
    print(f"\n[OCR] 📝 RAW Text (500 ký tự đầu):", file=sys.stderr, flush=True)
    raw_text = pytesseract.image_to_string(gray, lang="vie+eng", config="--oem 1 --psm 6")
    print(raw_text[:500], file=sys.stderr, flush=True)
    print(f"\n[OCR] 📝 Normalized text: {text[:300]}...", file=sys.stderr, flush=True)

    matched_fields: List[str] = []
    reasons: List[str] = []
    
    # KIỂM TRA 6 TRƯỜNG (4 cũ + CCCD keyword + CCCD number)
    # 1. Tìm MSSV (8-11 chữ số, KHÔNG phải CCCD 12 số)
    mssv = extract_mssv(text)
    if mssv:
        matched_fields.append("mssv")
        print(f"[OCR] ✅ Tìm thấy MSSV: {mssv}", file=sys.stderr, flush=True)
    else:
        reasons.append("Không tìm thấy MSSV (8-11 chữ số)")
        print("[OCR] ❌ Không tìm thấy MSSV", file=sys.stderr, flush=True)
    
    # 2. Tìm "Thẻ sinh viên" hoặc "Student Card"
    has_student_card = False
    for kw in FIELDS["student_card"]:
        if fuzzy_contains(text, kw, threshold=30):  # Giảm threshold xuống 30
            has_student_card = True
            matched_fields.append("student_card")
            print(f"[OCR] ✅ Tìm thấy keyword: {kw}", file=sys.stderr, flush=True)
            break
    if not has_student_card:
        reasons.append("Không tìm thấy 'Thẻ sinh viên' hoặc 'Student Card'")
        print("[OCR] ❌ Không tìm thấy 'Thẻ sinh viên'", file=sys.stderr, flush=True)
    
    # 3. Tìm "Đại học" hoặc "University"
    has_university = False
    for kw in FIELDS["university"]:
        if fuzzy_contains(text, kw, threshold=30):
            has_university = True
            matched_fields.append("university")
            print(f"[OCR] ✅ Tìm thấy keyword: {kw}", file=sys.stderr, flush=True)
            break
    if not has_university:
        reasons.append("Không tìm thấy 'Đại học' hoặc 'University'")
        print("[OCR] ❌ Không tìm thấy 'Đại học'", file=sys.stderr, flush=True)
    
    # 4. Tìm domain .edu.vn hoặc .edu
    has_edu = has_edu_domain(text)
    if has_edu:
        matched_fields.append("edu_domain")
        print("[OCR] ✅ Tìm thấy .edu domain", file=sys.stderr, flush=True)
    else:
        reasons.append("Không tìm thấy .edu domain")
        print("[OCR] ❌ Không tìm thấy .edu domain", file=sys.stderr, flush=True)
    
    # 5. Tìm chữ CCCD hoặc CMND
    has_id_keyword = has_cccd_or_cmnd_keyword(text)
    if has_id_keyword:
        matched_fields.append("cccd_cmnd_keyword")
        print("[OCR] ✅ Tìm thấy chữ CCCD/CMND", file=sys.stderr, flush=True)
    else:
        reasons.append("Không tìm thấy chữ CCCD hoặc CMND")
        print("[OCR] ❌ Không tìm thấy chữ CCCD/CMND", file=sys.stderr, flush=True)
    
    # 6. Tìm số CCCD (12 chữ số)
    cccd_number = extract_cccd(text)
    if cccd_number:
        matched_fields.append("cccd_number")
        print(f"[OCR] ✅ Tìm thấy số CCCD: {cccd_number}", file=sys.stderr, flush=True)
    else:
        reasons.append("Không tìm thấy số CCCD (12 chữ số)")
        print("[OCR] ❌ Không tìm thấy số CCCD", file=sys.stderr, flush=True)
    
    # LOGIC: Chỉ cần 1/6 trường là PASS (cực kỳ dễ dàng)
    all_fields = ["mssv", "student_card", "university", "edu_domain", "cccd_cmnd_keyword", "cccd_number"]
    matched_required = [f for f in matched_fields if f in all_fields]
    valid = len(matched_required) >= 1
    
    print(f"\n[OCR] 📊 Kết quả: {len(matched_required)}/6 trường -> {'PASS' if valid else 'FAIL'}", file=sys.stderr, flush=True)
    
    if not valid:
        reasons.append(f"Không tìm thấy bất kỳ trường hợp lệ nào (cần ít nhất 1/6)")

    return valid, {
        "fields_matched": list(set(matched_fields)),
        "mssv": mssv,
        "ocr_text": text,
        "reasons": reasons,
    }

# =======================
# Ví dụ sử dụng
# =======================
if __name__ == "__main__":
    import sys
    import json
    args = sys.argv[1:]

    # Usage:
    #   python student_card_filter.py --json <image_path>
    #   python student_card_filter.py --stdin  (reads image bytes from stdin)
    if len(args) >= 2 and args[0] == "--json":
        path = args[1]
        valid, details = is_student_card(path)
        print(json.dumps({"valid": valid, **details}, ensure_ascii=False))
        sys.exit(0)
    elif len(args) == 1 and args[0] == "--stdin":
        data = sys.stdin.buffer.read()
        valid, details = verify_student_card_from_bytes(data)
        print(json.dumps({"valid": valid, **details}, ensure_ascii=False))
        sys.exit(0)
    else:
        # Demo mode
        image = "the_sinh_vien.jpg"
        valid, details = is_student_card(image)
        print("===== OCR TEXT =====")
        print(details.get("ocr_text", ""))
        if valid:
            print("\n🔰 Ảnh là THẺ SINH VIÊN!")
        else:
            print("\n⛔ KHÔNG phải thẻ sinh viên.")
        print("Trường trùng:", details.get("fields_matched", []))
        print("Mã số sinh viên:", details.get("mssv"))
        if details.get("reasons"):
            print("Lý do:", ", ".join(details["reasons"]))