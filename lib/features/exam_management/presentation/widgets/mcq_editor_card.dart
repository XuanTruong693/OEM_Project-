import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/question_entity.dart';
import '../bloc/exam_editor_bloc.dart';
import '../bloc/exam_editor_event.dart';

class McqEditorCard extends StatelessWidget {
  final int index;
  final QuestionEntity question;
  final List<String> errors;
  final VoidCallback onDelete;

  const McqEditorCard({
    super.key,
    required this.index,
    required this.question,
    required this.errors,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    String correctOptionId = '';
    if (question.options.isNotEmpty) {
      final correctIndex = question.options.indexWhere((o) => o.isCorrect);
      correctOptionId = correctIndex != -1
          ? question.options[correctIndex].id
          : question.options.first.id;
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.blue.shade100,
          width: 1.5,
        ), // Giống border màu xanh lợt bên React
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
          // HEADER: Số thứ tự & Nút xóa
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
                tooltip: "Xóa câu hỏi",
              ),
            ],
          ),

          // NỘI DUNG CÂU HỎI
          TextFormField(
            initialValue: question.content,
            onChanged: (value) => context.read<ExamEditorBloc>().add(
              UpdateQuestionContentEvent(question.id, value),
            ),
            maxLines: 2,
            decoration: InputDecoration(
              hintText: "Nội dung câu hỏi trắc nghiệm",
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 12,
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ĐIỂM SỐ
          Row(
            children: [
              const Text("Điểm: ", style: TextStyle(color: Colors.black54)),
              SizedBox(
                width: 80,
                child: TextFormField(
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
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // DANH SÁCH ĐÁP ÁN (OPTIONS)
          ...question.options.asMap().entries.map((entry) {
            final optIndex = entry.key;
            final opt = entry.value;
            final label = String.fromCharCode(65 + optIndex); // A, B, C, D...

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Row(
                children: [
                  Text(
                    "$label.",
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  Radio<String>(
                    value: opt.id,
                    // 👉 THAY THẾ DÒNG NÀY
                    groupValue: correctOptionId,
                    onChanged: (value) {
                      if (value != null) {
                        context.read<ExamEditorBloc>().add(
                          SetCorrectOptionEvent(question.id, value),
                        );
                      }
                    },
                    activeColor: Colors.blue,
                  ),
                  Expanded(
                    child: TextFormField(
                      initialValue: opt.content,
                      onChanged: (value) => context.read<ExamEditorBloc>().add(
                        UpdateOptionContentEvent(question.id, opt.id, value),
                      ),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        hintText: "Nội dung đáp án",
                        isDense: true,
                      ),
                    ),
                  ),
                  if (opt.isCorrect)
                    const Text(
                      "(Đúng)",
                      style: TextStyle(
                        color: Colors.green,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18, color: Colors.red),
                    onPressed: () => context.read<ExamEditorBloc>().add(
                      RemoveOptionEvent(question.id, opt.id),
                    ),
                  ),
                ],
              ),
            );
          }),

          // NÚT THÊM ĐÁP ÁN
          TextButton.icon(
            onPressed: () =>
                context.read<ExamEditorBloc>().add(AddOptionEvent(question.id)),
            icon: const Icon(Icons.add, size: 16, color: Colors.green),
            label: const Text(
              "Thêm đáp án",
              style: TextStyle(color: Colors.green),
            ),
          ),

          // HIỂN THỊ LỖI (NẾU CÓ)
          if (errors.isNotEmpty)
            Container(
              margin: EdgeInsets.only(top: 12),
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
