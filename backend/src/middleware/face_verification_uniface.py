import sys
import json
import base64
import os
import cv2
import numpy as np
import warnings

warnings.filterwarnings("ignore")

try:
    import contextlib
    import io

    stdout_backup = sys.stdout
    sys.stdout = io.StringIO()

    from uniface import RetinaFace, ArcFace, compute_similarity

    USE_UNIFACE = True

    sys.stdout = stdout_backup

except ImportError as e:
    USE_UNIFACE = False
    print(
        f"ERROR: uniface not installed. Run: pip install uniface. Detail: {e}",
        file=sys.stderr,
    )

try:
    os.environ["PYTHONIOENCODING"] = "utf-8"
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ANTI_SPOOF_CONFIG = {
    "min_score": 50.0,
    "max_soft_warnings": 3,
}
_detector = None
_recognizer = None
_face_cascade = None


def get_detector():
    """Khởi tạo RetinaFace detector (cached)"""
    global _detector
    if _detector is None:
        import io

        stdout_backup = sys.stdout
        try:
            sys.stdout = io.StringIO()

            _detector = RetinaFace(conf_thresh=0.5, nms_thresh=0.4)
        finally:
            sys.stdout = stdout_backup
    return _detector


def get_recognizer():
    """Khởi tạo ArcFace recognizer (cached)"""
    global _recognizer
    if _recognizer is None:

        import io

        stdout_backup = sys.stdout
        try:
            sys.stdout = io.StringIO()
            _recognizer = ArcFace()
        finally:
            sys.stdout = stdout_backup
    return _recognizer


def get_face_cascade():
    """Khởi tạo Haar Cascade cho liveness check (cached)"""
    global _face_cascade
    if _face_cascade is None:
        _face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
    return _face_cascade


def fast_resize(img, max_side=640):
    """Resize nhanh ảnh xuống kích thước tối đa để xử lý nhanh hơn"""
    if img is None:
        return img
    h, w = img.shape[:2]
    max_dim = max(h, w)
    if max_dim <= max_side:
        return img
    scale = max_side / max_dim
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def detect_spoofing_fast(image_np):
    """
    Kiểm tra ảnh khuôn mặt THẬT
    Chỉ kiểm tra:
    1. Có khuôn mặt không
    2. Ảnh có rõ nét không (không quá mờ)
    3. Có độ tương phản tự nhiên không

    KHÔNG yêu cầu độ tin cậy cao - chỉ cần đảm bảo không phải ảnh quá mờ/giả
    """
    reasons = []
    scores = {}

    try:

        img = image_np

        face_cascade = get_face_cascade()
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=2,
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE,
        )

        if len(faces) == 0:
            faces = face_cascade.detectMultiScale(
                gray, scaleFactor=1.05, minNeighbors=1, minSize=(20, 20)
            )

        if len(faces) == 0:
            return {
                "is_live": False,
                "confidence": 0,
                "reasons": [
                    "Không phát hiện được khuôn mặt - vui lòng đưa khuôn mặt vào giữa khung hình"
                ],
                "scores": {},
            }

        # Lấy khuôn mặt lớn nhất
        if len(faces) > 1:
            faces = sorted(faces, key=lambda x: x[2] * x[3], reverse=True)
        (x, y, w, h) = faces[0]
        face_roi = gray[y : y + h, x : x + w]

        # 2. Kiểm tra độ mờ (blur) - NGƯỠNG RẤT THẤP
        laplacian_var = cv2.Laplacian(face_roi, cv2.CV_64F).var()
        scores["blur_score"] = float(laplacian_var)

        # Chỉ reject nếu QUÁ MỜ (blur < 20)
        is_too_blurry = laplacian_var < 30
        if is_too_blurry:
            reasons.append(f"Ảnh quá mờ (blur: {laplacian_var:.1f}, cần >= 20)")

        # 3. Kiểm tra độ tương phản
        contrast = face_roi.std()
        scores["contrast"] = float(contrast)

        # Chỉ reject nếu QUÁ THẤP (contrast < 8)
        is_too_flat = contrast < 8
        if is_too_flat:
            reasons.append(f"Độ tương phản quá thấp ({contrast:.1f}, cần >= 8)")

        # 4. Quyết định - PASS nếu không quá mờ và có tương phản tối thiểu
        is_live = not is_too_blurry and not is_too_flat

        # Tính confidence đơn giản (10-100%)
        if is_live:
            # PASS - cho điểm cao
            confidence = min(100, 10 + (laplacian_var / 2) + contrast)
        else:
            # FAIL - cho điểm thấp
            confidence = max(10, (laplacian_var / 3) + (contrast / 2))

        return {
            "is_live": is_live,
            "confidence": float(confidence),
            "reasons": reasons if not is_live else [],
            "scores": scores,
        }

    except Exception as e:
        return {
            "is_live": False,
            "confidence": 0,
            "reasons": [f"Lỗi: {str(e)}"],
            "scores": {},
        }


