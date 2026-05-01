import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/exam_bank_entity.dart';
import '../../domain/repositories/exam_bank_repository.dart';
import '../datasources/exam_bank_remote_data_source.dart';

class ExamBankRepositoryImpl implements ExamBankRepository {
  final ExamBankRemoteDataSource remoteDataSource;

  ExamBankRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Failure, List<ExamBankEntity>>> getExams({
    int page = 1,
    int limit = 10,
    String? search,
    String? status,
  }) async {
    try {
      final result = await remoteDataSource.getExams(
        page: page,
        limit: limit,
        search: search,
        status: status,
      );
      return Right(result);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> deleteExam(String id) async {
    try {
      await remoteDataSource.deleteExam(id);
      return const Right(null);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
