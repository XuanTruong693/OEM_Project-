// src/components/Features.jsx
import React from "react";

const features = [
  {
    icon: "/icons/UI Image/8194264.png",
    title: "Tạo đề thi nhanh chóng",
    desc: [
      "Giảng viên có thể tải lên file Excel chứa câu hỏi, hệ thống tự động phân loại MCQ và Essay, giảm thời gian nhập liệu thủ công.",
      "Hệ thống nhận diện và sắp xếp câu hỏi theo dạng trắc nghiệm và tự luận để chuẩn bị đề thi nhanh chóng.",
      "Giảng viên có thể chỉnh sửa câu hỏi ngay sau khi import, đảm bảo độ chính xác của đề thi",
      "Hệ thống kiểm soát số lượng câu hỏi tối đa trên mỗi đề để duy trì sự hợp lý và dễ quản lý.",
    ],
  },
  {
    icon: "/icons/UI Image/12.png",
    title: "Chấm điểm tự động thông minh",
    desc: [
      "Trắc nghiệm được chấm ngay lập tức, còn bài tự luận được AI/NLP gợi ý điểm số.",
      "Khi học sinh nộp bài, hệ thống chấm điểm MCQ dựa trên đáp án đúng đã đánh dấu.",
      "Giảng viên xem lại và điều chỉnh điểm AI trước khi công bố chính thức, đảm bảo công bằng.",
      "Hệ thống ghi nhận lịch sử điểm và thao tác chỉnh sửa, hỗ trợ kiểm tra và edit sau này",
    ],
  },
  {
    icon: "/icons/UI Image/123.png",
    title: "Kết quả minh bạch & công bằng",
    desc: [
      "Học sinh xem điểm MCQ ngay sau khi nộp bài; điểm tự luận được xác nhận bởi giảng viên.",
      "Giảng viên và quản trị viên có thể xuất điểm và thống kê thành file CSV/Excel để lưu trữ và phân tích.",
      "Giảng viên xem tổng quan kết quả của tất cả học sinh trong khóa học.",
      "Điểm tự luận chỉ được công bố sau khi giảng viên kiểm tra gợi ý từ AI, giảm sai lệch và thiên vị.",
    ],
  },
  {
    icon: "/icons/UI Image/124.png",
    title: "Bảo mật và an toàn dữ liệu",
    desc: [
      "Sử dụng JWT, bcrypt và các tiêu chuẩn bảo mật phổ biến để bảo vệ dữ liệu và phân quyền role-based để bảo vệ dữ liệu và quyền truy cập.",
      "Mật khẩu được lưu bằng bcrypt để bảo vệ thông tin người dùng.",
      "Hệ thống validate input để chống SQL Injection/XSS và lưu nhật ký hoạt động để theo dõi hành vi đáng ngờ.",
      "Data người dùng được sao lưu thường xuyên để tránh mất mát dữ liệu.",
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
              <h3 className="font-bold text-md" style={{ color: "#180eff" }}>
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
    </section>
  );
}
