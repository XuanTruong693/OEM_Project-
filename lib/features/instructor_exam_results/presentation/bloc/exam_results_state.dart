import '../../domain/entities/exam_result_entity.dart';
import '../../domain/entities/exam_summary_entity.dart';

abstract class ExamResultsState {}

class ExamResultsInitial extends ExamResultsState {}

class ExamResultsLoading extends ExamResultsState {}

class ExamResultsLoaded extends ExamResultsState {
  final List<Map<String, dynamic>> exams;
  final String? selectedExamId;
  final ExamSummaryEntity? summary;
  final List<ExamResultEntity> allResults;
  final List<ExamResultEntity> filteredResults;
  final String searchQuery;
  final String statusFilter; // 'all', 'confirmed', 'graded', 'pending'

  ExamResultsLoaded({
    required this.exams,
    this.selectedExamId,
    this.summary,
    required this.allResults,
    required this.filteredResults,
    this.searchQuery = '',
    this.statusFilter = 'all',
  });

  ExamResultsLoaded copyWith({
    List<Map<String, dynamic>>? exams,
    String? selectedExamId,
    ExamSummaryEntity? summary,
    List<ExamResultEntity>? allResults,
    List<ExamResultEntity>? filteredResults,
    String? searchQuery,
    String? statusFilter,
  }) {
    return ExamResultsLoaded(
      exams: exams ?? this.exams,
      selectedExamId: selectedExamId ?? this.selectedExamId,
      summary: summary ?? this.summary,
      allResults: allResults ?? this.allResults,
      filteredResults: filteredResults ?? this.filteredResults,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
    );
  }
}

class ExamResultsError extends ExamResultsState {
  final String message;
  ExamResultsError(this.message);
}
