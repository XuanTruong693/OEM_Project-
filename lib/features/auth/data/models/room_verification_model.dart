import '../../domain/entities/room_verification_entity.dart';

class RoomVerificationModel extends RoomVerificationEntity {
  RoomVerificationModel({
    super.examId,
    super.roomToken,
    super.durationMinutes,
    super.requireFaceCheck,
    super.requireStudentCard,
    super.monitorScreen,
    super.timeOpen,
    super.timeClose,
    super.isValid,
    super.message,
  });

  factory RoomVerificationModel.fromJson(Map<String, dynamic> json) {
    // KỊCH BẢN 1: API MỚI (Có trả về room_token và exam_id)
    if (json.containsKey('room_token') || json.containsKey('exam_id')) {
      return RoomVerificationModel(
        examId: json['exam_id'] is int
            ? json['exam_id']
            : int.tryParse(json['exam_id']?.toString() ?? ''),
        roomToken: json['room_token']?.toString(),
        durationMinutes: json['duration_minutes'] is int
            ? json['duration_minutes']
            : int.tryParse(json['duration_minutes']?.toString() ?? ''),

        // Xử lý an toàn cho boolean (nếu server trả về 1/0 hoặc true/false)
        requireFaceCheck:
            json['require_face_check'] == true ||
            json['require_face_check'] == 1,
        requireStudentCard:
            json['require_student_card'] == true ||
            json['require_student_card'] == 1,
        monitorScreen:
            json['monitor_screen'] == true || json['monitor_screen'] == 1,

        timeOpen: json['time_open']?.toString(),
        timeClose: json['time_close']?.toString(),
        isValid: true, // Nếu parse được API mới thì chắc chắn là valid
        message: "✅ Mã phòng thi hợp lệ! Đang chuyển hướng...",
      );
    }

    // KỊCH BẢN 2: API CŨ (Legacy - Chỉ trả về valid và examCode)
    return RoomVerificationModel(
      isValid: json['valid'] == true,
      // API cũ hay trả thông báo trong trường message
      message:
          json['message']?.toString() ??
          (json['valid'] == true
              ? "✅ Mã phòng thi hợp lệ! Đang chuyển hướng..."
              : "Mã phòng không hợp lệ"),
    );
  }
}
