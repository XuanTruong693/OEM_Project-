import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/exam_info_entity.dart';
import '../repositories/prepare_exam_repository.dart';

class GetExamPublicInfoUseCase {
  final PrepareExamRepository repository;

  GetExamPublicInfoUseCase(this.repository);

  Future<Either<Failure, ExamInfoEntity>> call(int examId) async {
    return await repository.getExamPublicInfo(examId);
  }
}
