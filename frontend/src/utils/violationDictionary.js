export const HARD_RULES_DICT = {
  escape: "Cố tình nhấn phím ESC để thoát chế độ Toàn màn hình.",
  f11: "Nhấn F11 để can thiệp kích thước màn hình thi.",
  f5: "Cố tình làm mới (Tải lại) trang bài thi nhằm vượt mặt hệ thống.",
  f12: "Cố tình mở Công cụ lập trình (DevTools) hòng can thiệp bài thi.",
  printscreen: "Nhấn phím cứng PrintScreen chụp ảnh đề thi.",
  "meta+shift+s": "Mở công cụ cắt/chụp ảnh màn hình (Snipping Tool) của Windows.",
  "alt+printscreen": "Chụp ảnh nhanh một cấu trúc cửa sổ ứng dụng.",
  "alt+tab": "Nhấn phím tắt Alt+Tab để chuyển nhanh sang ứng dụng/tài liệu khác.",
  "alt+f4": "Nhấn Alt+F4 để cố tình đóng cửa sổ trình duyệt thi.",
  "meta+d": "Nhanh chóng thu nhỏ toàn bộ bài thi để về Màn hình chính (Win+D / Desktop).",
  "meta+p": "Kích hoạt Bảng chia sẻ màn hình phụ (Win+P / Project) hòng phát đề thi ra ngoài.",
  "meta_key": "Nhấn phím Windows kết hợp Click chuột vào Taskbar hoặc ứng dụng khác để thoát bài thi.",
  copy_attempt: "Thực hiện thao tác sao chép (Copy / Ctrl+C) nội dung từ bài thi ra ngoài.",
  paste_attempt: "Thực hiện thao tác dán (Paste / Ctrl+V) nội dung từ bên ngoài vào bài thi.",
  drag_drop_in: "Kéo thả văn bản/tài liệu từ cửa sổ bên ngoài vào ô trả lời bài thi.",
  fullscreen_lost: "Thoát khỏi chế độ thi Toàn màn hình.",
  visibility_hidden: "Ẩn tab bài thi xuống (Mở một cửa sổ khác đè lên trên).",
  window_blur: "Click chuột ra ngoài cửa sổ trình duyệt thi.",
  multiple_screens_connected: "Phát hiện kết nối nhiều màn hình (Dual monitor).",
  screenshot_attempt: "Sử dụng lối tắt ngăn chặn hoặc phần mềm hệ thống để chụp màn hình bài thi."
};

/**
 * Lấy tiêu đề chính xác cho từng phím bấm.
 * Hàm này dùng để đồng bộ tiêu đề thông báo theo chuẩn HARD_RULES_DICT.
 */
export const getDynamicViolationTitle = (eventType, keyId) => {
  if (eventType === "blocked_key" && keyId) {
    const k = keyId.toLowerCase();
    switch (k) {
      case "f12": return "[AI PHÁT HIỆN] MỞ CÔNG CỤ LẬP TRÌNH (F12)";
      case "f11": return "[AI PHÁT HIỆN] CAN THIỆP KÍCH THƯỚC MÀN HÌNH (F11)";
      case "escape": return "[AI PHÁT HIỆN] THOÁT TOÀN MÀN HÌNH (ESC)";
      case "f5": return "[AI PHÁT HIỆN] LÀM MỚI BÀI THI (F5)";
      case "alt+tab": return "[AI PHÁT HIỆN] CHUYỂN ỨNG DỤNG BẰNG PHÍM (ALT+TAB)";
      case "meta+d": return "[AI PHÁT HIỆN] ẨN NHANH RA DESKTOP (WIN+D)";
      case "meta+p": return "[AI PHÁT HIỆN] KẾT NỐI MÀN HÌNH PHỤ (WIN+P)";
      case "alt+f4": return "[AI PHÁT HIỆN] ĐÓNG CỬA SỔ TRÌNH DUYỆT (ALT+F4)";
      case "printscreen": return "[AI PHÁT HIỆN] CHỤP ẢNH BÀI THI (PRINTSCREEN)";
      case "copy": return "[AI PHÁT HIỆN] SAO CHÉP NỘI DUNG (CTRL+C)";
      case "drag_drop": return "[AI PHÁT HIỆN] KÉO THẢ TÀI LIỆU VÀO BÀI THI";
      case "ctrl+v": return "[AI PHÁT HIỆN] DÁN NỘI DUNG (CTRL+V)";
      default: return `[AI PHÁT HIỆN] DÙNG PHÍM BỊ CHẶN (${k.toUpperCase()})`;
    }
  }
  return null; // Fallback to default MAP
};

/**
 * Lấy nội dung chi tiết dựa trên key.
 * ƯU TIÊN defaultMsg nếu có (để TakeExam.jsx có thể truyền log chi tiết [MOBILE]).
 */
export const getDynamicViolationReason = (eventType, keyId, defaultMsg = "") => {
  // Nếu TakeExam.jsx đã truyền lời giải thích cụ thể (ưu tiên hàng đầu)
  if (defaultMsg) return defaultMsg;

  if (eventType === "blocked_key" && keyId) {
    const reason = HARD_RULES_DICT[keyId.toLowerCase()];
    if (reason) return reason;
  }
  if (HARD_RULES_DICT[eventType]) {
    return HARD_RULES_DICT[eventType];
  }
  return defaultMsg;
};
