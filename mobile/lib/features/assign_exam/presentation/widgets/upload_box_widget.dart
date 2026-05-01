import 'dart:io';
import 'package:flutter/material.dart';

class UploadBoxWidget extends StatelessWidget {
  final File? selectedFile;
  final VoidCallback onTap;

  const UploadBoxWidget({
    super.key,
    required this.selectedFile,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(24),
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selectedFile != null
                ? Colors.blue.shade400
                : Colors.grey.shade300,
            width: 2,
            // Mẹo: Trong thực tế bạn có thể dùng package dotted_border để vẽ nét đứt
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              selectedFile != null
                  ? Icons.insert_drive_file
                  : Icons.cloud_upload_outlined,
              size: 48,
              color: selectedFile != null
                  ? Colors.blue.shade600
                  : Colors.grey.shade400,
            ),
            const SizedBox(height: 12),
            if (selectedFile != null) ...[
              Text(
                selectedFile!.path.split('/').last,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.blue,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                "${(selectedFile!.lengthSync() / 1024).toStringAsFixed(2)} KB",
                style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
              ),
            ] else ...[
              const Text(
                "Nhấn để chọn file",
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 4),
              Text(
                "Hỗ trợ: .xlsx, .xls, .docx, .pdf",
                style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
