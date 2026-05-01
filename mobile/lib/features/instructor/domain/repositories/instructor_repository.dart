import '../../../../core/error/failures.dart';
import '../entities/dashboard_stats_entity.dart';
import '../entities/instructor_student_entity.dart';
import '../entities/monthly_chart_entity.dart';
import '../entities/exam_entity.dart';
import '../entities/instructor_submission_entity.dart';
import 'package:dartz/dartz.dart';

abstract class InstructorRepository {
  Future<DashboardStatsEntity> getDashboardStats();
  Future<List<MonthlyChartEntity>> getMonthlyChartData();
  Future<List<ExamEntity>> getMyExams();
  Future<Either<Failure, List<InstructorSubmissionEntity>>> getSubmissions();
  Future<Either<Failure, List<InstructorStudentEntity>>> getStudents();
}
