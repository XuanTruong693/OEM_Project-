import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/repositories/student_results_repository.dart';
import '../../../domain/usecases/filter_results_usecase.dart';
import '../../../domain/usecases/get_my_results_usecase.dart';
import 'results_list_event.dart';
import 'results_list_state.dart';

class ResultsListBloc extends Bloc<ResultsListEvent, ResultsListState> {
  final GetMyResultsUseCase getMyResultsUseCase;
  final FilterResultsUseCase filterResultsUseCase;
  final StudentResultsRepository repository;

  StreamSubscription? _socketSubscription;

  ResultsListBloc({
    required this.getMyResultsUseCase,
    required this.filterResultsUseCase,
    required this.repository,
  }) : super(ResultsListLoading()) {
    on<LoadMyResultsEvent>(_onLoadMyResults);
    on<SearchResultsEvent>(_onSearch);
    on<SortResultsEvent>(_onSort);
    on<UpdateConfigFromSocketEvent>(_onSocketUpdate);

    _socketSubscription = repository.configUpdateStream.listen((data) {
      add(UpdateConfigFromSocketEvent(data));
    });
  }

  Future<void> _onLoadMyResults(
    LoadMyResultsEvent event,
    Emitter<ResultsListState> emit,
  ) async {
    emit(ResultsListLoading());
    final result = await getMyResultsUseCase();

    result.fold((failure) => emit(ResultsListError(failure.message)), (
      results,
    ) {
      final filtered = filterResultsUseCase(
        FilterResultsParams(
          rawResults: results,
          searchQuery: '',
          sortType: 'date_desc',
        ),
      );
      emit(ResultsListLoaded(rawResults: results, filteredResults: filtered));
    });
  }

  void _onSearch(SearchResultsEvent event, Emitter<ResultsListState> emit) {
    if (state is ResultsListLoaded) {
      final currentState = state as ResultsListLoaded;
      final filtered = filterResultsUseCase(
        FilterResultsParams(
          rawResults: currentState.rawResults,
          searchQuery: event.query,
          sortType: currentState.sortType,
        ),
      );
      emit(
        currentState.copyWith(
          searchQuery: event.query,
          filteredResults: filtered,
        ),
      );
    }
  }

  void _onSort(SortResultsEvent event, Emitter<ResultsListState> emit) {
    if (state is ResultsListLoaded) {
      final currentState = state as ResultsListLoaded;
      final filtered = filterResultsUseCase(
        FilterResultsParams(
          rawResults: currentState.rawResults,
          searchQuery: currentState.searchQuery,
          sortType: event.sortType,
        ),
      );
      emit(
        currentState.copyWith(
          sortType: event.sortType,
          filteredResults: filtered,
        ),
      );
    }
  }

  void _onSocketUpdate(
    UpdateConfigFromSocketEvent event,
    Emitter<ResultsListState> emit,
  ) {
    if (state is ResultsListLoaded) {
      final currentState = state as ResultsListLoaded;
      final data = event.data;

      final examId = data['examId']?.toString() ?? data['id']?.toString();
      final allowViewAnswers = data['allow_view_answers'];

      if (examId != null && allowViewAnswers != null) {
        final bool isAllowed =
            allowViewAnswers == 1 || allowViewAnswers == true;

        final updatedRaw = currentState.rawResults.map((r) {
          if (r.examId == examId)
            return r.copyWith(allowViewAnswers: isAllowed);
          return r;
        }).toList();

        final filtered = filterResultsUseCase(
          FilterResultsParams(
            rawResults: updatedRaw,
            searchQuery: currentState.searchQuery,
            sortType: currentState.sortType,
          ),
        );

        emit(
          currentState.copyWith(
            rawResults: updatedRaw,
            filteredResults: filtered,
          ),
        );
      }
    }
  }

  @override
  Future<void> close() {
    _socketSubscription?.cancel();
    return super.close();
  }
}
