import '../../domain/entities/instructor_submission_entity.dart';

abstract class InstructorSubmissionsState {}

class InstructorSubmissionsInitial extends InstructorSubmissionsState {}

class InstructorSubmissionsLoading extends InstructorSubmissionsState {}

class InstructorSubmissionsLoaded extends InstructorSubmissionsState {
  final List<InstructorSubmissionEntity> allSubmissions; // Danh sách gốc từ API
  final String searchQuery; // Từ khóa tìm kiếm hiện tại

  InstructorSubmissionsLoaded({
    required this.allSubmissions,
    this.searchQuery = '',
  });

  // 👉 ĐÂY CHÍNH LÀ BẢN SAO CỦA useMemo BÊN REACT
  // Getter này tự động tính toán danh sách hiển thị dựa trên searchQuery
  // Nó không lưu thêm dữ liệu vào bộ nhớ, tối ưu y hệt useMemo!
  List<InstructorSubmissionEntity> get filteredSubmissions {
    if (searchQuery.trim().isEmpty) {
      return allSubmissions;
    }

    final q = searchQuery.trim().toLowerCase();

    return allSubmissions.where((s) {
      // Tìm theo Tên đề thi (hoặc ID đề)
      final examText = (s.examTitle ?? s.examId).toLowerCase();
      // Tìm theo Tên sinh viên (hoặc ID sinh viên)
      final studentText = (s.studentName ?? s.studentId).toLowerCase();

      return examText.contains(q) || studentText.contains(q);
    }).toList();
  }

  // Hàm copyWith để giữ nguyên danh sách gốc, chỉ cập nhật từ khóa tìm kiếm
  InstructorSubmissionsLoaded copyWith({
    List<InstructorSubmissionEntity>? allSubmissions,
    String? searchQuery,
  }) {
    return InstructorSubmissionsLoaded(
      allSubmissions: allSubmissions ?? this.allSubmissions,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}

class InstructorSubmissionsError extends InstructorSubmissionsState {
  final String message;
  InstructorSubmissionsError(this.message);
}
