// src/components/Features.jsx
import React from "react";

const features = [
  {
    icon: "/icons/UI Image/8194264.png",
    title: "Tạo đề thi nhanh chóng",
    desc: [
      "Hỗ trợ nhập đề từ file Excel, hệ thống tự động phân loại câu hỏi trắc nghiệm và tự luận.",
      "Kết hợp Excel (liệu trường ô luôn xanh) kèm theo biểu tượng bắt buộc tại ô giấy.",
      "Có thêm dấu check để thể hiện sự đồng phân loại.",
      "Phong cách đơn giản, trực quan, dễ gọi nhớ đến thẻ “tạo đề thi từ file Excel”.",
    ],
  },
  {
    icon: "/icons/UI Image/12.png",
    title: "Chấm điểm tự động thông minh",
    desc: [
      "Trắc nghiệm được chấm ngay lập tức, còn bài tự luận được AI/NLP gợi ý điểm số.",
      "Một bảng báo lỗi trắc nghiệm có tick ✅.",
      "Hình ảnh đưa người với mạch AI có phòng trừ lỗi nhận thức.",
      "Có thêm biểu tượng đồng hồ nhấn mạnh tốc độ nhanh chóng.",
    ],
  },
  {
    icon: "/icons/UI Image/123.png",
    title: "Kết quả minh bạch & công bằng",
    desc: [
      "Giảng viên xem, điều chỉnh và xác nhận kết quả trước khi công bố.",
      "Một màn hình máy tính hiển thị biểu đồ cột hoặc báo cáo kết quả.",
      "Phía trên có dấu check vàng tượng trưng cho sự xác nhận.",
      "Kết hợp hình người (giảng viên) nhằm thể hiện giám sát để đảm bảo minh bạch.",
    ],
  },
  {
    icon: "/icons/UI Image/124.png",
    title: "Bảo mật và an toàn dữ liệu",
    desc: [
      "Sử dụng JWT, bcrypt và các tiêu chuẩn bảo mật phổ biến để bảo vệ dữ liệu.",
      "Một ổ khóa vàng chắc chắn. Ổ giữa ổ khóa có biểu tượng check ✅ tượng trưng cho an toàn.",
      "Có thể thêm một vài chi tiết “digital” (mạch điện, tấm shield) để nhấn mạnh tính bảo mật công nghệ.",
    ],
  },
];

export default function Features() {
  return (
    <section className="py-10 px-6">
      <h2 className="text-4xl font-bold text-blue-900 text-center mb-8">
        Giới thiệu tính năng nổi bật của OEM Mini
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {features.map((feature, index) => (
          <div
            key={index}
            className="bg-[#f8fbff] rounded-xl p-6 shadow hover:shadow-lg transition"
          >
            <div className="flex flex-col items-center text-center mb-4">
              <img
                src={feature.icon}
                alt="icon"
                className="w-12 h-12 mb-3 object-contain"
              />
              <h3
                className="font-semibold text-md"
                style={{ color: "#180eff" }}
              >
                {feature.title}
              </h3>
            </div>
            <p className="text-sm text-gray-800 mb-3">{feature.desc[0]}</p>
            <ul className="text-sm text-gray-700 list-disc pl-4 space-y-2">
              {feature.desc.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="text-center mt-6 text-sm text-gray-500">
        <a href="#" className="hover:underline">
          Chính sách dịch vụ
        </a>
        <span className="mx-2">|</span>
        <a href="#" className="hover:underline">
          Điều khoản thông tin
        </a>
      </div>
    </section>
  );
}
