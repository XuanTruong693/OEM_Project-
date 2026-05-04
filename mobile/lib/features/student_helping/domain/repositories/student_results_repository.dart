import 'package:dartz/dartz.dart';
import '../../../../../core/error/failures.dart';
import '../entities/result_detail_entity.dart';
import '../entities/result_item_entity.dart';

abstract class StudentResultsRepository {
  Stream<Map<String, dynamic>> get configUpdateStream;

  Future<Either<Failure, List<ResultItemEntity>>> getMyResults();
  Future<Either<Failure, ResultDetailEntity>> getResultDetail(
    String submissionId,
  );
}
