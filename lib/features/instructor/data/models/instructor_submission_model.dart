import '../../domain/entities/instructor_submission_entity.dart';

class InstructorSubmissionModel extends InstructorSubmissionEntity {
  const InstructorSubmissionModel({
    required super.submissionId,
    required super.examId,
    super.examTitle,
    required super.studentId,
    super.studentName,
    required super.status,
    super.totalScore,
    super.submittedAt,
  });

  factory InstructorSubmissionModel.fromJson(Map<String, dynamic> json) {
    return InstructorSubmissionModel(
      submissionId: json['submission_id']?.toString() ?? '',
      examId: json['exam_id']?.toString() ?? '',
      examTitle: json['exam_title']?.toString(),
      studentId: json['student_id']?.toString() ?? '',
      studentName: json['student_name']?.toString(),
      status: json['status'] ?? 'unknown',
      // Dùng double.tryParse để đề phòng API trả về số nguyên hoặc chuỗi
      totalScore: json['total_score'] != null
          ? double.tryParse(json['total_score'].toString())
          : null,
      submittedAt: json['submitted_at']?.toString(),
    );
  }
}
