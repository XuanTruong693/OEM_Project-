abstract class PrepareExamEvent {}

// Sự kiện hệ thống tự động chèn vào (Auto-Join)
class AutoJoinExamEvent extends PrepareExamEvent {
  final String roomToken;

  AutoJoinExamEvent({required this.roomToken});
}
