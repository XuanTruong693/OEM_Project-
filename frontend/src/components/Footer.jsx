import React, { useState } from "react";

export default function Footer() {
  const [activeContent, setActiveContent] = useState(null);

  const servicePolicy = (
    <div className="p-4 text-left">
      <h3 className="font-bold text-lg mb-2">Chính sách dịch vụ</h3>
      <ol className="list-decimal ml-6 space-y-1">
        <li>
          <strong>Mục đích dịch vụ:</strong> <br></br>
          OEM Mini cung cấp nền tảng quản lý kỳ thi trực tuyến, cho phép giảng
          viên tạo khóa học, tải lên đề thi, và chấm điểm tự động; học sinh có
          thể đăng ký khóa học, tham gia kỳ thi và tra cứu kết quả.
        </li>
        <li>
          <strong>Trách nhiệm của người dùng:</strong>
          <br></br>
          Học sinh và giảng viên phải sử dụng tài khoản cá nhân để truy cập hệ
          thống.<br></br>
          Người dùng không được chia sẻ thông tin đăng nhập với người khác.
          <br></br>
          Giảng viên chịu trách nhiệm đảm bảo chất lượng nội dung và câu hỏi tải
          lên hệ thống.<br></br>
        </li>
        <li>
          <strong>Giới hạn dịch vụ:</strong>
          <br></br>
          Mỗi kỳ thi hỗ trợ tối đa 50 câu hỏi trắc nghiệm.<br></br>
          Dịch vụ chấm tự luậnsử dụng gợi ý từ AI, nhưng điểm chính thức phải
          được giảng viên xác nhận. <br></br>
          Hệ thống không bao gồm hội thảo trực tuyến, video bài giảng hay các
          tính năng AI nâng cao ngoài chấm điểm tự luận.<br></br>
        </li>
        <li>
          <strong>Hỗ trợ & bảo trì:</strong>
          <br></br>
          Quản trị viên thực hiện sao lưu dữ liệu định kỳ và giám sát hoạt động
          hệ thống.<br></br>
          Người dùng có thể liên hệ đội ngũ hỗ trợ để báo cáo sự cố, lỗi truy
          cập hoặc các vấn đề liên quan đến kỳ thi.<br></br>
        </li>
      </ol>
    </div>
  );

  const infoTerms = (
    <div className="p-4 text-left">
      <h3 className="font-bold text-lg mb-2">Điều khoản thông tin</h3>
      <ol className="list-decimal ml-6 space-y-1">
        <li>
          <strong>Thu thập dữ liệu:</strong> <br></br>Hệ thống lưu trữ thông tin
          cá nhân của người dùng, bao gồm tên, email, vai trò
          (Student/Instructor/Admin), mã phòng thi (nếu là học sinh) và kết quả
          thi. <br></br>Dữ liệu câu hỏi, đáp án và điểm số cũng được lưu trong
          cơ sở dữ liệu để phục vụ quản lý và đánh giá.
        </li>
        <li>
          <strong>Bảo mật thông tin:</strong> <br></br>Mật khẩu được mã hóa bằng
          bcrypt; xác thực và phân quyền dựa trên JWT.<br></br>Tất cả các truy
          vấn và đầu vào đều được kiểm tra để phòng chống SQL Injection, XSS và
          các hành vi trái phép.
        </li>
        <li>
          <strong>Quyền truy cập dữ liệu:</strong> <br></br>Học sinh chỉ xem
          được kết quả và đề thi của bản thân. <br></br>Giảng viên xem được kết
          quả của học sinh trong khóa học mình quản lý. <br></br>Quản trị viên
          có quyền quản lý toàn bộ hệ thống nhưng vẫn tuân thủ các nguyên tắc
          bảo mật dữ liệu.
        </li>
        <li>
          <strong>Chia sẻ thông tin:</strong> <br></br>Dữ liệu người dùng và kết
          quả thi không được chia sẻ cho bên thứ ba mà không có sự đồng ý.{" "}
          <br></br>Tất cả thông tin phục vụ mục đích giáo dục và quản lý nội bộ
          của tổ chức.
        </li>
      </ol>
    </div>
  );

  return (
    <footer className="w-full py-6 px-4 text-gray-600 text-sm text-center">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          onClick={() => setActiveContent("policy")}
        >
          Chính sách dịch vụ
        </button>
        <span>|</span>
        <button
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          onClick={() => setActiveContent("info")}
        >
          Điều khoản thông tin
        </button>
      </div>

      {/* Modal */}
      {activeContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg max-w-2xl w-11/12 p-6 relative border border-white/20">
            <button
              className="absolute top-2 right-2 text-gray-700 hover:text-gray-900 font-bold text-xl"
              onClick={() => setActiveContent(null)}
            >
              &times;
            </button>
            {activeContent === "policy" && servicePolicy}
            {activeContent === "info" && infoTerms}
          </div>
        </div>
      )}
    </footer>
  );
}
