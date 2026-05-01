import 'package:flutter/material.dart';

class ConfirmDeleteDialog extends StatelessWidget {
  final VoidCallback onConfirm;

  const ConfirmDeleteDialog({super.key, required this.onConfirm});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: Colors.red, size: 28),
          SizedBox(width: 8),
          Text(
            "Xóa câu hỏi",
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
        ],
      ),
      content: const Text(
        "Bạn có chắc chắn muốn xóa câu hỏi này? Hành động này không thể hoàn tác.",
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(), // Đóng dialog
          child: const Text("Hủy", style: TextStyle(color: Colors.grey)),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.red,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          onPressed: () {
            onConfirm(); // Gọi hàm xóa
            Navigator.of(context).pop(); // Đóng dialog
          },
          child: const Text("Xóa", style: TextStyle(color: Colors.white)),
        ),
      ],
    );
  }
}