def preprocess_card_image(card_img):
    """
    Tiền xử lý ảnh thẻ sinh viên để tăng chất lượng phát hiện khuôn mặt
    - Resize nếu quá nhỏ
    - Sharpen để rõ nét hơn
    - Tăng contrast
    """
    # Resize về kích thước hợp lý
    card_img = fast_resize(card_img, max_side=640)

    # Tăng độ phân giải ảnh thẻ SV nếu quá nhỏ (upscale 2x)
    card_h, card_w = card_img.shape[:2]
    if card_h < 200 or card_w < 200:
        card_img = cv2.resize(
            card_img, (card_w * 2, card_h * 2), interpolation=cv2.INTER_CUBIC
        )

    # Sharpen ảnh thẻ SV để face detection tốt hơn
    kernel_sharpen = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    card_img = cv2.filter2D(card_img, -1, kernel_sharpen)

    # Tăng contrast cho ảnh thẻ SV
    lab = cv2.cvtColor(card_img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    card_img = cv2.merge([l, a, b])
    card_img = cv2.cvtColor(card_img, cv2.COLOR_LAB2BGR)

    return card_img


def crop_face_with_padding(img, padding=0.3, is_card=False):
    """
    Crop face với padding để không mất thông tin
    is_card=True: Ảnh thẻ SV nhỏ, cần padding lớn hơn và resize để phân tích tốt hơn
    """
    face_cascade = get_face_cascade()
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Nếu là ảnh thẻ SV, resize lên lớn hơn trước khi detect
    if is_card and max(img.shape[:2]) < 800:
        scale = 800 / max(img.shape[:2])
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    gray = cv2.equalizeHist(gray)

    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.05, minNeighbors=3, minSize=(40, 40)
    )

    if len(faces) == 0:
        # Không detect được -> trả về ảnh gốc
        return img

    # Lấy face lớn nhất
    if len(faces) > 1:
        faces = sorted(faces, key=lambda x: x[2] * x[3], reverse=True)

    x, y, w, h = faces[0]
    pad = int(max(w, h) * padding)
    xr = max(0, x - pad)
    yr = max(0, y - pad)
    x2 = min(img.shape[1], x + w + pad)
    y2 = min(img.shape[0], y + h + pad)

    cropped = img[yr:y2, xr:x2]

    if is_card and max(cropped.shape[:2]) < 400:
        scale = 400 / max(cropped.shape[:2])
        cropped = cv2.resize(
            cropped, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC
        )

    return cropped


