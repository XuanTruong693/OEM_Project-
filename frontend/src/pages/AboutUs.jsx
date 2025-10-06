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
    <section className="py-10 px-6 md:px-10 lg:px-20 bg-gradient-to-b ">
      <div className="flex items-center justify-center">
        <div className="max-w-4xl w-full">
          <h2 className="text-3xl md:text-4xl font-bold text-blue-900 text-center mb-8">
            Về chúng tôi
          </h2>

          <div className="bg-gradient-to-r from-blue-100 to-pink-100 p-8 rounded-3xl shadow-md hover:shadow-lg transition-shadow duration-300">
            <p className="text-gray-800 text-base md:text-lg mb-6 leading-relaxed">
              Với quy trình phát triển bài bản, áp dụng công nghệ tiên tiến vào
              giao diện thân thiện, <b>OEM Mini</b> đã giúp nhiều giảng viên và
              trung tâm đào tạo tổ chức các kỳ thi trực tuyến hiệu quả với các
              ưu điểm sau:
            </p>

            <ul className="list-disc pl-6 space-y-3 text-gray-800 text-base md:text-lg mb-6 leading-relaxed">
              {aboutPoints.map((text, index) => (
                <li key={index}>{text}</li>
              ))}
            </ul>

            <p className="text-gray-800 text-base md:text-lg leading-relaxed">
              Bên cạnh việc cung cấp các phương pháp học tập hiệu quả,{" "}
              <b>OEM Mini</b> còn mang lại sự tiện lợi trong việc tổ chức các kỳ
              thi trực tuyến.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
