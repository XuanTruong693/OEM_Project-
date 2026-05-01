import 'package:flutter/material.dart';
import 'exam_toggle_button.dart';

class LabeledToggle extends StatelessWidget {
  final IconData icon;
  final String label;
  final String description;
  final bool checked;
  final ValueChanged<bool> onChange;

  const LabeledToggle({
    super.key,
    required this.icon,
    required this.label,
    required this.description,
    required this.checked,
    required this.onChange,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              shape: BoxShape.circle,
              border: Border.all(color: Colors.grey[200]!),
            ),
            child: Icon(icon, size: 20, color: Colors.grey[400]),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF334155),
                  ),
                ),
                Text(
                  description,
                  style: TextStyle(fontSize: 13, color: Colors.grey[500]),
                ),
              ],
            ),
          ),
          ExamToggleButton(checked: checked, onChange: onChange),
        ],
      ),
    );
  }
}
