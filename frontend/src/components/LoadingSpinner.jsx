import React from "react";

const LoadingSpinner = ({ size = "md", text = "Đang xử lý..." }) => {
  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "w-4 h-4";
      case "md":
        return "w-6 h-6";
      case "lg":
        return "w-8 h-8";
      case "xl":
        return "w-12 h-12";
      default:
        return "w-6 h-6";
    }
  };

  return (
    <div className="flex items-center justify-center gap-3">
      <div
        className={`${getSizeClasses()} border-2 border-white border-t-transparent rounded-full animate-spin`}
      ></div>
      {text && <span className="text-sm font-medium">{text}</span>}
    </div>
  );
};

export default LoadingSpinner;
