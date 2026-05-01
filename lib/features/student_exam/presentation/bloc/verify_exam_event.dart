import 'package:equatable/equatable.dart';

abstract class VerifyExamEvent extends Equatable {
  const VerifyExamEvent();

  @override
  List<Object?> get props => [];
}

// =====================================
// 1. Tải dữ liệu ban đầu (ĐÃ SỬA)
// =====================================
class LoadVerifyExamDataEvent extends VerifyExamEvent {
  final int examId;
  final String submissionId; // Đổi roomToken thành submissionId

  const LoadVerifyExamDataEvent({
    required this.examId,
    required this.submissionId,
  });

  @override
  List<Object?> get props => [examId, submissionId];
}

// =====================================
// 2. Tìm và Xác minh MSSV (ĐÃ SỬA)
// =====================================
class VerifyStudentCodeEvent extends VerifyExamEvent {
  final String submissionId; // Thêm biến này
  final String studentCode;

  const VerifyStudentCodeEvent(this.submissionId, this.studentCode);

  @override
  List<Object?> get props => [submissionId, studentCode];
}

// 3. Đổi/Reset MSSV (Nut Nhập lại)
class ResetCardVerificationEvent extends VerifyExamEvent {}

// 4. Các Event của AI ML Kit (Bước 2)
class UpdateBlinkPhaseEvent extends VerifyExamEvent {
  final String phase;
  final int count;
  final int leftPct;
  final int rightPct;
  final bool faceOk;
  const UpdateBlinkPhaseEvent(
    this.phase,
    this.count,
    this.leftPct,
    this.rightPct,
    this.faceOk,
  );
  @override
  List<Object?> get props => [phase, count, leftPct, rightPct, faceOk];
}

class UpdateFaceGuideEvent extends VerifyExamEvent {
  final bool isOk;
  final String msg;
  const UpdateFaceGuideEvent(this.isOk, this.msg);
  @override
  List<Object?> get props => [isOk, msg];
}

// 5. Chụp ảnh tĩnh và gọi API Liveness (Bước 2)
class FaceCapturedEvent extends VerifyExamEvent {
  final String imagePath; // Ảnh do Camera chụp lưu vào Cache
  const FaceCapturedEvent(this.imagePath);
  @override
  List<Object?> get props => [imagePath];
}

// =====================================
// 6. Xử lý logic API (ĐÃ SỬA)
// =====================================
class VerifyFaceApiEvent extends VerifyExamEvent {
  final String submissionId;
  const VerifyFaceApiEvent(this.submissionId);
  @override
  List<Object?> get props => [submissionId];
}

class CompareFacesApiEvent extends VerifyExamEvent {
  final String submissionId;
  const CompareFacesApiEvent(this.submissionId);
  @override
  List<Object?> get props => [submissionId];
}

class UploadFinalImagesEvent extends VerifyExamEvent {
  final String submissionId;
  const UploadFinalImagesEvent(this.submissionId);
  @override
  List<Object?> get props => [submissionId];
}

// 7. Reset Face (Chụp lại ảnh khuôn mặt)
class ResetFaceVerificationEvent extends VerifyExamEvent {}

// 8. Bật chống gian lận (Bước 3)
class EnableMonitorEvent extends VerifyExamEvent {}

// 9. Các Event Socket.io (Realtime)
class SocketBypassGrantedEvent extends VerifyExamEvent {}

class SocketKickedEvent extends VerifyExamEvent {
  final String reason;
  const SocketKickedEvent(this.reason);
  @override
  List<Object?> get props => [reason];
}