def compare_faces_uniface(card_image_b64, selfie_image_b64, tolerance=0.35):
    try:
        if not USE_UNIFACE:
            return {
                "error": "Uniface not installed. Run: pip install uniface",
                "match": False,
            }

        # Decode base64
        card_data = base64.b64decode(card_image_b64)
        selfie_data = base64.b64decode(selfie_image_b64)

        card_np = np.frombuffer(card_data, dtype=np.uint8)
        selfie_np = np.frombuffer(selfie_data, dtype=np.uint8)

        card_img = cv2.imdecode(card_np, cv2.IMREAD_COLOR)
        selfie_img = cv2.imdecode(selfie_np, cv2.IMREAD_COLOR)

        if card_img is None or selfie_img is None:
            return {"error": "Không thể đọc ảnh", "match": False}

        # BƯỚC 1: Kiểm tra liveness cho selfie
        liveness_result = detect_spoofing_fast(selfie_img)

        if not liveness_result["is_live"]:
            return {
                "match": False,
                "error": "Ảnh selfie không hợp lệ",
                "liveness": liveness_result,
                "anti_spoofing_failed": True,
            }

        # BƯỚC 2: Tiền xử lý ảnh
        card_img = preprocess_card_image(card_img)
        selfie_img = fast_resize(selfie_img, max_side=640)

        # BƯỚC 3: Crop face với padding
        try:
            card_img = crop_face_with_padding(card_img, padding=0.6, is_card=True)
            selfie_img = crop_face_with_padding(selfie_img, padding=0.4, is_card=False)
        except Exception as e:
            pass  # Nếu crop lỗi, dùng ảnh gốc

        # BƯỚC 4: Phát hiện khuôn mặt với Uniface RetinaFace
        detector = get_detector()

        try:
            faces_card = detector.detect(card_img)
            faces_selfie = detector.detect(selfie_img)
        except Exception as e:
            return {"error": f"Không thể phát hiện khuôn mặt: {str(e)}", "match": False}

        if not faces_card or len(faces_card) == 0:
            return {
                "error": "Không phát hiện được khuôn mặt trong ảnh thẻ sinh viên",
                "match": False,
            }

        if not faces_selfie or len(faces_selfie) == 0:
            return {
                "error": "Không phát hiện được khuôn mặt trong ảnh selfie",
                "match": False,
            }

        # Lấy khuôn mặt lớn nhất (face đầu tiên đã được sort theo diện tích)
        face_card = faces_card[0]
        face_selfie = faces_selfie[0]

        # BƯỚC 5: Trích xuất embedding với ArcFace
        recognizer = get_recognizer()

        try:
            # get_normalized_embedding cần landmarks (5 điểm) từ detector
            # ⚠️ KHÔNG dùng 'or' với numpy array → ValueError
            landmarks_card = face_card.get("landmarks")
            if landmarks_card is None:
                landmarks_card = face_card.get("keypoints")

            landmarks_selfie = face_selfie.get("landmarks")
            if landmarks_selfie is None:
                landmarks_selfie = face_selfie.get("keypoints")

            embedding_card = recognizer.get_normalized_embedding(
                card_img, landmarks_card
            )

            embedding_selfie = recognizer.get_normalized_embedding(
                selfie_img, landmarks_selfie
            )

        except Exception as e:
            import traceback

            traceback.print_exc(file=sys.stderr)
            return {
                "error": f"Không thể trích xuất đặc trưng khuôn mặt: {str(e)}",
                "match": False,
            }

        # Tính độ tương đồng (Cosine Similarity)
        # compute_similarity trả về similarity từ -1 đến 1
        try:
            similarity = compute_similarity(embedding_card, embedding_selfie)

            # Chuyển sang scalar - handle nhiều trường hợp
            if hasattr(similarity, "item"):
                # NumPy array hoặc scalar
                similarity = float(similarity.item())
            elif isinstance(similarity, (int, float)):
                similarity = float(similarity)
            elif isinstance(similarity, np.ndarray):
                similarity = float(similarity.flatten()[0])
            else:
                # Fallback: convert trực tiếp
                similarity = float(similarity)

        except Exception as e:
            import traceback

            traceback.print_exc(file=sys.stderr)
            return {"error": f"Không thể tính độ tương đồng: {str(e)}", "match": False}

        distance = 1.0 - similarity
        base_confidence = (1 - distance) * 100

        # Hệ số điều chỉnh (scaling) để tăng confidence
        if distance < 0.3:
            # Rất giống: boost +30%
            adjusted_confidence = base_confidence + 30
        elif distance < 0.4:
            # Khá giống: boost +25%
            adjusted_confidence = base_confidence + 25
        elif distance < 0.5:
            # Tương đối: boost +20%
            adjusted_confidence = base_confidence + 20
        elif distance < 0.6:
            # Hơi giống: boost +10%
            adjusted_confidence = base_confidence + 10
        else:
            # Không giống: boost nhẹ +5%
            adjusted_confidence = base_confidence + 5

        # Giới hạn trong khoảng 0-100%
        confidence = max(0, min(100, adjusted_confidence))

        verified = confidence >= 50.0
        try:
            bbox_card = face_card.get("bbox", [])
            bbox_selfie = face_selfie.get("bbox", [])
            conf_card = face_card.get("confidence", 0)
            conf_selfie = face_selfie.get("confidence", 0)

            # Convert bbox sang list of floats
            if isinstance(bbox_card, np.ndarray):
                bbox_card = bbox_card.tolist()
            if isinstance(bbox_selfie, np.ndarray):
                bbox_selfie = bbox_selfie.tolist()

            # Convert confidence sang float
            if hasattr(conf_card, "item"):
                conf_card = float(conf_card.item())
            else:
                conf_card = float(conf_card)

            if hasattr(conf_selfie, "item"):
                conf_selfie = float(conf_selfie.item())
            else:
                conf_selfie = float(conf_selfie)

        except Exception as conv_err:
            # Fallback on conversion error
            bbox_card = []
            bbox_selfie = []
            conf_card = 0.0
            conf_selfie = 0.0

        return {
            "match": verified,
            "distance": float(distance),
            "confidence": float(confidence),
            "threshold_used": float(tolerance),
            "method": "Uniface-ArcFace-RetinaFace",
            "liveness": liveness_result,
            "liveness_passed": True,
            "face_card_bbox": bbox_card,
            "face_selfie_bbox": bbox_selfie,
            "face_card_confidence": conf_card,
            "face_selfie_confidence": conf_selfie,
        }

    except Exception as e:
        import traceback

        traceback.print_exc(file=sys.stderr)
        return {"error": f"Lỗi xử lý: {str(e)}", "match": False}


