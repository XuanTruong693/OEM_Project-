import 'dart:io';
import '../../domain/entities/assign_exam_result_entity.dart';

abstract class AssignExamState {}

// 1. Trạng thái ban đầu (Chưa có gì, hiện nút Upload to bự)
class AssignExamInitial extends AssignExamState {}

// 2. Trạng thái đang tải (Hiện vòng xoay Loading)
class AssignExamLoading extends AssignExamState {
  final String message;
  AssignExamLoading({this.message = "Đang xử lý..."});
}

// 3. Trạng thái ĐẶC BIỆT: Yêu cầu UI bật BottomSheet chọn Sheet
class AssignExamSheetSelectionRequired extends AssignExamState {
  final File file; // Giữ lại file gốc để xài cho bước sau
  final List<String> availableSheets;

  AssignExamSheetSelectionRequired({
    required this.file,
    required this.availableSheets,
  });
}

// 4. Trạng thái thành công bóc tách: UI vẽ List câu hỏi và bảng Thống kê
class AssignExamPreviewReady extends AssignExamState {
  final File file; // Giữ lại để biết đang làm việc với file nào
  final AssignExamResultEntity data;

  AssignExamPreviewReady({required this.file, required this.data});
}

// 5. Trạng thái Đẩy API thành công
class AssignExamSuccess extends AssignExamState {
  final String examId;
  AssignExamSuccess(this.examId);
}

// 6. Trạng thái Lỗi (Hiện bảng đỏ)
class AssignExamError extends AssignExamState {
  final String message;
  AssignExamError(this.message);
}
