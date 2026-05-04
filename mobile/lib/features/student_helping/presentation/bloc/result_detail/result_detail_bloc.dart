import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/usecases/get_result_detail_usecase.dart';
import 'result_detail_event.dart';
import 'result_detail_state.dart';

class ResultDetailBloc extends Bloc<ResultDetailEvent, ResultDetailState> {
  final GetResultDetailUseCase getResultDetailUseCase;

  ResultDetailBloc({required this.getResultDetailUseCase})
    : super(ResultDetailInitial()) {
    on<LoadResultDetailEvent>(_onLoadDetail);
    on<ResetResultDetailEvent>((event, emit) => emit(ResultDetailInitial()));
  }

  Future<void> _onLoadDetail(
    LoadResultDetailEvent event,
    Emitter<ResultDetailState> emit,
  ) async {
    emit(ResultDetailLoading());
    final result = await getResultDetailUseCase(event.submissionId);

    result.fold(
      (failure) => emit(ResultDetailError(failure.message)),
      (detail) => emit(ResultDetailLoaded(detail)),
    );
  }
}
