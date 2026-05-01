import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/open_exam_entity.dart';
import '../../domain/repositories/open_exam_repository.dart';
import '../datasources/open_exam_remote_data_source.dart';

class OpenExamRepositoryImpl implements OpenExamRepository {
  final OpenExamRemoteDataSource remoteDataSource;

  OpenExamRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Failure, List<OpenExamEntity>>> getOpenExams() async {
    try {
      final result = await remoteDataSource.getOpenExams();
      return Right(result);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
