import 'package:dartz/dartz.dart';
import '../../../../../core/error/exceptions.dart';
import '../../../../../core/error/failures.dart';
import '../../domain/entities/result_detail_entity.dart';
import '../../domain/entities/result_item_entity.dart';
import '../../domain/repositories/student_results_repository.dart';
import '../datasources/student_results_remote_datasource.dart';

class StudentResultsRepositoryImpl implements StudentResultsRepository {
  final StudentResultsRemoteDataSource remoteDataSource;

  StudentResultsRepositoryImpl(this.remoteDataSource);

  // Mở ống nước truyền tín hiệu realtime lên tầng trên
  @override
  Stream<Map<String, dynamic>> get configUpdateStream =>
      remoteDataSource.configUpdateStream;

  @override
  Future<Either<Failure, List<ResultItemEntity>>> getMyResults() async {
    try {
      final results = await remoteDataSource.getMyResults();
      return Right(results);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return Left(ServerFailure('Đã xảy ra lỗi không xác định.'));
    }
  }

  @override
  Future<Either<Failure, ResultDetailEntity>> getResultDetail(
    String submissionId,
  ) async {
    try {
      final detail = await remoteDataSource.getResultDetail(submissionId);
      return Right(detail);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return Left(ServerFailure('Đã xảy ra lỗi không xác định.'));
    }
  }
}
