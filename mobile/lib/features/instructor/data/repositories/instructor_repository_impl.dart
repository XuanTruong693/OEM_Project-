import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../../domain/entities/dashboard_stats_entity.dart';
import '../../domain/entities/instructor_student_entity.dart';
import '../../domain/entities/monthly_chart_entity.dart';
import '../../domain/entities/exam_entity.dart';
import '../../domain/entities/instructor_submission_entity.dart';
import '../../domain/repositories/instructor_repository.dart';
import '../datasources/instructor_remote_data_source.dart';

class InstructorRepositoryImpl implements InstructorRepository {
  final InstructorRemoteDataSource remoteDataSource;

  InstructorRepositoryImpl({required this.remoteDataSource});

  @override
  Future<DashboardStatsEntity> getDashboardStats() async {
    // Model kế thừa Entity nên trả về trực tiếp được
    return await remoteDataSource.getDashboardStats();
  }

  @override
  Future<List<MonthlyChartEntity>> getMonthlyChartData() async {
    return await remoteDataSource.getMonthlyChartData();
  }

  @override
  Future<List<ExamEntity>> getMyExams() async {
    return await remoteDataSource.getMyExams();
  }

  @override
  Future<Either<Failure, List<InstructorSubmissionEntity>>>
  getSubmissions() async {
    try {
      final result = await remoteDataSource.getSubmissions();
      return Right(result);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, List<InstructorStudentEntity>>> getStudents() async {
    try {
      final result = await remoteDataSource.getStudents();
      return Right(result);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