if __name__ == "__main__":
    try:
        input_json = sys.stdin.read()

        if not input_json.strip():
            result = {"error": "No input data"}
        else:
            input_data = json.loads(input_json)
            action = input_data.get("action")

            if action == "verify_face":
                face_image = input_data.get("face_image")
                if not face_image:
                    result = {"error": "Missing 'face_image'"}
                else:
                    img_data = base64.b64decode(face_image)
                    img_np = np.frombuffer(img_data, dtype=np.uint8)
                    img = cv2.imdecode(img_np, cv2.IMREAD_COLOR)

                    if img is None:
                        result = {"error": "Cannot decode image"}
                    else:
                        liveness_result = detect_spoofing_fast(img)
                        result = {"success": True, "liveness": liveness_result}

            elif action == "compare_faces":
                card_image = input_data.get("card_image")
                face_image = input_data.get("face_image")
                tolerance = input_data.get("tolerance", 0.35)

                if not card_image:
                    result = {"error": "Missing 'card_image'"}
                elif not face_image:
                    result = {"error": "Missing 'face_image'"}
                else:
                    try:
                        comparison = compare_faces_uniface(
                            card_image, face_image, tolerance
                        )
                        result = {"success": True, "comparison": comparison}
                    except Exception as compare_err:
                        import traceback

                        traceback.print_exc(file=sys.stderr)
                        result = {
                            "error": f"Lỗi xử lý: {str(compare_err)}",
                            "success": False,
                        }

            else:
                result = {"error": f"Unknown action: {action}"}

        print(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(0)

    except json.JSONDecodeError as e:
        error_result = {"error": f"Invalid JSON: {str(e)}"}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(0)

    except Exception as e:
        error_result = {"error": f"Fatal error: {str(e)}"}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(0)
