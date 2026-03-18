import requests
import time
import json

# URL AI Service gốc hoặc Production
URL = "http://localhost:8000/grade"

# 6 Trường hợp kiểm thử môn Lập Trình Hướng Đối Tượng (OOP)
# Yêu cầu: Mỗi câu < 50 chars, bao gồm thuật ngữ chuyên ngành và cả code
TEST_CASES = [
    {
        "id": 1,
        "type": "1. Khớp hoàn hảo (Perfect Match)",
        "model_answer": "Tính đóng gói bảo vệ dữ liệu khỏi truy cập ngoài.",
        "student_answer": "Tính đóng gói bảo vệ dữ liệu khỏi truy cập ngoài.",
        "max_points": 2.0,
        "expected": "Điểm tuyệt đối (2.0) vì giống 100%."
    },
    {
        "id": 2,
        "type": "2. Dùng từ đồng nghĩa/Tiếng Anh (Phức tạp)",
        "model_answer": "Đa hình cho phép đối tượng dùng chung một method",
        "student_answer": "Tính Polymorphism giúp gọi chung hàm nhưng logic khác",
        "max_points": 2.0,
        "expected": "Điểm cao (1.5 - 2.0) vì hiểu đúng bản chất (Polymorphism = Đa hình, method = hàm)."
    },
    {
        "id": 3,
        "type": "3. Kết hợp Code snippet thay vì dùng lời văn",
        "model_answer": "Constructor dùng để gán giá trị mặc định tạo object",
        "student_answer": "def __init__(self, x): self.x = x #để khởi tạo obj",
        "max_points": 2.0,
        "expected": "Điểm cao (1.5 - 2.0) vì sinh viên đưa ra code thay cho lời văn, chứng tỏ hiểu bài sâu."
    },
    {
        "id": 4,
        "type": "4. Thiếu một phần ý bắt buộc (Có liên quan)",
        "model_answer": "Class là bản thiết kế để tạo object và chứa method",
        "student_answer": "Class là khuôn đóng sẵn để đúc ra object.",
        "max_points": 2.0,
        "expected": "Điểm khá (1.0 - 1.5) vì thiếu vế chứa method."
    },
    {
        "id": 5,
        "type": "5. Logic ngược / Nhầm lẫn (Sai bản chất)",
        "model_answer": "Kế thừa giúp lớp con dùng lại code của cha",
        "student_answer": "Lớp cha sẽ kế thừa và dùng lại thuộc tính con",
        "max_points": 2.0,
        "expected": "Điểm thấp (0.0 - 0.5) vì đảo lộn logic (Subclass nhầm với Superclass)."
    },
    {
        "id": 6,
        "type": "6. Nhồi nhét từ khóa (Keyword stuffing vô nghĩa)",
        "model_answer": "Interface chỉ khai báo hàm, không có phần thân",
        "student_answer": "khai báo thân hàm không có Interface phần",
        "max_points": 2.0,
        "expected": "Điểm rất thấp (0.0 - 0.5) vì chỉ ghép chữ vô nghĩa, cấu trúc câu loạn."
    }
]

def run_evaluation():
    print("="*70)
    print("🧪 KIỂM THỬ CHẤT LƯỢNG CHẤM ĐIỂM AI - MÔN OOP (NGẮN LÝ THUYẾT & CODE)")
    print("="*70)
    
    total_time = 0
    success_requests = 0

    for idx, case in enumerate(TEST_CASES, 1):
        print(f"\n[TEST_CASE_{idx}]: {case['type']}")
        print(f"🔸 Đáp án chuẩn  : {case['model_answer']}")
        print(f"🔹 Bài SV nộp    : {case['student_answer']}")
        
        payload = {
            "student_answer": case["student_answer"],
            "model_answer": case["model_answer"],
            "max_points": case["max_points"],
            "grading_mode": "technical"
        }
        
        start_time = time.time()
        try:
            response = requests.post(URL, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            success_requests += 1
        except Exception as e:
            print(f"❌ Lỗi gửi API: {e}")
            continue
            
        elapsed_time = time.time() - start_time
        total_time += elapsed_time
        
        score = data.get("score", 0.0)
        confidence = data.get("confidence", 0.0)
        expl = data.get("explanation", "")
        
        print(f"⏱ Thời gian AI   : {elapsed_time:.3f} giây")
        print(f"📈 Điểm AI cho   : {score:.2f} / {case['max_points']:.2f} (Độ tự tin: {confidence:.2f})")
        print(f"🎯 Kỳ vọng gốc   : {case['expected']}")
        print(f"🤖 Lời phê của AI: {expl}")

    if success_requests > 0:
        avg_time = total_time / success_requests
        print("\n" + "="*70)
        print("TỔNG KẾT ĐÁNH GIÁ TỐC ĐỘ XỬ LÝ TRUNG BÌNH:")
        print(f"⏳ Cần trung bình {avg_time:.3f} giây / 1 câu hỏi OOP phức tạp.")
        if avg_time < 0.8:
            print("🚀 Tốc độ chấm: XUẤT SẮC (Cực kỳ phản hồi nhanh)")
        elif avg_time < 2:
            print("⚡ Tốc độ chấm: TỐT (Hoàn toàn đáp ứng thời gian thực cho kỳ thi)")
        else:
            print("🐢 Tốc độ chấm: CHẬM (Tạm ổn nhưng cần kiểm tra lại tài nguyên server)")
    print("="*70)

if __name__ == '__main__':
    run_evaluation()
