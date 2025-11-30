#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Service Python để so sánh 2 khuôn mặt (thẻ sinh viên vs selfie)
Input: JSON qua stdin với base64 images
Output: JSON với kết quả so sánh

Usage:
    echo '{"image1":"base64...","image2":"base64...","tolerance":0.6}' | python face_verification.py

Dependencies:
    pip install opencv-python numpy Pillow deepface tf-keras
"""

import sys
import json
import base64
import io
import os
import cv2
import numpy as np
from PIL import Image

# Đảm bảo output UTF-8 (fix lỗi 'charmap' trên Windows)
try:
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# Tắt TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

try:
    from deepface import DeepFace
    USE_DEEPFACE = True
except ImportError:
    USE_DEEPFACE = False
    print("Warning: DeepFace not installed. Using basic OpenCV face detection.", file=sys.stderr)

# Cấu hình ngưỡng chống gian lận (có thể tinh chỉnh qua biến môi trường)
ANTI_SPOOF_CONFIG = {
    "min_score": float(os.getenv("ANTI_SPOOF_MIN_SCORE", "60")),
    "max_soft_warnings": int(os.getenv("ANTI_SPOOF_MAX_SOFT", "3")),
}


def detect_spoofing(image_np):
    """
    Phát hiện ảnh giả/gian lận (photo attack, screen replay attack)
    
    Kiểm tra:
    1. Độ mờ (blur) - ảnh từ màn hình thường bị blur
    2. Phản chiếu màn hình (screen reflection)
    3. Moiré pattern (vân nhiễu từ màn hình)
    4. Độ sắc nét biên khuôn mặt
    5. Phân tích tần số (ảnh thật có nhiều tần số cao hơn)
    
    Returns:
        dict: {
            "is_live": bool,
            "confidence": float (0-100),
            "reasons": list,
            "scores": dict
        }
    """
    reasons = []
    hard_reasons = []
    scores = {}
    
    try:
        # 1. Phát hiện khuôn mặt trước
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) == 0:
            return {
                "is_live": False,
                "confidence": 0,
                "reasons": ["Không phát hiện được khuôn mặt"],
                "hard_reasons": ["Không có khuôn mặt để phân tích"],
                "scores": {}
            }
        
        # Lấy khuôn mặt đầu tiên
        (x, y, w, h) = faces[0]
        face_roi = gray[y:y+h, x:x+w]
        face_roi_color = image_np[y:y+h, x:x+w]
        
        # 2. Kiểm tra độ mờ (Laplacian variance)
        laplacian_var = cv2.Laplacian(face_roi, cv2.CV_64F).var()
        scores['blur_score'] = float(laplacian_var)
        
        # Ngưỡng: ảnh thật thường > 150, ảnh từ màn hình < 80
        if laplacian_var < 80:
            reasons.append(f"Ảnh mờ (blur: {laplacian_var:.1f})")
        elif laplacian_var < 120:
            reasons.append(f"Ảnh hơi mờ (blur: {laplacian_var:.1f})")
        
        # 3. Phát hiện Moiré pattern (vân nhiễu từ màn hình)
        # Chuyển sang frequency domain
        dft = cv2.dft(np.float32(face_roi), flags=cv2.DFT_COMPLEX_OUTPUT)
        dft_shift = np.fft.fftshift(dft)
        magnitude_spectrum = 20 * np.log(cv2.magnitude(dft_shift[:, :, 0], dft_shift[:, :, 1]) + 1)
        
        # Tính tỷ lệ tần số cao/thấp
        rows, cols = magnitude_spectrum.shape
        crow, ccol = rows // 2, cols // 2
        
        # Vùng tần số cao (biên ngoài)
        high_freq = magnitude_spectrum.copy()
        high_freq[crow-30:crow+30, ccol-30:ccol+30] = 0
        high_freq_mean = np.mean(high_freq)
        
        # Vùng tần số thấp (trung tâm)
        low_freq = magnitude_spectrum[crow-30:crow+30, ccol-30:ccol+30]
        low_freq_mean = np.mean(low_freq)
        
        freq_ratio = high_freq_mean / (low_freq_mean + 1e-6)
        scores['frequency_ratio'] = float(freq_ratio)
        
        # Ảnh từ màn hình có ít tần số cao hơn
        if freq_ratio < 0.20:
            reasons.append(f"Tần số cao thấp (ratio: {freq_ratio:.3f})")
        elif freq_ratio < 0.30:
            reasons.append(f"Tần số chưa đủ (ratio: {freq_ratio:.3f})")
        
        # 4. Phát hiện phản chiếu màn hình (bright spots)
        # Chuyển sang HSV để phát hiện vùng sáng bất thường
        hsv = cv2.cvtColor(face_roi_color, cv2.COLOR_BGR2HSV)
        v_channel = hsv[:, :, 2]
        
        # Đếm pixel quá sáng (có thể là phản chiếu)
        bright_pixels = np.sum(v_channel > 240)
        bright_ratio = bright_pixels / (w * h)
        scores['bright_reflection_ratio'] = float(bright_ratio)
        
        if bright_ratio > 0.08:
            reasons.append(f"Phản chiếu mạnh ({bright_ratio*100:.1f}%)")
        elif bright_ratio > 0.05:
            reasons.append(f"Phản chiếu nhẹ ({bright_ratio*100:.1f}%)")
        
        # 5. Kiểm tra độ tương phản (ảnh từ màn hình thường có tương phản thấp)
        contrast = face_roi.std()
        scores['contrast'] = float(contrast)
        
        if contrast < 30:
            reasons.append(f"Độ tương phản thấp ({contrast:.1f})")
        
        # 6. Phát hiện biên màn hình/điện thoại (edge detection)
        edges = cv2.Canny(image_np, 30, 100)
        
        # Tìm các đường thẳng (có thể là cạnh màn hình/điện thoại)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=80, minLineLength=80, maxLineGap=15)
        
        long_lines = 0
        rectangular_lines = {'horizontal': 0, 'vertical': 0}
        
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                length = np.sqrt((x2-x1)**2 + (y2-y1)**2)
                
                # Tính góc của đường thẳng
                angle = np.abs(np.arctan2(y2-y1, x2-x1) * 180 / np.pi)
                
                if length > 150:
                    long_lines += 1
                    
                    # Phát hiện đường thẳng ngang/dọc (đặc trưng của viền màn hình)
                    if angle < 10 or angle > 170:  # Ngang
                        rectangular_lines['horizontal'] += 1
                    elif 80 < angle < 100:  # Dọc
                        rectangular_lines['vertical'] += 1
        
        # 6.1. Phát hiện khung chữ nhật bằng contour (điện thoại/màn hình)
        screen_rectangles = 0
        face_inside_rectangle = False
        try:
            cnt_edges = cv2.Canny(cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY), 50, 150)
            contours, _ = cv2.findContours(cnt_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            img_area = image_np.shape[0] * image_np.shape[1]
            for cnt in contours:
                perim = cv2.arcLength(cnt, True)
                if perim < 300:
                    continue
                approx = cv2.approxPolyDP(cnt, 0.02 * perim, True)
                if len(approx) == 4:
                    xr, yr, wr, hr = cv2.boundingRect(approx)
                    area = wr * hr
                    aspect = max(wr/hr, hr/wr)
                    area_ratio = area / (img_area + 1e-6)
                    # Lọc theo diện tích và tỉ lệ khung điện thoại (dài hơn, chiếm đáng kể khung hình)
                    if 0.10 < area_ratio < 0.75 and aspect > 1.5:
                        screen_rectangles += 1
                        # Kiểm tra xem face ROI nằm trong khung này không
                        if x >= xr and y >= yr and (x+w) <= (xr+wr) and (y+h) <= (yr+hr):
                            face_inside_rectangle = True
                            # Phân tích luminance bên trong khung
                            rect_roi = cv2.cvtColor(image_np[yr:yr+hr, xr:xr+wr], cv2.COLOR_BGR2LAB)[:, :, 0]
                            rect_std = rect_roi.std()
                            rect_mean = rect_roi.mean()
                            scores['rectangle_luminance_std'] = float(rect_std)
                            scores['rectangle_luminance_mean'] = float(rect_mean)
                            if rect_std < 35 and rect_mean > 120:
                                hard_reasons.append("Khuôn mặt ở trong khung hình chữ nhật có ánh sáng đồng đều (điện thoại/màn hình)")
        except Exception as _:
            pass

        scores['screen_edges'] = long_lines
        scores['rectangular_pattern'] = rectangular_lines['horizontal'] + rectangular_lines['vertical']
        scores['screen_rectangles'] = screen_rectangles
        scores['face_in_rectangle'] = bool(face_inside_rectangle)
        
        # Phát hiện pattern hình chữ nhật (điện thoại/màn hình)
        if rectangular_lines['horizontal'] >= 2 and rectangular_lines['vertical'] >= 2:
            reasons.append("Viền hình chữ nhật rõ (có thể là điện thoại/màn hình)")
            # Chỉ hard block nếu cũng phát hiện khung chữ nhật lớn
            if face_inside_rectangle and screen_rectangles >= 1:
                hard_reasons.append("Viền màn hình rõ và khuôn mặt nằm trong khung")
        elif long_lines >= 4:
            reasons.append(f"Phát hiện nhiều đường thẳng ({long_lines} cạnh)")
            if face_inside_rectangle and screen_rectangles >= 1:
                hard_reasons.append("Nhiều cạnh thẳng bao quanh khuôn mặt (khung điện thoại)")
        elif long_lines >= 2:
            reasons.append(f"Phát hiện đường viền ({long_lines} cạnh)")

        # Nếu phát hiện khung chữ nhật lớn và khuôn mặt nằm trong đó → rất nghi ngờ
        if screen_rectangles >= 1 and face_inside_rectangle:
            hard_reasons.append("Khuôn mặt nằm bên trong khung chữ nhật lớn (điện thoại/màn hình)")
        
        # 7. Phát hiện pixel pattern của màn hình LCD/LED
        # Lấy vùng nhỏ để phân tích pixel pattern
        sample_region = face_roi_color[h//4:h//4+20, w//4:w//4+20]
        
        # Tính gradient giữa các pixel
        grad_x = cv2.Sobel(sample_region, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(sample_region, cv2.CV_64F, 0, 1, ksize=3)
        gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2).mean()
        
        scores['pixel_gradient'] = float(gradient_magnitude)
        
        # Ảnh từ màn hình có gradient đều đặn (grid pattern)
        if 10 < gradient_magnitude < 30:
            reasons.append("Grid pattern nghi ngờ màn hình")
        
        # 7.5. Phát hiện "glow" từ màn hình phát sáng (screen backlight)
        # Phân tích trong vùng xung quanh khuôn mặt để tránh ảnh hưởng đèn nền bên ngoài
        lab_full = cv2.cvtColor(image_np, cv2.COLOR_BGR2LAB)
        l_full = lab_full[:, :, 0]
        # Tạo vùng quan tâm mở rộng quanh khuôn mặt
        pad = int(max(w, h) * 0.2)
        xr = max(0, x - pad)
        yr = max(0, y - pad)
        x2 = min(image_np.shape[1], x + w + pad)
        y2 = min(image_np.shape[0], y + h + pad)
        l_roi = l_full[yr:y2, xr:x2]

        # Tính độ đồng đều của luminance trong vùng mặt mở rộng
        luminance_std = l_roi.std() if l_roi.size > 0 else l_full.std()
        luminance_mean = l_roi.mean() if l_roi.size > 0 else l_full.mean()
        
        scores['luminance_uniformity'] = float(luminance_std)
        scores['luminance_mean'] = float(luminance_mean)
        
        # Màn hình có luminance đồng đều (std thấp) và thường sáng hơn
        if luminance_std < 35 and luminance_mean > 120:
            reasons.append(f"Phát hiện ánh sáng đồng đều từ màn hình (std: {luminance_std:.1f})")
        
        # Phát hiện "screen glow effect" - vùng sáng ở giữa, tối ở biên
        hr, wr = l_roi.shape
        if hr > 0 and wr > 0:
            center_region = l_roi[hr//4:3*hr//4, wr//4:3*wr//4]
            border_region = np.concatenate([
                l_roi[0:hr//4, :].flatten(),
                l_roi[3*hr//4:hr, :].flatten(),
                l_roi[:, 0:wr//4].flatten(),
                l_roi[:, 3*wr//4:wr].flatten()
            ])
            center_mean = center_region.mean() if center_region.size > 0 else luminance_mean
            border_mean = border_region.mean() if border_region.size > 0 else luminance_mean
        else:
            center_mean = luminance_mean
            border_mean = luminance_mean
        glow_effect = center_mean - border_mean
        
        scores['screen_glow_effect'] = float(glow_effect)
        
        # Nếu trung tâm sáng hơn viền đáng kể -> dấu hiệu màn hình
        if glow_effect > 15 and face_inside_rectangle and screen_rectangles >= 1:
            hard_reasons.append(f"Screen glow mạnh ở vùng chứa khuôn mặt ({glow_effect:.1f})")
        elif glow_effect > 15:
            reasons.append(f"Screen glow mạnh ({glow_effect:.1f})")
        
        # 7.6. Phát hiện color cast từ màn hình (màn hình có blue tint đặc trưng)
        # Tách kênh màu
        b_mean = image_np[:, :, 0].mean()
        g_mean = image_np[:, :, 1].mean()
        r_mean = image_np[:, :, 2].mean()
        
        # Màn hình LCD/LED thường có blue/green cast
        blue_dominance = b_mean - ((r_mean + g_mean) / 2)
        scores['blue_cast'] = float(blue_dominance)
        
        if blue_dominance > 12 and face_inside_rectangle and screen_rectangles >= 1:
            reasons.append(f"Blue cast cao (LCD) ({blue_dominance:.1f})")
            hard_reasons.append("Màu xanh chi phối trong khung chữ nhật (màn hình LCD)")
        
        # 8. Tính toán điểm liveness tổng hợp
        liveness_score = 0
        max_score = 100
        
        # Điểm cho độ sắc nét (0-30 điểm) - QUAN TRỌNG
        if laplacian_var >= 150:
            liveness_score += 30
        elif laplacian_var >= 120:
            liveness_score += 20
        elif laplacian_var >= 80:
            liveness_score += 10
        elif laplacian_var >= 50:
            liveness_score += 5
        
        # Điểm cho tần số cao (0-30 điểm) - QUAN TRỌNG
        if freq_ratio >= 0.35:
            liveness_score += 30
        elif freq_ratio >= 0.25:
            liveness_score += 20
        elif freq_ratio >= 0.18:
            liveness_score += 10
        elif freq_ratio >= 0.12:
            liveness_score += 5
        
        # Điểm cho không có phản chiếu (0-20 điểm)
        if bright_ratio < 0.03:
            liveness_score += 20
        elif bright_ratio < 0.05:
            liveness_score += 15
        elif bright_ratio < 0.08:
            liveness_score += 8
        elif bright_ratio < 0.12:
            liveness_score += 3
        
        # Điểm cho độ tương phản (0-20 điểm)
        if contrast >= 45:
            liveness_score += 20
        elif contrast >= 30:
            liveness_score += 10
        elif contrast >= 20:
            liveness_score += 5
        
        # Điểm cho không có viền màn hình (0-10 điểm)
        screen_edge_count = scores.get('screen_edges', 0)
        rect_pattern = scores.get('rectangular_pattern', 0)
        screen_rectangles = scores.get('screen_rectangles', 0)
        face_in_rectangle = scores.get('face_in_rectangle', False)
        
        if screen_edge_count == 0 and rect_pattern == 0:
            liveness_score += 10
        elif screen_edge_count < 2 and rect_pattern < 2:
            liveness_score += 5
        # Nếu có pattern chữ nhật -> TRỪ điểm
        elif rect_pattern >= 4:
            liveness_score -= 15
            reasons.append("Phát hiện pattern viền chữ nhật rõ ràng")
        
        # TRỪ điểm mạnh nếu phát hiện điện thoại và khuôn mặt ở trong khung
        if screen_rectangles >= 1 and face_in_rectangle:
            liveness_score -= 22
            # Hard block chỉ khi cả hai dấu hiệu đều mạnh: phản chiếu và blue cast hoặc glow
            if (bright_ratio > 0.14 and blue_dominance > 12) or (glow_effect > 18 and blue_dominance > 12):
                hard_reasons.append("Khuôn mặt trong khung + phản chiếu/màu màn hình rõ rệt")
        
        # Điểm cho không có screen glow (0-10 điểm)
        glow_effect = scores.get('screen_glow_effect', 0)
        luminance_uniformity = scores.get('luminance_uniformity', 100)
        
        if glow_effect < 5 and luminance_uniformity > 40:
            liveness_score += 10
        elif glow_effect < 10 and luminance_uniformity > 35:
            liveness_score += 5
        # TRỪ điểm nếu có dấu hiệu screen glow
        elif glow_effect > 20:
            liveness_score -= 10
        
        # Quyết định: ảnh thật hay giả
        # Điều kiện: đủ điểm + KHÔNG có cảnh báo cứng + cảnh báo mềm <= max_soft_warnings
        min_score = ANTI_SPOOF_CONFIG.get("min_score", 65)
        max_soft = ANTI_SPOOF_CONFIG.get("max_soft_warnings", 2)
        is_live = (liveness_score >= min_score) and (len(hard_reasons) == 0) and (len(reasons) <= max_soft)
        
        confidence = (liveness_score / max_score) * 100
        
        return {
            "is_live": is_live,
            "confidence": float(confidence),
            "liveness_score": float(liveness_score),
            "reasons": reasons if not is_live else [],
            "hard_reasons": hard_reasons if not is_live else [],
            "scores": scores,
            "gating_used": {
                "min_score": float(min_score),
                "max_soft_warnings": int(max_soft)
            }
        }
        
    except Exception as e:
        print(f"[Liveness Detection Error] {str(e)}", file=sys.stderr)
        # Nếu lỗi, từ chối để an toàn
        return {
            "is_live": False,
            "confidence": 0,
            "reasons": [f"Lỗi kiểm tra liveness: {str(e)}"],
            "scores": {}
        }


def compare_faces_deepface(image1_b64, image2_b64, tolerance=0.6):
    """
    So sánh 2 ảnh khuôn mặt sử dụng DeepFace (thẻ sinh viên vs selfie)
    
    Args:
        image1_b64: Base64 string của ảnh thẻ sinh viên
        image2_b64: Base64 string của ảnh selfie
        tolerance: Ngưỡng so sánh (0-1, default 0.6)
    
    Returns:
        dict: {
            "match": bool,
            "distance": float,
            "confidence": float (0-100%),
            "method": str,
            "liveness": dict (kết quả kiểm tra liveness cho selfie)
        }
    """
    try:
        # Decode base64 -> numpy array
        img1_data = base64.b64decode(image1_b64)
        img2_data = base64.b64decode(image2_b64)
        
        img1_np = np.frombuffer(img1_data, dtype=np.uint8)
        img2_np = np.frombuffer(img2_data, dtype=np.uint8)
        
        img1 = cv2.imdecode(img1_np, cv2.IMREAD_COLOR)
        img2 = cv2.imdecode(img2_np, cv2.IMREAD_COLOR)

        # Resize to speed up processing (limit max side to 480px)
        def fast_resize(img):
            if img is None:
                return img
            h, w = img.shape[:2]
            max_side = max(h, w)
            if max_side <= 480:
                return img
            scale = 480.0 / max_side
            new_w = int(w * scale)
            new_h = int(h * scale)
            return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        img1 = fast_resize(img1)
        img2 = fast_resize(img2)

        # Pre-crop to face ROI to speed up DeepFace
        try:
            cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            def crop_face(img):
                g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                faces = cascade.detectMultiScale(g, 1.1, 4)
                if len(faces) == 0:
                    return img
                x, y, w, h = faces[0]
                pad = int(max(w, h) * 0.25)
                xr = max(0, x - pad)
                yr = max(0, y - pad)
                x2 = min(img.shape[1], x + w + pad)
                y2 = min(img.shape[0], y + h + pad)
                return img[yr:y2, xr:x2]
            img1 = crop_face(img1)
            img2 = crop_face(img2)
        except Exception:
            pass
        
        if img1 is None or img2 is None:
            return {"error": "Không thể đọc ảnh"}
        
        # BƯỚC 1: Kiểm tra liveness cho ảnh selfie (img2)
        print("[Liveness Check] Bắt đầu kiểm tra ảnh selfie...", file=sys.stderr)
        liveness_result = detect_spoofing(img2)
        
        print(f"[Liveness Check] Kết quả: is_live={liveness_result['is_live']}, confidence={liveness_result['confidence']:.1f}%", file=sys.stderr)
        print(f"[Liveness Check] Lý do: {liveness_result.get('reasons', [])}", file=sys.stderr)
        
        # Nếu không pass liveness check -> từ chối ngay
        if not liveness_result['is_live']:
            return {
                "match": False,
                "error": "Phát hiện gian lận: Ảnh selfie không phải từ người thật",
                "liveness": liveness_result,
                "anti_spoofing_failed": True
            }
        
        # BƯỚC 2: Lưu tạm để DeepFace xử lý (dùng file để đảm bảo tương thích)
        temp_img1 = "temp_card.jpg"
        temp_img2 = "temp_selfie.jpg"
        cv2.imwrite(temp_img1, img1)
        cv2.imwrite(temp_img2, img2)
        
        try:
            # Dùng DeepFace.verify() với model Facenet512 (chính xác hơn VGG-Face)
            # Model Facenet512: threshold = 0.30 (cosine distance)
            print("[Face Matching] Bắt đầu so sánh khuôn mặt...", file=sys.stderr)
            # Dùng Facenet512 để ổn định, tương thích tốt
            result = DeepFace.verify(
                img1_path=temp_img1,
                img2_path=temp_img2,
                model_name="Facenet512",
                detector_backend="opencv",
                enforce_detection=True,
                distance_metric="cosine"
            )
            
            # Kết quả: {"verified": bool, "distance": float, "threshold": float}
            distance = result.get("distance", 1.0)
            threshold = result.get("threshold", tolerance)
            verified = result.get("verified", False)
            
            # Chuyển distance sang confidence (%)
            confidence = max(0, min(100, (1 - distance) * 100))
            
            # Log để debug
            print(f"[Face Matching] Distance: {distance:.4f}, Threshold: {threshold:.4f}, Verified: {verified}", file=sys.stderr)
            
            return {
                "match": verified,
                "distance": float(distance),
                "confidence": float(confidence),
                "threshold_used": float(threshold),
                "method": "DeepFace-Facenet512",
                "liveness": liveness_result,
                "liveness_passed": True
            }
        
        except Exception as deepface_error:
            # DeepFace có thể lỗi nếu không detect được face
            print(f"[DeepFace Error] {str(deepface_error)}", file=sys.stderr)
            return {"error": f"Không thể phát hiện khuôn mặt trong ảnh: {str(deepface_error)}"}
            
        finally:
            # Xóa file tạm
            try:
                if os.path.exists(temp_img1):
                    os.remove(temp_img1)
                if os.path.exists(temp_img2):
                    os.remove(temp_img2)
            except:
                pass
                
    except Exception as e:
        return {"error": f"Lỗi xử lý ảnh: {str(e)}"}


def compare_faces_opencv(image1_b64, image2_b64, tolerance=0.6):
    """
    Fallback khi không có DeepFace - KHÔNG SO SÁNH ĐƯỢC
    Chỉ kiểm tra có face hay không, KHÔNG thể xác minh có phải cùng người
    """
    try:
        img1_data = base64.b64decode(image1_b64)
        img2_data = base64.b64decode(image2_b64)
        
        img1_np = np.frombuffer(img1_data, dtype=np.uint8)
        img2_np = np.frombuffer(img2_data, dtype=np.uint8)
        
        img1 = cv2.imdecode(img1_np, cv2.IMREAD_COLOR)
        img2 = cv2.imdecode(img2_np, cv2.IMREAD_COLOR)
        
        if img1 is None or img2 is None:
            return {"error": "Không thể đọc ảnh"}
        
        # Load Haar Cascade để detect face
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        
        faces1 = face_cascade.detectMultiScale(gray1, 1.1, 4)
        faces2 = face_cascade.detectMultiScale(gray2, 1.1, 4)
        
        if len(faces1) == 0:
            return {"error": "Không tìm thấy khuôn mặt trong ảnh thẻ sinh viên"}
        
        if len(faces2) == 0:
            return {"error": "Không tìm thấy khuôn mặt trong ảnh selfie"}
        
        # QUAN TRỌNG: OpenCV KHÔNG CÓ KHẢ NĂNG SO SÁNH FACE ENCODING
        # Trả về lỗi vì hệ thống cần DeepFace để hoạt động
        return {
            "error": "DeepFace chưa được cài đặt. Không thể so sánh khuôn mặt. Vui lòng chạy: pip install deepface tf-keras"
        }
        
    except Exception as e:
        return {"error": f"OpenCV error: {str(e)}"}


def compare_faces(image1_b64, image2_b64, tolerance=0.6):
    """
    So sánh 2 khuôn mặt (thẻ sinh viên vs selfie)
    Tự động chọn method: DeepFace (nếu có) hoặc OpenCV (fallback)
    """
    if USE_DEEPFACE:
        return compare_faces_deepface(image1_b64, image2_b64, tolerance)
    else:
        return compare_faces_opencv(image1_b64, image2_b64, tolerance)


if __name__ == "__main__":
    try:
        # Đọc JSON từ stdin
        input_json = sys.stdin.read()
        
        if not input_json.strip():
            result = {"error": "No input data received"}
        else:
            input_data = json.loads(input_json)
            
            # Kiểm tra mode liveness_only
            liveness_only = input_data.get("liveness_only", False)
            
            if liveness_only:
                # Chỉ kiểm tra liveness cho 1 ảnh
                image = input_data.get("image")
                if not image:
                    result = {"error": "Missing 'image' field for liveness check"}
                else:
                    # Decode base64 -> numpy array
                    img_data = base64.b64decode(image)
                    img_np = np.frombuffer(img_data, dtype=np.uint8)
                    img = cv2.imdecode(img_np, cv2.IMREAD_COLOR)
                    
                    if img is None:
                        result = {"error": "Cannot decode image"}
                    else:
                        result = detect_spoofing(img)
            else:
                # So sánh 2 khuôn mặt (mode mặc định)
                image1 = input_data.get("image1")
                image2 = input_data.get("image2")
                tolerance = input_data.get("tolerance", 0.6)
                
                if not image1:
                    result = {"error": "Missing 'image1' field"}
                elif not image2:
                    result = {"error": "Missing 'image2' field"}
                else:
                    result = compare_faces(image1, image2, tolerance)
        
        # Output JSON qua stdout (LUÔN IN RA, KHÔNG EXIT 1)
        print(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()
        
        # Exit 0 để Node.js nhận được output
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        error_result = {"error": f"Invalid JSON input: {str(e)}"}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(0)  # Exit 0 để Node.js nhận được JSON error
        
    except Exception as e:
        error_result = {"error": f"Fatal error: {str(e)}"}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(0)  # Exit 0 để Node.js nhận được JSON error

