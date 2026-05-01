import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../repositories/prepare_exam_repository.dart';

class VerifyStudentCodeUseCase {
  final PrepareExamRepository repository;

  VerifyStudentCodeUseCase(this.repository);

  Future<Either<Failure, Map<String, dynamic>>> call(
    String submissionId,
    String studentCode,
  ) async {
    return await repository.verifyStudentCode(submissionId, studentCode);
  }
}
