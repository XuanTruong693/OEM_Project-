import '../../domain/entities/question_preview_entity.dart';

class QuestionPreviewModel extends QuestionPreviewEntity {
  const QuestionPreviewModel({
    required super.row,
    required super.type,
    required super.questionText,
    required super.originalQuestionText,
    super.points,
    super.options,
    super.correctOption,
    super.modelAnswer,
    required super.errors,
  });

  Map<String, dynamic> toJson() {
    // 1. Tạo các trường cơ bản (Dùng chung cho cả MCQ và Essay)
    final map = <String, dynamic>{
      'row': row,
      'type': type,
      'question_text': questionText,
      'original_question_text': originalQuestionText,
      'points': points,
      'errors': errors,
    };

    // 2. CHỈ nạp dữ liệu đặc thù khi đúng loại câu hỏi để tránh Backend báo lỗi (400 Bad Request)
    if (type == 'MCQ') {
      map['options'] = options ?? [];
      map['correct_option'] = correctOption;
    } else if (type == 'Essay') {
      map['model_answer'] = modelAnswer ?? "";
    }

    return map;
  }
}
