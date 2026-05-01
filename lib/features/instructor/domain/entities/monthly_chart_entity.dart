class MonthlyChartEntity {
  final String month; // Sẽ format thành "T1", "T2"...
  final int examsCreated;
  final int studentsParticipated;

  MonthlyChartEntity({
    required this.month,
    required this.examsCreated,
    required this.studentsParticipated,
  });
}
