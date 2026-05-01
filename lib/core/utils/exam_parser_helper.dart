// Onley use for REVIEW EXAM funtionality, not for ASSIGN EXAM

class ExamParserHelper {
  /// Phân tách nội dung câu hỏi và đáp án mẫu (chuyển thể từ splitQA của React)
  /// Sử dụng Dart Records để trả về 2 giá trị {stem, model} giống Javascript
  static ({String stem, String model}) splitQA(
    String? questionText,
    String? modelAnswer,
  ) {
    final text = (questionText ?? "").trim();
    final direct = (modelAnswer ?? "").trim();
    final markers = ["câu trả lời:", "cau tra loi:", "answer:"];
    final lower = text.toLowerCase();

    int cut = -1;
    int markerLen = 0;

    // Tìm vị trí xuất hiện của các từ khóa đánh dấu
    for (final m in markers) {
      final i = lower.indexOf(m);
      if (i >= 0) {
        cut = i;
        markerLen = m.length;
        break;
      }
    }

    // Trường hợp 1: Nếu đã có sẵn model_answer từ database (ưu tiên dùng cái này)
    if (direct.isNotEmpty) {
      if (cut >= 0) {
        return (stem: text.substring(0, cut).trim(), model: direct);
      }
      return (stem: text, model: direct);
    }

    // Trường hợp 2: model_answer rỗng, phải tự bóc tách từ question_text
    if (cut >= 0) {
      // RegExp(r'[\s:]+$') xóa tất cả khoảng trắng và dấu hai chấm ở cuối câu hỏi
      final stem = text
          .substring(0, cut)
          .trim()
          .replaceAll(RegExp(r'[\s:]+$'), '');
      final model = text.substring(cut + markerLen).trim();
      return (stem: stem, model: model);
    }

    // Trường hợp 3: Không có từ khóa, không có đáp án -> Trả về nguyên gốc
    return (stem: text, model: "");
  }

  /// Kiểm tra xem đề thi có đang trong thời gian mở cửa không (chuyển thể từ isInProgress)
  static bool isInProgress(
    String? status,
    String? timeOpenStr,
    String? timeCloseStr,
  ) {
    // Nếu chưa xuất bản thì chắc chắn chưa mở
    if (status != 'published') {
      return false;
    }

    final now = DateTime.now();
    // Chuyển đổi chuỗi String (ISO 8601) từ API sang đối tượng DateTime an toàn
    final open = timeOpenStr != null ? DateTime.tryParse(timeOpenStr) : null;
    final close = timeCloseStr != null ? DateTime.tryParse(timeCloseStr) : null;

    // Nếu có cài giờ mở mà chưa tới giờ -> không tính là đang mở
    if (open != null && now.isBefore(open)) return false;

    // Nếu có cài giờ đóng mà đã qua giờ -> không tính là đang mở (Đã đóng thi)
    if (close != null && now.isAfter(close)) return false;

    // Còn lại là đang mở (Trong khoảng thời gian, hoặc không có giới hạn)
    return true;
  }
}
