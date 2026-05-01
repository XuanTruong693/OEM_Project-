import '../../domain/entities/option_entity.dart';

class OptionModel extends OptionEntity {
  OptionModel({
    required super.id,
    required super.content,
    required super.isCorrect,
  });

  factory OptionModel.fromJson(Map<String, dynamic> json) {
    return OptionModel(
      id: json['id']?.toString() ?? json['tempId']?.toString() ?? '',
      content: json['option_text'] ?? json['content'] ?? '',
      // Xử lý an toàn boolean
      isCorrect:
          json['is_correct'] == true ||
          json['is_correct'] == 1 ||
          json['is_correct'] == 'true',
    );
  }

  // Đóng gói để gửi lên Node.js
  Map<String, dynamic> toJson() {
    return {
      'id':
          int.tryParse(id) ??
          id, // Node.js thường thích id là số, nếu parse được thì gửi số
      'content': content,
      'is_correct': isCorrect,
    };
  }
}
