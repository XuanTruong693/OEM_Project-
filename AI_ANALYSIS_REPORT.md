# Đánh giá Hệ thống Chấm điểm AI (AI Grading System Assessment)

## 1. Kết luận Tổng quan
**Hệ thống này CHÍNH XÁC là một hệ thống Hybrid AI (Lai ghép) kết hợp Machine Learning, Deep Learning và Specialized Parsers.**

Hệ thống vượt trội hơn các giải pháp NLP thuần túy nhờ khả năng xử lý đa miền: Văn bản (NLP), Mã nguồn (Code AST), và Dữ liệu có cấu trúc (SQL/Math).

## 2. Phân tích Kiến trúc & Công nghệ

### 2.1. Các thành phần Deep Learning (Học sâu)
Hệ thống sử dụng các mô hình Transformer tiên tiến (SOTA) cho Semantic Search:

*   **Core Model (`paraphrase-multilingual-mpnet-base-v2`)**:
    *   **Loại**: Deep Learning (Transformer - MPNet architecture).
    *   **Nâng cấp**: Thay thế cho `vietnamese-sbert` cũ để hỗ trợ đa ngôn ngữ (Anh-Việt) và hiểu ngữ nghĩa sâu hơn nhiều.
    *   **Ứng dụng**: Tính toán độ tương đồng ngữ nghĩa (`Cosine Similarity`). Hiểu các khái niệm trừu tượng (ví dụ: "loop" tương đương "vòng lặp", "thái dương" tương đương "mặt trời").
*   **Cross-Encoder (`symanto/xlm-roberta-base-snli-mnli-anli-xnli`)**:
    *   **Loại**: Deep Learning (RoBERTa architecture).
    *   **Chức năng**: Phân tích logic (NLI - Natural Language Inference).
    *   **Ứng dụng**: Xác định quan hệ Lập luận (Entailment) vs Mâu thuẫn (Contradiction). Giúp phát hiện các câu trả lời "viết hay nhưng sai sự thật".

### 2.2. Các thành phần Specialized Analysis (Phân tích Chuyên biệt)
Đây là điểm khác biệt của hệ thống so với LLM thông thường:

*   **Code Analyzer (AST Parser)**:
    *   Sử dụng `Python AST` (Abstract Syntax Tree) để phân tích mã nguồn.
    *   Phát hiện lỗi logic (đệ quy vô hạn, sai toán tử) mà không cần chạy code.
    *   So sánh cấu trúc (Structure Matching) thay vì so sánh chuỗi, giúp chấm đúng ngay cả khi sinh viên đổi tên biến.
*   **SQL Parser**:
    *   Chuẩn hóa cú pháp SQL, xử lý Table Aliasing (`s.name` vs `Student.name`).
*   **Math Normalizer**:
    *   Xử lý các đơn vị đo lường, làm tròn số học.

### 2.3. Các thành phần Machine Learning & NLP truyền thống
*   **Dictionary Expansion**: Bộ từ điển 800+ từ đồng nghĩa/viết tắt/thuật ngữ chuyên ngành (IT, Y tế, Giáo dục) giúp AI hiểu dải từ vựng rộng.
*   **Active Learning (Học chủ động)**:
    *   Module `dataset_learning.py` (thay thế `learning.py` cũ).
    *   **Cơ chế**: Khi giáo viên sửa điểm, AI lưu lại mẫu đó ("Few-shot Learning").
    *   **Hot-Reload**: Học tức thì mà không cần huấn luyện lại (Retrain) toàn bộ mô hình.

## 3. Quy trình Chấm điểm (Grading Pipeline)
Quy trình trong `grader.py` được tối ưu hóa theo tầng (Layered Architecture):

1.  **Strict Match**: Khớp chính xác hoàn toàn (Điểm tuyệt đối 100% - Tốc độ nhanh nhất).
2.  **Active Memory**: Tra cứu dữ liệu đã học từ giáo viên (`dataset_learning`).
3.  **Technical Routing**:
    *   Nếu là Code/SQL -> Gọi `CodeAnalyzer`.
    *   Nếu là Văn bản -> Gọi `LogicAnalyzer` & `SemanticModel`.
4.  **Logic Guardrails (Hàng rào logic)**:
    *   Kiểm tra từ trái nghĩa (Antonyms context-aware).
    *   Kiểm tra phương hướng (Directional Logic: A->B khác B->A).
    *   Kiểm tra dữ kiện cứng (Fact Check: Năm, Địa danh).
5.  **Deep Semantic Scoring**:
    *   Tính điểm dựa trên Embedding Similarity (MPNet).
    *   Tự động phạt điểm nếu câu trả lời quá ngắn (Partial Answer).

## 4. Tích hợp Hệ thống (System Integration)
*   **Backend (`GradingController.js`)**:
    *   Tích hợp chặt chẽ quy trình **Human-in-the-loop**.
    *   API `/learn/from-correction` đóng vai trò cầu nối để AI "khôn lên" sau mỗi lần giáo viên can thiệp.

## 5. Kết luận
*   **Độ chuẩn xác**: Hệ thống đạt chuẩn **Semantic RAG** (Retrieval-Augmented Generation) chuyên dụng cho chấm thi.
*   **So với LMS khác**: Vượt trội nhờ khả năng tự học và xử lý Code/SQL chuyên sâu.
*   **So với GPT thuần**: An toàn hơn (không bị ảo giác), ổn định (deterministic) và chi phí thấp hơn (chạy local).

