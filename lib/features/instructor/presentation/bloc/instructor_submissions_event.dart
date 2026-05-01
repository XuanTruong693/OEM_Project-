abstract class InstructorSubmissionsEvent {}

// Tín hiệu 1: Gọi API lấy toàn bộ danh sách bài nộp khi vừa vào trang
class LoadSubmissionsEvent extends InstructorSubmissionsEvent {}

// Tín hiệu 2: Khi người dùng gõ vào thanh tìm kiếm
class SearchQueryChangedEvent extends InstructorSubmissionsEvent {
  final String query;
  SearchQueryChangedEvent(this.query);
}
