import '../../domain/entities/dashboard_stats_entity.dart';
import '../../domain/entities/monthly_chart_entity.dart';

abstract class InstructorDashboardState {}

class DashboardInitial extends InstructorDashboardState {}

class DashboardLoading extends InstructorDashboardState {}

class DashboardLoaded extends InstructorDashboardState {
  final DashboardStatsEntity stats;
  final List<MonthlyChartEntity> monthlyData;
  final String fullName;
  final String avatar;
  final List<String> examIds;

  DashboardLoaded({
    required this.stats,
    required this.monthlyData,
    required this.fullName,
    required this.avatar,
    this.examIds = const [],
  });
}

class DashboardError extends InstructorDashboardState {
  final String message;
  DashboardError(this.message);
}
