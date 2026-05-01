import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/usecases/get_open_exams_use_case.dart';
import 'open_exam_event.dart';
import 'open_exam_state.dart';

class OpenExamBloc extends Bloc<OpenExamEvent, OpenExamState> {
  final GetOpenExamsUseCase getOpenExamsUseCase;

  OpenExamBloc({required this.getOpenExamsUseCase}) : super(OpenExamInitial()) {
    on<LoadOpenExamsEvent>(_onLoadOpenExams);
    on<SearchExamChangedEvent>(_onSearchExamChanged);
    on<FilterStatusChangedEvent>(_onFilterStatusChanged);
  }

  Future<void> _onLoadOpenExams(
    LoadOpenExamsEvent event,
    Emitter<OpenExamState> emit,
  ) async {
    // Giữ nguyên giao diện cũ (nếu có) để tránh màn hình chớp trắng khi load lại
    if (state is! OpenExamLoaded) {
      emit(OpenExamLoading());
    }

    final result = await getOpenExamsUseCase();

    result.fold((failure) => emit(OpenExamError(failure.message)), (exams) {
      if (state is OpenExamLoaded) {
        // Gắn data mới nhưng giữ lại bộ lọc cũ
        emit((state as OpenExamLoaded).copyWith(allExams: exams));
      } else {
        // Khởi tạo lần đầu
        emit(OpenExamLoaded(allExams: exams));
      }
    });
  }

  void _onSearchExamChanged(
    SearchExamChangedEvent event,
    Emitter<OpenExamState> emit,
  ) {
    if (state is OpenExamLoaded) {
      emit((state as OpenExamLoaded).copyWith(searchQuery: event.query));
    }
  }

  void _onFilterStatusChanged(
    FilterStatusChangedEvent event,
    Emitter<OpenExamState> emit,
  ) {
    if (state is OpenExamLoaded) {
      emit((state as OpenExamLoaded).copyWith(filterStatus: event.status));
    }
  }
}
