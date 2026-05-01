import '../../domain/entities/exam_entity.dart';

class ExamModel extends ExamEntity {
  ExamModel({
    required super.id,
    required super.title,
    super.examRoomCode,
    super.status,
    required super.duration,
    super.timeOpen,
    super.timeClose,
  });

  factory ExamModel.fromJson(Map<String, dynamic> json) {
    return ExamModel(
      id: int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      title: json['title']?.toString() ?? 'Đề thi không tên',
      examRoomCode: json['exam_room_code']?.toString(),
      status: json['status']?.toString() ?? 'draft',
      duration:
          int.tryParse(
            json['duration_minutes']?.toString() ??
                json['duration']?.toString() ??
                '0',
          ) ??
          0,
      timeOpen: json['time_open']?.toString(),
      timeClose: json['time_close']?.toString(),
    );
  }
}
