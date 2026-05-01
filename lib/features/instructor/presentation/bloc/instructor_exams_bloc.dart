import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_my_exams_use_case.dart';
import 'instructor_exams_event.dart';
import 'instructor_exams_state.dart';

class InstructorExamsBloc
    extends Bloc<InstructorExamsEvent, InstructorExamsState> {
  final GetMyExamsUseCase getMyExamsUseCase;

  InstructorExamsBloc({required this.getMyExamsUseCase})
    : super(InstructorExamsInitial()) {
    on<LoadMyExamsEvent>(_onLoadMyExams);
  }

  Future<void> _onLoadMyExams(
    LoadMyExamsEvent event,
    Emitter<InstructorExamsState> emit,
  ) async {
    emit(InstructorExamsLoading());
    try {
      final exams = await getMyExamsUseCase.call();
      emit(InstructorExamsLoaded(exams: exams));
    } catch (e) {
      emit(InstructorExamsError(e.toString()));
    }
  }
}
