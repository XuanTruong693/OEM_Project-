import '../../domain/entities/dashboard_stats_entity.dart';

class DashboardStatsModel extends DashboardStatsEntity {
  DashboardStatsModel({
    required super.totalExamsCreated,
    required super.totalTestsSubmitted,
    required super.totalStudentsParticipated,
  });

  factory DashboardStatsModel.fromJson(Map<String, dynamic> json) {
    return DashboardStatsModel(
      // Dùng tryParse an toàn phòng trường hợp Backend trả về String '6' thay vì số 6
      totalExamsCreated:
          int.tryParse(json['total_exams_created']?.toString() ?? '0') ?? 0,
      totalTestsSubmitted:
          int.tryParse(json['total_tests_submitted']?.toString() ?? '0') ?? 0,
      totalStudentsParticipated:
          int.tryParse(
            json['total_students_participated']?.toString() ?? '0',
          ) ??
          0,
    );
  }
}
