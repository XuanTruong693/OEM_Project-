import '../../domain/entities/instructor_student_entity.dart';

class InstructorStudentModel extends InstructorStudentEntity {
  const InstructorStudentModel({
    required super.studentId,
    super.studentName,
    super.email,
    required super.submissionsCount,
    super.avgScore,
    super.lastSubmittedAt,
  });

  factory InstructorStudentModel.fromJson(Map<String, dynamic> json) {
    return InstructorStudentModel(
      studentId: json['student_id']?.toString() ?? '',
      studentName: json['student_name']?.toString(),
      email: json['email']?.toString(),
      submissionsCount: json['submissions_count'] ?? 0,
      // Ép kiểu an toàn cho avgScore, đề phòng API trả về chuỗi "8.5" hoặc số nguyên 8
      avgScore: json['avg_score'] != null
          ? double.tryParse(json['avg_score'].toString())
          : null,
      lastSubmittedAt: json['last_submitted_at']?.toString(),
    );
  }
}
