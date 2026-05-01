import '../entities/monthly_chart_entity.dart';
import '../repositories/instructor_repository.dart';

class GetMonthlyChartUseCase {
  final InstructorRepository repository;

  GetMonthlyChartUseCase(this.repository);

  Future<List<MonthlyChartEntity>> call() async {
    return await repository.getMonthlyChartData();
  }
}
