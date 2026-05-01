import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_submissions_use_case.dart';
import 'instructor_submissions_event.dart';
import 'instructor_submissions_state.dart';

class InstructorSubmissionsBloc
    extends Bloc<InstructorSubmissionsEvent, InstructorSubmissionsState> {
  final GetSubmissionsUseCase getSubmissionsUseCase;

  InstructorSubmissionsBloc({required this.getSubmissionsUseCase})
    : super(InstructorSubmissionsInitial()) {
    on<LoadSubmissionsEvent>(_onLoadSubmissions);
    on<SearchQueryChangedEvent>(_onSearchQueryChanged);
  }

  Future<void> _onLoadSubmissions(
    LoadSubmissionsEvent event,
    Emitter<InstructorSubmissionsState> emit,
  ) async {
    emit(InstructorSubmissionsLoading());

    // Gọi API qua UseCase
    final result = await getSubmissionsUseCase();

    result.fold((failure) => emit(InstructorSubmissionsError(failure.message)), (
      submissions,
    ) {
      // Thành công: Đưa danh sách vào trạng thái Loaded (searchQuery mặc định là rỗng)
      emit(InstructorSubmissionsLoaded(allSubmissions: submissions));
    });
  }

  void _onSearchQueryChanged(
    SearchQueryChangedEvent event,
    Emitter<InstructorSubmissionsState> emit,
  ) {
    // Chỉ xử lý tìm kiếm nếu dữ liệu đã được load thành công
    if (state is InstructorSubmissionsLoaded) {
      final currentState = state as InstructorSubmissionsLoaded;

      // Phát ra trạng thái mới với từ khóa mới.
      // Getter `filteredSubmissions` sẽ tự động chạy lại để lọc UI.
      emit(currentState.copyWith(searchQuery: event.query));
    }
  }
}
