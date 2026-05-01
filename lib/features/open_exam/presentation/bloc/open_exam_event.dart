abstract class OpenExamEvent {}

// Tín hiệu yêu cầu tải danh sách đề thi của tôi
class LoadOpenExamsEvent extends OpenExamEvent {}

// Tín hiệu khi người dùng gõ vào thanh tìm kiếm
class SearchExamChangedEvent extends OpenExamEvent {
  final String query;
  SearchExamChangedEvent(this.query);
}

// Tín hiệu khi người dùng bấm chọn các nút lọc (All, Draft, Published)
class FilterStatusChangedEvent extends OpenExamEvent {
  final String status;
  FilterStatusChangedEvent(this.status);
}
