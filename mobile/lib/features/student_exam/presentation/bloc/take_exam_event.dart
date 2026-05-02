import 'package:equatable/equatable.dart';

abstract class TakeExamEvent extends Equatable {
  const TakeExamEvent();

  @override
  List<Object?> get props => [];
}

class LoadExamQuestionsEvent extends TakeExamEvent {
  final String submissionId;
  const LoadExamQuestionsEvent({required this.submissionId});

  @override
  List<Object?> get props => [submissionId];
}

class SaveAnswerEvent extends TakeExamEvent {
  final String submissionId;
  final String questionId;
  final dynamic answer; // string for essay, int or array for MCQ
  const SaveAnswerEvent({
    required this.submissionId,
    required this.questionId,
    required this.answer,
  });

  @override
  List<Object?> get props => [submissionId, questionId, answer];
}

class CheatEvent extends TakeExamEvent {
  final String submissionId;
  final String key;
  final String description;
  const CheatEvent({
    required this.submissionId,
    required this.key,
    required this.description,
  });

  @override
  List<Object?> get props => [submissionId, key, description];
}

class CheckPingAndSyncEvent extends TakeExamEvent {
  final String submissionId;
  const CheckPingAndSyncEvent({required this.submissionId});

  @override
  List<Object?> get props => [submissionId];
}

class SubmitExamEvent extends TakeExamEvent {
  final String submissionId;
  const SubmitExamEvent({required this.submissionId});

  @override
  List<Object?> get props => [submissionId];
}
