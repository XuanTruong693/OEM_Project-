import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/submit_exam_setting_use_case.dart';
import 'exam_setting_event.dart';
import 'exam_setting_state.dart';

class ExamSettingBloc extends Bloc<ExamSettingEvent, ExamSettingState> {
  final SubmitExamSettingUseCase submitExamSettingUseCase;

  ExamSettingBloc({required this.submitExamSettingUseCase})
    : super(ExamSettingInitial()) {
    on<SubmitSettingEvent>(_onSubmitSetting);
  }

  Future<void> _onSubmitSetting(
    SubmitSettingEvent event,
    Emitter<ExamSettingState> emit,
  ) async {
    emit(ExamSettingLoading());

    final result = await submitExamSettingUseCase(event.examId, event.entity);

    result.fold(
      (failure) {
        emit(ExamSettingFailure(failure.message));
      },
      (roomCode) {
        emit(ExamSettingSuccess(roomCode));
      },
    );
  }
}
