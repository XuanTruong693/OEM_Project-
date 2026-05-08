import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/delete_bank_exam_use_case.dart';
import '../../domain/usecases/get_bank_exams_use_case.dart';
import 'exam_bank_event.dart';
import 'exam_bank_state.dart';

class ExamBankBloc extends Bloc<ExamBankEvent, ExamBankState> {
  final GetBankExamsUseCase getBankExamsUseCase;
  final DeleteBankExamUseCase deleteBankExamUseCase;

  ExamBankBloc({
    required this.getBankExamsUseCase,
    required this.deleteBankExamUseCase,
  }) : super(ExamBankInitial()) {
    on<LoadExamsEvent>(_onLoadExams);
    on<LoadMoreExamsEvent>(_onLoadMoreExams);
    on<SearchExamEvent>(_onSearchExam);
    on<FilterStatusChangedEvent>(_onFilterStatusChanged);
    on<DeleteExamEvent>(_onDeleteExam);
    on<ClearToastEvent>(_onClearToast);
  }

  // 1. GỌI API LẤY DANH SÁCH ĐỀ THI (Trang 1)
  Future<void> _onLoadExams(
    LoadExamsEvent event,
    Emitter<ExamBankState> emit,
  ) async {
    String searchQuery = '';
    String filterStatus = 'all';

    if (state is ExamBankLoaded) {
      final currentState = state as ExamBankLoaded;
      searchQuery = currentState.searchQuery;
      filterStatus = currentState.filterStatus;
    }

    if (state is! ExamBankLoaded) {
      emit(ExamBankLoading());
    }

    final result = await getBankExamsUseCase(
      page: 1,
      limit: 10,
      search: searchQuery.isNotEmpty ? searchQuery : null,
      status: filterStatus != 'all' ? filterStatus : null,
    );

    result.fold(
      (failure) => emit(ExamBankError(failure.message)),
      (exams) {
        emit(ExamBankLoaded(
          allExams: exams,
          searchQuery: searchQuery,
          filterStatus: filterStatus,
          currentPage: 1,
          hasReachedMax: exams.length < 10,
          isLoadingMore: false,
        ));
      },
    );
  }

  // 1b. GỌI API TẢI THÊM ĐỀ THI (Trang tiếp theo)
  Future<void> _onLoadMoreExams(
    LoadMoreExamsEvent event,
    Emitter<ExamBankState> emit,
  ) async {
    if (state is! ExamBankLoaded) return;
    final currentState = state as ExamBankLoaded;

    if (currentState.hasReachedMax || currentState.isLoadingMore) return;

    emit(currentState.copyWith(isLoadingMore: true));

    final nextPage = currentState.currentPage + 1;
    final result = await getBankExamsUseCase(
      page: nextPage,
      limit: 10,
      search: currentState.searchQuery.isNotEmpty ? currentState.searchQuery : null,
      status: currentState.filterStatus != 'all' ? currentState.filterStatus : null,
    );

    result.fold(
      (failure) {
        emit(currentState.copyWith(isLoadingMore: false));
      },
      (newExams) {
        if (newExams.isEmpty) {
          emit(currentState.copyWith(
            isLoadingMore: false,
            hasReachedMax: true,
          ));
        } else {
          final existingIds = currentState.allExams.map((e) => e.id).toSet();
          final uniqueNewExams = newExams.where((e) => !existingIds.contains(e.id)).toList();

          emit(currentState.copyWith(
            allExams: [...currentState.allExams, ...uniqueNewExams],
            currentPage: nextPage,
            isLoadingMore: false,
            hasReachedMax: newExams.length < 10,
          ));
        }
      },
    );
  }

  // 2. CẬP NHẬT TỪ KHÓA TÌM KIẾM VÀ TẢI LẠI TRANG 1
  Future<void> _onSearchExam(SearchExamEvent event, Emitter<ExamBankState> emit) async {
    if (state is! ExamBankLoaded) return;
    final currentState = state as ExamBankLoaded;

    emit(currentState.copyWith(
      searchQuery: event.query,
      isLoadingMore: false,
    ));

    add(LoadExamsEvent());
  }

  // 3. CẬP NHẬT BỘ LỌC TRẠNG THÁI VÀ TẢI LẠI TRANG 1
  Future<void> _onFilterStatusChanged(
    FilterStatusChangedEvent event,
    Emitter<ExamBankState> emit,
  ) async {
    if (state is! ExamBankLoaded) return;
    final currentState = state as ExamBankLoaded;

    emit(currentState.copyWith(
      filterStatus: event.status,
      isLoadingMore: false,
    ));

    add(LoadExamsEvent());
  }

  // 4. XÓA ĐỀ THI
  Future<void> _onDeleteExam(
    DeleteExamEvent event,
    Emitter<ExamBankState> emit,
  ) async {
    if (state is! ExamBankLoaded) return;
    final currentState = state as ExamBankLoaded;

    // Bật cờ isDeleting (để hiện loading xoay xoay ở Modal nếu cần)
    emit(currentState.copyWith(isDeleting: true));

    final result = await deleteBankExamUseCase(event.examId);

    result.fold(
      (failure) {
        // Xóa thất bại -> Phát Toast Error
        emit(
          currentState.copyWith(
            isDeleting: false,
            toastMessage: "Xóa đề thi thất bại: ${failure.message}",
            toastType: "error",
          ),
        );
      },
      (_) {
        // Xóa thành công -> Phát Toast Success và gọi lại API làm mới danh sách
        emit(
          currentState.copyWith(
            isDeleting: false,
            toastMessage: "Xóa đề thi thành công!",
            toastType: "success",
          ),
        );

        // Gọi lại sự kiện LoadExams để lấy danh sách mới nhất từ server
        add(LoadExamsEvent());
      },
    );
  }

  // 5. XÓA THÔNG BÁO TOAST
  void _onClearToast(ClearToastEvent event, Emitter<ExamBankState> emit) {
    if (state is ExamBankLoaded) {
      emit((state as ExamBankLoaded).copyWith(clearToast: true));
    }
  }
}
