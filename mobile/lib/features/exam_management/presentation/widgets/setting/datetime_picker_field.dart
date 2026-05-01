import 'package:flutter/material.dart';

class DateTimePickerField extends StatelessWidget {
  final String label;
  final DateTime currentValue;
  final DateTime? minimumDate;
  final ValueChanged<DateTime> onChanged;

  const DateTimePickerField({
    super.key,
    required this.label,
    required this.currentValue,
    required this.onChanged,
    this.minimumDate,
  });

  // Tách riêng hàm chọn Ngày
  Future<void> _pickDate(BuildContext context) async {
    final DateTime? pickedDate = await showDatePicker(
      context: context,
      initialDate: currentValue,
      firstDate: minimumDate ?? DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (pickedDate != null) {
      // Giữ nguyên Giờ hiện tại, chỉ cập nhật Ngày
      final newDateTime = DateTime(
        pickedDate.year,
        pickedDate.month,
        pickedDate.day,
        currentValue.hour,
        currentValue.minute,
      );
      onChanged(newDateTime);
    }
  }

  // Tách riêng hàm chọn Giờ
  Future<void> _pickTime(BuildContext context) async {
    final TimeOfDay? pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(currentValue),
    );
    if (pickedTime != null) {
      // Giữ nguyên Ngày hiện tại, chỉ cập nhật Giờ
      final newDateTime = DateTime(
        currentValue.year,
        currentValue.month,
        currentValue.day,
        pickedTime.hour,
        pickedTime.minute,
      );
      onChanged(newDateTime);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Format chuỗi hiển thị
    final dateStr =
        "${currentValue.day.toString().padLeft(2, '0')}/${currentValue.month.toString().padLeft(2, '0')}/${currentValue.year}";
    final timeStr =
        "${currentValue.hour.toString().padLeft(2, '0')}:${currentValue.minute.toString().padLeft(2, '0')}";

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Color(0xFF334155),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            // Nút Chọn Ngày (Chiếm 60% chiều rộng)
            Expanded(
              flex: 3,
              child: InkWell(
                onTap: () => _pickDate(context),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: Colors.grey[300]!),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(dateStr, style: const TextStyle(fontSize: 15)),
                      Icon(
                        Icons.calendar_today,
                        size: 18,
                        color: Colors.blue[600],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Nút Chọn Giờ (Chiếm 40% chiều rộng)
            Expanded(
              flex: 2,
              child: InkWell(
                onTap: () => _pickTime(context),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: Colors.grey[300]!),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(timeStr, style: const TextStyle(fontSize: 15)),
                      Icon(
                        Icons.access_time,
                        size: 18,
                        color: Colors.blue[600],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
