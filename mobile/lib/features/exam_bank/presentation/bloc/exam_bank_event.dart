abstract class ExamBankEvent {}

// Tải danh sách đề thi (gọi API)
class LoadExamsEvent extends ExamBankEvent {}

// Thay đổi từ khóa tìm kiếm
class SearchExamEvent extends ExamBankEvent {
  final String query;
  SearchExamEvent(this.query);
}

// Thay đổi bộ lọc trạng thái (all, draft, published)
class FilterStatusChangedEvent extends ExamBankEvent {
  final String status;
  FilterStatusChangedEvent(this.status);
}

// Xác nhận xóa đề thi
class DeleteExamEvent extends ExamBankEvent {
  final String examId;
  DeleteExamEvent(this.examId);
}

// Xóa thông báo Toast sau khi đã hiển thị
class ClearToastEvent extends ExamBankEvent {}
