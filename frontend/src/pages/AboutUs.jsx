// src/pages/AboutUs.jsx
import React from "react";

const aboutPoints = [
  "Tích hợp AI/NLP hỗ trợ chấm điểm tự luận thông minh, đảm bảo tính công bằng và minh bạch.",
  "Tạo đề thi nhanh chóng từ file Excel, hỗ trợ tự động phân loại câu hỏi theo mức độ.",
  "Chấm điểm tự động nhanh chóng, hỗ trợ giáo viên tiết kiệm thời gian đáng kể.",
  "Quản lý khóa học, ngân lượng và kết quả thi trên một nền tảng duy nhất, dễ sử dụng.",
  "Thống kê, báo cáo kết quả toàn diện, hỗ trợ giảng viên đánh giá chính xác năng lực học viên.",
];

export default function AboutUs() {
  return (
    <section className="py-10 px-6">
      <div className=" flex items-center justify-center">
        <div className="max-w-4xl w-full">
          <h2 className="text-4xl font-bold text-blue-900 text-center mb-8">
            Về chúng tôi
          </h2>
          <div className="bg-[#f8fbff] p-8 rounded-3xl shadow hover:shadow-lg transition">
            <p className="text-gray-800 text-lg mb-8">
              Với quy trình phát triển bài bản, áp dụng công nghệ tiên tiến vào
              giao diện thân thiện, <b>OEM Mini</b> đã giúp nhiều giảng viên và
              trung tâm đào tạo tổ chức các kỳ thi trực tuyến hiệu quả với các
              ưu điểm sau:
            </p>
            <div className="space-y-4 mb-8">
              {aboutPoints.map((text, index) => (
                <div key={index}>
                  <p className="text-gray-800">{text}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-800 text-lg">
              Bên cạnh việc cung cấp các phương pháp học tập hiệu quả,{" "}
              <b>OEM Mini</b> còn mang lại sự tiện lợi trong việc tổ chức các kỳ
              thi trực tuyến.
            </p>
          </div>
          <div className="flex justify-center items-center mt-6 text-sm text-gray-500 space-x-2">
            <a href="#" className="hover:underline">
              Chính sách dịch vụ
            </a>
            <span>|</span>
            <a href="#" className="hover:underline">
              Điều khoản thông tin
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
