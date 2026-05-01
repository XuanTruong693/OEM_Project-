import 'package:flutter/material.dart';

class ExamToggleButton extends StatelessWidget {
  final bool checked;
  final ValueChanged<bool> onChange;

  const ExamToggleButton({
    super.key,
    required this.checked,
    required this.onChange,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChange(!checked),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 44,
        height: 24,
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: checked ? Colors.blue[600] : Colors.grey[300],
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 200),
          alignment: checked ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 20,
            height: 20,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black12,
                  blurRadius: 2,
                  offset: Offset(0, 1),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
