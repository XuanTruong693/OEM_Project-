import React from "react";

const SummaryCard = ({ title, value, color, icon, linkText }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-all duration-300">
      <div className="flex items-center my-auto gap-3 mb-2">
        <div
          className={`w-10 h-10 flex items-center justify-center rounded-full ${color}`}
        >
          <img src={icon} alt={title} className="w-6 h-6 object-contain" />
        </div>
        <div className="">
          <h3 className="text-2xl font-semibold text-gray-400">{value}</h3>
          <p className="text-gray-400 font-semibold text-base mb-3">{title}</p>
        </div>
      </div>
      {linkText && (
        <a
          href="#"
          className={`text-[16px] hover:text-gray-600 text-gray-400 font-semibold flex items-center gap-1 self-end cursor-pointer transition-all duration-200 group`}
        >
          {linkText}
          <span className="text-[20px] font-bold transform transition-transform duration-200  ">
            →
          </span>
        </a>
      )}
    </div>
  );
};

export default SummaryCard;
