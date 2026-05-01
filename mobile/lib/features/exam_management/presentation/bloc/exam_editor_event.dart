abstract class ExamEditorEvent {}

// 1. Tải và Lưu
class LoadExamDetailEvent extends ExamEditorEvent {
  final String examId;
  LoadExamDetailEvent(this.examId);
}

class SaveExamEvent extends ExamEditorEvent {}

// 2. Chỉnh sửa thông tin cơ bản
class UpdateExamTitleEvent extends ExamEditorEvent {
  final String title;
  UpdateExamTitleEvent(this.title);
}

// 3. Thao tác Câu hỏi
class AddQuestionEvent extends ExamEditorEvent {
  final String type; // 'MCQ' hoặc 'essay'
  AddQuestionEvent(this.type);
}

class RemoveQuestionEvent extends ExamEditorEvent {
  final String questionId;
  RemoveQuestionEvent(this.questionId);
}

class UpdateQuestionContentEvent extends ExamEditorEvent {
  final String questionId;
  final String content;
  UpdateQuestionContentEvent(this.questionId, this.content);
}

class UpdateQuestionPointsEvent extends ExamEditorEvent {
  final String questionId;
  final double points;
  UpdateQuestionPointsEvent(this.questionId, this.points);
}

class UpdateModelAnswerEvent extends ExamEditorEvent {
  final String questionId;
  final String modelAnswer;
  UpdateModelAnswerEvent(this.questionId, this.modelAnswer);
}

// 4. Thao tác Đáp án (Options)
class AddOptionEvent extends ExamEditorEvent {
  final String questionId;
  AddOptionEvent(this.questionId);
}

class RemoveOptionEvent extends ExamEditorEvent {
  final String questionId;
  final String optionId;
  RemoveOptionEvent(this.questionId, this.optionId);
}

class UpdateOptionContentEvent extends ExamEditorEvent {
  final String questionId;
  final String optionId;
  final String content;
  UpdateOptionContentEvent(this.questionId, this.optionId, this.content);
}

class SetCorrectOptionEvent extends ExamEditorEvent {
  final String questionId;
  final String optionId;
  SetCorrectOptionEvent(this.questionId, this.optionId);
}

// 5. Thử thách Excel (Luồng Import)
class AnalyzeExcelFileEvent extends ExamEditorEvent {
  final List<int> bytes;
  AnalyzeExcelFileEvent(this.bytes);
}

class TogglePreviewSelectionEvent extends ExamEditorEvent {
  final String tempId;
  TogglePreviewSelectionEvent(this.tempId);
}

class AddSelectedPreviewQuestionsEvent extends ExamEditorEvent {}

class CancelPreviewEvent extends ExamEditorEvent {}
