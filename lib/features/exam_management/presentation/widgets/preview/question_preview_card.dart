import 'package:flutter/material.dart';
import '../../../../../core/utils/exam_parser_helper.dart';
import '../../../domain/entities/question_entity.dart';

class QuestionPreviewCard extends StatelessWidget {
  final QuestionEntity question;
  final int index;

  const QuestionPreviewCard({
    super.key,
    required this.question,
    required this.index,
  });

  @override
  Widget build(BuildContext context) {
    // Gọi Helper để bóc tách câu hỏi và đáp án mẫu
    final parsedQA = ExamParserHelper.splitQA(
      question.content,
      question.modelAnswer,
    );

    // Xóa chữ "Câu 1:" ở đầu nếu API có trả về để tự format cho đẹp
    final cleanStem = parsedQA.stem.replaceAll(
      RegExp(r'^(?:Câu|Question)?\s*\d+[:.]?\s*', caseSensitive: false),
      '',
    );

    return RepaintBoundary(
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.blueGrey.shade50.withOpacity(0.3),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.blueGrey.shade100),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Nhãn Loại câu hỏi
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.green.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    "T",
                    style: TextStyle(
                      color: Colors.green.shade700,
                      fontWeight: FontWeight.bold,
                      fontSize: 10,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    question.type,
                    style: TextStyle(color: Colors.grey.shade700, fontSize: 10),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Nội dung câu hỏi
            Text(
              "Câu ${index + 1}: $cleanStem",
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
            const SizedBox(height: 12),

            // Render đáp án tùy theo loại
            if (question.type.toUpperCase() == 'MCQ')
              ...question.options.asMap().entries.map((entry) {
                final idx = entry.key;
                final opt = entry.value;
                final letter = String.fromCharCode(65 + idx); // A, B, C, D

                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CircleAvatar(
                        radius: 10,
                        backgroundColor: Colors.grey.shade200,
                        child: Text(
                          letter,
                          style: TextStyle(
                            fontSize: 10,
                            color: Colors.grey.shade700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          opt.content,
                          style: TextStyle(
                            fontSize: 13,
                            color: opt.isCorrect
                                ? Colors.green.shade700
                                : Colors.black87,
                            fontWeight: opt.isCorrect
                                ? FontWeight.w600
                                : FontWeight.normal,
                          ),
                        ),
                      ),
                      if (opt.isCorrect)
                        const Icon(Icons.check, color: Colors.green, size: 16),
                    ],
                  ),
                );
              })
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Đáp án mẫu:",
                    style: TextStyle(
                      fontStyle: FontStyle.italic,
                      color: Colors.grey.shade600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      parsedQA.model.isEmpty ? "—" : parsedQA.model,
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
