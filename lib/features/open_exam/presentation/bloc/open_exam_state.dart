import '../../domain/entities/open_exam_entity.dart';

abstract class OpenExamState {}

class OpenExamInitial extends OpenExamState {}

class OpenExamLoading extends OpenExamState {}

class OpenExamLoaded extends OpenExamState {
  final List<OpenExamEntity> allExams;
  final String searchQuery;
  final String filterStatus; // 'all', 'draft', 'published'

  OpenExamLoaded({
    required this.allExams,
    this.searchQuery = '',
    this.filterStatus = 'all',
  });

  // 👉 BẢN SAO CỦA useMemo: Lọc theo status và search term
  List<OpenExamEntity> get filteredExams {
    return allExams.where((exam) {
      // 1. Lọc theo trạng thái
      final matchesStatus =
          filterStatus == 'all' || exam.status == filterStatus;

      // 2. Lọc theo tên hoặc ID (chuẩn hóa về chữ thường để so sánh)
      final q = searchQuery.trim().toLowerCase();
      final titleOrId = "${exam.title} ${exam.id}".toLowerCase();
      final matchesSearch = titleOrId.contains(q);

      return matchesStatus && matchesSearch;
    }).toList();
  }

  OpenExamLoaded copyWith({
    List<OpenExamEntity>? allExams,
    String? searchQuery,
    String? filterStatus,
  }) {
    return OpenExamLoaded(
      allExams: allExams ?? this.allExams,
      searchQuery: searchQuery ?? this.searchQuery,
      filterStatus: filterStatus ?? this.filterStatus,
    );
  }
}

class OpenExamError extends OpenExamState {
  final String message;
  OpenExamError(this.message);
}

// ==========================================
// 👉 LOGIC XỬ LÝ GIAI ĐOẠN (getPhase)
// ==========================================

enum ExamPhase { notOpened, opened, closed }

extension OpenExamEntityX on OpenExamEntity {
  ExamPhase get phase {
    // Nếu chưa published thì mặc định là Chưa mở
    if (status != 'published') return ExamPhase.notOpened;

    final now = DateTime.now();
    final openDate = timeOpen != null ? DateTime.tryParse(timeOpen!) : null;
    final closeDate = timeClose != null ? DateTime.tryParse(timeClose!) : null;

    // Đã xuất bản nhưng chưa tới giờ mở
    if (openDate != null && now.isBefore(openDate)) {
      return ExamPhase.notOpened;
    }

    // Đã xuất bản nhưng quá giờ đóng
    if (closeDate != null && now.isAfter(closeDate)) {
      return ExamPhase.closed;
    }

    // Nằm trong khoảng thời gian hoặc không cài đặt thời gian
    return ExamPhase.opened;
  }

  // Helper trả về chữ tiếng Việt để UI hiển thị
  String get phaseLabel {
    switch (phase) {
      case ExamPhase.notOpened:
        return "Chưa mở";
      case ExamPhase.closed:
        return "Đã đóng thi";
      case ExamPhase.opened:
        return "Đã mở";
    }
  }
}
