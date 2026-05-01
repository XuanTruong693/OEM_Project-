import '../../domain/entities/monthly_chart_entity.dart';

class MonthlyChartModel extends MonthlyChartEntity {
  MonthlyChartModel({
    required super.month,
    required super.examsCreated,
    required super.studentsParticipated,
  });

  factory MonthlyChartModel.fromJson(Map<String, dynamic> json) {
    return MonthlyChartModel(
      // Giống React: Format sẵn chữ "T" (Tháng) cho UI dễ hiển thị
      month: 'T${json['month'] ?? ''}',
      examsCreated: int.tryParse(json['exams_created']?.toString() ?? '0') ?? 0,
      studentsParticipated:
          int.tryParse(json['students_participated']?.toString() ?? '0') ?? 0,
    );
  }
}
