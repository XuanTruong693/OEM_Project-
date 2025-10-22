import React, { useState, useEffect } from "react";
import { FiLogOut, FiCamera } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const navigate = useNavigate();

  const [userInfo, setUserInfo] = useState({
    fullname: "Giảng viên",
    avatar: "/icons/UI Image/default-avatar.png",
  });

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    email: "",
    phone: "",
    address: "",
    avatar: "/icons/UI Image/default-avatar.png",
  });

  useEffect(() => {
    const fullname = localStorage.getItem("fullname") || "Giảng viên";
    const avatar =
      localStorage.getItem("avatar") || "/icons/UI Image/default-avatar.png";
    const email = localStorage.getItem("email") || "";

    setUserInfo({ fullname, avatar });
    setFormData((prev) => ({
      ...prev,
      avatar,
      email,
    }));
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Profile data:", formData);
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <main className="flex-1 p-6">
        <div className="flex justify-end items-center mb-8">
          <div className="flex items-center gap-3 px-4 py-2">
            <img
              src={userInfo.avatar}
              alt="User Avatar"
              className="w-10 h-10 rounded-full border border-gray-200 object-cover"
            />
            <div className="flex items-center gap-2">
              <p className="text-gray-500 text-sm leading-tight">Xin chào,</p>
              <p className="font-semibold text-[#606060]">
                {userInfo.fullname}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-9 h-9 ml-4 rounded-full hover:bg-gray-100 transition"
            title="Đăng xuất"
          >
            <FiLogOut className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-full">
            <div className="flex items-center bg-[#1BA4FF] rounded-[17px] px-3 py-3 mb-6 gap-3">
              <button
                onClick={() => navigate("/instructor-dashboard")}
                className="flex items-center text-white hover:opacity-80 transition"
              >
                <img
                  src="/icons/UI Image/return.png"
                  alt="Return"
                  className="w-4 h-4 mr-2"
                />
                <h2 className="text-xl underline underline-offset-4 font-semibold">
                  Hồ sơ
                </h2>
              </button>
            </div>

            <div className="bg-white shadow-lg rounded-3xl w-full p-8 border border-gray-100">
              <div className="flex justify-center mb-6">
                <div className="relative w-28 h-28">
                  <img
                    src={formData.avatar}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover border border-gray-200 shadow-sm"
                  />
                  <label
                    htmlFor="avatar"
                    className="absolute bottom-1 right-1 bg-gray-100 border border-gray-300 text-gray-600 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer hover:bg-gray-200 transition"
                  >
                    <FiCamera className="w-4 h-4" />
                    <input
                      type="file"
                      id="avatar"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          avatar: URL.createObjectURL(e.target.files[0]),
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-between flex-col sm:flex-row gap-6">
                  <div className="flex flex-1 items-center gap-3">
                    <label className="w-24 text-xl text-[#606060] font-normal">
                      Họ:
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>

                  <div className="flex flex-1 items-center gap-3">
                    <label className="w-24 text-xl text-[#606060] font-normal">
                      Tên:
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="w-24 text-xl text-[#606060] font-normal">
                    Giới tính:
                  </label>
                  <div className="flex gap-6 text-xl">
                    {["Nam", "Nữ", "Khác"].map((g) => (
                      <label key={g} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="gender"
                          value={g}
                          checked={formData.gender === g}
                          onChange={handleChange}
                          className="accent-blue-500"
                        />
                        {g}
                      </label>
                    ))}
                  </div>
                </div>

                {[
                  {
                    label: "Email:",
                    name: "email",
                    type: "email",
                  },
                  { label: "SĐT:", name: "phone", type: "text" },
                  { label: "Địa chỉ:", name: "address", type: "text" },
                ].map((field) => (
                  <div key={field.name} className="flex items-center gap-3">
                    <label className="w-24 text-xl text-[#606060] font-normal">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      name={field.name}
                      value={formData[field.name]}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                ))}

                <div className="flex justify-center pt-4">
                  <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600 text-white font-normal px-6 py-2 rounded-lg transition"
                  >
                    Lưu hồ sơ
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
