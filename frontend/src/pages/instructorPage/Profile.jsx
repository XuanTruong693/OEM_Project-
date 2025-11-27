import React, { useState, useEffect } from "react";
import axiosClient from "../../api/axiosClient";
import { FiCamera, FiSave } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const navigate = useNavigate();

  // Detect user role to determine which dashboard to return to
  const userRole = localStorage.getItem("role");

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
  // Keep a copy of the initially loaded values to detect real changes
  const [initialForm, setInitialForm] = useState(null);
  // Inline message shown above the Save button
  const [message, setMessage] = useState({ text: "", type: "" }); // type: 'success'|'error'|'info'
  const messageTimerRef = React.useRef(null);

  // clear timer on unmount
  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Load from backend profile if token exists, otherwise fallback to localStorage
    const loadProfile = async () => {
      try {
        const res = await axiosClient.get("/profile");
        const user = res.data && res.data.data;
        if (user) {
          // Map backend user -> frontend form fields
          const nameParts = (user.full_name || "").split(" ");
          const lastName = nameParts.slice(0, -1).join(" ") || "";
          const firstName = nameParts.slice(-1).join(" ") || "";
          const genderMapBack = { male: "Nam", female: "Nữ", other: "Khác" };

          setFormData((prev) => ({
            ...prev,
            firstName,
            lastName,
            gender: genderMapBack[user.gender] || "",
            email: user.email || prev.email,
            phone: user.phone || "",
            address: user.address || "",
            avatar: user.avatar || prev.avatar,
          }));

          // store a normalized snapshot for change detection
          setInitialForm({
            firstName,
            lastName,
            gender: genderMapBack[user.gender] || "",
            email: user.email || "",
            phone: user.phone || "",
            address: user.address || "",
            avatar: user.avatar || prev.avatar,
          });

          setUserInfo({
            fullname: user.full_name || prev.fullname,
            avatar: user.avatar || prev.avatar,
          });

          // also persist a couple of values locally for other UI
          if (user.full_name) localStorage.setItem("fullname", user.full_name);
          if (user.avatar) localStorage.setItem("avatar", user.avatar);
          if (user.email) localStorage.setItem("email", user.email);
          return;
        }
      } catch (err) {
        // ignore fetch error and fall back to localStorage
        console.warn(
          "Could not fetch profile from API:",
          err?.response || err?.message || err
        );
      }

      // Fallback: use localStorage if backend not available
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
    };

    loadProfile();
  }, []);

  // logout is handled by the global header; keep navigation available via profile links

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Prevent typing letters into phone field by stripping non-digits
    if (name === "phone") {
      const digits = value.replace(/\D/g, "");
      setFormData({ ...formData, [name]: digits });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("[Profile] saving profile, data:", formData);

    // Validate phone: must be 10 digits when provided
    if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
      alert("Nhập sai định dạng số điện thoại");
      return;
    }

    // Helper: normalize avatar URL (remove cache-bust query param)
    const normalizeAvatar = (a) => {
      if (!a) return "";
      try {
        // treat blob/data URLs as unique (they indicate a new file)
        if (a.startsWith("blob:") || a.startsWith("data:")) return a;
        const url = new URL(a, window.location.origin);
        url.searchParams.delete("t");
        return url.toString();
      } catch (err) {
        // fallback string compare
        return a.replace(/\?t=\d+$/, "");
      }
    };

    // If we have an initial snapshot, check if anything changed; if not, notify and skip
    if (initialForm) {
      const fullnameNow = `${formData.lastName || ""} ${
        formData.firstName || ""
      }`.trim();
      const fullnameThen = `${initialForm.lastName || ""} ${
        initialForm.firstName || ""
      }`.trim();
      const changed =
        fullnameNow !== fullnameThen ||
        (formData.phone || "") !== (initialForm.phone || "") ||
        (formData.address || "") !== (initialForm.address || "") ||
        (formData.gender || "") !== (initialForm.gender || "") ||
        normalizeAvatar(formData.avatar) !==
          normalizeAvatar(initialForm.avatar);
      if (!changed) {
        // show inline info message instead of alert
        setMessage({ text: "Không có thay đổi nào mới", type: "info" });
        if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
        messageTimerRef.current = setTimeout(
          () => setMessage({ text: "", type: "" }),
          4000
        );
        return;
      }
    }

    // Map frontend fields to backend expected payload
    const genderMap = { Nam: "male", Nữ: "female", Khác: "other" };
    const payload = {
      full_name: `${formData.lastName || ""} ${
        formData.firstName || ""
      }`.trim(),
      phone: formData.phone || null,
      address: formData.address || null,
      avatar: formData.avatar || null,
      gender: genderMap[formData.gender] || null,
    };

    try {
      const res = await axiosClient.put("/profile", payload);
      console.log("[Profile] save response:", res.data);

      if (res.data && res.data.success) {
        const saved = res.data.data || {};
        const fullname = saved.full_name || payload.full_name || "";
        let avatar = saved.avatar || payload.avatar || formData.avatar;
        // cache-bust
        if (typeof avatar === "string" && !avatar.startsWith("data:")) {
          const sep = avatar.includes("?") ? "&" : "?";
          avatar = `${avatar}${sep}t=${Date.now()}`;
        }

        const email = saved.email || formData.email;
        localStorage.setItem("fullname", fullname);
        if (avatar) localStorage.setItem("avatar", avatar);
        if (email) localStorage.setItem("email", email);

        // update local UI
        const nameParts = (fullname || "").split(" ");
        const lastName = nameParts.slice(0, -1).join(" ") || "";
        const firstName = nameParts.slice(-1).join(" ") || "";

        const genderMapBack = { male: "Nam", female: "Nữ", other: "Khác" };

        setFormData((prev) => ({
          ...prev,
          firstName,
          lastName,
          gender: genderMapBack[saved.gender] || prev.gender,
          email,
          phone: saved.phone || prev.phone,
          address: saved.address || prev.address,
          avatar,
        }));

        setUserInfo({ fullname, avatar });

        // update initial snapshot so further saves compare against the newly saved state
        const normalizedAvatarForSnapshot =
          typeof avatar === "string"
            ? String(avatar).replace(/\?t=\d+$/, "")
            : avatar;
        setInitialForm({
          firstName,
          lastName,
          gender: genderMapBack[saved.gender] || "",
          email,
          phone: saved.phone || formData.phone || "",
          address: saved.address || formData.address || "",
          avatar: normalizedAvatarForSnapshot,
        });

        try {
          window.dispatchEvent(new Event("profileUpdated"));
        } catch (e) {
          /* ignore */
        }

        // show inline success message instead of alert
        setMessage({ text: "Lưu hồ sơ thành công", type: "success" });
        if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
        messageTimerRef.current = setTimeout(
          () => setMessage({ text: "", type: "" }),
          4000
        );
        return;
      }

      alert(res.data?.message || "Lưu hồ sơ thất bại");
    } catch (err) {
      console.error("[Profile] save error", err);
      const msg =
        err?.response?.data?.message || err.message || "Lưu hồ sơ thất bại";
      alert(msg);
    }
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <main className="flex-1 max-sm:p-3 p-6 mt-0 max-sm:mt-10">
        <div className="flex justify-center">
          <div className="w-full max-w-xl lg:max-w-4xl ">
            <div className="flex items-center bg-[#1BA4FF] rounded-[17px] px-3 py-3 mb-6 gap-3">
              <button
                onClick={() => navigate(userRole === "student" ? "/student-dashboard" : "/instructor-dashboard")}
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

            <div className="bg-white shadow-lg rounded-3xl w-full p-5 sm:p-8 border border-gray-100">
              <div className="flex justify-center mb-6">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28">
                  <img
                    src={formData.avatar}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover border border-gray-200 shadow-sm"
                  />
                  <label
                    htmlFor="avatar"
                    className="absolute bottom-1 right-1 bg-gray-100 border border-gray-300 
                           text-gray-600 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center 
                           rounded-full cursor-pointer hover:bg-gray-200 transition"
                  >
                    <FiCamera className="w-4 h-4" />
                    {/* Accessible label text for screen-readers */}
                    <span className="sr-only">Chọn ảnh đại diện</span>
                    <input
                      type="file"
                      id="avatar"
                      accept="image/*"
                      className="hidden"
                      aria-label="Upload avatar"
                      onChange={async (e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file) return;

                        try {
                          // show a temporary preview while uploading
                          const tmpUrl = URL.createObjectURL(file);
                          setFormData((prev) => ({ ...prev, avatar: tmpUrl }));

                          const form = new FormData();

                          // Ensure we append a real File object. In some cases the UI stores a
                          // preview URL (blob: or data:) instead of the original File; that
                          // won't be accepted by multer. If `file` isn't a File, try to
                          // fetch the blob from the preview URL and convert it to a File.
                          let fileToUpload = file;
                          if (!(fileToUpload instanceof File)) {
                            console.warn(
                              "[Profile] selected item is not a File object, attempting to resolve from preview URL"
                            );
                            const preview = formData.avatar;
                            if (
                              typeof preview === "string" &&
                              (preview.startsWith("blob:") ||
                                preview.startsWith("data:"))
                            ) {
                              try {
                                const fetched = await fetch(preview);
                                const blob = await fetched.blob();
                                // Preserve mimetype if available
                                const ext =
                                  (blob.type && blob.type.split("/")[1]) ||
                                  "jpg";
                                fileToUpload = new File(
                                  [blob],
                                  `avatar.${ext}`,
                                  { type: blob.type || "image/jpeg" }
                                );
                                console.log(
                                  "[Profile] converted preview URL to File for upload",
                                  fileToUpload
                                );
                              } catch (fetchErr) {
                                console.error(
                                  "[Profile] failed to fetch blob from preview URL",
                                  fetchErr
                                );
                                alert(
                                  "Không thể đọc file ảnh từ bản xem trước. Vui lòng chọn lại ảnh từ thiết bị."
                                );
                                return;
                              }
                            } else {
                              alert(
                                "Không tìm thấy file ảnh hợp lệ. Vui lòng chọn file từ máy tính."
                              );
                              return;
                            }
                          }

                          form.append("avatar", fileToUpload);

                          // Log token presence to help debug 401 issues
                          const token = localStorage.getItem("token");
                          console.log(
                            "[Profile] uploading avatar — token present:",
                            !!token,
                            token
                          );

                          // If there's no token, use the no-auth debug endpoint to verify server upload
                          if (!token) {
                            console.warn(
                              "[Profile] No token found — attempting no-auth debug upload to /profile/avatar-test"
                            );
                            const res = await axiosClient.post(
                              "/profile/avatar-test",
                              form
                            );
                            if (res?.data?.data?.avatar) {
                              let savedUrl = res.data.data.avatar;
                              if (
                                typeof savedUrl === "string" &&
                                !savedUrl.startsWith("data:")
                              ) {
                                const sep = savedUrl.includes("?") ? "&" : "?";
                                savedUrl = `${savedUrl}${sep}t=${Date.now()}`;
                              }
                              setFormData((prev) => ({
                                ...prev,
                                avatar: savedUrl,
                              }));
                              localStorage.setItem("avatar", savedUrl);
                              try {
                                window.dispatchEvent(
                                  new Event("profileUpdated")
                                );
                              } catch (e) {
                                /* ignore */
                              }
                            }
                            return;
                          }

                          // When token exists, include it explicitly to ensure Authorization header is present
                          const config = {
                            headers: { Authorization: `Bearer ${token}` },
                          };

                          // IMPORTANT: do NOT set Content-Type manually; let the browser/axios set the multipart boundary
                          const res = await axiosClient.post(
                            "/profile/avatar",
                            form,
                            config
                          );

                          if (
                            res.data &&
                            res.data.data &&
                            res.data.data.avatar
                          ) {
                            let savedUrl = res.data.data.avatar;
                            if (
                              typeof savedUrl === "string" &&
                              !savedUrl.startsWith("data:")
                            ) {
                              const sep = savedUrl.includes("?") ? "&" : "?";
                              savedUrl = `${savedUrl}${sep}t=${Date.now()}`;
                            }
                            setFormData((prev) => ({
                              ...prev,
                              avatar: savedUrl,
                            }));
                            // update UI global storage
                            localStorage.setItem("avatar", savedUrl);
                            // notify other components in the same tab to refresh (storage event won't fire in same tab)
                            try {
                              window.dispatchEvent(new Event("profileUpdated"));
                            } catch (e) {
                              /* ignore */
                            }
                          }
                        } catch (err) {
                          console.error("Avatar upload failed", err);

                          // If auth fails, give a clear message and hint to re-login
                          if (err?.response?.status === 401) {
                            console.warn(
                              "[Profile] Upload blocked by 401 — token invalid or expired"
                            );
                            alert(
                              "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại và thử lại."
                            );
                            return;
                          }

                          const msg =
                            err?.response?.data?.message ||
                            err.message ||
                            "Không thể tải ảnh lên. Vui lòng thử lại.";
                          alert(msg);
                        }
                      }}
                    />
                    <span id="avatar-desc" className="sr-only">
                      Chọn file ảnh để cập nhật ảnh đại diện
                    </span>
                  </label>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex max-lg:flex-col flex-row gap-6">
                  <div className="flex flex-1 items-center max-lg:flex-col max-lg:items-start gap-3">
                    <label
                      htmlFor="lastName"
                      className="w-24 text-xl max-lg:text-[16px] text-[#606060] font-normal"
                    >
                      Họ:
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Họ"
                      title="Họ"
                      autoComplete="family-name"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>

                  <div className="flex flex-1 items-center max-lg:flex-col max-lg:items-start gap-3">
                    <label
                      htmlFor="firstName"
                      className="w-24 text-xl max-lg:text-[16px] text-[#606060] font-normal"
                    >
                      Tên:
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="Tên"
                      title="Tên"
                      autoComplete="given-name"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="w-24 text-xl max-lg:text-[16px] text-[#606060] font-normal">
                    Giới tính:
                  </label>
                  <div className="flex gap-6 text-xl max-lg:text-[16px]">
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
                    placeholder: "Email",
                  },
                  {
                    label: "SĐT:",
                    name: "phone",
                    type: "text",
                    placeholder: "Số điện thoại",
                  },
                  {
                    label: "Địa chỉ:",
                    name: "address",
                    type: "text",
                    placeholder: "Địa chỉ",
                  },
                ].map((field) => (
                  <div
                    key={field.name}
                    className="flex flex-col sm:flex-row sm:items-center gap-2"
                  >
                    <label className="text-[#606060] font-normal w-auto sm:w-24">
                      {field.label}
                    </label>
                    <input
                      id={`field-${field.name}`}
                      type={field.type}
                      name={field.name}
                      value={formData[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      title={field.label.replace(":", "")}
                      autoComplete={
                        field.name === "email"
                          ? "email"
                          : field.name === "phone"
                          ? "tel"
                          : "street-address"
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                      // make email read-only (cannot be changed from profile page)
                      readOnly={field.name === "email"}
                      disabled={field.name === "email"}
                    />
                  </div>
                ))}

                {/* Inline message shown above the Save button */}
                <div className="flex justify-center pt-2">
                  {message.text && (
                    <div
                      className={`mb-3 px-4 py-2 rounded-md text-sm ${
                        message.type === "success"
                          ? "bg-green-50 text-green-800 border border-green-200"
                          : message.type === "error"
                          ? "bg-red-50 text-red-800 border border-red-200"
                          : "bg-blue-50 text-blue-800 border border-blue-200"
                      }`}
                      role="status"
                      aria-live="polite"
                    >
                      {message.text}
                    </div>
                  )}
                </div>

                <div className="flex justify-center pt-4">
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-normal px-6 py-2 rounded-lg transition group"
                  >
                    <FiSave className="text-xl group-hover:text-blue-100 transition" />
                    <span className="text-lg sm:text-xl">Lưu hồ sơ</span>
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
