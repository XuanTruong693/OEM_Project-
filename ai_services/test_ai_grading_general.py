import requests
import time
import json

# Cấu hình
API_URL = "http://localhost:8000/grade"
MAX_POINTS = 2.0

# Môn học: Pháp luật đại cương (General Law)
# Câu hỏi giả định: Bản chất của Pháp luật là gì?
MODEL_ANSWER = "Pháp luật thể hiện ý chí của giai cấp thống trị và điều chỉnh các quan hệ xã hội."

# 6 Trường hợp kiểm thử (Test cases with ~50 chars/words focused on intent)
TEST_CASES = [
    {
        "name": "1. Khớp hoàn hảo (Perfect Match)",
        "student_text": "Pháp luật thể hiện ý chí của giai cấp cầm quyền và điều chỉnh các mối quan hệ trong xã hội.",
        "expected": "Điểm tuyệt đối (2.0) vì diễn đạt chuẩn xác 100% ý nghĩa."
    },
    {
        "name": "2. Dùng từ đồng nghĩa/Paraphrase mượt mà (Ngữ cảnh chung)",
        "student_text": "Luật phản ánh mong muốn từ tầng lớp lãnh đạo, giúp quản lý và duy trì trật tự cộng đồng.",
        "expected": "Điểm cao (1.5 - 2.0) vì trình bày hoàn toàn đúng bản chất bằng cụm từ tương đương."
    },
    {
        "name": "3. Đảo cấu trúc câu nhưng đúng ý (Rephrased correctly)",
        "student_text": "Các quan hệ xã hội được điều chỉnh bởi pháp luật, vốn là ý chí của giai cấp thống trị.",
        "expected": "Điểm cao (1.8 - 2.0) vì sử dụng câu bị động nhưng không làm sai lệch ý nghĩa."
    },
    {
        "name": "4. Thiếu một phần ý bắt buộc (Chỉ có 1 vế)",
        "student_text": "Pháp luật được nhà nước đặt ra dùng để điều chỉnh các quan hệ xã hội.",
        "expected": "Điểm trung bình (1.0 - 1.2) vì thiết sót vế cốt lõi về 'ý chí giai cấp'."
    },
    {
        "name": "5. Logic ngược / Sai bản chất (Wrong Context/Logic)",
        "student_text": "Nhân dân lao động tự đặt ra pháp luật để thống trị và quản lý bộ máy nhà nước.",
        "expected": "Điểm thấp (0.0 - 0.5) vì sai lệch bản chất cốt lõi của môn học (Đảo ngược quan hệ thống trị)."
    },
    {
        "name": "6. Nhồi nhét từ khóa bừa bãi (Keyword stuffing)",
        "student_text": "thể hiện xã hội thống trị quan hệ giai cấp điều chỉnh ý chí của",
        "expected": "Điểm rất thấp (0.0) vì vi phạm lỗi văn phạm nghiêm trọng và không thành câu."
    }
]

def run_tests():
    print("======================================================================")
    print("🧪 KIỂM THỬ CHẤT LƯỢNG CHẤM ĐIỂM AI - MÔN ĐẠI CƯƠNG (PHÁP LUẬT / TRIẾT)")
    print("======================================================================\n")
    
    total_time = 0
    
    for i, test in enumerate(TEST_CASES):
        print(f"[TEST_CASE_{i+1}]: {test['name']}")
        print(f"🔸 Đáp án chuẩn  : {MODEL_ANSWER}")
        print(f"🔹 Bài SV nộp    : {test['student_text']}")
        
        payload = {
            "model_answer": MODEL_ANSWER,
            "student_answer": test['student_text'],
            "max_points": MAX_POINTS,
            "grading_mode": "general"
        }
        
        start_time = time.time()
        try:
            # Timeout 60s để AI model load
            response = requests.post(API_URL, json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()
            
            end_time = time.time()
            elapsed = end_time - start_time
            total_time += elapsed
            
            score = result.get("score", 0.0)
            feedback = result.get("explanation", "")
            
            print(f"⏱ Thời gian AI   : {elapsed:.3f} giây")
            print(f"📈 Điểm AI cho   : {score:.2f} / {MAX_POINTS:.2f}")
            print(f"🎯 Kỳ vọng gốc   : {test['expected']}")
            print(f"🤖 Lời phê của AI: {feedback}")
            print("\n" + "-"*70 + "\n")
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Lỗi kết nối tới API: {e}")
            print("\n" + "-"*70 + "\n")

    print("======================================================================")
    print("TỔNG KẾT ĐÁNH GIÁ TỐC ĐỘ XỬ LÝ TRUNG BÌNH:")
    avg_time = total_time / len(TEST_CASES)
    speed_status = "NHANH" if avg_time < 1.0 else ("TẠM ỔN" if avg_time < 2.5 else "CHẬM")
    print(f"⏳ Cần trung bình {avg_time:.3f} giây / 1 câu hỏi.")
    print(f"🐢 Tốc độ chấm: {speed_status}")
    print("======================================================================")

if __name__ == "__main__":
    run_tests()
