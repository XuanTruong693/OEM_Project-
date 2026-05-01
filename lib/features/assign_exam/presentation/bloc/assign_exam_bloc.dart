import 'dart:io';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/usecases/parse_exam_file_use_case.dart';
import '../../domain/usecases/commit_exam_use_case.dart';
import 'assign_exam_event.dart';
import 'assign_exam_state.dart';

class AssignExamBloc extends Bloc<AssignExamEvent, AssignExamState> {
  final ParseExamFileUseCase parseExamFileUseCase;
  final CommitExamUseCase commitExamUseCase;

  // Lưu trữ tạm thời file đang xử lý để phòng hờ trường hợp cần chọn Sheet
  File? _currentFile;

  AssignExamBloc({
    required this.parseExamFileUseCase,
    required this.commitExamUseCase,
  }) : super(AssignExamInitial()) {
    on<PickFileEvent>(_onPickFile);
    on<SheetSelectedEvent>(_onSheetSelected);
    on<CommitExamEvent>(_onCommitExam);
    on<ResetEvent>(_onReset);
  }

  // XỬ LÝ: KHI CÓ FILE MỚI ĐƯỢC CHỌN
  Future<void> _onPickFile(
    PickFileEvent event,
    Emitter<AssignExamState> emit,
  ) async {
    _currentFile = event.file;
    emit(AssignExamLoading(message: "Đang phân tích file..."));

    final result = await parseExamFileUseCase(event.file);

    result.fold((failure) => emit(AssignExamError(failure.message)), (data) {
      if (data.isMultipleSheets) {
        // Nếu file Excel có nhiều sheet, ra lệnh cho UI bật BottomSheet
        emit(
          AssignExamSheetSelectionRequired(
            file: event.file,
            availableSheets: data.availableSheets,
          ),
        );
      } else {
        // Bóc tách thành công ngay lập tức
        emit(AssignExamPreviewReady(file: event.file, data: data));
      }
    });
  }

  // XỬ LÝ: KHI NGƯỜI DÙNG CHỐT 1 SHEET TỪ BOTTOM SHEET
  Future<void> _onSheetSelected(
    SheetSelectedEvent event,
    Emitter<AssignExamState> emit,
  ) async {
    if (_currentFile == null) {
      emit(AssignExamError("Không tìm thấy file gốc. Vui lòng upload lại."));
      return;
    }

    emit(AssignExamLoading(message: "Đang đọc sheet '${event.sheetName}'..."));

    // Gọi lại UseCase nhưng lần này truyền thêm tên Sheet
    final result = await parseExamFileUseCase(
      _currentFile!,
      sheetName: event.sheetName,
    );

    result.fold(
      (failure) => emit(AssignExamError(failure.message)),
      (data) => emit(AssignExamPreviewReady(file: _currentFile!, data: data)),
    );
  }

  // XỬ LÝ: KHI BẤM NÚT LƯU ĐỀ THI
  Future<void> _onCommitExam(
    CommitExamEvent event,
    Emitter<AssignExamState> emit,
  ) async {
    // Chỉ cho phép lưu nếu đang ở trạng thái PreviewReady
    if (state is! AssignExamPreviewReady) return;

    final currentState = state as AssignExamPreviewReady;

    emit(AssignExamLoading(message: "Đang kiểm tra và lưu hệ thống..."));

    final result = await commitExamUseCase(
      data: currentState.data,
      title: event.title,
      duration: event.duration,
    );

    result.fold(
      (failure) {
        // Nếu thất bại (vd: Tổng điểm không bằng 10), trả về lại trạng thái Preview kèm theo Lỗi
        // Để UI không bị mất list câu hỏi cũ, mà chỉ hiện thêm popup lỗi.
        emit(AssignExamError(failure.message));

        // Phục hồi lại state Preview sau một tích tắc để người dùng sửa điểm
        emit(currentState);
      },
      (examId) {
        _currentFile = null; // Dọn dẹp RAM
        emit(AssignExamSuccess(examId));
      },
    );
  }

  // XỬ LÝ: BẤM NÚT RESET
  void _onReset(ResetEvent event, Emitter<AssignExamState> emit) {
    _currentFile = null;
    emit(AssignExamInitial());
  }
}
