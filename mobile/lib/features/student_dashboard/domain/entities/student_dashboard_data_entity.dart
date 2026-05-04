import 'student_profile_entity.dart';
import 'student_result_entity.dart';
import 'student_stats_entity.dart';

class StudentDashboardDataEntity {
  final StudentProfileEntity profile;
  final List<StudentResultEntity> recentResults;
  final StudentStatsEntity stats;

  StudentDashboardDataEntity({
    required this.profile,
    required this.recentResults,
    required this.stats,
  });
}
