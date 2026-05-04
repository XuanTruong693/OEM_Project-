import 'package:dartz/dartz.dart';
import '../../../../../core/error/failures.dart';
import '../entities/student_profile_entity.dart';
import '../entities/student_result_entity.dart';

abstract class StudentDashboardRepository {
  Future<Either<Failure, List<StudentResultEntity>>> getMyResults();
  Future<Either<Failure, StudentProfileEntity>> getProfile();
}
