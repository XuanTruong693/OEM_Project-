import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ExamGuidelines() {
  const navigate = useNavigate();

  const Section = ({ icon, title, children }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 grid place-items-center text-2xl">
          {icon}
        </div>
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      </div>
      <div className="space-y-3 text-slate-600">
        {children}
      </div>
    </div>
  );

  const Rule = ({ icon, text, variant = 'do' }) => (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${
      variant === 'do' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
    }`}>
      <span className="text-xl flex-shrink-0">{icon}</span>
      <p className={`text-sm ${variant === 'do' ? 'text-green-800' : 'text-red-800'}`}>{text}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => navigate('/student-dashboard')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition"
          >
            <span className="text-xl">←</span>
            <span className="font-medium">Quay lại Dashboard</span>
          </button>
          <img src="/Logo.png" alt="Logo" className="h-8 w-auto" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-4xl mb-4 shadow-lg">
            🛡️
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Hướng dẫn làm bài thi</h1>
          <p className="text-slate-600 text-lg">
            Quy tắc và chống gian lận - Đảm bảo tính công bằng cho mọi thí sinh
          </p>
        </div>

        <div className="space-y-6">
          {/* Quy tắc chuẩn bị */}
          <Section icon="📝" title="Trước khi bắt đầu thi">
            <Rule 
              icon="✅" 
              text="Chuẩn bị thiết bị: Máy tính/laptop có camera, microphone, kết nối internet ổn định"
              variant="do"
            />
            <Rule 
              icon="✅" 
              text="Môi trường thi: Phòng riêng, yên tĩnh, ánh sáng đủ để camera nhận diện khuôn mặt"
              variant="do"
            />
            <Rule 
              icon="✅" 
              text="Chuẩn bị giấy tờ: CMND/CCCD hoặc thẻ sinh viên để xác minh danh tính"
              variant="do"
            />
            <Rule 
              icon="✅" 
              text="Đăng nhập trước 15 phút: Kiểm tra camera, microphone, xác minh khuôn mặt"
              variant="do"
            />
            <Rule 
              icon="❌" 
              text="KHÔNG sử dụng điện thoại, tài liệu, sách vở trong phòng thi"
              variant="dont"
            />
          </Section>

          {/* Quy tắc trong khi thi */}
          <Section icon="🎯" title="Trong khi làm bài">
            <Rule 
              icon="✅" 
              text="Giữ khuôn mặt trong khung hình camera suốt buổi thi"
              variant="do"
            />
            <Rule 
              icon="✅" 
              text="Ngồi yên, nhìn thẳng màn hình, không di chuyển quá nhiều"
              variant="do"
            />
            <Rule 
              icon="✅" 
              text="Làm bài trong chế độ toàn màn hình (fullscreen), không thoát ra"
              variant="do"
            />
            <Rule 
              icon="❌" 
              text="KHÔNG mở tab/cửa sổ khác, không chuyển ứng dụng (Alt+Tab)"
              variant="dont"
            />
            <Rule 
              icon="❌" 
              text="KHÔNG nói chuyện, nhìn sang nơi khác, hoặc có người khác trong phòng"
              variant="dont"
            />
            <Rule 
              icon="❌" 
              text="KHÔNG thoát khỏi fullscreen, không nhấn F11, Esc, F5 (refresh)"
              variant="dont"
            />
          </Section>

          {/* Hệ thống giám sát */}
          <Section icon="📹" title="Hệ thống giám sát tự động">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Hệ thống AI sẽ theo dõi:</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span><strong>Khuôn mặt:</strong> Nhận diện và xác minh danh tính liên tục</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span><strong>Màn hình:</strong> Phát hiện nếu bạn thoát fullscreen hoặc chuyển tab</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span><strong>Hành vi:</strong> Ghi nhận các cảnh báo (rời cửa sổ, mất focus, phím tắt)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span><strong>Cảnh báo tích lũy:</strong> Sau 5 vi phạm → <strong className="text-red-600">TƯ ĐỘNG NỘP BÀI</strong></span>
                </li>
              </ul>
            </div>
          </Section>

          {/* Vi phạm & hậu quả */}
          <Section icon="⚠️" title="Vi phạm và hậu quả">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-3">Các hành vi gian lận bị phát hiện:</h3>
              <div className="space-y-2 text-sm text-red-800">
                <div className="flex items-center gap-3 p-2 bg-white rounded border border-red-100">
                  <span className="font-mono bg-red-100 px-2 py-1 rounded text-xs">Cảnh báo 1</span>
                  <span>Thoát fullscreen → Hệ thống tự động bật lại</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-white rounded border border-red-100">
                  <span className="font-mono bg-red-100 px-2 py-1 rounded text-xs">Cảnh báo 2</span>
                  <span>Chuyển tab/cửa sổ khác → Ghi nhận vi phạm</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-white rounded border border-red-100">
                  <span className="font-mono bg-red-100 px-2 py-1 rounded text-xs">Cảnh báo 3</span>
                  <span>Nhấn phím bị chặn (Esc, F11, F5, Ctrl+W) → Ghi log</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-white rounded border border-red-100">
                  <span className="font-mono bg-red-100 px-2 py-1 rounded text-xs">Cảnh báo 4</span>
                  <span>Blur window (click ra ngoài) → Cảnh báo</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-red-600 text-white rounded font-semibold">
                  <span className="font-mono bg-red-800 px-2 py-1 rounded text-xs">Cảnh báo 5</span>
                  <span>🚨 HỆ THỐNG TỰ ĐỘNG NỘP BÀI 🚨</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-900">
                <strong>⚡ Lưu ý:</strong> Giảng viên sẽ xem lại video giám sát và log vi phạm. 
                Nếu phát hiện gian lận nghiêm trọng → <strong className="text-red-600">Điểm 0 và xử lý kỷ luật</strong>
              </p>
            </div>
          </Section>

          {/* Tips thành công */}
          <Section icon="💡" title="Tips để thi thành công">
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <span className="text-2xl">🎯</span>
                <div>
                  <h4 className="font-semibold text-blue-900">Tập trung cao độ</h4>
                  <p className="text-sm text-blue-700">Đọc kỹ đề, suy nghĩ cẩn thận trước khi chọn đáp án</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                <span className="text-2xl">⏱️</span>
                <div>
                  <h4 className="font-semibold text-green-900">Quản lý thời gian</h4>
                  <p className="text-sm text-green-700">Theo dõi đồng hồ đếm ngược, ưu tiên câu dễ trước</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                <span className="text-2xl">💾</span>
                <div>
                  <h4 className="font-semibold text-purple-900">Lưu câu trả lời thường xuyên</h4>
                  <p className="text-sm text-purple-700">Hệ thống tự động lưu, nhưng hãy kiểm tra trước khi nộp</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg">
                <span className="text-2xl">✅</span>
                <div>
                  <h4 className="font-semibold text-orange-900">Kiểm tra trước khi nộp</h4>
                  <p className="text-sm text-orange-700">Rà soát lại các câu, đảm bảo không bỏ sót</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Contact support */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 rounded-xl p-6 text-center">
            <h3 className="font-bold text-slate-800 mb-2">Gặp vấn đề kỹ thuật?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Liên hệ giảng viên hoặc bộ phận hỗ trợ kỹ thuật <strong>TRƯỚC KHI</strong> bắt đầu thi
            </p>
            <div className="flex justify-center gap-3">
              <a href="mailto:support@oem.edu.vn" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                📧 Email: support@oem.edu.vn
              </a>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <button 
            onClick={() => navigate('/verify-room')}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition"
          >
            Tôi đã hiểu rõ quy định → Bắt đầu xác minh phòng thi
          </button>
          <p className="text-xs text-slate-500 mt-3">
            Bằng cách tiếp tục, bạn xác nhận đã đọc và đồng ý tuân thủ các quy định trên
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-12 py-6 text-center text-sm text-slate-500">
        <p>© 2025 OEM - Online Examination Management System</p>
        <p className="mt-1">Mọi hành vi gian lận sẽ bị xử lý nghiêm khắc theo quy định</p>
      </footer>
    </div>
  );
}
