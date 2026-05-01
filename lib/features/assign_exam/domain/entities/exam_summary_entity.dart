class ExamSummaryEntity {
  final int total;
  final int mcq;
  final int essay;
  final int errors;

  const ExamSummaryEntity({
    required this.total,
    required this.mcq,
    required this.essay,
    required this.errors,
  });
}
