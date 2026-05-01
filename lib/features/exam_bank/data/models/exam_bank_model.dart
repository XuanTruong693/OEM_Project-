import '../../domain/entities/exam_bank_entity.dart';

class ExamBankModel extends ExamBankEntity {
  const ExamBankModel({
    required super.id,
    required super.title,
    required super.status,
    super.timeOpen,
    super.timeClose,
    super.examRoomCode,
    super.createdAt,
  });

  factory ExamBankModel.fromJson(Map<String, dynamic> json) {
    return ExamBankModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Không có tiêu đề',
      status: json['status']?.toString() ?? 'draft',
      timeOpen: json['time_open']?.toString(),
      timeClose: json['time_close']?.toString(),
      examRoomCode: json['exam_room_code']?.toString(),
      createdAt: json['created_at']?.toString(),
    );
  }
}
