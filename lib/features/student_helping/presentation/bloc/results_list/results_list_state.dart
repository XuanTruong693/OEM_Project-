import '../../../domain/entities/result_item_entity.dart';

abstract class ResultsListState {}

class ResultsListLoading extends ResultsListState {}

class ResultsListError extends ResultsListState {
  final String message;
  ResultsListError(this.message);
}

class ResultsListLoaded extends ResultsListState {
  final List<ResultItemEntity> rawResults;
  final List<ResultItemEntity> filteredResults;
  final String searchQuery;
  final String sortType;

  ResultsListLoaded({
    required this.rawResults,
    required this.filteredResults,
    this.searchQuery = '',
    this.sortType = 'date_desc',
  });

  ResultsListLoaded copyWith({
    List<ResultItemEntity>? rawResults,
    List<ResultItemEntity>? filteredResults,
    String? searchQuery,
    String? sortType,
  }) {
    return ResultsListLoaded(
      rawResults: rawResults ?? this.rawResults,
      filteredResults: filteredResults ?? this.filteredResults,
      searchQuery: searchQuery ?? this.searchQuery,
      sortType: sortType ?? this.sortType,
    );
  }
}
