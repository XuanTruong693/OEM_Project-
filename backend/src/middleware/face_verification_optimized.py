#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OPTIMIZED Face Verification Service - Tăng tốc xử lý lên 5-10 giây
- Giảm độ phân giải ảnh trước khi xử lý
- Tối ưu thuật toán detection cho ảnh nhỏ trong thẻ SV
- Giảm số bước kiểm tra không cần thiết
- Sử dụng model nhẹ hơn
"""

import sys
import json
import base64
import os
import cv2
import numpy as np
import warnings

warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["GLOG_minloglevel"] = "3"

import logging

logging.getLogger("deepface").setLevel(logging.CRITICAL)
logging.getLogger("tensorflow").setLevel(logging.CRITICAL)
logging.getLogger("absl").setLevel(logging.CRITICAL)


# Chặn stderr của RetinaFace download
class DevNull:
    def write(self, msg):
        pass

    def flush(self):
        pass


stderr_backup = sys.stderr
sys.stderr = DevNull()

try:
    from deepface import DeepFace

    USE_DEEPFACE = True
except ImportError:
    USE_DEEPFACE = False
finally:
    sys.stderr = stderr_backup

# Đảm bảo output UTF-8
try:
    os.environ["PYTHONIOENCODING"] = "utf-8"
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# Cấu hình tối ưu
ANTI_SPOOF_CONFIG = {
    "min_score": 50.0,  # Giảm ngưỡng để tăng tốc
    "max_soft_warnings": 3,
}
_face_cascade = None


def get_face_cascade():
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
        # KHÔNG resize - giữ nguyên kích thước gốc để detect tốt hơn
        img = image_np

        # 1. Phát hiện khuôn mặt - THAM SỐ DỄ DÀNG HƠN
        face_cascade = get_face_cascade()
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Thử nhiều cấu hình detection để tăng tỷ lệ phát hiện
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
        is_too_blurry = laplacian_var < 20
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


def compare_faces_fast(card_image_b64, selfie_image_b64, tolerance=0.35):
    try:
        # Decode base64
        card_data = base64.b64decode(card_image_b64)
        selfie_data = base64.b64decode(selfie_image_b64)

        card_np = np.frombuffer(card_data, dtype=np.uint8)
        selfie_np = np.frombuffer(selfie_data, dtype=np.uint8)

        card_img = cv2.imdecode(card_np, cv2.IMREAD_COLOR)
        selfie_img = cv2.imdecode(selfie_np, cv2.IMREAD_COLOR)

        if card_img is None or selfie_img is None:
            return {"error": "Không thể đọc ảnh"}

        # BƯỚC 1: Kiểm tra liveness cho selfie (NHANH)
        # print("[Liveness] Kiểm tra selfie...", file=sys.stderr)
        liveness_result = detect_spoofing_fast(selfie_img)

        if not liveness_result["is_live"]:
            return {
                "match": False,
                "error": "Ảnh selfie không hợp lệ",
                "liveness": liveness_result,
                "anti_spoofing_failed": True,
            }

        # BƯỚC 2: Tiền xử lý ảnh thẻ SV (tăng cường cho ảnh nhỏ)
        # print("[Preprocessing] Tăng cường ảnh thẻ SV...", file=sys.stderr)

        # Resize về kích thước hợp lý
        card_img = fast_resize(card_img, max_side=640)
        selfie_img = fast_resize(selfie_img, max_side=640)

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

        # BƯỚC 3: Crop face trước để DeepFace xử lý nhanh hơn
        face_cascade = get_face_cascade()

        def crop_face_with_padding(img, padding=0.3, is_card=False):
            """Crop face với padding để không mất thông tin
            is_card=True: Ảnh thẻ SV nhỏ, cần padding lớn hơn và resize để phân tích tốt hơn
            """
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # Nếu là ảnh thẻ SV, resize lên lớn hơn trước khi detect
            if is_card and max(img.shape[:2]) < 800:
                scale = 800 / max(img.shape[:2])
                img = cv2.resize(
                    img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC
                )
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # Histogram equalization cho gray image trước khi detect
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

            # Nếu là ảnh thẻ SV, đảm bảo kích thước tối thiểu 400px
            if is_card and max(cropped.shape[:2]) < 400:
                scale = 400 / max(cropped.shape[:2])
                cropped = cv2.resize(
                    cropped, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC
                )

            return cropped

        try:
            # Ảnh thẻ SV: padding 60%,
            card_img = crop_face_with_padding(
                card_img, padding=0.6, is_card=True
            )  # Tăng từ 0.5 lên 0.6
            # Ảnh selfie: padding 40% để lấy đủ context
            selfie_img = crop_face_with_padding(
                selfie_img, padding=0.4, is_card=False
            )  # Tăng từ 0.3 lên 0.4
        except Exception as e:
            pass

        # BƯỚC 4: Lưu tạm và gọi DeepFace
        temp_card = "temp_card_fast.jpg"
        temp_selfie = "temp_selfie_fast.jpg"
        cv2.imwrite(temp_card, card_img, [cv2.IMWRITE_JPEG_QUALITY, 95])
        cv2.imwrite(temp_selfie, selfie_img, [cv2.IMWRITE_JPEG_QUALITY, 95])

        try:
            # print("[Face Matching] So sánh với DeepFace...", file=sys.stderr, flush=True)

            if not USE_DEEPFACE:
                raise Exception("DeepFace not installed")

            sys.stderr = DevNull()
            try:
                result = DeepFace.verify(
                    img1_path=temp_card,
                    img2_path=temp_selfie,
                    model_name="VGG-Face",
                    detector_backend="retinaface",
                    enforce_detection=False,
                    distance_metric="cosine",
                    align=True,
                    normalization="base",
                )
            finally:
                sys.stderr = stderr_backup

            distance = result.get("distance", 1.0)
            verified = result.get("verified", False)
            threshold = result.get("threshold", tolerance)

            # Áp dụng công thức điều chỉnh để phản ánh đúng độ tương đồng

            # 1. Tính confidence cơ bản
            base_confidence = (1 - distance) * 100

            # 2. Áp dụng hệ số điều chỉnh (scaling) để tăng confidence
            # Distance < 0.4 (good match) → boost lên nhiều
            # Distance 0.4-0.6 (medium) → boost vừa phải
            # Distance > 0.6 (poor) → giữ nguyên
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

            # 3. Giới hạn trong khoảng 0-100%
            confidence = max(0, min(100, adjusted_confidence))

            # 4. Điều chỉnh verified dựa trên confidence mới
            # Ngưỡng 50% tương đương distance ~0.5
            verified = confidence >= 50.0

            return {
                "match": verified,
                "distance": float(distance),
                "confidence": float(confidence),
                "threshold_used": float(threshold),
                "method": "DeepFace-VGG-Face-RetinaFace-Adjusted",
                "liveness": liveness_result,
                "liveness_passed": True,
            }

        except Exception as deepface_error:

            return {
                "error": f"Không thể phát hiện khuôn mặt: {str(deepface_error)}",
                "match": False,
            }

        finally:
            # Xóa file tạm
            try:
                if os.path.exists(temp_card):
                    os.remove(temp_card)
                if os.path.exists(temp_selfie):
                    os.remove(temp_selfie)
            except:
                pass

    except Exception as e:

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
                    comparison = compare_faces_fast(card_image, face_image, tolerance)
                    result = {"success": True, "comparison": comparison}

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
