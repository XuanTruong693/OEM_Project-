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
    "student_card": [
        "the sinh vien",
        "thẻ sinh viên",
        "the sv",
        "student card",
        "student id",
        "sinh vien",
        "sinhvien",
    ],
    "university": [
        # Tiếng Việt chuẩn
        "dai hoc",
        "đại học",
        "truong dai hoc",
        "trường đại học",
        # Biến thể OCR nhầm
        "dai học",
        "dại hoc",
        "daihoc",
        "đaihoc",
        "university",
        # Tên trường phổ biến
        "duy tan",
        "duytan",
        "dtu",
        "dai hoc duy tan",
        # Keyword liên quan
        "truong",
        "trường",
    ],
    "faculty": ["khoa", "khoaa", "faculty"],
    "major": ["nganh", "ngành", "major", "field"],
    "class": ["lop", "lớp", "class"],
    "mssv": ["ma sinh vien", "mã sinh viên", "student code", "mssv", "masv"],
    "cccd": ["cccd", "can cuoc cong dan", "căn cước công dân", "citizen id"],
    "cmnd": ["cmnd", "chung minh nhan dan", "chứng minh nhân dân", "identity card"],
    "edu_domain": [".edu.vn", ".edu", "edu.vn", "edu", "eduvn"],
}


# Hàm chuẩn hóa text OCR
def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    text = re.sub(r"[^a-zA-Z0-9áàảãạăâđéèẻẽẹêíìỉĩịóòỏõọôơúùủũụýỳỷỹỵ\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# Fuzzy match
def fuzzy_contains(text: str, keyword: str, threshold: int = 50) -> bool:
    t = text.lower()
    k = keyword.lower()
    if k in t:
        return True
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
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2
    )
    # Dilation + Erosion
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    return processed


# Kiểm tra CCCD (12 chữ số)
def extract_cccd(text: str) -> Optional[str]:
    import sys

    # Loại bỏ khoảng trắng, dấu gạch, dấu chấm
    clean = text.replace(" ", "").replace("-", "").replace(".", "")
    matches = re.findall(r"\d{12}", clean)
    if matches:
        print(
            f"[OCR] 🔍 Tìm thấy {len(matches)} dãy 12 số: {matches}",
            file=sys.stderr,
            flush=True,
        )
        return matches[0]
    for keyword in ["cccd", "cmnd", "cmt"]:
        pattern = rf"{keyword}\D{{0,5}}([\dOoIlSsB]{{10,14}})"
        match = re.search(pattern, clean.lower())
        if match:
            raw_number = match.group(1).upper()
            cleaned = raw_number.replace("O", "0").replace("o", "0")
            cleaned = cleaned.replace("I", "1").replace("l", "1")
            cleaned = cleaned.replace("S", "5").replace("s", "5")
            cleaned = cleaned.replace("B", "8")
            cleaned = re.sub(r"\D", "", cleaned)

            if len(cleaned) == 12:
                print(
                    f"[OCR] ✅ Tìm thấy CCCD gần '{keyword}': {raw_number} → làm sạch: {cleaned}",
                    file=sys.stderr,
                    flush=True,
                )
                return cleaned
            elif 11 <= len(cleaned) <= 13:
                if len(cleaned) == 13:
                    cleaned = cleaned[:12]
                elif len(cleaned) == 11:
                    print(
                        f"[OCR] ⚠️ CCCD gần '{keyword}' thiếu 1 số: {cleaned}",
                        file=sys.stderr,
                        flush=True,
                    )
                    return cleaned  # Vẫn trả về, để validation quyết định
                print(
                    f"[OCR] ✅ Tìm thấy CCCD gần '{keyword}': {raw_number} → làm sạch: {cleaned}",
                    file=sys.stderr,
                    flush=True,
                )
                return cleaned

    print(f"[OCR] ❌ Không tìm thấy CCCD 12 số trong text", file=sys.stderr, flush=True)
    return None


