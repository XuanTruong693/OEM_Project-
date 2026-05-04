import 'package:dartz/dartz.dart';
import '../../../../../core/error/failures.dart';
import '../entities/result_detail_entity.dart';
import '../repositories/student_results_repository.dart';

class GetResultDetailUseCase {
  final StudentResultsRepository repository;

  GetResultDetailUseCase(this.repository);

  Future<Either<Failure, ResultDetailEntity>> call(String submissionId) async {
    return await repository.getResultDetail(submissionId);
  }
}
