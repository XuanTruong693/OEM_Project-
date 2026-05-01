import '../../domain/entities/exam_info_entity.dart';

class ExamInfoModel extends ExamInfoEntity {
  ExamInfoModel({
    required super.title,
    required super.instructorName,
    required super.requireFaceCheck,
    required super.requireStudentCard,
    required super.monitorScreen,
  });

  factory ExamInfoModel.fromJson(Map<String, dynamic> json) {
    // Tạo một hàm nhỏ ẩn bên trong để check an toàn
    bool parseBool(dynamic value) {
      if (value is bool) return value;
      if (value is int) return value == 1;
      if (value is String) return value == '1' || value.toLowerCase() == 'true';
      return false;
    }

    return ExamInfoModel(
      title: json['title'] ?? '',
      instructorName: json['instructor_name'] ?? '',

      // 👉 SỬA 3 DÒNG NÀY (Dùng hàm parseBool ở trên)
      requireFaceCheck: parseBool(json['require_face_check']),
      requireStudentCard: parseBool(json['require_student_card']),
      monitorScreen: parseBool(json['monitor_screen']),
    );
  }
}
