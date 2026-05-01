import '../../domain/entities/exam_detail_entity.dart';
import '../../domain/entities/question_entity.dart';

abstract class ExamEditorState {}

class ExamEditorInitial extends ExamEditorState {}

class ExamEditorLoading extends ExamEditorState {}

class ExamEditorLoaded extends ExamEditorState {
  final ExamDetailEntity exam;
  final Map<String, List<String>> validationErrors;

  // Trạng thái Lưu
  final bool isSaving;
  final String? saveError;
  final String?
  successMessage; // Để hiện Toast (Thêm thành công / Lưu thành công)

  // Trạng thái Excel Preview
  final List<QuestionEntity> previewQuestions;
  final Set<String> selectedPreviewIds; // Chứa ID các câu được tick chọn
  final String? previewMessage; // Chứa lỗi hoặc thông báo đọc file
  final bool isPreviewOpen;

  ExamEditorLoaded({
    required this.exam,
    this.validationErrors = const {},
    this.isSaving = false,
    this.saveError,
    this.successMessage,
    this.previewQuestions = const [],
    this.selectedPreviewIds = const {},
    this.previewMessage,
    this.isPreviewOpen = false,
  });

  ExamEditorLoaded copyWith({
    ExamDetailEntity? exam,
    Map<String, List<String>>? validationErrors,
    bool? isSaving,
    String? saveError,
    String? successMessage,
    List<QuestionEntity>? previewQuestions,
    Set<String>? selectedPreviewIds,
    String? previewMessage,
    bool? isPreviewOpen,
    bool clearSaveError = false,
    bool clearSuccessMessage = false,
    bool clearPreviewMessage = false,
  }) {
    return ExamEditorLoaded(
      exam: exam ?? this.exam,
      validationErrors: validationErrors ?? this.validationErrors,
      isSaving: isSaving ?? this.isSaving,
      saveError: clearSaveError ? null : (saveError ?? this.saveError),
      successMessage: clearSuccessMessage
          ? null
          : (successMessage ?? this.successMessage),
      previewQuestions: previewQuestions ?? this.previewQuestions,
      selectedPreviewIds: selectedPreviewIds ?? this.selectedPreviewIds,
      previewMessage: clearPreviewMessage
          ? null
          : (previewMessage ?? this.previewMessage),
      isPreviewOpen: isPreviewOpen ?? this.isPreviewOpen,
    );
  }
}

class ExamEditorError extends ExamEditorState {
  final String message;
  ExamEditorError(this.message);
}
