import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../repositories/prepare_exam_repository.dart';

class UploadVerifiedImagesUseCase {
  final PrepareExamRepository repository;

  UploadVerifiedImagesUseCase(this.repository);

  Future<Either<Failure, Map<String, dynamic>>> call(
    String submissionId,
    String? facePath,
    String? cardPath,
  ) async {
    return await repository.uploadVerifiedImages(
      submissionId,
      facePath,
      cardPath,
    );
  }
}
