import 'package:dartz/dartz.dart';
import '../../../../../core/error/failures.dart';
import '../entities/result_item_entity.dart';
import '../repositories/student_results_repository.dart';

class GetMyResultsUseCase {
  final StudentResultsRepository repository;

  GetMyResultsUseCase(this.repository);

  Future<Either<Failure, List<ResultItemEntity>>> call() async {
    return await repository.getMyResults();
  }
}
