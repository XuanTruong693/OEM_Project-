import 'package:flutter/material.dart';
import '../../domain/entities/exam_summary_entity.dart';

class SummaryStatsWidget extends StatelessWidget {
  final ExamSummaryEntity summary;

  const SummaryStatsWidget({super.key, required this.summary});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _buildStatCard("Tổng cộng", summary.total, Colors.blue),
        _buildStatCard("Trắc nghiệm", summary.mcq, Colors.green),
        _buildStatCard("Tự luận", summary.essay, Colors.purple),
        if (summary.errors > 0)
          _buildStatCard("Lỗi", summary.errors, Colors.red),
      ],
    );
  }

  Widget _buildStatCard(String label, int value, MaterialColor color) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color.shade50,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(
              value.toString(),
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: color.shade700,
              ),
            ),
            Text(label, style: TextStyle(fontSize: 10, color: color.shade700)),
          ],
        ),
      ),
    );
  }
}
