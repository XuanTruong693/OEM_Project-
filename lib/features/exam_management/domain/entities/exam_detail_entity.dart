import 'question_entity.dart';

class ExamDetailEntity {
  final String id;
  final String title;
  final String? examRoomCode;
  final String? status;
  final int duration;
  final List<QuestionEntity> questions;
  final String? timeOpen;
  final String? timeClose;

  ExamDetailEntity({
    required this.id,
    required this.title,
    this.examRoomCode,
    this.status,
    required this.duration,
    required this.questions,
    this.timeOpen,
    this.timeClose,
  });
}
