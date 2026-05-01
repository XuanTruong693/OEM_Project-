import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/instructor_submission_entity.dart';
import '../repositories/instructor_repository.dart';

class GetSubmissionsUseCase {
  final InstructorRepository repository;

  GetSubmissionsUseCase(this.repository);

  Future<Either<Failure, List<InstructorSubmissionEntity>>> call() {
    return repository.getSubmissions();
  }
}
