import 'package:flutter/material.dart';
import '../../domain/entities/question_preview_entity.dart';

class QuestionPreviewCard extends StatelessWidget {
  final QuestionPreviewEntity question;

  const QuestionPreviewCard({super.key, required this.question});

  @override
  Widget build(BuildContext context) {
    final hasError = question.errors.isNotEmpty;
    final isMCQ = question.type == 'MCQ';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: hasError ? Colors.red.shade50 : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: hasError ? Colors.red.shade300 : Colors.grey.shade300,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon phân loại
          CircleAvatar(
            backgroundColor: isMCQ
                ? Colors.green.shade100
                : Colors.purple.shade100,
            child: Icon(
              isMCQ ? Icons.format_list_bulleted : Icons.notes,
              color: isMCQ ? Colors.green.shade700 : Colors.purple.shade700,
            ),
          ),
          const SizedBox(width: 12),

          // Nội dung chính
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Row & Type
                Row(
                  children: [
                    Text(
                      "Row ${question.row}",
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.grey,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: isMCQ
                            ? Colors.green.shade100
                            : Colors.purple.shade100,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        question.type,
                        style: TextStyle(
                          fontSize: 10,
                          color: isMCQ
                              ? Colors.green.shade700
                              : Colors.purple.shade700,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Text câu hỏi
                Text(
                  "Câu ${question.row}: ${question.questionText}",
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 8),

                // Đáp án Trắc nghiệm
                if (isMCQ && question.options != null)
                  ...question.options!.asMap().entries.map((entry) {
                    final isCorrect = entry.key == question.correctOption;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 10,
                            backgroundColor: Colors.blue.shade50,
                            child: Text(
                              String.fromCharCode(65 + entry.key),
                              style: const TextStyle(fontSize: 10),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              entry.value,
                              style: TextStyle(
                                color: isCorrect
                                    ? Colors.green.shade700
                                    : Colors.grey.shade800,
                                fontWeight: isCorrect
                                    ? FontWeight.bold
                                    : FontWeight.normal,
                              ),
                            ),
                          ),
                          if (isCorrect)
                            const Icon(
                              Icons.check,
                              color: Colors.green,
                              size: 16,
                            ),
                        ],
                      ),
                    );
                  }),

                // Đáp án Tự luận
                if (!isMCQ && question.modelAnswer != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      "Đáp án mẫu: ${question.modelAnswer}",
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade800,
                      ),
                    ),
                  ),

                // Lỗi (nếu có)
                if (hasError)
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.red.shade100,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: question.errors
                          .map(
                            (err) => Text(
                              "⚠️ $err",
                              style: TextStyle(
                                color: Colors.red.shade700,
                                fontSize: 12,
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
