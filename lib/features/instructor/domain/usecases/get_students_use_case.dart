import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/instructor_student_entity.dart';
import '../repositories/instructor_repository.dart';

class GetStudentsUseCase {
  final InstructorRepository repository;

  GetStudentsUseCase(this.repository);

  Future<Either<Failure, List<InstructorStudentEntity>>> call() {
    return repository.getStudents();
  }
}