def extract_mssv(text: str) -> Optional[str]:
    import sys

    clean_text = text.replace(" ", "").replace("-", "").upper()
    numeric_matches = re.findall(r"\d{9,11}", clean_text)
    numeric_matches = [m for m in numeric_matches if len(m) >= 9 and len(m) <= 11]
    alphanumeric_matches = re.findall(r"[A-Z0-9]{9,11}", clean_text)
    alphanumeric_matches = [
        m
        for m in alphanumeric_matches
        if re.search(r"[A-Z]", m)
        and re.search(r"\d", m)
        and len(m) >= 9
        and len(m) <= 11
    ]

    # Gộp cả 2 loại
    all_matches = numeric_matches + alphanumeric_matches
    filtered_matches = []
    for match in all_matches:
        match_pos = clean_text.find(match)
        if match_pos > 0:
            before_text = clean_text[max(0, match_pos - 10) : match_pos]
            if any(kw in before_text.lower() for kw in ["cccd", "cmnd", "cmt"]):
                print(
                    f"[OCR] ⚠️ Bỏ qua MSSV candidate '{match}' (gần keyword CCCD/CMND)",
                    file=sys.stderr,
                    flush=True,
                )
                continue
        filtered_matches.append(match)

    if not filtered_matches:
        return None
    filtered_matches.sort(key=len, reverse=True)

    return filtered_matches[0]


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
    img = preprocess_image(image_path)
    if img is None:
        return False, {
            "error": "Không đọc được ảnh",
            "fields_matched": [],
            "mssv": None,
            "ocr_text": "",
            "reasons": ["Ảnh không hợp lệ hoặc đường dẫn sai"],
        }

    text = pytesseract.image_to_string(img, lang="vie+eng")
    text = normalize_text(text)

    matched_fields: List[str] = []
    reasons: List[str] = []
    for field, keywords in FIELDS.items():
        if field == "edu_domain":
            if has_edu_domain(text):
                matched_fields.append(field)
        else:
            for kw in keywords:
                if fuzzy_contains(text, kw):
                    matched_fields.append(field)
                    break
    mssv = extract_mssv(text)
    if mssv:
        if "mssv" not in matched_fields:
            matched_fields.append("mssv")
    else:
        reasons.append("Không tìm thấy mã số sinh viên")

    # Kiểm tra có "Thẻ sinh viên" hoặc "Student card"
    if "student_card" not in matched_fields:
        reasons.append("Không tìm thấy chữ 'Thẻ sinh viên' hoặc 'Student Card'")
    # Kiểm tra có "Đại học" hoặc "University"
    if "university" not in matched_fields:
        reasons.append("Không tìm thấy chữ 'Đại học' hoặc 'University'")

    # Kiểm tra có domain .edu.vn hoặc .edu
    if "edu_domain" not in matched_fields:
        reasons.append("Không tìm thấy domain .edu.vn hoặc .edu")
    required_fields = ["student_card", "university", "edu_domain", "mssv"]
    matched_required = [f for f in matched_fields if f in required_fields]
    valid = len(matched_required) >= 2

    if not valid:
        reasons.append(
            f"Chỉ tìm thấy {len(matched_required)}/4 trường bắt buộc (cần ít nhất 2)"
        )

    return valid, {
        "fields_matched": list(set(matched_fields)),
        "mssv": mssv,
        "ocr_text": text,
        "reasons": reasons,
    }


