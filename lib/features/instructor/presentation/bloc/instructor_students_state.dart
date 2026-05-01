import '../../domain/entities/instructor_student_entity.dart';

abstract class InstructorStudentsState {}

class InstructorStudentsInitial extends InstructorStudentsState {}

class InstructorStudentsLoading extends InstructorStudentsState {}

class InstructorStudentsLoaded extends InstructorStudentsState {
  final List<InstructorStudentEntity> allStudents; // Danh sách gốc từ API
  final String searchQuery; // Từ khóa tìm kiếm hiện tại

  InstructorStudentsLoaded({required this.allStudents, this.searchQuery = ''});

  // 👉 BẢN SAO HOÀN HẢO CỦA useMemo
  // Hàm này tự động lọc danh sách theo tên, ID hoặc email
  List<InstructorStudentEntity> get filteredStudents {
    if (searchQuery.trim().isEmpty) {
      return allStudents;
    }

    final q = searchQuery.trim().toLowerCase();

    return allStudents.where((s) {
      // Chuẩn hóa dữ liệu về chữ thường để so sánh
      final nameOrId = (s.studentName ?? s.studentId).toLowerCase();
      final email = (s.email ?? "").toLowerCase();

      // Trả về true nếu tên/id chứa từ khóa HOẶC email chứa từ khóa
      return nameOrId.contains(q) || email.contains(q);
    }).toList();
  }

  // Hàm copyWith để cập nhật từ khóa mà không làm mất danh sách gốc
  InstructorStudentsLoaded copyWith({
    List<InstructorStudentEntity>? allStudents,
    String? searchQuery,
  }) {
    return InstructorStudentsLoaded(
      allStudents: allStudents ?? this.allStudents,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}

class InstructorStudentsError extends InstructorStudentsState {
  final String message;
  InstructorStudentsError(this.message);
}
