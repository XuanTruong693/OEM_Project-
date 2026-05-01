import '../../domain/entities/exam_setting_entity.dart';

abstract class ExamSettingEvent {}

class SubmitSettingEvent extends ExamSettingEvent {
  final int examId;
  final ExamSettingEntity entity;

  SubmitSettingEvent({required this.examId, required this.entity});
}
