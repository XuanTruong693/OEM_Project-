import '../../domain/entities/question_entity.dart';
import 'option_model.dart';

class QuestionModel extends QuestionEntity {
  QuestionModel({
    required super.id,
    required super.type,
    required super.content,
    required super.points,
    super.modelAnswer,
    required super.options,
  });

  factory QuestionModel.fromJson(Map<String, dynamic> json) {
    // Logic normalizeType giống hệt React
    final rawType = json['type']?.toString().toLowerCase() ?? '';
    final type = (rawType == 'essay' || rawType == 'tự luận') ? 'essay' : 'MCQ';

    var parsedOptions = <OptionModel>[];
    if (json['options'] != null && json['options'] is List) {
      parsedOptions = (json['options'] as List)
          .map((o) => OptionModel.fromJson(o as Map<String, dynamic>))
          .toList();
    }

    return QuestionModel(
      id: json['id']?.toString() ?? json['tempId']?.toString() ?? '',
      type: type,
      content: json['question_text'] ?? json['content'] ?? '',
      // Bắt lỗi null hoặc chữ, mặc định là 0.1
      points: double.tryParse(json['points']?.toString() ?? '0.1') ?? 0.1,

      // 👉 SỬA TẠI ĐÂY: Hứng cả snake_case lẫn camelCase, chống null tuyệt đối
      modelAnswer:
          json['model_answer']?.toString() ??
          json['modelAnswer']?.toString() ??
          '',

      options: parsedOptions,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': int.tryParse(id) ?? id,
      'type': type,
      'content': content,
      'points': points,
      'modelAnswer': modelAnswer ?? '',
      'options': options.map((opt) => (opt as OptionModel).toJson()).toList(),
    };
  }
}
