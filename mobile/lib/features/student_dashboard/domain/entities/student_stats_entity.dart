class StudentStatsEntity {
  final int totalExams;
  final double bestScore;
  final double averageScore;
  final int passRate;

  // Dữ liệu cho biểu đồ 7 ngày (fl_chart sẽ dùng cái này)
  final List<int> chartDataTotal;
  final List<double> chartDataAvg;
  final List<double> chartDataBest;
  final List<double> chartDataRecent;

  StudentStatsEntity({
    required this.totalExams,
    required this.bestScore,
    required this.averageScore,
    required this.passRate,
    required this.chartDataTotal,
    required this.chartDataAvg,
    required this.chartDataBest,
    required this.chartDataRecent,
  });
}
