import React from "react";

const newsList = [
  {
    title: "Kỷ nguyên chuyển đổi số trong giáo dục",
    date: "04/03/2026",
    description: " Trong kỷ nguyên số hóa, giáo dục đang trải qua những thay đổi mạnh mẽ. Công nghệ thông tin đã trở thành một công cụ đắc lực hỗ trợ việc dạy và học, giúp nâng cao hiệu quả giáo dục và mang lại nhiều tiện ích cho người học và người dạy. Hệ thống OEM ra đời nhằm đáp ứng nhu cầu đó, mang đến cho người dùng những trải nghiệm học tập và thi cử tốt nhất.",
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
      </div>
    </section>
  );
}
