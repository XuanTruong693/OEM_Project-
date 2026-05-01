import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../repositories/prepare_exam_repository.dart';

class CompareFacesUseCase {
  final PrepareExamRepository repository;

  CompareFacesUseCase(this.repository);

  Future<Either<Failure, Map<String, dynamic>>> call(
    String submissionId,
  ) async {
    return await repository.compareFaces(submissionId);
  }
}
