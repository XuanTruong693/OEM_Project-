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
  final String? reason; // 'time', 'violation', 'kicked', etc.
  const SubmitExamEvent({required this.submissionId, this.reason});

  @override
  List<Object?> get props => [submissionId, reason];
}

class StudentKickedEvent extends TakeExamEvent {
  final String message;
  const StudentKickedEvent({required this.message});

  @override
  List<Object?> get props => [message];
}

class ExamConfigUpdatedEvent extends TakeExamEvent {
  final Map<String, dynamic> updates;
  const ExamConfigUpdatedEvent({required this.updates});

  @override
  List<Object?> get props => [updates];
}

