import 'package:equatable/equatable.dart';

class TakeExamState extends Equatable {
  final bool isLoading;
  final String? errorMessage;
  final String? successMessage;
  final bool isSubmitting;
  final bool isSubmitted;

  final Map<String, dynamic>? examData; // Contains duration, title, etc.
  final List<dynamic> questions;
  final Map<String, dynamic> localAnswers; // questionId: chosenAnswer

  // Network & Ping stats
  final int pingMs;
  final String connectionStatus; // 'green' (<200), 'yellow' (<500), 'red' (>500 or offline)

  // Cheat tracking
  final int violations;
  final bool isBlurred;

  // Grade results
  final double? mcqScore;
  final double? aiScore;
  final double? totalScore;
  final bool showResultModal;

  const TakeExamState({
    this.isLoading = false,
    this.errorMessage,
    this.successMessage,
    this.isSubmitting = false,
    this.isSubmitted = false,
    this.examData,
    this.questions = const [],
    this.localAnswers = const {},
    this.pingMs = 0,
    this.connectionStatus = 'green',
    this.violations = 0,
    this.isBlurred = false,
    this.mcqScore,
    this.aiScore,
    this.totalScore,
    this.showResultModal = false,
  });

  TakeExamState copyWith({
    bool? isLoading,
    String? errorMessage,
    String? successMessage,
    bool? isSubmitting,
    bool? isSubmitted,
    Map<String, dynamic>? examData,
    List<dynamic>? questions,
    Map<String, dynamic>? localAnswers,
    int? pingMs,
    String? connectionStatus,
    int? violations,
    bool? isBlurred,
    double? mcqScore,
    double? aiScore,
    double? totalScore,
    bool? showResultModal,
  }) {
    return TakeExamState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage ?? this.errorMessage,
      successMessage: successMessage ?? this.successMessage,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isSubmitted: isSubmitted ?? this.isSubmitted,
      examData: examData ?? this.examData,
      questions: questions ?? this.questions,
      localAnswers: localAnswers ?? this.localAnswers,
      pingMs: pingMs ?? this.pingMs,
      connectionStatus: connectionStatus ?? this.connectionStatus,
      violations: violations ?? this.violations,
      isBlurred: isBlurred ?? this.isBlurred,
      mcqScore: mcqScore ?? this.mcqScore,
      aiScore: aiScore ?? this.aiScore,
      totalScore: totalScore ?? this.totalScore,
      showResultModal: showResultModal ?? this.showResultModal,
    );
  }

  @override
  List<Object?> get props => [
        isLoading,
        errorMessage,
        successMessage,
        isSubmitting,
        isSubmitted,
        examData,
        questions,
        localAnswers,
        pingMs,
        connectionStatus,
        violations,
        isBlurred,
        mcqScore,
        aiScore,
        totalScore,
        showResultModal,
      ];
}
