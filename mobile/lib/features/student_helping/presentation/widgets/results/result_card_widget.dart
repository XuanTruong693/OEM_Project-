import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../domain/entities/result_item_entity.dart';

class ResultCardWidget extends StatelessWidget {
  final ResultItemEntity result;
  final VoidCallback onViewAnswers;

  const ResultCardWidget({
    super.key,
    required this.result,
    required this.onViewAnswers,
  });

  // Tương đương hàm getScoreBadge bên React
  Map<String, dynamic> _getScoreBadge(double? score) {
    if (score == null) {
      return {
        'label': '-',
        'color': Colors.grey,
        'bgColor': Colors.grey.shade100,
        'icon': '○',
      };
    }
    if (score >= 8) {
      return {
        'label': score.toStringAsFixed(1),
        'color': Colors.teal.shade600,
        'bgColor': Colors.teal.shade50,
        'icon': '🏆',
        'grade': 'Xuất sắc',
      };
    }
    if (score >= 5) {
      return {
        'label': score.toStringAsFixed(1),
        'color': Colors.orange.shade600,
        'bgColor': Colors.orange.shade50,
        'icon': '⭐',
        'grade': 'Đạt',
      };
    }
    return {
      'label': score.toStringAsFixed(1),
      'color': Colors.red.shade600,
      'bgColor': Colors.red.shade50,
      'icon': '○',
      'grade': 'Chưa đạt',
    };
  }

  @override
  Widget build(BuildContext context) {
    final isConfirmed =
        result.instructorConfirmed == 1 || result.status == 'confirmed';
    final mcq = result.mcqScore ?? result.totalScore;
    final essay = result.essayScore ?? result.aiScore;
    final total = result.suggestedTotalScore ?? ((mcq ?? 0) + (essay ?? 0));

    final totalBadge = _getScoreBadge(total);
    final mcqBadge = _getScoreBadge(mcq);
    final essayBadge = _getScoreBadge(essay);

    // Format ngày
    String dateStr = '-';
    final dt = DateTime.tryParse(result.submittedAt);
    if (dt != null) dateStr = DateFormat('dd/MM/yyyy').format(dt.toLocal());

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Header (Icon + Title + Status)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.blue.shade50, Colors.indigo.shade50],
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  totalBadge['icon'],
                  style: const TextStyle(fontSize: 24),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      result.examTitle.isNotEmpty
                          ? result.examTitle
                          : 'Bài thi #${result.examId}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(
                          Icons.calendar_today,
                          size: 12,
                          color: Colors.grey,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          dateStr,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: isConfirmed
                                ? Colors.green.shade50
                                : Colors.orange.shade50,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isConfirmed
                                  ? Colors.green.shade200
                                  : Colors.orange.shade200,
                            ),
                          ),
                          child: Text(
                            isConfirmed ? '✓ Đã duyệt' : '⏳ Chưa duyệt',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: isConfirmed
                                  ? Colors.green.shade700
                                  : Colors.orange.shade700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1),
          ),

          // 2. Scores Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildScoreColumn('Trắc nghiệm', mcqBadge),
              _buildScoreColumn('Tự luận', essayBadge),
              Container(width: 1, height: 32, color: Colors.grey.shade200),
              _buildScoreColumn('Tổng điểm', totalBadge, isTotal: true),
            ],
          ),

          // 3. Button Xem đáp án (Ẩn/Hiện dựa vào allowViewAnswers)
          if (result.allowViewAnswers) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onViewAnswers,
                icon: const Icon(Icons.check_circle_outline, size: 18),
                label: const Text('Xem đáp án chi tiết'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue.shade600,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildScoreColumn(
    String title,
    Map<String, dynamic> badge, {
    bool isTotal = false,
  }) {
    return Column(
      children: [
        Text(
          title,
          style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
        ),
        const SizedBox(height: 4),
        Text(
          badge['label'],
          style: TextStyle(
            fontSize: isTotal ? 24 : 18,
            fontWeight: FontWeight.bold,
            color: badge['color'],
          ),
        ),
        if (isTotal && badge['grade'] != null) ...[
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: badge['bgColor'],
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              badge['grade'],
              style: TextStyle(
                fontSize: 10,
                color: badge['color'],
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
