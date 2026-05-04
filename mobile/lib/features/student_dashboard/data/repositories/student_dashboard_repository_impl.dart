import 'package:dartz/dartz.dart';
import '../../../../../core/error/exceptions.dart';
import '../../../../../core/error/failures.dart';
import '../../domain/entities/student_result_entity.dart';
import '../../domain/entities/student_profile_entity.dart';
import '../../domain/repositories/student_dashboard_repository.dart';
import '../datasources/student_dashboard_remote_datasource.dart';

class StudentDashboardRepositoryImpl implements StudentDashboardRepository {
  final StudentDashboardRemoteDataSource remoteDataSource;

  StudentDashboardRepositoryImpl(this.remoteDataSource);

  @override
  Future<Either<Failure, List<StudentResultEntity>>> getMyResults() async {
    try {
      final results = await remoteDataSource.getMyResults();
      return Right(results);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return Left(ServerFailure('Đã xảy ra lỗi không xác định'));
    }
  }

  @override
  Future<Either<Failure, StudentProfileEntity>> getProfile() async {
    try {
      final profile = await remoteDataSource.getProfile();
      return Right(profile);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return Left(ServerFailure('Đã xảy ra lỗi không xác định'));
    }
  }
}