def verify_student_card_from_bytes(
    image_bytes: bytes,
) -> Tuple[bool, Dict[str, object]]:
    import sys

    if not _HAS_NUMPY:
        return False, {
            "error": "Thiếu thư viện numpy để giải mã ảnh bytes",
            "fields_matched": [],
            "mssv": None,
            "ocr_text": "",
            "reasons": ["Vui lòng cài đặt numpy"],
        }

    print("[OCR] 📥 Đang decode ảnh...", file=sys.stderr, flush=True)
    try:
        nparr = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    except Exception:
        return False, {
            "error": "Không giải mã được ảnh từ bytes",
            "fields_matched": [],
            "mssv": None,
            "ocr_text": "",
            "reasons": ["Dữ liệu ảnh không hợp lệ"],
        }
    h, w = nparr.shape[:2]
    print(f"[OCR] Progress: 10% - Kích thước gốc: {w}x{h}", file=sys.stderr, flush=True)

    max_dim = max(h, w)
    target_size = 600

    if max_dim < target_size:
        # Upscale nếu ảnh quá nhỏ
        scale = target_size / max_dim
        new_w = int(w * scale)
        new_h = int(h * scale)
        nparr = cv2.resize(nparr, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
        print(
            f"[OCR] Progress: 20% - Resize lên {new_w}x{new_h}",
            file=sys.stderr,
            flush=True,
        )
    elif max_dim > target_size:
        # Downscale nếu ảnh quá lớn
        scale = target_size / max_dim
        new_w = int(w * scale)
        new_h = int(h * scale)
        nparr = cv2.resize(nparr, (new_w, new_h), interpolation=cv2.INTER_AREA)
        print(
            f"[OCR] Progress: 20% - Resize xuống {new_w}x{new_h}",
            file=sys.stderr,
            flush=True,
        )
    print(
        "[OCR] Progress: 30% - Tiền xử lý tối ưu",
        file=sys.stderr,
        flush=True,
    )
    gray = cv2.cvtColor(nparr, cv2.COLOR_BGR2GRAY)
    gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=20)
    gray = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    print(
        "[OCR] Progress: 40% - Bắt đầu Tesseract OCR (vie+eng) với config tối ưu",
        file=sys.stderr,
        flush=True,
    )
    custom_config = r"--oem 1 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵýỷỹ "
    ocr_data = pytesseract.image_to_data(
        gray, lang="vie+eng", config=custom_config, output_type=pytesseract.Output.DICT
    )
    print("[OCR] Progress: 100% - OCR hoàn tất", file=sys.stderr, flush=True)

    text = " ".join([word for word in ocr_data["text"] if word.strip()])
    text = normalize_text(text)
    print(f"\n[OCR] 📝 Normalized text: {text[:300]}...", file=sys.stderr, flush=True)
    img_height = gray.shape[0]
    img_width = gray.shape[1]
    mssv_candidates = []
    for i, word in enumerate(ocr_data["text"]):
        if word and word.strip():
            word_clean = word.strip().replace(" ", "").replace("-", "").upper()

            # Trích xuất số thuần (9-11 chữ số)
            numbers_in_word = re.findall(r"\d{9,11}", word_clean)
            numbers_in_word = [n for n in numbers_in_word if 9 <= len(n) <= 11]

            # Trích xuất alphanumeric (9-11 ký tự, có cả chữ và số)
            alphanum_in_word = re.findall(r"[A-Z0-9]{9,11}", word_clean)
            alphanum_in_word = [
                m
                for m in alphanum_in_word
                if re.search(r"[A-Z]", m) and re.search(r"\d", m) and 9 <= len(m) <= 11
            ]

            # Gộp cả 2 loại
            all_codes = numbers_in_word + alphanum_in_word

            for code in all_codes:
                word_lower = word_clean.lower()
                if any(kw in word_lower for kw in ["cccd", "cmnd", "cmt"]):
                    print(
                        f"[OCR] ⚠️ Bỏ qua '{code}' vì nằm gần keyword CCCD/CMND: '{word}'",
                        file=sys.stderr,
                        flush=True,
                    )
                    continue

                y_position = ocr_data["top"][i]
                x_position = ocr_data["left"][i]
                img_width = gray.shape[1]
                y_ratio = y_position / img_height
                x_ratio = x_position / img_width

                priority = 0
                if 0.75 <= y_ratio <= 0.95:
                    priority = 5  # Rất cao
                # Ưu tiên cao: phần dưới (65-90% height)
                elif 0.65 <= y_ratio <= 0.9:
                    priority = 4
                # Ưu tiên trung bình cao: nửa dưới (55-85% height)
                elif 0.55 <= y_ratio <= 0.85:
                    priority = 3
                # Ưu tiên trung bình: nửa dưới (45-75% height)
                elif 0.45 <= y_ratio <= 0.75:
                    priority = 2
                # Ưu tiên thấp: vị trí khác
                else:
                    priority = 1

                mssv_candidates.append(
                    {
                        "number": code,
                        "priority": priority,
                        "length": len(code),
                        "y_position": y_position,
                        "x_position": x_position,
                        "y_ratio": round(y_ratio, 2),
                        "x_ratio": round(x_ratio, 2),
                    }
                )

    # Log các candidates
    if mssv_candidates:
        print(
            f"\n[OCR] 🔍 Tìm thấy {len(mssv_candidates)} số có thể là MSSV:",
            file=sys.stderr,
            flush=True,
        )
        for c in mssv_candidates:
            print(
                f"  - {c['number']} (priority={c['priority']}, len={c['length']}, pos=({c['x_ratio']}, {c['y_ratio']}))",
                file=sys.stderr,
                flush=True,
            )

    matched_fields: List[str] = []
    reasons: List[str] = []

    cccd_number_found = extract_cccd(text)

    mssv = None
    if mssv_candidates:
        # Sắp xếp theo: priority cao nhất -> độ dài dài nhất -> vị trí thấp nhất (gần đáy)
        mssv_candidates.sort(
            key=lambda x: (-x["priority"], -x["length"], -x["y_position"])
        )
        mssv = mssv_candidates[0]["number"]
        print(
            f"[OCR] 🎯 Chọn MSSV từ bounding box: {mssv} (priority={mssv_candidates[0]['priority']})",
            file=sys.stderr,
            flush=True,
        )
    else:
        # Fallback: dùng regex trên toàn bộ text
        mssv = extract_mssv(text)
        if mssv:
            print(
                f"[OCR] 🎯 Chọn MSSV từ regex fallback: {mssv}",
                file=sys.stderr,
                flush=True,
            )
    if mssv:
        has_letters = bool(re.search(r"[A-Z]", mssv))
        has_digits = bool(re.search(r"\d", mssv))

        # Đếm số lượng chữ số vs chữ cái
        digit_count = sum(1 for c in mssv if c.isdigit())
        letter_count = sum(1 for c in mssv if c.isalpha())
        total_chars = len(mssv)

        # Nếu MSSV toàn chữ cái (0 số) → OCR sai hoàn toàn
        if digit_count == 0:
            print(
                f"[OCR] ❌ MSSV '{mssv}' toàn chữ cái (0 số) → Loại bỏ",
                file=sys.stderr,
                flush=True,
            )
            mssv = None
        # Nếu MSSV có ít hơn 70% là số → OCR sai
        elif digit_count / total_chars < 0.7:
            print(
                f"[OCR] ❌ MSSV '{mssv}' chỉ có {digit_count}/{total_chars} số ({digit_count/total_chars*100:.0f}%) → Loại bỏ",
                file=sys.stderr,
                flush=True,
            )
            mssv = None
        elif has_letters and has_digits:
            # Đếm số lần chuyển đổi giữa chữ và số
            transitions = 0
            for i in range(len(mssv) - 1):
                if mssv[i].isdigit() != mssv[i + 1].isdigit():
                    transitions += 1

            # Nếu chuyển đổi > 3 lần → MSSV lộn xộn do OCR sai
            if transitions > 3:
                print(
                    f"[OCR] ⚠️ MSSV '{mssv}' có {transitions} transitions (lộn xộn) → Loại bỏ",
                    file=sys.stderr,
                    flush=True,
                )
                mssv = None  # Loại bỏ MSSV lộn xộn
    primary_id = None
    if cccd_number_found:
        primary_id = cccd_number_found
        matched_fields.append("mssv")  # Đánh dấu có mã định danh
        print(
            f"[OCR] ✅ ƯU TIÊN CCCD/CMND: {cccd_number_found}",
            file=sys.stderr,
            flush=True,
        )
        if not mssv:
            reasons.append("⚠️ Không tìm thấy MSSV, sử dụng CCCD/CMND làm mã định danh")
        else:
            print(
                f"[OCR] 📋 Cũng tìm thấy MSSV: {mssv} (nhưng ưu tiên CCCD)",
                file=sys.stderr,
                flush=True,
            )
    elif mssv:
        primary_id = mssv
        matched_fields.append("mssv")
        print(f"[OCR] ✅ Tìm thấy MSSV: {mssv}", file=sys.stderr, flush=True)
        reasons.append("⚠️ Không tìm thấy CCCD/CMND, sử dụng MSSV")
    else:
        reasons.append("❌ Không tìm thấy MSSV (9-11 ký tự) và CMND/CCCD (12 số)")
        print(
            "[OCR] ❌ Không tìm thấy MSSV hoặc CMND/CCCD", file=sys.stderr, flush=True
        )

    has_student_card = False
    for kw in FIELDS["student_card"]:
        if fuzzy_contains(text, kw, threshold=30):
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

    all_fields = [
        "mssv",
        "student_card",
        "university",
        "edu_domain",
        "cccd_cmnd_keyword",
        "cccd_number",
    ]
    matched_required = [f for f in matched_fields if f in all_fields]
    important_fields = [
        "student_card",
        "university",
        "cccd_cmnd_keyword",
        "cccd_number",
        "mssv",
    ]
    matched_important = [f for f in matched_fields if f in important_fields]

    valid = len(matched_important) >= 2

    print(
        f"\n[OCR] 📊 Kết quả: {len(matched_important)}/5 trường quan trọng ({', '.join(matched_important)}) -> {'PASS' if valid else 'FAIL'}",
        file=sys.stderr,
        flush=True,
    )

    if not valid:
        reasons.append(
            f"⚠️ Chỉ tìm thấy {len(matched_important)}/5 trường quan trọng (cần ít nhất 2)"
        )
        reasons.append(
            f"Các trường đã tìm: {', '.join(matched_important) if matched_important else 'Không có'}"
        )

    if valid and not primary_id and cccd_number_found:
        primary_id = cccd_number_found
        print(
            f"[OCR] 🔄 Không có MSSV, dùng CCCD làm mã định danh: {primary_id}",
            file=sys.stderr,
            flush=True,
        )

    return valid, {
        "fields_matched": list(set(matched_fields)),
        "mssv": primary_id, 
        "cccd": cccd_number_found,
        "student_id": (
            mssv if mssv and len(mssv) <= 11 else None
        ),
        "ocr_text": text,
        "reasons": reasons,
    }


if __name__ == "__main__":
    import sys
    import json

    args = sys.argv[1:]

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
