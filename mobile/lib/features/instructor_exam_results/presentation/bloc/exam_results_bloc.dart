import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import '../../data/datasources/exam_results_remote_datasource.dart';
import '../../domain/entities/exam_result_entity.dart';
import 'exam_results_event.dart';
import 'exam_results_state.dart';

class ExamResultsBloc extends Bloc<ExamResultsEvent, ExamResultsState> {
  final ExamResultsRemoteDataSource _dataSource;
  Timer? _pollingTimer;

  ExamResultsBloc(this._dataSource) : super(ExamResultsInitial()) {
    on<LoadExamsEvent>(_onLoadExams);
    on<SelectExamEvent>(_onSelectExam);
    on<ReloadResultsEvent>(_onReloadResults);
    on<SearchQueryChangedEvent>(_onSearchQueryChanged);
    on<StatusFilterChangedEvent>(_onStatusFilterChanged);
    on<ApproveAllScoresEvent>(_onApproveAllScores);
    on<DeleteSubmissionEvent>(_onDeleteSubmission);
  }

  @override
  Future<void> close() {
    _pollingTimer?.cancel();
    return super.close();
  }

  void _startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      add(ReloadResultsEvent());
    });
  }

  Future<void> _onLoadExams(LoadExamsEvent event, Emitter<ExamResultsState> emit) async {
    emit(ExamResultsLoading());
    try {
      final exams = await _dataSource.getMyExams();
      if (exams.isEmpty) {
        emit(ExamResultsLoaded(
          exams: [],
          allResults: [],
          filteredResults: [],
        ));
        return;
      }

      String? selectedId = event.initialExamId;
      if (selectedId == null || !exams.any((e) => e['id'].toString() == selectedId)) {
        final published = exams.where((e) => e['status'] == 'published').toList();
        selectedId = published.isNotEmpty ? published.first['id'].toString() : exams.first['id'].toString();
      }

      add(SelectExamEvent(selectedId));
    } on DioException catch (e) {
      emit(ExamResultsError(e.message ?? "Lỗi kết nối mạng"));
    } catch (e) {
      emit(ExamResultsError("Đã xảy ra lỗi: $e"));
    }
  }

  Future<void> _onSelectExam(SelectExamEvent event, Emitter<ExamResultsState> emit) async {
    final currentState = state;
    List<Map<String, dynamic>> exams = [];
    if (currentState is ExamResultsLoaded) {
      exams = currentState.exams;
    } else {
      try {
        exams = await _dataSource.getMyExams();
      } catch (_) {}
    }

    emit(ExamResultsLoading());

    try {
      final summary = await _dataSource.getExamSummary(event.examId);
      final results = await _dataSource.getExamResults(event.examId);

      // Tính tổng số gian lận từ tất cả sinh viên
      final totalViolations = results.fold<num>(0, (sum, r) => sum + (r.cheatingCount ?? 0));
      final updatedSummary = summary?.copyWith(totalViolations: totalViolations);

      emit(ExamResultsLoaded(
        exams: exams,
        selectedExamId: event.examId,
        summary: updatedSummary,
        allResults: results,
        filteredResults: _applyFilters(results, '', 'all'),
      ));

      _startPolling();
    } on DioException catch (e) {
      emit(ExamResultsError(e.message ?? "Lỗi khi lấy dữ liệu"));
    } catch (e) {
      emit(ExamResultsError("Đã xảy ra lỗi: $e"));
    }
  }

  Future<void> _onReloadResults(ReloadResultsEvent event, Emitter<ExamResultsState> emit) async {
    if (state is ExamResultsLoaded) {
      final currentState = state as ExamResultsLoaded;
      if (currentState.selectedExamId == null) return;

      try {
        final summary = await _dataSource.getExamSummary(currentState.selectedExamId!);
        final results = await _dataSource.getExamResults(currentState.selectedExamId!);

        // Check if there are changes to avoid unnecessary rebuilds
        if (results.length != currentState.allResults.length ||
            summary?.submittedCount != currentState.summary?.submittedCount) {
          
          final totalViolations = results.fold<num>(0, (sum, r) => sum + (r.cheatingCount ?? 0));
          final updatedSummary = summary?.copyWith(totalViolations: totalViolations);

          emit(currentState.copyWith(
            summary: updatedSummary,
            allResults: results,
            filteredResults: _applyFilters(results, currentState.searchQuery, currentState.statusFilter),
          ));
        }
      } catch (e) {
        // Silent fail on polling error
        print("Polling error: $e");
      }
    }
  }

  void _onSearchQueryChanged(SearchQueryChangedEvent event, Emitter<ExamResultsState> emit) {
    if (state is ExamResultsLoaded) {
      final currentState = state as ExamResultsLoaded;
      final filtered = _applyFilters(currentState.allResults, event.query, currentState.statusFilter);
      emit(currentState.copyWith(
        searchQuery: event.query,
        filteredResults: filtered,
      ));
    }
  }

  void _onStatusFilterChanged(StatusFilterChangedEvent event, Emitter<ExamResultsState> emit) {
    if (state is ExamResultsLoaded) {
      final currentState = state as ExamResultsLoaded;
      final filtered = _applyFilters(currentState.allResults, currentState.searchQuery, event.status);
      emit(currentState.copyWith(
        statusFilter: event.status,
        filteredResults: filtered,
      ));
    }
  }

  Future<void> _onApproveAllScores(ApproveAllScoresEvent event, Emitter<ExamResultsState> emit) async {
    try {
      await _dataSource.approveAllScores(event.examId);
      add(SelectExamEvent(event.examId)); // Refresh data
    } catch (e) {
      emit(ExamResultsError("Lỗi duyệt điểm: $e"));
    }
  }

  Future<void> _onDeleteSubmission(DeleteSubmissionEvent event, Emitter<ExamResultsState> emit) async {
    try {
      await _dataSource.deleteStudentExamRecord(event.examId, event.studentId);
      add(SelectExamEvent(event.examId)); // Refresh data
    } catch (e) {
      emit(ExamResultsError("Lỗi xóa bài thi: $e"));
    }
  }


  List<ExamResultEntity> _applyFilters(List<ExamResultEntity> all, String query, String status) {
    var result = all;
    if (query.isNotEmpty) {
      final q = query.toLowerCase();
      result = result.where((e) {
        return (e.studentName?.toLowerCase().contains(q) ?? false) ||
               (e.studentId?.toLowerCase().contains(q) ?? false);
      }).toList();
    }

    if (status != 'all') {
      result = result.where((e) => e.status?.toLowerCase() == status.toLowerCase()).toList();
    }

    // Default sort by Name A-Z
    result.sort((a, b) => (a.studentName ?? '').compareTo(b.studentName ?? ''));
    return result;
  }
}
