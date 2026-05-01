import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/exam_management_repository.dart';
import 'exam_preview_event.dart';
import 'exam_preview_state.dart';

class ExamPreviewBloc extends Bloc<ExamPreviewEvent, ExamPreviewState> {
  final ExamManagementRepository repository;

  ExamPreviewBloc({required this.repository}) : super(ExamPreviewInitial()) {
    on<LoadExamPreviewDataEvent>(_onLoadData);
    on<CheckAndOpenRoomEvent>(_onCheckAndOpenRoom);
    on<CloseWarningModalEvent>(_onCloseModal);
    on<PurgeAndOpenEvent>(_onPurgeAndOpen);
    on<CloneAndEditEvent>(_onCloneAndEdit);
  }

  // 1. GỌI 2 API CÙNG LÚC KHI VÀO TRANG
  Future<void> _onLoadData(
    LoadExamPreviewDataEvent event,
    Emitter<ExamPreviewState> emit,
  ) async {
    emit(ExamPreviewLoading());

    final previewResult = await repository.getExamPreview(event.examId);

    // 👉 ĐÃ SỬA: Thêm chữ "await" ở đây để Bloc đợi toàn bộ tiến trình này kết thúc
    await previewResult.fold(
      (failure) async {
        // Thêm async ở đây cho đồng bộ
        emit(ExamPreviewError(failure.message));
      },
      (examData) async {
        // Lấy Preview thành công, tiếp tục gọi Summary
        final summaryResult = await repository.getExamSummary(event.examId);

        summaryResult.fold(
          (failure) =>
              emit(ExamPreviewError("Lỗi tải thống kê: ${failure.message}")),
          (summaryData) {
            // Cả 2 đều thành công -> Bật trạng thái Loaded
            emit(
              ExamPreviewLoaded(
                exam: examData,
                totalSubmissions: summaryData.totalSubmissions,
              ),
            );
          },
        );
      },
    );
  }

  // 2. LOGIC KIỂM TRA ĐIỀU KIỆN MỞ PHÒNG (Bản sao 1:1 từ React)
  void _onCheckAndOpenRoom(
    CheckAndOpenRoomEvent event,
    Emitter<ExamPreviewState> emit,
  ) {
    if (state is! ExamPreviewLoaded) return;
    final currentState = state as ExamPreviewLoaded;

    final hasData =
        currentState.totalSubmissions > 0 ||
        currentState.exam.status == 'published';

    if (hasData) {
      // Có rủi ro -> Bật cảnh báo
      emit(
        currentState.copyWith(showWarningModal: true, clearModalError: true),
      );
    } else {
      // An toàn -> Chuyển trang Settings ngay
      emit(currentState.copyWith(navigateToSettings: true));
    }
  }

  // 3. ĐÓNG MODAL
  void _onCloseModal(
    CloseWarningModalEvent event,
    Emitter<ExamPreviewState> emit,
  ) {
    if (state is! ExamPreviewLoaded) return;
    emit(
      (state as ExamPreviewLoaded).copyWith(
        showWarningModal: false,
        clearModalError: true,
      ),
    );
  }

  // 4. CHẤP NHẬN XÓA (PURGE)
  Future<void> _onPurgeAndOpen(
    PurgeAndOpenEvent event,
    Emitter<ExamPreviewState> emit,
  ) async {
    if (state is! ExamPreviewLoaded) return;
    final currentState = state as ExamPreviewLoaded;

    emit(currentState.copyWith(modalBusy: true, clearModalError: true));

    final result = await repository.purgeExamData(event.examId);

    result.fold(
      (failure) {
        // Thất bại: Tắt xoay, hiện chữ đỏ trong modal
        emit(
          currentState.copyWith(
            modalBusy: false,
            modalError: "Không thể xóa dữ liệu: ${failure.message}",
          ),
        );
      },
      (_) {
        // Thành công: Tắt modal, ra lệnh chuyển trang settings
        emit(
          currentState.copyWith(
            modalBusy: false,
            showWarningModal: false,
            navigateToSettings: true,
          ),
        );
      },
    );
  }

  // 5. TẠO BẢN SAO (CLONE)
  Future<void> _onCloneAndEdit(
    CloneAndEditEvent event,
    Emitter<ExamPreviewState> emit,
  ) async {
    if (state is! ExamPreviewLoaded) return;
    final currentState = state as ExamPreviewLoaded;

    emit(currentState.copyWith(modalBusy: true, clearModalError: true));

    final result = await repository.cloneExam(event.examId);

    result.fold(
      (failure) {
        emit(
          currentState.copyWith(
            modalBusy: false,
            modalError: "Không thể tạo bản sao: ${failure.message}",
          ),
        );
      },
      (newExamId) {
        // Thành công: Đóng modal, phát tín hiệu kèm ID mới để giao diện nhảy sang trang Edit
        emit(
          currentState.copyWith(
            modalBusy: false,
            showWarningModal: false,
            cloneNewExamId: newExamId,
          ),
        );
      },
    );
  }
}
