import 'package:flutter/material.dart';
import '../../domain/entities/open_exam_entity.dart';
import '../bloc/open_exam_state.dart'; // Import để dùng Extension OpenExamEntityX

class OpenExamCard extends StatelessWidget {
  final OpenExamEntity exam;
  final VoidCallback onTap;

  const OpenExamCard({super.key, required this.exam, required this.onTap});

  @override
  Widget build(BuildContext context) {
    // Gọi extension để lấy giai đoạn và nhãn tiếng Việt
    final phase = exam.phase;
    final phaseLabel = exam.phaseLabel;

    final bool isPublished = exam.status == 'published';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          // Hiệu ứng hover/tap màu xanh dương nhạt (sky-400 equivalent)
          highlightColor: Colors.lightBlue.withValues(alpha: 0.05),
          splashColor: Colors.lightBlue.withValues(alpha: 0.1),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Cột trái: Thông tin chính
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        exam.title.isNotEmpty ? exam.title : "Exam #${exam.id}",
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E293B), // slate-800
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Hàng Badges: Trạng thái & Giai đoạn
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          const Text(
                            "Trạng thái:",
                            style: TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                          _buildBadge(
                            isPublished ? "published" : "draft",
                            isPublished ? Colors.green : Colors.grey,
                          ),
                          _buildPhaseBadge(phase, phaseLabel),
                        ],
                      ),

                      const SizedBox(height: 8),

                      // Hàng Thời gian
                      Wrap(
                        spacing: 12,
                        runSpacing: 4,
                        children: [
                          if (exam.timeOpen != null)
                            _buildTimeText("Open: ", exam.timeOpen!),
                          if (exam.timeClose != null)
                            _buildTimeText("Close: ", exam.timeClose!),
                        ],
                      ),
                    ],
                  ),
                ),

                // Cột phải: Nút "Xem ->"
                const Padding(
                  padding: EdgeInsets.only(top: 4.0, left: 12.0),
                  child: Text(
                    "Xem \u2192", // Ký tự mũi tên ->
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF2563EB), // blue-600
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBadge(String text, MaterialColor colorBase) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: colorBase.shade50,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: colorBase.shade700,
        ),
      ),
    );
  }

  Widget _buildPhaseBadge(ExamPhase phase, String label) {
    Color bgColor;
    Color textColor;

    switch (phase) {
      case ExamPhase.opened:
        bgColor = Colors.green.shade50; // emerald-50
        textColor = Colors.green.shade700;
        break;
      case ExamPhase.closed:
        bgColor = Colors.red.shade50; // rose-50
        textColor = Colors.red.shade700;
        break;
      case ExamPhase.notOpened:
        bgColor = Colors.grey.shade100; // slate-100
        textColor = Colors.grey.shade700;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
      ),
    );
  }

  Widget _buildTimeText(String prefix, String dateString) {
    final dt = DateTime.tryParse(dateString);
    final formatted = dt != null
        ? "${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')} ${dt.day}/${dt.month}/${dt.year}"
        : dateString;

    return Text(
      "$prefix$formatted",
      style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
    );
  }
}
