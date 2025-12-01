#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified verification script: Thẻ SV + Khuôn mặt + So sánh
Input: JSON qua stdin
Output: JSON với kết quả xác minh chi tiết

Usage:
    echo '{"action":"verify_card","card_image":"base64..."}' | python verify_images.py
    echo '{"action":"verify_face","face_image":"base64..."}' | python verify_images.py
    echo '{"action":"compare_faces","face_image":"base64...","card_image":"base64...","tolerance":0.35}' | python verify_images.py
"""

import sys
import json
import base64
import os

# Import từ các module đã có
import cv2
import numpy as np

# Import từ student_card_filter
import importlib.util
spec_card = importlib.util.spec_from_file_location(
    "student_card_filter",
    os.path.join(os.path.dirname(__file__), "student_card_filter.py")
)
student_card_filter = importlib.util.module_from_spec(spec_card)
spec_card.loader.exec_module(student_card_filter)

# Import từ face_verification_optimized (phiên bản tối ưu tốc độ)
spec_face = importlib.util.spec_from_file_location(
    "face_verification_optimized",
    os.path.join(os.path.dirname(__file__), "face_verification_optimized.py")
)
face_verification = importlib.util.module_from_spec(spec_face)
spec_face.loader.exec_module(face_verification)

# Ensure UTF-8 output
try:
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass


def verify_student_card(card_image_b64):
    """Xác minh thẻ sinh viên từ base64"""
    try:
        img_bytes = base64.b64decode(card_image_b64)
        valid, details = student_card_filter.verify_student_card_from_bytes(img_bytes)
        return {
            "success": True,
            "valid": valid,
            "details": details
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Lỗi xác minh thẻ SV: {str(e)}"
        }


def verify_face_liveness(face_image_b64):
    """Kiểm tra liveness của khuôn mặt từ base64 - PHIÊN BẢN NHANH"""
    try:
        img_data = base64.b64decode(face_image_b64)
        img_np = np.frombuffer(img_data, dtype=np.uint8)
        img = cv2.imdecode(img_np, cv2.IMREAD_COLOR)
        
        if img is None:
            return {
                "success": False,
                "error": "Không thể decode ảnh khuôn mặt"
            }
        
        # Sử dụng hàm tối ưu
        liveness_result = face_verification.detect_spoofing_fast(img)
        return {
            "success": True,
            "liveness": liveness_result
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Lỗi kiểm tra liveness: {str(e)}"
        }


def compare_two_faces(face_image_b64, card_image_b64, tolerance=0.35):
    """So sánh 2 khuôn mặt: selfie vs thẻ SV - PHIÊN BẢN NHANH"""
    try:
        print(f"[Compare] Bắt đầu so sánh khuôn mặt...", file=sys.stderr, flush=True)
        # Sử dụng hàm tối ưu
        result = face_verification.compare_faces_fast(card_image_b64, face_image_b64, tolerance)
        print(f"[Compare] Kết quả: {result}", file=sys.stderr, flush=True)
        return {
            "success": True,
            "comparison": result
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Compare Error] {error_trace}", file=sys.stderr, flush=True)
        return {
            "success": False,
            "error": f"Lỗi so sánh khuôn mặt: {str(e)}",
            "error_trace": error_trace
        }


if __name__ == "__main__":
    try:
        # ✅ FIX: Đọc stdin an toàn hơn, tránh deadlock với buffer lớn
        input_chunks = []
        chunk_size = 8192  # 8KB mỗi lần đọc
        
        while True:
            chunk = sys.stdin.read(chunk_size)
            if not chunk:
                break
            input_chunks.append(chunk)
        
        input_json = "".join(input_chunks)
        
        if not input_json.strip():
            result = {"error": "No input data received"}
        else:
            input_data = json.loads(input_json)
            action = input_data.get("action")
            
            if action == "verify_card":
                card_image = input_data.get("card_image")
                if not card_image:
                    result = {"error": "Missing 'card_image' field"}
                else:
                    result = verify_student_card(card_image)
                    
            elif action == "verify_face":
                face_image = input_data.get("face_image")
                if not face_image:
                    result = {"error": "Missing 'face_image' field"}
                else:
                    result = verify_face_liveness(face_image)
                    
            elif action == "compare_faces":
                face_image = input_data.get("face_image")
                card_image = input_data.get("card_image")
                tolerance = input_data.get("tolerance", 0.35)
                
                if not face_image:
                    result = {"error": "Missing 'face_image' field"}
                elif not card_image:
                    result = {"error": "Missing 'card_image' field"}
                else:
                    result = compare_two_faces(face_image, card_image, tolerance)
                    
            else:
                result = {"error": f"Unknown action: {action}"}
        
        print(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        error_result = {"error": f"Invalid JSON input: {str(e)}"}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(0)
        
    except Exception as e:
        error_result = {"error": f"Fatal error: {str(e)}"}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(0)
