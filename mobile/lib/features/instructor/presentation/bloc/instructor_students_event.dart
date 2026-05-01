abstract class InstructorStudentsEvent {}

// Tín hiệu 1: Khi vừa vào trang, yêu cầu gọi API lấy danh sách
class LoadStudentsEvent extends InstructorStudentsEvent {}

// Tín hiệu 2: Khi người dùng gõ vào thanh tìm kiếm
class SearchStudentQueryChangedEvent extends InstructorStudentsEvent {
  final String query;
  SearchStudentQueryChangedEvent(this.query);
}
