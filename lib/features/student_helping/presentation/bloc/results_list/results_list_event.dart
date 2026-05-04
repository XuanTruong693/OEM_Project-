abstract class ResultsListEvent {}

class LoadMyResultsEvent extends ResultsListEvent {}

class SearchResultsEvent extends ResultsListEvent {
  final String query;
  SearchResultsEvent(this.query);
}

class SortResultsEvent extends ResultsListEvent {
  final String sortType;
  SortResultsEvent(this.sortType);
}

class UpdateConfigFromSocketEvent extends ResultsListEvent {
  final Map<String, dynamic> data;
  UpdateConfigFromSocketEvent(this.data);
}
