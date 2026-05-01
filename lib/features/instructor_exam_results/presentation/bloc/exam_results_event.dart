abstract class ExamResultsEvent {}

class LoadExamsEvent extends ExamResultsEvent {
  final String? initialExamId;
  LoadExamsEvent({this.initialExamId});
}

class SelectExamEvent extends ExamResultsEvent {
  final String examId;
  SelectExamEvent(this.examId);
}

class ReloadResultsEvent extends ExamResultsEvent {}

class SearchQueryChangedEvent extends ExamResultsEvent {
  final String query;
  SearchQueryChangedEvent(this.query);
}

class StatusFilterChangedEvent extends ExamResultsEvent {
  final String status;
  StatusFilterChangedEvent(this.status);
}

class ApproveAllScoresEvent extends ExamResultsEvent {
  final String examId;
  ApproveAllScoresEvent(this.examId);
}
