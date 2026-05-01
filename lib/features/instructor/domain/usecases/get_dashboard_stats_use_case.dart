import '../entities/dashboard_stats_entity.dart';
import '../repositories/instructor_repository.dart';

class GetDashboardStatsUseCase {
  final InstructorRepository repository;

  GetDashboardStatsUseCase(this.repository);

  Future<DashboardStatsEntity> call() async {
    return await repository.getDashboardStats();
  }
}
