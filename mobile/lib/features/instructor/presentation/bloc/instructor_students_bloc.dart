import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_students_use_case.dart';
import 'instructor_students_event.dart';
import 'instructor_students_state.dart';

class InstructorStudentsBloc
    extends Bloc<InstructorStudentsEvent, InstructorStudentsState> {
  final GetStudentsUseCase getStudentsUseCase;

  InstructorStudentsBloc({required this.getStudentsUseCase})
    : super(InstructorStudentsInitial()) {
    on<LoadStudentsEvent>(_onLoadStudents);
    on<SearchStudentQueryChangedEvent>(_onSearchQueryChanged);
  }

  // Xử lý gọi API
  Future<void> _onLoadStudents(
    LoadStudentsEvent event,
    Emitter<InstructorStudentsState> emit,
  ) async {
    emit(InstructorStudentsLoading());

    final result = await getStudentsUseCase();

    result.fold((failure) => emit(InstructorStudentsError(failure.message)), (
      students,
    ) {
      // Nếu lấy dữ liệu thành công, đưa vào trạng thái Loaded
      emit(InstructorStudentsLoaded(allStudents: students));
    });
  }

  // Xử lý thay đổi từ khóa tìm kiếm
  void _onSearchQueryChanged(
    SearchStudentQueryChangedEvent event,
    Emitter<InstructorStudentsState> emit,
  ) {
    if (state is InstructorStudentsLoaded) {
      final currentState = state as InstructorStudentsLoaded;

      // Phát ra State mới với từ khóa vừa gõ.
      // Giao diện (UI) sẽ tự động gọi getter `filteredStudents` để cập nhật màn hình.
      emit(currentState.copyWith(searchQuery: event.query));
    }
  }
}
