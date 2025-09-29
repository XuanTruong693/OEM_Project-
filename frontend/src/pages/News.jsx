import React from "react";

const newsList = [
  {
    title: "",
    date: "",
    description: "",
  },
  {
    title: "",
    date: "",
    description: "",
  },
  {
    title: "",
    date: "",
    description: "",
  },
];

export default function News() {
  return (
    <section className=" py-10 px-6">
      <div className="">
        <h2 className="text-4xl font-bold text-blue-900 text-center mb-8">
          Tin tức
        </h2>

        <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow border border-gray-200 overflow-hidden">
          <div className="bg-blue-500 text-white font-bold text-lg text-center py-3 rounded-t-3xl">
            TIN TỨC NỔI BẬT
          </div>

          <div className="p-6 space-y-6">
            {newsList.map((news, index) => (
              <div
                key={index}
                className="border-b border-gray-200 py-4 last:border-none"
              >
                <h3 className="text-xl font-semibold text-[#180eff]">
                  {news.title}
                </h3>
                <p className="text-sm text-gray-500 mb-2">{news.date}</p>
                <p className="text-gray-700">{news.description}</p>
              </div>
            ))}
          </div>
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
    </section>
  );
}
