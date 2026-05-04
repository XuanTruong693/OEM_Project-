abstract class ResultDetailEvent {}

class LoadResultDetailEvent extends ResultDetailEvent {
  final String submissionId;
  LoadResultDetailEvent(this.submissionId);
}

class ResetResultDetailEvent extends ResultDetailEvent {}
