import React from "react";

const contacts = [
  {
    icon: "/icons/UI Image/gps.png",
    text: "120 Hoàng Minh Thảo, quận Liên Chiểu, thành phố Đà Nẵng",
  },
  {
    icon: "/icons/UI Image/phone.png",
    text: "0971893750",
  },
  {
    icon: "/icons/UI Image/mail1.png",
    text: "OEMini@edu.vn",
  },
];
export default function Contact() {
  return (
    <section className="py-10 px-6">
      <div className=" flex items-center justify-center">
        <div className="max-w-5xl w-full">
          <h2 className="text-4xl font-bold text-blue-900 text-center mb-4">
            Liên hệ
          </h2>
          <div className="bg-gradient-to-r from-blue-100 to-pink-100 p-8 rounded-3xl shadow flex flex-col md:flex-row justify-between items-center">
            {/* Thông tin bên trái */}
            <div className="space-y-6 text-lg text-gray-800">
              {contacts.map((item, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <img src={item.icon} alt="icon" className="w-12 h-12" />
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 md:mt-0 text-center">
              <img src="/Logo.png" alt="OEM Logo" className="h-24 w-auto" />
            </div>
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
        </div>
      </div>
    </section>
  );
}
