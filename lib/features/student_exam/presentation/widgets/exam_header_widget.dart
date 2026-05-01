import 'package:flutter/material.dart';
import '../../domain/entities/exam_info_entity.dart';

class ExamHeaderWidget extends StatelessWidget {
  final ExamInfoEntity? examInfo;

  const ExamHeaderWidget({Key? key, required this.examInfo}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (examInfo == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.white, Colors.blue.shade50.withOpacity(0.3)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.blue.shade100.withOpacity(0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.blue.shade900.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.assignment, color: Colors.blue.shade700, size: 24),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  examInfo!.title,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Colors.blue.shade900,
                    letterSpacing: -0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.person, color: Colors.grey.shade600, size: 18),
              const SizedBox(width: 6),
              Text(
                'Giảng viên: ',
                style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
              ),
              Text(
                examInfo!.instructorName,
                style: TextStyle(fontSize: 14, color: Colors.grey.shade800, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          const SizedBox(height: 14),
          Text(
            'Các yêu cầu xác minh:',
            style: TextStyle(fontSize: 13, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (examInfo!.requireFaceCheck)
                _buildTag('Khuôn mặt', Icons.face, Colors.purple),
              if (examInfo!.requireStudentCard)
                _buildTag('Thẻ SV', Icons.badge, Colors.orange),
              if (examInfo!.monitorScreen) 
                _buildTag('Giám sát', Icons.screen_lock_landscape, Colors.blue),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTag(String text, IconData icon, MaterialColor color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.shade200.withOpacity(0.8)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color.shade700),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              color: color.shade700,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
