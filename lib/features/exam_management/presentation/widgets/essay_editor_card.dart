import 'dart:developer' as developer;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/question_entity.dart';
import '../bloc/exam_editor_bloc.dart';
import '../bloc/exam_editor_event.dart';

class EssayEditorCard extends StatelessWidget {
  final int index;
  final QuestionEntity question;
  final List<String> errors;
  final VoidCallback onDelete;

  const EssayEditorCard({
    super.key,
    required this.index,
    required this.question,
    required this.errors,
    required this.onDelete,
  });

  /// Hàm hỗ trợ: Tự động tìm đáp án cũ
  String _getOldAnswer() {
    // 1. IN LOG ĐỂ KIỂM TRA DỮ LIỆU ĐẦU VÀO
    developer.log(
      "========== DEBUG CÂU ${question.id} ==========",
      name: "EssayCard",
    );
    developer.log(
      "1. modelAnswer hiện tại: '${question.modelAnswer}'",
      name: "EssayCard",
    );
    developer.log(
      "2. Số lượng options: ${question.options.length}",
      name: "EssayCard",
    );

    if (question.options.isNotEmpty) {
      developer.log(
        "3. Nội dung option đầu tiên: '${question.options.first.content}'",
        name: "EssayCard",
      );
    } else {
      developer.log("3. Mảng options TRỐNG RỖNG!", name: "EssayCard");
    }
    developer.log(
      "===========================================",
      name: "EssayCard",
    );

    // 2. LOGIC TÌM ĐÁP ÁN (Giữ nguyên)
    if (question.modelAnswer != null &&
        question.modelAnswer!.trim().isNotEmpty) {
      return question.modelAnswer!;
    }

    if (question.options.isNotEmpty) {
      return question.options.first.content;
    }

    return "";
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.purple.shade100, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Số thứ tự câu và nút Xóa
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Câu $index:",
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: Colors.black87,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.red),
                onPressed: onDelete,
              ),
            ],
          ),

          // 1. Ô nhập Nội dung câu hỏi
          TextFormField(
            key: ValueKey(
              'essay_content_${question.id}',
            ), // 🔑 KHÓA CHỐNG LỖI NHẢY CHỮ
            initialValue: question.content,
            onChanged: (value) => context.read<ExamEditorBloc>().add(
              UpdateQuestionContentEvent(question.id, value),
            ),
            maxLines: 3,
            decoration: InputDecoration(
              hintText: "Nội dung câu hỏi tự luận",
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),

          const SizedBox(height: 12),

          // 2. Ô nhập Điểm
          Row(
            children: [
              const Text("Điểm: ", style: TextStyle(color: Colors.black54)),
              SizedBox(
                width: 80,
                child: TextFormField(
                  key: ValueKey(
                    'essay_points_${question.id}',
                  ), // 🔑 KHÓA CHỐNG LỖI NHẢY SỐ
                  initialValue: question.points.toString(),
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  onChanged: (value) {
                    final points = double.tryParse(value) ?? 0.1;
                    context.read<ExamEditorBloc>().add(
                      UpdateQuestionPointsEvent(question.id, points),
                    );
                  },
                  decoration: InputDecoration(
                    isDense: true,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    contentPadding: const EdgeInsets.all(8),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),
          const Text(
            "Đáp án mẫu:",
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 8),

          // 3. Ô nhập Đáp án mẫu
          TextFormField(
            key: ValueKey(
              'essay_answer_${question.id}',
            ), // 🔑 KHÓA BẢO VỆ DỮ LIỆU
            initialValue: _getOldAnswer(), // 🔥 SỬ DỤNG HÀM TÌM ĐÁP ÁN CŨ
            onChanged: (value) => context.read<ExamEditorBloc>().add(
              UpdateModelAnswerEvent(question.id, value),
            ),
            maxLines: 4,
            decoration: InputDecoration(
              hintText: "Nhập đáp án mẫu cho câu tự luận...",
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),

          // Hiển thị lỗi (nếu có)
          if (errors.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: errors
                    .map(
                      (err) => Text(
                        "• $err",
                        style: TextStyle(
                          color: Colors.red.shade700,
                          fontSize: 13,
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
        ],
      ),
    );
  }
}
