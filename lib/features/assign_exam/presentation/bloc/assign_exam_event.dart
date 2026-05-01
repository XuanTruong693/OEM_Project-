import 'dart:io';

abstract class AssignExamEvent {}

// 1. Gửi lên khi người dùng chọn xong file từ máy điện thoại
class PickFileEvent extends AssignExamEvent {
  final File file;
  PickFileEvent(this.file);
}

// 2. Gửi lên khi người dùng bấm chọn 1 Sheet từ BottomSheet
class SheetSelectedEvent extends AssignExamEvent {
  final String sheetName;
  SheetSelectedEvent(this.sheetName);
}

// 3. Gửi lên khi người dùng nhập xong tên và bấm Lưu
class CommitExamEvent extends AssignExamEvent {
  final String title;
  final int duration;
  CommitExamEvent({required this.title, required this.duration});
}

// 4. Gửi lên khi bấm nút "Reset"
class ResetEvent extends AssignExamEvent {}
