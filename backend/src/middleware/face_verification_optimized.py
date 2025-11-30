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

# Tắt TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

try:
    from deepface import DeepFace
    USE_DEEPFACE = True
except ImportError:
    USE_DEEPFACE = False

# Đảm bảo output UTF-8
try:
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# Cấu hình tối ưu
ANTI_SPOOF_CONFIG = {
    "min_score": 50.0,  # Giảm ngưỡng để tăng tốc
    "max_soft_warnings": 3,
}

# Cache cascade để không load lại mỗi lần
_face_cascade = None

def get_face_cascade():
    global _face_cascade
    if _face_cascade is None:
        _face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
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
    Phát hiện gian lận NHANH - chỉ giữ lại các bước quan trọng nhất
    Mục tiêu: < 2 giây
    """
    reasons = []
    scores = {}
    
    try:
        # Resize để xử lý nhanh
        img = fast_resize(image_np, max_side=480)
        
        # 1. Phát hiện khuôn mặt
        face_cascade = get_face_cascade()
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=3, minSize=(40, 40))
        
        if len(faces) == 0:
            return {
                "is_live": False,
                "confidence": 0,
                "reasons": ["Không phát hiện được khuôn mặt"],
                "scores": {}
            }
        
        # Lấy khuôn mặt lớn nhất
        if len(faces) > 1:
            faces = sorted(faces, key=lambda x: x[2]*x[3], reverse=True)
        (x, y, w, h) = faces[0]
        face_roi = gray[y:y+h, x:x+w]
        
        # 2. Kiểm tra độ mờ (blur) - TEST QUAN TRỌNG NHẤT
        laplacian_var = cv2.Laplacian(face_roi, cv2.CV_64F).var()
        scores['blur_score'] = float(laplacian_var)
        
        # Ngưỡng nới lỏng để tăng pass rate
        if laplacian_var < 50:
            reasons.append(f"Ảnh quá mờ (blur: {laplacian_var:.1f})")
        elif laplacian_var < 80:
            reasons.append(f"Ảnh hơi mờ (blur: {laplacian_var:.1f})")
        
        # 3. Kiểm tra độ tương phản
        contrast = face_roi.std()
        scores['contrast'] = float(contrast)
        
        if contrast < 20:
            reasons.append(f"Độ tương phản thấp ({contrast:.1f})")
        
        # 4. Phát hiện cạnh màn hình (chỉ làm nếu cần - tốn thời gian)
        edges = cv2.Canny(img, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=60, minLineLength=60, maxLineGap=20)
        
        long_lines = 0
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                length = np.sqrt((x2-x1)**2 + (y2-y1)**2)
                if length > 100:
                    long_lines += 1
        
        scores['screen_edges'] = long_lines
        
        if long_lines >= 6:
            reasons.append(f"Phát hiện nhiều viền ({long_lines} cạnh)")
        
        # 5. Tính điểm liveness (đơn giản hóa)
        liveness_score = 0
        
        # Điểm cho độ sắc nét (0-40 điểm)
        if laplacian_var >= 120:
            liveness_score += 40
        elif laplacian_var >= 80:
            liveness_score += 30
        elif laplacian_var >= 50:
            liveness_score += 15
        
        # Điểm cho độ tương phản (0-30 điểm)
        if contrast >= 35:
            liveness_score += 30
        elif contrast >= 25:
            liveness_score += 20
        elif contrast >= 15:
            liveness_score += 10
        
        # Điểm cho không có viền màn hình (0-30 điểm)
        if long_lines == 0:
            liveness_score += 30
        elif long_lines < 3:
            liveness_score += 20
        elif long_lines < 6:
            liveness_score += 10
        else:
            liveness_score -= 10
        
        # Quyết định
        min_score = ANTI_SPOOF_CONFIG["min_score"]
        is_live = liveness_score >= min_score
        confidence = (liveness_score / 100.0) * 100
        
        return {
            "is_live": is_live,
            "confidence": float(confidence),
            "liveness_score": float(liveness_score),
            "reasons": reasons if not is_live else [],
            "scores": scores,
        }
        
    except Exception as e:
        return {
            "is_live": False,
            "confidence": 0,
            "reasons": [f"Lỗi: {str(e)}"],
            "scores": {}
        }


def compare_faces_fast(card_image_b64, selfie_image_b64, tolerance=0.35):
    """
    So sánh 2 khuôn mặt NHANH - tối ưu cho ảnh nhỏ trong thẻ SV
    Mục tiêu: 3-5 giây
    
    Cải tiến:
    - Resize ảnh trước khi xử lý
    - Dùng detector_backend="opencv" (nhanh hơn mtcnn/retinaface)
    - enforce_detection=False để không crash khi không detect được face
    - Tăng cường preprocessing cho ảnh thẻ SV nhỏ
    """
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
        print("[Liveness] Kiểm tra selfie...", file=sys.stderr)
        liveness_result = detect_spoofing_fast(selfie_img)
        
        if not liveness_result['is_live']:
            return {
                "match": False,
                "error": "Ảnh selfie không hợp lệ",
                "liveness": liveness_result,
                "anti_spoofing_failed": True
            }
        
        # BƯỚC 2: Tiền xử lý ảnh thẻ SV (tăng cường cho ảnh nhỏ)
        print("[Preprocessing] Tăng cường ảnh thẻ SV...", file=sys.stderr)
        
        # Resize về kích thước hợp lý
        card_img = fast_resize(card_img, max_side=640)
        selfie_img = fast_resize(selfie_img, max_side=640)
        
        # Tăng độ phân giải ảnh thẻ SV nếu quá nhỏ (upscale 2x)
        card_h, card_w = card_img.shape[:2]
        if card_h < 200 or card_w < 200:
            card_img = cv2.resize(card_img, (card_w*2, card_h*2), interpolation=cv2.INTER_CUBIC)
        
        # Sharpen ảnh thẻ SV để face detection tốt hơn
        kernel_sharpen = np.array([[-1,-1,-1],
                                    [-1, 9,-1],
                                    [-1,-1,-1]])
        card_img = cv2.filter2D(card_img, -1, kernel_sharpen)
        
        # Tăng contrast cho ảnh thẻ SV
        lab = cv2.cvtColor(card_img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        l = clahe.apply(l)
        card_img = cv2.merge([l, a, b])
        card_img = cv2.cvtColor(card_img, cv2.COLOR_LAB2BGR)
        
        # BƯỚC 3: Crop face trước để DeepFace xử lý nhanh hơn
        face_cascade = get_face_cascade()
        
        def crop_face_with_padding(img, padding=0.3):
            """Crop face với padding để không mất thông tin"""
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))
            
            if len(faces) == 0:
                # Không detect được -> trả về ảnh gốc
                return img
            
            # Lấy face lớn nhất
            if len(faces) > 1:
                faces = sorted(faces, key=lambda x: x[2]*x[3], reverse=True)
            
            x, y, w, h = faces[0]
            pad = int(max(w, h) * padding)
            xr = max(0, x - pad)
            yr = max(0, y - pad)
            x2 = min(img.shape[1], x + w + pad)
            y2 = min(img.shape[0], y + h + pad)
            
            return img[yr:y2, xr:x2]
        
        try:
            card_img = crop_face_with_padding(card_img, padding=0.4)  # Padding lớn hơn cho ảnh thẻ SV
            selfie_img = crop_face_with_padding(selfie_img, padding=0.3)
        except Exception as e:
            print(f"[Crop Face Warning] {str(e)}", file=sys.stderr)
        
        # BƯỚC 4: Lưu tạm và gọi DeepFace
        temp_card = "temp_card_fast.jpg"
        temp_selfie = "temp_selfie_fast.jpg"
        cv2.imwrite(temp_card, card_img, [cv2.IMWRITE_JPEG_QUALITY, 95])
        cv2.imwrite(temp_selfie, selfie_img, [cv2.IMWRITE_JPEG_QUALITY, 95])
        
        try:
            print("[Face Matching] So sánh với DeepFace...", file=sys.stderr, flush=True)
            
            if not USE_DEEPFACE:
                raise Exception("DeepFace not installed")
            
            # Dùng model VGG-Face (nhanh hơn Facenet512 nhưng vẫn chính xác)
            # hoặc Facenet (model nhỏ nhất, nhanh nhất)
            result = DeepFace.verify(
                img1_path=temp_card,
                img2_path=temp_selfie,
                model_name="Facenet",  # Nhanh nhất: Facenet < VGG-Face < Facenet512
                detector_backend="opencv",  # Nhanh nhất: opencv < ssd < mtcnn
                enforce_detection=False,  # Không crash nếu không detect được
                distance_metric="cosine",
                align=True  # Align face để tăng độ chính xác
            )
            
            print(f"[Face Matching] DeepFace result: {result}", file=sys.stderr, flush=True)
            
            distance = result.get("distance", 1.0)
            verified = result.get("verified", False)
            threshold = result.get("threshold", tolerance)
            
            # Chuyển distance -> confidence (%)
            confidence = max(0, min(100, (1 - distance) * 100))
            
            print(f"[Result] Distance: {distance:.4f}, Confidence: {confidence:.1f}%, Verified: {verified}", file=sys.stderr)
            
            return {
                "match": verified,
                "distance": float(distance),
                "confidence": float(confidence),
                "threshold_used": float(threshold),
                "method": "DeepFace-Facenet-Optimized",
                "liveness": liveness_result,
                "liveness_passed": True
            }
        
        except Exception as deepface_error:
            import traceback
            error_trace = traceback.format_exc()
            print(f"[DeepFace Error] {error_trace}", file=sys.stderr, flush=True)
            return {
                "error": f"Không thể phát hiện khuôn mặt: {str(deepface_error)}",
                "error_detail": error_trace,
                "match": False
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
        import traceback
        error_detail = traceback.format_exc()
        print(f"[Compare Error] {error_detail}", file=sys.stderr, flush=True)
        return {
            "error": f"Lỗi xử lý: {str(e)}",
            "error_detail": error_detail,
            "match": False
        }


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
                        result = {
                            "success": True,
                            "liveness": liveness_result
                        }
            
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
                    result = {
                        "success": True,
                        "comparison": comparison
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
