import '../../domain/entities/exam_bank_entity.dart';

abstract class ExamBankState {}

class ExamBankInitial extends ExamBankState {}

class ExamBankLoading extends ExamBankState {}

class ExamBankLoaded extends ExamBankState {
  final List<ExamBankEntity> allExams; // Danh sách gốc từ API
  final String searchQuery;
  final String filterStatus; // 'all', 'draft', 'published'

  // Trạng thái cho việc Xóa
  final bool isDeleting;
  final String? toastMessage;
  final String? toastType; // 'success' hoặc 'error'

  ExamBankLoaded({
    required this.allExams,
    this.searchQuery = '',
    this.filterStatus = 'all',
    this.isDeleting = false,
    this.toastMessage,
    this.toastType,
  });

  // 👉 BẢN SAO HOÀN HẢO CỦA useMemo VÀ .filter() BÊN REACT
  List<ExamBankEntity> get filteredExams {
    return allExams.where((exam) {
      // 1. Kiểm tra Search
      final matchesSearch = exam.title.toLowerCase().contains(
        searchQuery.trim().toLowerCase(),
      );

      // 2. Kiểm tra Filter
      final matchesFilter =
          filterStatus == 'all' || exam.status == filterStatus;

      return matchesSearch && matchesFilter;
    }).toList();
  }

  ExamBankLoaded copyWith({
    List<ExamBankEntity>? allExams,
    String? searchQuery,
    String? filterStatus,
    bool? isDeleting,
    String? toastMessage,
    String? toastType,
    bool clearToast = false, // Cờ đặc biệt để reset toast về null
  }) {
    return ExamBankLoaded(
      allExams: allExams ?? this.allExams,
      searchQuery: searchQuery ?? this.searchQuery,
      filterStatus: filterStatus ?? this.filterStatus,
      isDeleting: isDeleting ?? this.isDeleting,
      toastMessage: clearToast ? null : (toastMessage ?? this.toastMessage),
      toastType: clearToast ? null : (toastType ?? this.toastType),
    );
  }
}

class ExamBankError extends ExamBankState {
  final String message;
  ExamBankError(this.message);
}

// 👉 EXTENSION TIỆN ÍCH: Xử lý logic isInProgress (thay thế hàm js)
extension ExamBankEntityX on ExamBankEntity {
  bool get isInProgress {
    if (timeOpen == null || timeClose == null) return false;

    final open = DateTime.tryParse(timeOpen!);
    final close = DateTime.tryParse(timeClose!);

    if (open == null || close == null) return false;

    final now = DateTime.now();
    // Đang diễn ra nếu Hiện tại >= Lúc Mở VÀ Hiện tại <= Lúc Đóng
    return (now.isAfter(open) || now.isAtSameMomentAs(open)) &&
        (now.isBefore(close) || now.isAtSameMomentAs(close));
  }
}
