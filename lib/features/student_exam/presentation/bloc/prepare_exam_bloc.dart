import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/storage/secure_storage_helper.dart';
import '../../domain/usecases/join_exam_use_case.dart';
import 'prepare_exam_event.dart';
import 'prepare_exam_state.dart';

class PrepareExamBloc extends Bloc<PrepareExamEvent, PrepareExamState> {
  final JoinExamUseCase joinExamUseCase;

  PrepareExamBloc({required this.joinExamUseCase})
    : super(PrepareExamInitial()) {
    // Đăng ký lắng nghe sự kiện Auto-Join
    on<AutoJoinExamEvent>(_onAutoJoinExam);
  }

  Future<void> _onAutoJoinExam(
    AutoJoinExamEvent event,
    Emitter<PrepareExamState> emit,
  ) async {
    emit(PrepareExamLoading()); // Vòng xoay xoay

    // Gọi API thông qua UseCase
    final result = await joinExamUseCase(event.roomToken);

    // Xử lý kết quả
    await result.fold(
      (failure) async {
        // Trái: Thất bại (ném lỗi ra cho UI)
        emit(PrepareExamJoinFailure(message: failure.message));
      },
      (entity) async {
        // Phải: Thành công (lưu Két sắt và báo UI)
        try {
          // Lưu submission_id
          await SecureStorageHelper.saveSubmissionId(entity.submissionId);

          // 👉 SỬA LẠI Ở ĐÂY
          await SecureStorageHelper.saveExamFlagsFromJson(entity.flags);
        } catch (e) {
          // Bỏ qua lỗi parse JSON nếu có
        }

        emit(
          PrepareExamJoinSuccess(
            submissionId: entity.submissionId,
            examId: entity.examId,
          ),
        );
      },
    );
  }
}
