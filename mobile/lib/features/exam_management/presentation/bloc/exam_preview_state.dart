import '../../domain/entities/exam_detail_entity.dart';

abstract class ExamPreviewState {}

class ExamPreviewInitial extends ExamPreviewState {}

class ExamPreviewLoading extends ExamPreviewState {}

class ExamPreviewLoaded extends ExamPreviewState {
  final ExamDetailEntity exam; // Chi tiết đề thi (Câu hỏi, thời gian...)
  final int totalSubmissions; // Số lượng bài nộp lấy từ Summary

  // Các cờ (flags) điều khiển UI Modal (Giống y hệt file React)
  final bool showWarningModal;
  final bool modalBusy; // Hiệu ứng loading trên 2 nút đỏ/xanh
  final String? modalError; // Hiển thị dòng lỗi màu đỏ trong Modal

  // Các cờ điều khiển Chuyển trang (Navigation)
  final bool navigateToSettings;
  final String? cloneNewExamId; // Chứa ID mới để chuyển sang trang Edit

  ExamPreviewLoaded({
    required this.exam,
    required this.totalSubmissions,
    this.showWarningModal = false,
    this.modalBusy = false,
    this.modalError,
    this.navigateToSettings = false,
    this.cloneNewExamId,
  });

  // Hàm copyWith để giữ nguyên data cũ, chỉ cập nhật 1 vài cờ
  ExamPreviewLoaded copyWith({
    ExamDetailEntity? exam,
    int? totalSubmissions,
    bool? showWarningModal,
    bool? modalBusy,
    String? modalError,
    bool? navigateToSettings,
    String? cloneNewExamId,
    bool clearModalError = false,
  }) {
    return ExamPreviewLoaded(
      exam: exam ?? this.exam,
      totalSubmissions: totalSubmissions ?? this.totalSubmissions,
      showWarningModal: showWarningModal ?? this.showWarningModal,
      modalBusy: modalBusy ?? this.modalBusy,
      modalError: clearModalError ? null : (modalError ?? this.modalError),
      navigateToSettings: navigateToSettings ?? this.navigateToSettings,
      cloneNewExamId: cloneNewExamId ?? this.cloneNewExamId,
    );
  }
}

class ExamPreviewError extends ExamPreviewState {
  final String message;
  ExamPreviewError(this.message);
}
