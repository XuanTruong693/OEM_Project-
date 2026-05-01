// File nay giup tai file mau tu thu muc assets va mo hop thoai luu tren Android/iOS
import 'dart:io';
import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

class AssetExporter {
  /// Hàm trích xuất file từ thư mục assets và mở hộp thoại lưu
  /// [fileName] là tên file bao gồm cả đuôi, ví dụ: 'Mau_De_Import.xlsx'
  static Future<void> exportAndShare(String fileName) async {
    try {
      // 1. Đọc dữ liệu thô (bytes) của file từ gói Assets
      final assetPath = 'assets/files/$fileName';
      final byteData = await rootBundle.load(assetPath);

      // 2. Tìm thư mục tạm (Cache Directory) của điện thoại để làm nơi giải nén
      final tempDir = await getTemporaryDirectory();
      final tempPath = '${tempDir.path}/$fileName';
      final tempFile = File(tempPath);

      // 3. Ghi dữ liệu bytes ra file tạm đó
      final buffer = byteData.buffer;
      await tempFile.writeAsBytes(
        buffer.asUint8List(byteData.offsetInBytes, byteData.lengthInBytes),
        flush: true, // Đảm bảo dữ liệu được ghi hoàn tất vào bộ nhớ vật lý
      );

      // 4. Kích hoạt hộp thoại chia sẻ/lưu file nguyên bản của Android/iOS
      await Share.shareXFiles(
        [XFile(tempFile.path)],
        subject:
            'File mẫu: $fileName', // Tiêu đề khi chia sẻ qua email/tin nhắn
      );
    } catch (e) {
      // Ném lỗi ra để UI bắt được và báo cho người dùng
      throw Exception("Không thể xử lý file mẫu: $e");
    }
  }
}
