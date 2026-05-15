class ViolationDictionary {
  static const Map<String, String> hardRulesDict = {
    'escape': "Cố tình nhấn phím ESC để thoát chế độ Toàn màn hình.",
    'f11': "Nhấn F11 để can thiệp kích thước màn hình thi.",
    'f5': "Cố tình làm mới (Tải lại) trang bài thi nhằm vượt mặt hệ thống.",
    'f12': "Cố tình mở Công cụ lập trình (DevTools) hòng can thiệp bài thi.",
    'printscreen': "Nhấn phím cứng PrintScreen chụp ảnh đề thi.",
    'meta+shift+s': "Mở công cụ cắt/chụp ảnh màn hình (Snipping Tool) của Windows.",
    'alt+printscreen': "Chụp ảnh nhanh một cấu trúc cửa sổ ứng dụng.",
    'alt+tab': "Nhấn phím tắt Alt+Tab để chuyển nhanh sang ứng dụng/tài liệu khác.",
    'alt+f4': "Nhấn Alt+F4 để cố tình đóng cửa sổ trình duyệt thi.",
    'meta+d': "Nhanh chóng thu nhỏ toàn bộ bài thi để về Màn hình chính (Win+D / Desktop).",
    'meta+p': "Kích hoạt Bảng chia sẻ màn hình phụ (Win+P / Project) hòng phát đề thi ra ngoài.",
    'meta_key': "Nhấn phím Windows kết hợp Click chuột vào Taskbar hoặc ứng dụng khác để thoát bài thi.",
    'copy_attempt': "Thực hiện thao tác sao chép (Copy / Ctrl+C) nội dung từ bài thi ra ngoài.",
    'paste_attempt': "Thực hiện thao tác dán (Paste / Ctrl+V) nội dung từ bên ngoài vào bài thi.",
    'drag_drop_in': "Kéo thả văn bản/tài liệu từ cửa sổ bên ngoài vào ô trả lời bài thi.",
    'fullscreen_lost': "Thoát khỏi chế độ thi Toàn màn hình.",
    'visibility_hidden': "Ẩn tab bài thi xuống (Mở một cửa sổ khác đè lên trên).",
    'window_blur': "Click chuột ra ngoài cửa sổ trình duyệt thi.",
    'multiple_screens_connected': "Phát hiện kết nối nhiều màn hình (Dual monitor).",
    'screenshot_attempt': "Sử dụng lối tắt ngăn chặn hoặc phần mềm hệ thống để chụp màn hình bài thi.",
  };

  static const Map<String, String> typeMap = {
    'copy_attempt': "SAO CHÉP NỘI DUNG",
    'paste_attempt': "DÁN DỮ LIỆU",
    'drag_drop_in': "KÉO THẢ TÀI LIỆU",
    'screenshot_attempt': "CỐ TÌNH CHỤP ẢNH",
    'blocked_key': "DÙNG PHÍM CẤM",
    'visibility_hidden': "ẨN HOẶC ĐỔI TAB BÀI THI",
    'fullscreen_lost': "THOÁT TOÀN MÀN HÌNH",
    'window_blur': "RỜI BỎ KHU VỰC THI (MẤT FOCUS)",
    'tab_switch': "LIÊN TỤC ĐỔI TAB",
    'alt_tab': "CHUYỂN ỨNG DỤNG (ALT+TAB)",
    'multiple_faces': "CÓ NGƯỜI LẠ TRONG CAMERA",
    'no_face_detected': "KHÔNG THẤY THÍ SINH",
    'inactivity': "BỎ MÁY TRONG THỜI GIAN DÀI",
    'split_screen': "CHIA ĐÔI MÀN HÌNH",
    'ai_detected_cheating': "TỔNG HỢP HÀNH VI ĐÁNG NGỜ",
    'devtools_attempt': "MỞ CÔNG CỤ LẬP TRÌNH (DEVTOOLS)",
    'multi_monitor_attempt': "DÙNG NHIỀU MÀN HÌNH",
    'mouse_outside': "CHUỘT RỜI KHU VỰC BÀI THI",
    'typing_speed_violation': "TỐC ĐỘ GÕ PHÍM BẤT THƯỜNG (DÙNG TOOL)",
    'screen_share_stopped': "NGẮT CHIA SẺ MÀN HÌNH GỌI THI",
    'prolonged_away': "VẮNG MẶT QUÁ LÂU (>15 GIÂY)",
  };

  static String getDynamicViolationTitle(String eventType, {String? keyId}) {
    if (eventType == "blocked_key" && keyId != null && keyId.isNotEmpty) {
      final k = keyId.toLowerCase();
      switch (k) {
        case "f12": return "MỞ CÔNG CỤ LẬP TRÌNH (F12)";
        case "f11": return "CAN THIỆP KÍCH THƯỚC MÀN HÌNH (F11)";
        case "escape": return "THOÁT TOÀN MÀN HÌNH (ESC)";
        case "f5": return "LÀM MỚI BÀI THI (F5)";
        case "alt+tab": return "CHUYỂN ỨNG DỤNG BẰNG PHÍM (ALT+TAB)";
        case "meta+d": return "ẨN NHANH RA DESKTOP (WIN+D)";
        case "meta+p": return "KẾT NỐI MÀN HÌNH PHỤ (WIN+P)";
        case "alt+f4": return "ĐÓNG CỬA SỔ TRÌNH DUYỆT (ALT+F4)";
        case "printscreen": return "CHỤP ẢNH BÀI THI (PRINTSCREEN)";
        case "copy": return "SAO CHÉP NỘI DUNG (CTRL+C)";
        case "drag_drop": return "KÉO THẢ TÀI LIỆU VÀO BÀI THI";
        case "ctrl+v": return "DÁN NỘI DUNG (CTRL+V)";
        default: return "DÙNG PHÍM BỊ CHẶN (${k.toUpperCase()})";
      }
    }
    
    return typeMap[eventType] ?? eventType.replaceAll('_', ' ').toUpperCase();
  }

  static String getDynamicViolationReason(String eventType, {String? keyId, String? defaultMsg}) {
    if (defaultMsg != null && defaultMsg.isNotEmpty) return defaultMsg;

    if (eventType == "blocked_key" && keyId != null && keyId.isNotEmpty) {
      final reason = hardRulesDict[keyId.toLowerCase()];
      if (reason != null) return reason;
    }
    
    final generalReason = hardRulesDict[eventType];
    if (generalReason != null) return generalReason;

    // Thêm giải thích cho các trường hợp chưa có trong hardRulesDict
    switch (eventType) {
      case 'multiple_faces':
        return "Phát hiện có nhiều người xuất hiện trong khung hình camera - nghi vấn có sự hỗ trợ từ bên ngoài.";
      case 'no_face_detected':
        return "Không phát hiện thấy thí sinh trước camera - có thể thí sinh đã rời khỏi vị trí làm bài.";
      case 'inactivity':
        return "Thí sinh không có bất kỳ thao tác chuột hay phím bấm nào trong thời gian dài.";
      case 'split_screen':
        return "Thí sinh đang sử dụng chế độ chia đôi màn hình trên hệ điều hành để xem tài liệu song song.";
      case 'mouse_outside':
        return "Chuột thí sinh rời khỏi vùng làm bài (nghi ngờ thao tác trên màn hình phụ hoặc ứng dụng ngoài).";
      case 'ai_detected_cheating':
        return "AI PHÂN TÍCH: Tổng hợp nhiều hành vi bất thường (Rời cam, mất tiêu điểm, phím tắt) với xác suất vi phạm quy chế rất cao.";
      case 'screen_share_stopped':
        return "Thí sinh đã chủ động ngắt chia sẻ màn hình - hành vi vi phạm bắt buộc đối với giám sát từ xa.";
      case 'prolonged_away':
        return "Thí sinh vắng mặt trước ống kính máy quay vượt quá giới hạn thời gian quy định.";
      default:
        return "Phát hiện hành vi bất thường ghi nhận trong quá trình làm bài.";
    }
  }
}
