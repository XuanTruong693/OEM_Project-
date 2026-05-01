import '../../domain/entities/open_exam_entity.dart';

class OpenExamModel extends OpenExamEntity {
  const OpenExamModel({
    required super.id,
    required super.title,
    required super.status,
    super.timeOpen,
    super.timeClose,
  });

  factory OpenExamModel.fromJson(Map<String, dynamic> json) {
    return OpenExamModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Không có tiêu đề',
      status: json['status']?.toString() ?? 'draft',
      timeOpen: json['time_open']?.toString(),
      timeClose: json['time_close']?.toString(),
    );
  }
}
