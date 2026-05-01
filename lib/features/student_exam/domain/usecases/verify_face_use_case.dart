import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../repositories/prepare_exam_repository.dart';

class VerifyFaceUseCase {
  final PrepareExamRepository repository;

  VerifyFaceUseCase(this.repository);

  Future<Either<Failure, Map<String, dynamic>>> call(
    String submissionId,
    String faceImagePath,
  ) async {
    return await repository.verifyFace(submissionId, faceImagePath);
  }
}
