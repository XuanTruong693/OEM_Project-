import '../../domain/entities/exam_setting_entity.dart';

class ExamSettingRequest extends ExamSettingEntity {
  const ExamSettingRequest({
    required super.duration,
    required super.durationMinutes,
    required super.timeOpen,
    required super.timeClose,
    required super.maxAttempts,
    required super.requireFaceCheck,
    required super.requireStudentCard,
    required super.monitorScreen,
    required super.intentShuffle,
    super.gradingMode,
    super.maxPoints,
  });

  /// Ánh xạ từ Entity sang Model để xử lý ở tầng Data
  factory ExamSettingRequest.fromEntity(ExamSettingEntity entity) {
    return ExamSettingRequest(
      duration: entity.duration,
      durationMinutes: entity.durationMinutes,
      timeOpen: entity.timeOpen,
      timeClose: entity.timeClose,
      maxAttempts: entity.maxAttempts,
      requireFaceCheck: entity.requireFaceCheck,
      requireStudentCard: entity.requireStudentCard,
      monitorScreen: entity.monitorScreen,
      intentShuffle: entity.intentShuffle,
      gradingMode: entity.gradingMode,
      maxPoints: entity.maxPoints,
    );
  }

  /// Chuyển đổi dữ liệu sang JSON để gửi API
  Map<String, dynamic> toJson() {
    return {
      'duration': duration,
      'duration_minutes': durationMinutes,
      // Chuyển DateTime sang chuỗi ISO8601 mà Backend yêu cầu
      'time_open': timeOpen.toIso8601String(),
      'time_close': timeClose.toIso8601String(),
      'max_attempts': maxAttempts,
      'require_face_check': requireFaceCheck,
      'require_student_card': requireStudentCard,
      'monitor_screen': monitorScreen,
      // Convert bool sang int (1/0) cho Backend
      'intent_shuffle': intentShuffle ? 1 : 0,
      'grading_mode': gradingMode,
      'max_points': maxPoints,
    };
  }
}
