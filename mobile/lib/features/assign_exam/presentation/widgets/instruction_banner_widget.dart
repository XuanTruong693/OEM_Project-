import 'package:flutter/material.dart';

class InstructionBannerWidget extends StatelessWidget {
  const InstructionBannerWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "📋 Hướng dẫn format file (Excel, Word, PDF):",
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 16,
              color: Colors.blue.shade800,
            ),
          ),
          const SizedBox(height: 12),

          // 1. BOX VÀNG: MARKER BẮT BUỘC
          Container(
            padding: const EdgeInsets.all(12),
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.yellow.shade50,
              border: Border.all(color: Colors.yellow.shade300),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "📌 BẮT BUỘC - Marker phân loại:",
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.brown,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  "• File PHẢI CÓ dòng marker để hệ thống nhận biết loại câu hỏi",
                  style: TextStyle(fontSize: 13, color: Colors.brown),
                ),
                _buildRichText(
                  "• Marker MCQ: ",
                  '"Trắc nghiệm (MCQ)"',
                  Colors.brown,
                ),
                _buildRichText(
                  "• Marker Essay: ",
                  '"Tự luận (Essay)"',
                  Colors.brown,
                ),
                const SizedBox(height: 4),
                const Text(
                  "⚠️ Thiếu marker = File bị từ chối!",
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Colors.orange,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 2. BOX XANH LÁ: WORD/PDF
          Container(
            padding: const EdgeInsets.all(12),
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              border: Border.all(color: Colors.green.shade300),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "📝 Format Word/PDF (MCQ):",
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.green.shade800,
                  ),
                ),
                const SizedBox(height: 4),
                _buildRichText(
                  "• Dòng 1: Marker ",
                  '"Trắc nghiệm (MCQ)"',
                  Colors.green.shade800,
                ),
                _buildRichText(
                  "• Dòng 2: Câu hỏi với điểm, VD: ",
                  '"Câu 1: Hà Nội là thủ đô nước nào? (2đ)"',
                  Colors.green.shade800,
                ),
                Text(
                  "• Dòng 3-6: 4 đáp án, đánh dấu * ở cuối đáp án đúng",
                  style: TextStyle(fontSize: 13, color: Colors.green.shade800),
                ),
                const SizedBox(height: 8),
                Text(
                  "Ví dụ:",
                  style: TextStyle(fontSize: 13, color: Colors.green.shade800),
                ),
                Container(
                  margin: const EdgeInsets.only(top: 4),
                  padding: const EdgeInsets.all(8),
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    "Trắc nghiệm (MCQ)\nCâu 1: Hà Nội là thủ đô của nước nào? (2đ)\nViệt Nam*\nThái Lan\nTrung Quốc\nLào",
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: Colors.green.shade800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 3. EXCEL FORMAT
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "📊 Format Excel (MCQ):",
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.blue.shade800,
                ),
              ),
              const SizedBox(height: 4),
              _buildRichText(
                "• Dòng 1: ",
                'Marker "Trắc nghiệm (MCQ)"',
                Colors.blue.shade800,
              ),
              _buildRichText(
                "• Dòng tiếp theo: ",
                'Câu hỏi (cột 1) + 4 đáp án (cột 2-5)',
                Colors.blue.shade800,
              ),
              Text(
                "• Đánh dấu * ở cuối đáp án đúng",
                style: TextStyle(fontSize: 13, color: Colors.blue.shade800),
              ),
            ],
          ),

          Divider(color: Colors.blue.shade200, height: 24, thickness: 1),

          // 4. ESSAY FORMAT
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "✍️ Phần Tự luận (Essay):",
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.blue.shade800,
                ),
              ),
              const SizedBox(height: 4),
              _buildRichText(
                "• Bước 1: ",
                'Thêm dòng marker: "Tự luận (Essay)"',
                Colors.blue.shade800,
              ),
              _buildRichText(
                "• Bước 2: ",
                'Format mỗi câu: "Câu hỏi: ..." và "Câu trả lời: ..."',
                Colors.blue.shade800,
              ),
              Text(
                '• Ví dụ: "Câu 1: Câu hỏi: trong lịch sử việt nam có bao nhiêu vị vua? Câu trả lời: Có 8 vị vua."',
                style: TextStyle(fontSize: 13, color: Colors.blue.shade800),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // Hàm tiện ích để in đậm một phần text cho giống giao diện Web
  Widget _buildRichText(String normalText, String boldText, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: RichText(
        text: TextSpan(
          style: TextStyle(
            fontSize: 13,
            color: color,
            fontFamily: 'sans-serif',
          ),
          children: [
            TextSpan(text: normalText),
            TextSpan(
              text: boldText,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }
}
