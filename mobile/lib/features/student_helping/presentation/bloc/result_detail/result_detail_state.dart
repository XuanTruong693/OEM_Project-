import '../../../domain/entities/result_detail_entity.dart';

abstract class ResultDetailState {}

class ResultDetailInitial extends ResultDetailState {}

class ResultDetailLoading extends ResultDetailState {}

class ResultDetailError extends ResultDetailState {
  final String message;
  ResultDetailError(this.message);
}

class ResultDetailLoaded extends ResultDetailState {
  final ResultDetailEntity detail;
  ResultDetailLoaded(this.detail);
}
