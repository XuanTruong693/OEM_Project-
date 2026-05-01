import 'package:flutter/material.dart';
import '../../domain/entities/exam_bank_entity.dart';
import '../bloc/exam_bank_state.dart'; // Để dùng Extension isInProgress

class ExamBankCard extends StatelessWidget {
  final ExamBankEntity exam;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onPreview;

  const ExamBankCard({
    super.key,
    required this.exam,
    required this.onEdit,
    required this.onDelete,
    required this.onPreview,
  });

  @override
  Widget build(BuildContext context) {
    final bool inProgress = exam.isInProgress;
    final bool isDraft = exam.status == 'draft';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  exam.title,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
              ),
              // Status Badge
              _buildStatusBadge(isDraft),
            ],
          ),
          const SizedBox(height: 12),

          // Row 2: Room Code & Status Info
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              _buildInfoItem(Icons.tag, exam.examRoomCode ?? "Chưa mở phòng"),
              _buildInfoItem(
                Icons.history,
                "Đã tạo: ${_formatSimpleDate(exam.createdAt)}",
              ),
            ],
          ),

          if (inProgress) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                "⚠️ Đang thi, không thể chỉnh sửa/xóa.",
                style: TextStyle(
                  color: Colors.amber.shade900,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],

          const Divider(height: 32, color: Color(0xFFF5F5F5)),

          // Actions Row
          Row(
            children: [
              if (!inProgress) ...[
                _buildActionButton(
                  Icons.edit_outlined,
                  "Sửa",
                  Colors.blue,
                  onEdit,
                ),
                const SizedBox(width: 8),
                _buildActionButton(
                  Icons.delete_outline,
                  "Xóa",
                  Colors.red,
                  onDelete,
                ),
              ] else
                _buildActionButton(
                  Icons.visibility_outlined,
                  "Xem đề",
                  Colors.teal,
                  onPreview,
                ),

              const Spacer(),

              // Hiển thị thời gian Open/Close nhỏ bên dưới
              if (exam.timeOpen != null)
                Text(
                  "Hết hạn: ${_formatSimpleDate(exam.timeClose)}",
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(bool isDraft) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isDraft ? Colors.grey.shade100 : Colors.blue.shade50,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        isDraft ? "Nháp" : "Đã mở",
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: isDraft ? Colors.grey.shade700 : Colors.blue.shade700,
        ),
      ),
    );
  }

  Widget _buildInfoItem(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.grey.shade400),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
      ],
    );
  }

  Widget _buildActionButton(
    IconData icon,
    String label,
    Color color,
    VoidCallback onTap,
  ) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatSimpleDate(String? date) {
    if (date == null) return "—";
    final dt = DateTime.tryParse(date);
    if (dt == null) return date;
    return "${dt.day}/${dt.month} ${dt.hour}:${dt.minute}";
  }
}
