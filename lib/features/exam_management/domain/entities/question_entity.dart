import 'option_entity.dart';

class QuestionEntity {
  final String id;
  final String type; // 'MCQ' hoặc 'essay'
  final String content;
  final double points;
  final String? modelAnswer;
  final List<OptionEntity> options;

  QuestionEntity({
    required this.id,
    required this.type,
    required this.content,
    required this.points,
    this.modelAnswer,
    required this.options,
  });
}
