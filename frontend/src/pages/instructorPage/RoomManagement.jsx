import React, { useState, useEffect } from "react";
import { 
  FiSearch, 
  FiClock, 
  FiUsers, 
  FiExternalLink, 
  FiXCircle, 
  FiRefreshCw, 
  FiAlertCircle,
  FiChevronRight
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient.js";
import { useUi } from "../../context/UiContext.jsx";
import ConfirmModal from "../../components/common/ConfirmModal.jsx";
import { motion, AnimatePresence } from "framer-motion";

const RoomManagement = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState({ isOpen: false, examId: null });
  const { t } = useUi();
  const navigate = useNavigate();

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await axiosClient.get("/instructor/rooms/active");
      setRooms(response.data);
      setError(null);
    } catch (err) {
      console.error("Fetch rooms failed:", err);
      setError("Không thể tải danh sách phòng thi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCloseRoom = async (examId) => {
    setShowConfirm({ isOpen: true, examId });
  };

  const confirmCloseRoom = async () => {
    const examId = showConfirm.examId;
    try {
      await axiosClient.post(`/instructor/rooms/${examId}/close`);
      fetchRooms();
      setShowConfirm({ isOpen: false, examId: null });
    } catch (err) {
      alert("Đóng phòng thi thất bại.");
    }
  };

  const filteredRooms = Array.isArray(rooms) ? rooms.filter(room => 
    room.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    room.exam_room_code?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {t("room_management", "Quản lý phòng thi", "Room Management")}
          </h1>
          <p className="mt-2 text-gray-500">Theo dõi và can thiệp thời gian thực cho các bài thi đang diễn ra.</p>
        </div>
        <button 
          onClick={fetchRooms}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-all text-gray-700 font-medium"
        >
          <FiRefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Tải lại
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-200 text-white flex flex-col justify-center items-center text-center">
          <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">Phòng đang mở</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-black">{Array.isArray(rooms) ? rooms.length : 0}</span>
            <span className="text-blue-100">phòng active</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-3xl shadow-lg shadow-emerald-200 text-white flex flex-col justify-center items-center text-center">
          <p className="text-emerald-100 text-sm font-medium uppercase tracking-wider">Tổng sinh viên</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-black">{Array.isArray(rooms) ? rooms.reduce((acc, r) => acc + (r.active_students || 0), 0) : 0}</span>
            <span className="text-emerald-100">đang thi</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
        <input 
          type="text"
          placeholder="Tìm tên bài thi hoặc mã phòng..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all text-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Grid of Rooms */}
      {loading && rooms.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-3xl"></div>
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
          <FiAlertCircle className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">Không tìm thấy phòng thi nào đang hoạt động.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredRooms.map((room) => (
              <motion.div
                key={room.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group"
              >
                <div className="p-6 space-y-4 flex-1">
                  <div className="flex justify-between items-start">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full uppercase tracking-tighter">
                      Mã: {room.exam_room_code}
                    </span>
                    <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold animate-pulse">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      LIVE
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-800 line-clamp-2 min-h-[3.5rem]">
                    {room.title}
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-gray-500">
                      <FiUsers className="w-4 h-4" />
                      <span className="text-sm">{room.active_students || 0} sinh viên</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <FiClock className="w-4 h-4" />
                      <span className="text-sm">{room.duration_minutes} phút</span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 flex items-center gap-2">
                  <button 
                    onClick={() => navigate(`/room-management/${room.id}`)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                  >
                    Can thiệp <FiExternalLink className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleCloseRoom(room.id)}
                    className="p-2.5 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                    title="Đóng phòng thi"
                  >
                    <FiXCircle className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {/* Confirm Modal */}
      <ConfirmModal 
        isOpen={showConfirm.isOpen}
        title="Đóng phòng thi"
        message="Bạn có chắc chắn muốn đóng phòng thi này? Tất cả sinh viên đang thi sẽ bị buộc dừng lại ngay lập tức."
        confirmText="Đóng ngay"
        cancelText="Hủy"
        type="danger"
        onConfirm={confirmCloseRoom}
        onCancel={() => setShowConfirm({ isOpen: false, examId: null })}
      />
    </div>
  );
};

export default RoomManagement;
