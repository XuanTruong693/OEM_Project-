import '../../domain/entities/exam_entity.dart';

abstract class InstructorExamsState {}

class InstructorExamsInitial extends InstructorExamsState {}

class InstructorExamsLoading extends InstructorExamsState {}

class InstructorExamsLoaded extends InstructorExamsState {
  final List<ExamEntity> exams;
  InstructorExamsLoaded({required this.exams});
}

class InstructorExamsError extends InstructorExamsState {
  final String message;
  InstructorExamsError(this.message);
}
