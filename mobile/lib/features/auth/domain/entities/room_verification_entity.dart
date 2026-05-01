class RoomVerificationEntity {
  final int? examId;
  final String? roomToken;
  final int? durationMinutes;

  // Các cờ gian lận (Mặc định là false nếu API cũ không trả về)
  final bool requireFaceCheck;
  final bool requireStudentCard;
  final bool monitorScreen;

  final String? timeOpen;
  final String? timeClose;

  // Dùng để tương thích với API cũ (legacy)
  final bool isValid;
  final String? message;

  RoomVerificationEntity({
    this.examId,
    this.roomToken,
    this.durationMinutes,
    this.requireFaceCheck = false,
    this.requireStudentCard = false,
    this.monitorScreen = false,
    this.timeOpen,
    this.timeClose,
    this.isValid = false,
    this.message,
  });
}
