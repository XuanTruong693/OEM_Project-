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
    on<SearchExamEvent>(_onSearchExam);
    on<FilterStatusChangedEvent>(_onFilterStatusChanged);
    on<DeleteExamEvent>(_onDeleteExam);
    on<ClearToastEvent>(_onClearToast);
  }

  // 1. GỌI API LẤY DANH SÁCH ĐỀ THI
  Future<void> _onLoadExams(
    LoadExamsEvent event,
    Emitter<ExamBankState> emit,
  ) async {
    // Nếu đang có data cũ, giữ nguyên trạng thái Loaded để không chớp giật màn hình
    // Chỉ emit Loading nếu là lần đầu tiên vào trang (Initial) hoặc bị Error
    if (state is! ExamBankLoaded) {
      emit(ExamBankLoading());
    }

    final result =
        await getBankExamsUseCase(); // Lấy tất cả (để BLoC tự filter ở máy khách)

    result.fold((failure) => emit(ExamBankError(failure.message)), (exams) {
      if (state is ExamBankLoaded) {
        // Cập nhật lại danh sách mới nhưng giữ nguyên từ khóa tìm kiếm & filter hiện tại
        emit((state as ExamBankLoaded).copyWith(allExams: exams));
      } else {
        // Lần đầu tải thành công
        emit(ExamBankLoaded(allExams: exams));
      }
    });
  }

  // 2. CẬP NHẬT TỪ KHÓA TÌM KIẾM
  void _onSearchExam(SearchExamEvent event, Emitter<ExamBankState> emit) {
    if (state is ExamBankLoaded) {
      emit((state as ExamBankLoaded).copyWith(searchQuery: event.query));
    }
  }

  // 3. CẬP NHẬT BỘ LỌC TRẠNG THÁI
  void _onFilterStatusChanged(
    FilterStatusChangedEvent event,
    Emitter<ExamBankState> emit,
  ) {
    if (state is ExamBankLoaded) {
      emit((state as ExamBankLoaded).copyWith(filterStatus: event.status));
    }
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
