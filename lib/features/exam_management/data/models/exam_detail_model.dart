import '../../domain/entities/exam_detail_entity.dart';
import 'question_model.dart';

class ExamDetailModel extends ExamDetailEntity {
  ExamDetailModel({
    required super.id,
    required super.title,
    super.examRoomCode,
    super.status,
    required super.duration,
    required super.questions,
    super.timeOpen,
    super.timeClose,
  });

  factory ExamDetailModel.fromJson(Map<String, dynamic> json) {
    var parsedQuestions = <QuestionModel>[];
    if (json['questions'] != null && json['questions'] is List) {
      parsedQuestions = (json['questions'] as List)
          .map((q) => QuestionModel.fromJson(q as Map<String, dynamic>))
          .toList();
    }

    return ExamDetailModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Đề thi không tên',
      examRoomCode:
          json['exam_room_code']?.toString() ??
          json['examRoomCode']?.toString(),
      status: json['status']?.toString() ?? 'draft',
      duration:
          int.tryParse(
            json['duration_minutes']?.toString() ??
                json['duration']?.toString() ??
                '0',
          ) ??
          0,
      questions: parsedQuestions,
      timeOpen: json['time_open']?.toString(),
      timeClose: json['time_close']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': int.tryParse(id) ?? id,
      'title': title,
      'exam_room_code': examRoomCode,
      'status': status,
      'duration': duration,
      'questions': questions.map((q) => (q as QuestionModel).toJson()).toList(),
      'time_open': timeOpen,
      'time_close': timeClose,
    };
  }
}
