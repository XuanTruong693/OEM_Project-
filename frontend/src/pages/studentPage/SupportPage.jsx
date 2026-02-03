import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPhone, FiMail, FiMapPin, FiArrowLeft, FiCalendar } from 'react-icons/fi';

export default function SupportPage() {
  const navigate = useNavigate();

  const handleEmailClick = () => {
    const subject = encodeURIComponent('Yêu cầu hỗ trợ - OEM System');
    const body = encodeURIComponent(
      'Xin chào bộ phận hỗ trợ,\n\n' +
      'Tôi cần hỗ trợ về:\n\n' +
      '[Mô tả vấn đề của bạn tại đây]\n\n' +
      'Trân trọng.'
    );
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=truongkt693@gmail.com&su=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/student-dashboard')}
            className="flex items-center gap-2 px-3 py-2 text-slate-700 rounded-lg hover:bg-slate-100 transition-all"
          >
            <FiArrowLeft className="w-5 h-5" />
            <span className="font-semibold hidden sm:inline">Quay lại</span>
          </button>

          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
            <img src="/Logo.png" alt="Logo" className="h-10 sm:h-12 w-auto" />
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <FiCalendar className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-600 hidden sm:inline">{new Date().toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-4xl">💬</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-3">
            Trung tâm hỗ trợ
          </h1>
          <p className="text-slate-600 text-lg">
            Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7
          </p>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 mb-8">
          {/* Contact Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>📞</span>
                Thông tin liên hệ
              </h2>
              <p className="text-blue-100 mt-2">Liên hệ với chúng tôi qua các kênh sau</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Phone */}
              <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100 hover:shadow-md transition">
                <div className="p-3 bg-blue-600 rounded-xl text-white">
                  <FiPhone className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 mb-1">Hotline hỗ trợ</h3>
                  <a
                    href="tel:0971893750"
                    className="text-blue-600 text-lg font-bold hover:text-blue-700 transition"
                  >
                    0971 893 750
                  </a>
                  <p className="text-slate-600 text-sm mt-1">Thời gian: 24/7 (cả ngày lễ)</p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100 hover:shadow-md transition">
                <div className="p-3 bg-indigo-600 rounded-xl text-white">
                  <FiMail className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 mb-1">Email hỗ trợ</h3>
                  <button
                    onClick={handleEmailClick}
                    className="text-indigo-600 text-lg font-bold hover:text-indigo-700 transition underline"
                  >
                    truongkt693@gmail.com
                  </button>
                  <p className="text-slate-600 text-sm mt-1">Click để gửi email qua Gmail</p>
                  <p className="text-slate-500 text-xs mt-2 italic">
                    💡 Bạn sẽ được chuyển sang Gmail để soạn email hỗ trợ
                  </p>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-xl border border-purple-100 hover:shadow-md transition">
                <div className="p-3 bg-purple-600 rounded-xl text-white">
                  <FiMapPin className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 mb-1">Địa chỉ văn phòng</h3>
                  <p className="text-slate-700 text-lg">
                    120 Hoàng Minh Thảo
                  </p>
                  <p className="text-slate-600 mt-1">
                    Hòa Khánh, Liên Chiểu, Đà Nẵng
                  </p>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=120+Hoàng+Minh+Thảo,+Hòa+Khánh,+Liên+Chiểu,+Đà+Nẵng"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-purple-600 hover:text-purple-700 text-sm font-semibold transition"
                  >
                    🗺️ Xem bản đồ
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>❓</span>
              Câu hỏi thường gặp
            </h2>

            <div className="space-y-4">
              <details className="group p-4 bg-slate-50 rounded-xl border border-slate-200">
                <summary className="font-semibold text-slate-800 cursor-pointer list-none flex items-center justify-between">
                  <span>🔐 Tôi quên mật khẩu, làm thế nào?</span>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-slate-600 pl-6">
                  Tại trang đăng nhập, nhấn "Quên mật khẩu" và làm theo hướng dẫn. Email khôi phục sẽ được gửi trong vòng 5 phút.
                </p>
              </details>

              <details className="group p-4 bg-slate-50 rounded-xl border border-slate-200">
                <summary className="font-semibold text-slate-800 cursor-pointer list-none flex items-center justify-between">
                  <span>⏱️ Tôi không vào được phòng thi, phải làm sao?</span>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-slate-600 pl-6">
                  Kiểm tra lại mã phòng thi và thời gian thi. Nếu vẫn gặp lỗi, liên hệ hotline ngay để được hỗ trợ khẩn cấp.
                </p>
              </details>

              <details className="group p-4 bg-slate-50 rounded-xl border border-slate-200">
                <summary className="font-semibold text-slate-800 cursor-pointer list-none flex items-center justify-between">
                  <span>📹 Camera/Microphone không hoạt động?</span>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-slate-600 pl-6">
                  Kiểm tra cài đặt trình duyệt để cho phép truy cập camera/micro. Đảm bảo không có ứng dụng nào khác đang sử dụng thiết bị.
                </p>
              </details>

              <details className="group p-4 bg-slate-50 rounded-xl border border-slate-200">
                <summary className="font-semibold text-slate-800 cursor-pointer list-none flex items-center justify-between">
                  <span>🎯 Tôi muốn phản hồi về bài thi?</span>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-slate-600 pl-6">
                  Vui lòng gửi email đến địa chỉ hỗ trợ với tiêu đề "Phản hồi bài thi - [Tên bài thi]". Chúng tôi sẽ xem xét và phản hồi trong 24-48 giờ.
                </p>
              </details>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-3">🚀 Hành động nhanh</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={handleEmailClick}
                className="bg-white text-blue-600 px-4 py-3 rounded-xl font-semibold hover:bg-blue-50 transition shadow-md"
              >
                ✉️ Gửi email hỗ trợ
              </button>
              <a
                href="tel:0971893750"
                className="bg-white text-indigo-600 px-4 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition shadow-md text-center"
              >
                📞 Gọi hotline
              </a>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center p-4 bg-white/50 backdrop-blur rounded-xl border border-white/60">
          <p className="text-slate-600">
            💡 <strong>Lưu ý:</strong> Đội ngũ hỗ trợ sẽ phản hồi trong vòng <strong>30 phút</strong> (giờ hành chính)
            hoặc <strong>2 giờ</strong> (ngoài giờ).
          </p>
        </div>
      </div>
    </div>
  );
}
