import React from "react";
import SummaryCard from "./SummaryCard.jsx";

const InstructorSummary = () => {
  const summaryData = [
    {
      title: "Tổng số đề đã tạo",
      value: "0",
      color: "bg-green-400",
      icon: "/icons/UI Image/report.png",
      linkText: "Xem",
    },
    {
      title: "Tổng số bài kiểm tra",
      value: "0",
      color: "bg-red-400",
      icon: "/icons/UI Image/totalExam.png",
      linkText: "Xem",
    },
    {
      title: "Tổng số thí sinh đã thi",
      value: "0",
      color: "bg-purple-400",
      icon: "/icons/UI Image/studentGroup.png",
      linkText: "Xem",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {summaryData.map((item, index) => (
        <SummaryCard key={index} {...item} />
      ))}
    </div>
  );
};

export default InstructorSummary;
