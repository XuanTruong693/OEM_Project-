abstract class ExamPreviewEvent {}

// Tín hiệu 1: Khi vừa vào trang, nạp dữ liệu câu hỏi và thống kê
class LoadExamPreviewDataEvent extends ExamPreviewEvent {
  final String examId;
  LoadExamPreviewDataEvent(this.examId);
}

// Tín hiệu 2: Khi bấm nút "Bắt đầu mở phòng"
class CheckAndOpenRoomEvent extends ExamPreviewEvent {}

// Tín hiệu 3: Đóng Modal cảnh báo (Hủy)
class CloseWarningModalEvent extends ExamPreviewEvent {}

// Tín hiệu 4: Chấp nhận Xóa dữ liệu cũ & Mở phòng
class PurgeAndOpenEvent extends ExamPreviewEvent {
  final String examId;
  PurgeAndOpenEvent(this.examId);
}

// Tín hiệu 5: Chọn phương án an toàn (Tạo bản sao)
class CloneAndEditEvent extends ExamPreviewEvent {
  final String examId;
  CloneAndEditEvent(this.examId);
}
