import requests
import json
import time

API_URL = "http://localhost:8000/grade"

test_cases = [
    {
        "name": "1. Khớp hoàn hảo (Perfect Match)",
        "model": "Tính đóng gói bảo vệ dữ liệu khỏi truy cập ngoài.",
        "student": "Tính đóng gói bảo vệ dữ liệu khỏi truy cập ngoài.",
        "expected": 2.0
    },
    {
        "name": "2. Dùng từ đồng nghĩa/Tiếng Anh (Polymorphism)",
        "model": "Đa hình cho phép đối tượng dùng chung một method",
        "student": "Tính Polymorphism giúp gọi chung hàm nhưng logic khác",
        "expected": ">= 1.5"
    }
]

def run_tests():
    print("="*70)
    print("🧪 KIỂM THỬ CHẤT LƯỢNG CHẤM ĐIỂM AI - MÔN OOP (NGẮN LÝ THUYẾT & CODE)")
    print("="*70)
    
    for tc in test_cases:
        print(f"\n[TEST_CASE]: {tc['name']}")
        payload = {
            "student_answer": tc['student'],
            "model_answer": tc['model'],
            "max_points": 2.0,
            "grading_mode": "technical"
        }
        res = requests.post(API_URL, json=payload).json()
        print(f"📈 Điểm AI cho   : {res['score']:.2f} / 2.00")
        print(f"🎯 Kỳ vọng gốc   : {tc['expected']}")
        print(f"🤖 Lời phê của AI: {res['explanation']}")
        print("-" * 70)

if __name__ == "__main__":
    run_tests()
