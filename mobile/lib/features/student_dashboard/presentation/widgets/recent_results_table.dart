import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/student_result_entity.dart';

class RecentResultsTable extends StatelessWidget {
  final List<StudentResultEntity> results;
  final VoidCallback onViewAll;

  const RecentResultsTable({
    super.key,
    required this.results,
    required this.onViewAll,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Tiêu đề & Nút Xem tất cả
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Kết quả gần đây',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E293B),
                ),
              ),
              TextButton(
                onPressed: onViewAll,
                child: const Text(
                  'Xem tất cả',
                  style: TextStyle(color: Colors.blue),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          if (results.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Text(
                'Chưa có kết quả nào.',
                style: TextStyle(color: Colors.grey),
              ),
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingTextStyle: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.grey,
                ),
                dataTextStyle: const TextStyle(color: Colors.black87),
                horizontalMargin: 12,
                columnSpacing: 24,
                columns: const [
                  DataColumn(label: Text('Bài thi')),
                  DataColumn(label: Text('MCQ')),
                  DataColumn(label: Text('Tự luận')),
                  DataColumn(label: Text('Tổng tạm')),
                  DataColumn(label: Text('Trạng thái')),
                  DataColumn(label: Text('Ngày nộp')),
                ],
                rows: results.take(6).map((r) {
                  final mcqScore = r.mcqScore ?? r.totalScore;
                  final essayScore = r.essayScore ?? r.aiScore;
                  final totalSuggested = r.suggestedTotalScore ?? r.totalScore;
                  final isConfirmed =
                      r.instructorConfirmed == 1 || r.status == 'confirmed';

                  // Format Date
                  String dateString = '-';
                  if (r.submittedAt != null) {
                    final dt = DateTime.tryParse(r.submittedAt!)?.toLocal();
                    if (dt != null) {
                      dateString = DateFormat('dd/MM/yyyy HH:mm').format(dt);
                    }
                  }

                  return DataRow(
                    cells: [
                      DataCell(
                        Text(
                          r.examTitle ?? r.examId ?? '-',
                          style: const TextStyle(fontWeight: FontWeight.w500),
                        ),
                      ),
                      DataCell(
                        Text(
                          mcqScore != null ? mcqScore.toStringAsFixed(1) : '-',
                        ),
                      ),
                      DataCell(
                        Text(
                          essayScore != null
                              ? essayScore.toStringAsFixed(1)
                              : '-',
                        ),
                      ),
                      DataCell(
                        Text(
                          totalSuggested != null
                              ? totalSuggested.toStringAsFixed(1)
                              : '-',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                      DataCell(
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: isConfirmed
                                ? Colors.green.shade50
                                : Colors.orange.shade50,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            isConfirmed ? '✓ Đã duyệt' : '⏳ Chưa duyệt',
                            style: TextStyle(
                              color: isConfirmed
                                  ? Colors.green.shade700
                                  : Colors.orange.shade700,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                      DataCell(Text(dateString)),
                    ],
                  );
                }).toList(),
              ),
            ),
        ],
      ),
    );
  }
}
