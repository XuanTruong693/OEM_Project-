import 'package:flutter/material.dart';
import '../../domain/entities/exam_entity.dart';

class InstructorExamCard extends StatelessWidget {
  final ExamEntity exam;
  final VoidCallback onEdit;
  final VoidCallback onPreview;

  const InstructorExamCard({
    super.key,
    required this.exam,
    required this.onEdit,
    required this.onPreview,
  });

  // --- CÁC HÀM XỬ LÝ LOGIC UI ---
  // 👉 NÂNG CẤP: Truyền thêm timeOpen và timeClose vào hàm này
  Map<String, dynamic> _getStatusLabel(
    String? status,
    String? timeOpenStr,
    String? timeCloseStr,
  ) {
    if (status == null || status == 'draft') {
      return {
        'text': 'Nháp',
        'color': Colors.grey.shade600,
        'bg': Colors.grey.shade100,
      };
    }

    // 👉 LOGIC THỜI GIAN THỰC ĐƯỢC CHUYỂN TỪ WEB SANG ĐÂY
    if (status == 'published') {
      final now = DateTime.now();
      final openDate = timeOpenStr != null
          ? DateTime.tryParse(timeOpenStr)
          : null;
      final closeDate = timeCloseStr != null
          ? DateTime.tryParse(timeCloseStr)
          : null;

      if (closeDate != null && now.isAfter(closeDate)) {
        return {
          'text': 'Đã đóng',
          'color': Colors.red.shade700,
          'bg': Colors.red.shade100,
        };
      }
      if (openDate != null && now.isBefore(openDate)) {
        return {
          'text': 'Sắp mở',
          'color': Colors.amber.shade700,
          'bg': Colors.amber.shade100,
        };
      }
      return {
        'text': 'Đang mở',
        'color': Colors.green.shade700,
        'bg': Colors.green.shade100,
      };
    }

    if (status == 'closed') {
      return {
        'text': 'Đã đóng',
        'color': Colors
            .red
            .shade700, // Đổi sang đỏ cho đồng bộ với logic đóng ở trên
        'bg': Colors.red.shade100,
      };
    }

    return {
      'text': status,
      'color': Colors.grey.shade600,
      'bg': Colors.grey.shade100,
    };
  }

  String _formatDate(String? dateString) {
    if (dateString == null) return '';
    try {
      final date = DateTime.parse(dateString).toLocal();
      return "${date.hour}:${date.minute.toString().padLeft(2, '0')} ${date.day}/${date.month}/${date.year}";
    } catch (e) {
      return dateString;
    }
  }

  Widget _buildInfoBadge(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.grey.shade600),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // 👉 GỌI HÀM VÀ TRUYỀN THÊM DỮ LIỆU THỜI GIAN TỪ EXAM VÀO
    final status = _getStatusLabel(exam.status, exam.timeOpen, exam.timeClose);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Tiêu đề & Trạng thái
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      exam.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Mã phòng: ${exam.examRoomCode ?? '—'}",
                      style: TextStyle(
                        color: Colors.grey.shade500,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: status['bg'],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  status['text'],
                  style: TextStyle(
                    color: status['color'],
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Thời gian & Thông tin
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildInfoBadge(Icons.access_time, "${exam.duration} phút"),
              if (exam.timeOpen != null)
                _buildInfoBadge(
                  Icons.play_circle_outline,
                  "Mở: ${_formatDate(exam.timeOpen)}",
                ),
              if (exam.timeClose != null)
                _buildInfoBadge(
                  Icons.stop_circle_outlined,
                  "Đóng: ${_formatDate(exam.timeClose)}",
                ),
            ],
          ),
          const SizedBox(height: 12),

          // Các nút hành động
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: onEdit,
                child: const Text(
                  "Chỉnh sửa",
                  style: TextStyle(color: Colors.blue),
                ),
              ),
              TextButton(
                onPressed: onPreview,
                child: Text(
                  "Xem trước",
                  style: TextStyle(color: Colors.grey.shade700),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
