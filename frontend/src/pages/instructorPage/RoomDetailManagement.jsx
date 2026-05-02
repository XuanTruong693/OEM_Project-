import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiClock, FiUsers, FiSettings, FiSave, FiAlertTriangle,
  FiShield, FiUserX, FiCheckCircle, FiRefreshCw, FiCamera, FiLayout,
  FiChevronLeft, FiSearch, FiMoreVertical, FiAlertCircle
} from "react-icons/fi";
import axiosClient from "../../api/axiosClient.js";
import { useUi } from "../../context/UiContext.jsx";
import ConfirmModal from "../../components/common/ConfirmModal.jsx";
import Toast from "../../components/common/Toast.jsx";
import { motion, AnimatePresence } from "framer-motion";
import io from "socket.io-client";
import { SOCKET_URL } from "../../api/config";

const RoomDetailManagement = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { t } = useUi();
  const socketRef = useRef(null);

  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Config form state
  const [config, setConfig] = useState({
    duration_minutes: 0,
    time_open: "",
    time_close: "",
    require_face_check: false,
    require_student_card: false,
    monitor_screen: false,
    grading_mode: "auto",
    allow_view_answers: false
  });

  const [showConfirm, setShowConfirm] = useState({
    isOpen: false,
    submissionId: null,
    action: '',
    title: '',
    message: '',
    type: 'warning'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [examRes, studentsRes] = await Promise.all([
        axiosClient.get(`/instructor/rooms/${examId}`),
        axiosClient.get(`/instructor/rooms/${examId}/students`)
      ]);

      const currentExam = examRes.data;
      if (!currentExam || currentExam.message) {
        setError(currentExam?.message || "Không tìm thấy dữ liệu phòng thi.");
        return;
      }

      const formatForInput = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        // Chuyển đổi sang chuỗi YYYY-MM-DDTHH:mm theo giờ địa phương
        const pad = (n) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      setExam(currentExam);
      setStudents(studentsRes.data);
      setConfig({
        duration_minutes: currentExam.duration_minutes || 0,
        time_open: formatForInput(currentExam.time_open),
        time_close: formatForInput(currentExam.time_close),
        require_face_check: !!currentExam.require_face_check,
        require_student_card: !!currentExam.require_student_card,
        monitor_screen: !!currentExam.monitor_screen,
        grading_mode: currentExam.grading_mode || "auto",
        allow_view_answers: !!currentExam.allow_view_answers
      });
    } catch (err) {
      console.error("Fetch failed:", err);
      setError(err.response?.data?.message || err.message || "Lỗi kết nối hệ thống.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Initialize Socket
    socketRef.current = io(SOCKET_URL || window.location.origin, {
      withCredentials: true,
      transports: ["websocket"]
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to room management socket");
      socketRef.current.emit("instructor:join-exam", examId);
    });

    // Listen for new student registrations
    socketRef.current.on("student:registered", (data) => {
      setStudents(prev => {
        // Only add if not already in list
        if (prev.find(s => s.submission_id === data.submissionId)) return prev;
        return [{
          submission_id: data.submissionId,
          student_id: data.studentId,
          name: data.studentName,
          status: 'pending',
          attempt_no: data.attempt_no || 1,
          cheating_count: 0,
          started_at: new Date().toISOString()
        }, ...prev];
      });
    });

    // Listen for status updates (bypass, kick, start)
    socketRef.current.on("instructor:student-status-updated", (data) => {
      setStudents(prev => prev.map(s => 
        String(s.submission_id) === String(data.submissionId)
          ? { ...s, ...data }
          : s
      ));
    });

    // Listen for cheating detections to update counts in real-time
    socketRef.current.on("cheating:detected", (data) => {
      if (String(data.examId) === String(examId)) {
        setStudents(prev => prev.map(s =>
          String(s.submission_id) === String(data.submissionId)
            ? { ...s, cheating_count: data.cheatingCount }
            : s
        ));
      }
    });

    // Listen for submission completion
    socketRef.current.on("student:submission-finished", (data) => {
      setStudents(prev => prev.map(s =>
        String(s.submission_id) === String(data.submissionId)
          ? { ...s, status: 'submitted' }
          : s
      ));
    });

    // Listen for global room config updates (from another instructor)
    socketRef.current.on("exam:config-updated", (updates) => {
      if (updates.duration_minutes) setDuration(updates.duration_minutes);
      if (updates.monitor_screen !== undefined) {
        setMonitorScreen(updates.monitor_screen === 1 || updates.monitor_screen === true);
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [examId]);

  const handleUpdateConfig = async () => {
    try {
      setUpdating(true);

      // Đồng bộ múi giờ: Gửi chuỗi thời gian địa phương (Local Time) trực tiếp tới server
      const configToUpdate = { ...config };
      const toMySQL = (localIso) => {
        if (!localIso) return null;
        // datetime-local format is YYYY-MM-DDTHH:mm, MySQL expects YYYY-MM-DD HH:mm:ss
        return localIso.replace("T", " ") + ":00";
      };

      if (configToUpdate.time_open !== undefined) {
        configToUpdate.time_open = toMySQL(configToUpdate.time_open);
      }
      if (configToUpdate.time_close !== undefined) {
        configToUpdate.time_close = toMySQL(configToUpdate.time_close);
      }

      await axiosClient.patch(`/instructor/rooms/${examId}/config`, configToUpdate);
      fetchData();
      setToast({ message: "Cấu hình đã được cập nhật!", type: "success" });
    } catch (err) {
      setToast({ message: "Cập nhật thất bại.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleStudentAction = async (submissionId, action) => {
    const title = action === 'kick' ? "Trục xuất sinh viên" : "Bỏ qua xác minh";
    const message = action === 'kick'
      ? "Bạn có chắc muốn kết thúc bài thi của sinh viên này ngay lập tức? Thao tác này không thể hoàn tác."
      : "Cấp quyền cho phép sinh viên này tiếp tục thi mà không cần qua các bước xác minh hình ảnh/thẻ sinh viên?";
    const type = action === 'kick' ? 'danger' : 'info';

    setShowConfirm({
      isOpen: true,
      submissionId,
      action,
      title,
      message,
      type
    });
  };

  const confirmStudentAction = async () => {
    const { submissionId, action } = showConfirm;
    try {
      await axiosClient.post(`/instructor/rooms/students/${submissionId}/action`, { action });

      if (action === 'kick') {
        setStudents(prev => prev.map(s => s.submission_id === submissionId ? { ...s, status: 'submitted' } : s));
        setToast({ message: "Đã mời sinh viên ra khỏi phòng.", type: "success" });
      } else {
        setStudents(prev => prev.map(s => s.submission_id === submissionId ? { ...s, is_bypassed: true } : s));
        setToast({ message: "Đã cho phép sinh viên bỏ qua xác minh.", type: "success" });
      }
      setShowConfirm(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
      setToast({ message: "Thao tác thất bại.", type: "error" });
    }
  };

  const filteredStudents = Array.isArray(students) ? students.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  if (loading && !exam) return <div className="flex items-center justify-center h-full"><FiRefreshCw className="animate-spin w-8 h-8 text-blue-500" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto h-[calc(100vh-140px)] flex flex-col gap-6 overflow-hidden">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/room-management")}
            className="p-2 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition-all"
          >
            <FiChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
              {exam?.title}
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-lg border border-emerald-100 flex items-center gap-1.5 uppercase letter-spacing-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                Đang diễn ra
              </span>
            </h1>
            <p className="text-sm text-gray-500 font-medium">Mã phòng: {exam?.exam_room_code}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-4 py-2 border-r border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">Thời gian thi</p>
            <p className="text-lg font-black text-blue-600 leading-none">{exam?.duration_minutes}p</p>
          </div>
          <div className="px-4 py-2 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">Sĩ số bài làm</p>
            <p className="text-lg font-black text-gray-800 leading-none">{students.length}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        {/* Left Side: Room Config */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FiSettings className="text-blue-500" /> Cấu hình phòng thi
            </h2>
            <button
              onClick={handleUpdateConfig}
              disabled={updating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-100 transition-all active:scale-95"
            >
              <FiSave /> {updating ? "Đang lưu..." : "Áp dụng"}
            </button>
          </div>

          <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Thời gian làm bài (phút)</label>
                <div className="relative">
                  <FiClock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="number"
                    value={config.duration_minutes}
                    onChange={(e) => setConfig({ ...config, duration_minutes: parseInt(e.target.value) })}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Thời điểm mở phòng</label>
                  <input
                    type="datetime-local"
                    value={config.time_open}
                    onChange={(e) => setConfig({ ...config, time_open: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Thời điểm kết thúc</label>
                  <input
                    type="datetime-local"
                    value={config.time_close}
                    onChange={(e) => setConfig({ ...config, time_close: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 transition-all font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Chế độ giám sát</label>

              <div className="grid grid-cols-1 gap-3">
                <ConfigToggle
                  icon={FiCamera}
                  label="Nhận diện khuôn mặt"
                  desc="Yêu cầu SV chụp ảnh xác minh"
                  active={config.require_face_check}
                  onClick={() => setConfig({ ...config, require_face_check: !config.require_face_check })}
                />
                <ConfigToggle
                  icon={FiShield}
                  label="Yêu cầu Thẻ SV"
                  desc="Verify thẻ thông qua AI"
                  active={config.require_student_card}
                  onClick={() => setConfig({ ...config, require_student_card: !config.require_student_card })}
                />
                <ConfigToggle
                  icon={FiLayout}
                  label="Giám sát màn hình"
                  desc="Tự động phát hiện Alt-Tab"
                  active={config.monitor_screen}
                  onClick={() => setConfig({ ...config, monitor_screen: !config.monitor_screen })}
                />
                <ConfigToggle
                  icon={FiCheckCircle}
                  label="Cho phép xem đáp án"
                  desc="SV có thể xem lại kết quả chi tiết sau khi thi"
                  active={config.allow_view_answers}
                  onClick={() => setConfig({ ...config, allow_view_answers: !config.allow_view_answers })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Student List */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
              <FiUsers className="text-emerald-500" /> Danh sách sinh viên
            </h2>
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                placeholder="Tìm tên, email..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-100 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button onClick={fetchData} className="p-2 text-gray-400 hover:text-blue-500 transition-all">
              <FiRefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sinh viên</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Trạng thái</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vi phạm</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence>
                  {filteredStudents.map((s) => (
                    <motion.tr
                      key={s.submission_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-blue-50/30 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black text-xs">
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-gray-800 leading-none">{s.name}</p>
                              {s.attempt_no > 1 && (
                                <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-black rounded-md border border-purple-100">
                                  Lần {s.attempt_no}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 leading-none">{s.email || "No email"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${s.cheating_count > 0 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`}></div>
                          <span className={`text-sm font-bold ${s.cheating_count > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {s.cheating_count} lần
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ActionButton
                            icon={FiCheckCircle}
                            label="Bypass"
                            color="blue"
                            disabled={s.is_bypassed || !['in_progress', 'registered', 'pending'].includes(s.status)}
                            onClick={() => handleStudentAction(s.submission_id, 'bypass')}
                            title="Cho phép bỏ qua xác minh"
                          />
                          <ActionButton
                            icon={FiUserX}
                            label="Kick"
                            color="red"
                            disabled={!['in_progress', 'registered', 'pending'].includes(s.status)}
                            onClick={() => handleStudentAction(s.submission_id, 'kick')}
                            title="Buộc nộp bài"
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>

            {filteredStudents.length === 0 && (
              <div className="py-20 text-center">
                <FiUsers className="mx-auto w-12 h-12 text-gray-200 mb-2" />
                <p className="text-gray-400">Không có thí sinh nào trong danh sách hiện tại.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Notifications */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showConfirm.isOpen}
        title={showConfirm.title}
        message={showConfirm.message}
        onConfirm={confirmStudentAction}
        onCancel={() => setShowConfirm(prev => ({ ...prev, isOpen: false }))}
        type={showConfirm.type}
        confirmText="Xác nhận"
      />
    </div>
  );
};

// UI Components
const ConfigToggle = ({ icon: Icon, label, desc, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${active ? "border-blue-500 bg-blue-50/50" : "border-gray-50 bg-white hover:border-gray-200"}`}
  >
    <div className="flex items-center gap-4">
      <div className={`p-2.5 rounded-xl ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-gray-100 text-gray-500"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-left">
        <p className={`text-sm font-bold ${active ? "text-blue-700" : "text-gray-700"}`}>{label}</p>
        <p className="text-[11px] text-gray-400 font-medium">{desc}</p>
      </div>
    </div>
    <div className={`w-10 h-6 rounded-full relative transition-colors ${active ? "bg-blue-600" : "bg-gray-200"}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${active ? "left-5 shadow-sm" : "left-1"}`}></div>
    </div>
  </button>
);

const StatusBadge = ({ status }) => {
  const config = {
    in_progress: { label: "Đang thi", class: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    submitted: { label: "Đã nộp", class: "bg-blue-50 text-blue-600 border-blue-100" },
    kicked: { label: "BỊ KICK", class: "bg-red-50 text-red-600 border-red-100" },
    registered: { label: "CHỜ VERIFY", class: "bg-amber-50 text-amber-600 border-amber-100" },
    pending: { label: "CHỜ VERIFY", class: "bg-amber-50 text-amber-600 border-amber-100" }
  };
  const s = config[status] || { label: status, class: "bg-gray-50 text-gray-600" };
  return <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${s.class}`}>{s.label}</span>;
};

const ActionButton = ({ icon: Icon, color, onClick, disabled, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${color === 'red' ? "bg-red-50 text-red-500 hover:bg-red-500 hover:text-white" : "bg-blue-50 text-blue-500 hover:bg-blue-600 hover:text-white"
      }`}
  >
    <Icon className="w-5 h-5" />
  </button>
);

const AlertBlock = ({ message }) => (
  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
    <FiAlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
    <p className="text-xs text-amber-800 leading-relaxed font-medium">{message}</p>
  </div>
);

export default RoomDetailManagement;
