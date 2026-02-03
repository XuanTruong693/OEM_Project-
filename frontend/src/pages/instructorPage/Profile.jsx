import React, { useState, useEffect } from "react";
import axiosClient from "../../api/axiosClient";
import { FiCamera, FiSave } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { getFullImageUrl } from "../../utils/imageUtils";

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Detect user role to determine which dashboard to return to
  const userRole = localStorage.getItem("role");

  // Auto-redirect Instructor to nested route to keep socket alive
  useEffect(() => {
    if (userRole === "instructor" && location.pathname === "/profile") {
      navigate("/instructor/profile", { replace: true });
    }
  }, [userRole, location.pathname, navigate]);

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

          // Normalize avatar URL from DB (remove any existing timestamp params)
          const avatarFromDB = user.avatar || "/icons/UI Image/default-avatar.png";
          const normalizedAvatar = typeof avatarFromDB === "string"
            ? avatarFromDB.replace(/[?&]t=\d+/g, "")
            : avatarFromDB;

          setFormData((prev) => ({
            ...prev,
            firstName,
            lastName,
            gender: genderMapBack[user.gender] || "",
            email: user.email || prev.email,
            phone: user.phone || "",
            address: user.address || "",
            avatar: avatarFromDB,
          }));

          // store a normalized snapshot for change detection
          setInitialForm({
            firstName,
            lastName,
            gender: genderMapBack[user.gender] || "",
            email: user.email || "",
            phone: user.phone || "",
            address: user.address || "",
            avatar: normalizedAvatar, // Store normalized version
          });

          setUserInfo({
            fullname: user.full_name || "Giảng viên",
            avatar: avatarFromDB,
          });

          // also persist a couple of values locally for other UI
          if (user.full_name) localStorage.setItem("fullname", user.full_name);
          if (avatarFromDB) localStorage.setItem("avatar", avatarFromDB);
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

    // Validate phone: must be 10 digits when provided
    if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
      alert("Nhập sai định dạng số điện thoại");
      return;
    }

    // Helper: normalize avatar URL (remove ALL cache-bust query params and extract just the path)
    const normalizeAvatar = (a) => {
      if (!a) return "";
      if (typeof a !== "string") return String(a);

      // treat blob/data URLs as unique (new upload in progress)
      if (a.startsWith("blob:") || a.startsWith("data:")) return a;

      try {
        // Parse URL and remove timestamp param
        const url = new URL(a, window.location.origin);
        url.searchParams.delete("t");
        // Return just the pathname + search (without timestamp)
        return url.pathname + url.search;
      } catch (err) {
        // fallback: remove both ?t= and &t= patterns
        const cleaned = a.replace(/[?&]t=\d+/g, "");
        // Try to extract just the path
        try {
          return new URL(cleaned, window.location.origin).pathname;
        } catch {
          return cleaned;
        }
      }
    };

    // If we have an initial snapshot, check if anything changed; if not, notify and skip
    if (initialForm) {
      const fullnameNow = `${formData.lastName || ""} ${formData.firstName || ""
        }`.trim();
      const fullnameThen = `${initialForm.lastName || ""} ${initialForm.firstName || ""
        }`.trim();

      const normalizedCurrentAvatar = normalizeAvatar(formData.avatar);
      const normalizedInitialAvatar = normalizeAvatar(initialForm.avatar);

      const changed =
        fullnameNow !== fullnameThen ||
        (formData.phone || "") !== (initialForm.phone || "") ||
        (formData.address || "") !== (initialForm.address || "") ||
        (formData.gender || "") !== (initialForm.gender || "") ||
        normalizedCurrentAvatar !== normalizedInitialAvatar;

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
    // NOTE: Do NOT include avatar here - it's handled separately via /profile/avatar endpoint
    const genderMap = { Nam: "male", Nữ: "female", Khác: "other" };
    const payload = {
      full_name: `${formData.lastName || ""} ${formData.firstName || ""
        }`.trim(),
      phone: formData.phone || null,
      address: formData.address || null,
      gender: genderMap[formData.gender] || null,
    };

    try {
      const res = await axiosClient.put("/profile", payload);

      if (res.data && res.data.success) {
        const saved = res.data.data || {};
        const fullname = saved.full_name || payload.full_name || "";

        // Avatar is NOT included in this response - keep current avatar from formData
        const currentAvatar = formData.avatar;

        const email = saved.email || formData.email;
        localStorage.setItem("fullname", fullname);
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
          // Keep the current avatar - it's managed separately
        }));

        setUserInfo({ fullname, avatar: currentAvatar });

        // update initial snapshot so further saves compare against the newly saved state
        // Normalize avatar: extract path only (consistent with upload logic)
        let normalizedAvatarForSnapshot = currentAvatar;
        if (typeof currentAvatar === "string") {
          try {
            const url = new URL(currentAvatar, window.location.origin);
            url.searchParams.delete("t");
            normalizedAvatarForSnapshot = url.pathname;
          } catch {
            normalizedAvatarForSnapshot = currentAvatar.replace(/[?&]t=\d+/g, "");
          }
        }

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-1/3 -left-24 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-24 left-1/3 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header with Logo */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => navigate(userRole === "student" ? "/student-dashboard" : "/instructor-dashboard")}
                className="flex items-center gap-2 px-3 py-2 text-slate-700 rounded-lg hover:bg-slate-100 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-medium hidden sm:inline">Quay lại</span>
              </button>

              <div className="h-8 w-px bg-slate-300 hidden sm:block"></div>

              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Hồ sơ cá nhân
              </h1>
            </div>

            {/* Desktop Center Logo */}
            <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:block">
              <img src="/Logo.png" alt="System Logo" className="h-12 w-auto" />
            </div>

            {/* Mobile Right Logo */}
            <div className="md:hidden">
              <img src="/Logo.png" alt="System Logo" className="h-8 w-auto" />
            </div>

            <div className="w-32 hidden md:block"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white/80 backdrop-blur-xl shadow-2xl rounded-3xl border border-white/20 overflow-hidden">
          <div className="p-6 sm:p-8">
            {/* Avatar Section - Larger */}
            <div className="flex justify-center mb-6">
              <div className="relative w-32 h-32 sm:w-36 sm:h-36">
                <img
                  src={getFullImageUrl(formData.avatar)}
                  alt="Avatar"
                  className="w-full h-full rounded-full object-cover border-4 border-gradient-to-r from-blue-500 to-indigo-600 shadow-2xl ring-4 ring-blue-100"
                />
                <label
                  htmlFor="avatar"
                  className="absolute bottom-1 right-1 bg-gradient-to-br from-blue-500 to-indigo-600 
                         text-white w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center 
                         rounded-full cursor-pointer hover:from-blue-600 hover:to-indigo-700 transition-all 
                         shadow-lg hover:shadow-xl border-3 border-white"
                >
                  <FiCamera className="w-5 h-5" />
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

                            // Normalize URL: extract path only
                            let normalizedUrl = savedUrl;
                            if (typeof savedUrl === "string") {
                              try {
                                const url = new URL(savedUrl, window.location.origin);
                                url.searchParams.delete("t");
                                normalizedUrl = url.pathname;
                              } catch {
                                normalizedUrl = savedUrl.replace(/[?&]t=\d+/g, "");
                              }
                            }

                            setFormData((prev) => ({
                              ...prev,
                              avatar: savedUrl,
                            }));

                            // Update initialForm to reflect the new avatar state
                            setInitialForm((prev) => {
                              return {
                                ...prev,
                                avatar: normalizedUrl,
                              };
                            });

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

                          // Normalize URL for initialForm: extract path only
                          let normalizedUrl = savedUrl;
                          if (typeof savedUrl === "string") {
                            try {
                              const url = new URL(savedUrl, window.location.origin);
                              url.searchParams.delete("t");
                              normalizedUrl = url.pathname;
                            } catch {
                              normalizedUrl = savedUrl.replace(/[?&]t=\d+/g, "");
                            }
                          }

                          setFormData((prev) => ({
                            ...prev,
                            avatar: savedUrl,
                          }));

                          // Update initialForm to reflect the new avatar state
                          setInitialForm((prev) => {
                            return {
                              ...prev,
                              avatar: normalizedUrl,
                            };
                          });

                          // update UI global storage
                          localStorage.setItem("avatar", savedUrl);
                          // notify other components in the same tab to refresh (storage event won't fire in same tab)
                          try {
                            window.dispatchEvent(new Event("profileUpdated"));
                          } catch (e) {
                            /* ignore */
                          }

                          // Show success message
                          setMessage({ text: "Cập nhật ảnh đại diện thành công!", type: "success" });
                          if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
                          messageTimerRef.current = setTimeout(
                            () => setMessage({ text: "", type: "" }),
                            4000
                          );
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
                </label>
                <span id="avatar-desc" className="sr-only">
                  Chọn file ảnh để cập nhật ảnh đại diện
                </span>
              </div>
            </div>

            {/* Form Section - Enhanced */}
            <form onSubmit={handleSubmit} className="space-y-5 mt-6">
              {/* Name Fields */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="lastName"
                    className="block text-base font-semibold text-slate-700"
                  >
                    Họ:
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Nhập họ của bạn"
                    title="Họ"
                    autoComplete="family-name"
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base 
                               focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none 
                               transition-all hover:border-slate-300"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="firstName"
                    className="block text-base font-semibold text-slate-700"
                  >
                    Tên:
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Nhập tên của bạn"
                    title="Tên"
                    autoComplete="given-name"
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base 
                               focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none 
                               transition-all hover:border-slate-300"
                  />
                </div>
              </div>

              {/* Gender Field */}
              <div className="space-y-2">
                <label className="block text-base font-semibold text-slate-700">
                  Giới tính:
                </label>
                <div className="flex gap-6 text-base">
                  {["Nam", "Nữ", "Khác"].map((g) => (
                    <label key={g} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={formData.gender === g}
                        onChange={handleChange}
                        className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="group-hover:text-blue-600 transition-colors font-medium">
                        {g}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Contact Fields */}
              {[
                {
                  label: "Email:",
                  name: "email",
                  type: "email",
                  placeholder: "example@email.com",
                },
                {
                  label: "SĐT:",
                  name: "phone",
                  type: "text",
                  placeholder: "0123456789",
                },
                {
                  label: "Địa chỉ:",
                  name: "address",
                  type: "text",
                  placeholder: "Nhập địa chỉ của bạn",
                },
              ].map((field) => (
                <div
                  key={field.name}
                  className="space-y-1.5"
                >
                  <label
                    htmlFor={`field-${field.name}`}
                    className="block text-base font-semibold text-slate-700"
                  >
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
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base 
                               focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none 
                               transition-all hover:border-slate-300 disabled:bg-slate-50 
                               disabled:text-slate-500 disabled:cursor-not-allowed"
                    readOnly={field.name === "email"}
                    disabled={field.name === "email"}
                  />
                </div>
              ))}

              {/* Message & Save Button */}
              <div className="flex flex-col items-center pt-4 space-y-3">
                {message.text && (
                  <div
                    className={`px-5 py-3 rounded-xl text-sm font-medium shadow-lg ${message.type === "success"
                      ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border-2 border-green-200"
                      : message.type === "error"
                        ? "bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border-2 border-red-200"
                        : "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border-2 border-blue-200"
                      }`}
                    role="status"
                    aria-live="polite"
                  >
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 
                             hover:from-blue-600 hover:to-indigo-700 text-white font-semibold 
                             px-8 py-3 rounded-xl transition-all shadow-xl hover:shadow-2xl 
                             hover:scale-105 active:scale-95 group text-base"
                >
                  <FiSave className="text-lg group-hover:rotate-12 transition-transform" />
                  <span>Lưu hồ sơ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
