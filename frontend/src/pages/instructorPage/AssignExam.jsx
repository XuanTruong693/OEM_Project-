// 📁 AssignExam.jsx
import React, { useState, useEffect } from "react";
import {
  FiPlus,
  FiSearch,
  FiEdit,
  FiTrash2,
  FiSettings,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiHash,
  FiFileText,
} from "react-icons/fi";
import axios from "axios";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { timeAgo } from "../../../../backend/src/utils/timeAgo";

const AssignExam = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const fetchExams = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get(
        `http://localhost:5000/api/assign-bank/exams`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            page: currentPage,
            limit: 10,
            search: searchTerm || undefined,
            status: filterStatus === "all" ? undefined : filterStatus,
          },
        }
      );

      const { data, pagination } = response.data;
      setExams(data);
      setTotalPages(pagination.totalPages || 1);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Không thể tải danh sách đề thi. Vui lòng thử lại.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [currentPage, searchTerm, filterStatus]);

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đề thi này?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/assign-bank/exams/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Xóa đề thi thành công!");
      fetchExams();
    } catch (err) {
      const msg =
        err.response?.data?.message || "Xóa đề thi thất bại. Vui lòng thử lại.";
      alert(msg);
    }
  };

  const handlePublish = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn mở phòng thi?")) return;
    try {
      await axios.post(
        `http://localhost:5000/api/assign-bank/exams/${id}/publish`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Mở phòng thi thành công!");
      fetchExams();
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Không thể mở phòng thi. Vui lòng thử lại.";
      alert(msg);
    }
  };

  const filteredExams = exams.filter((exam) => {
    const matchesSearch = exam.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterStatus === "all" || exam.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Ngân hàng đề thi
            </h1>
            <p className="text-gray-600 mt-1">
              Quản lý và phân công đề thi cho học viên
            </p>
          </div>
          <button
            onClick={() => navigate("/instructor/upload-exam")}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            <FiPlus className="w-5 h-5" />
            Tạo đề thi mới
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Tìm kiếm đề thi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-5 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="draft">Nháp</option>
              <option value="published">Đã mở</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <p className="text-gray-500 mb-4">Chưa có đề thi nào</p>
            <button
              onClick={() => navigate("/instructor/upload-exam")}
              className="text-purple-600 hover:underline"
            >
              Tạo đề thi đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredExams.map((exam) => (
              <div
                key={exam.id}
                className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-lg transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {exam.title}
                    </h3>
                    <div className="flex items-center  gap-6 mt-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <FiHash className="w-4 h-4" />
                        <span>{exam.exam_room_code || "Chưa mở phòng"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FiFileText className="w-4 h-4" />
                        <span>
                          {exam.status === "draft" ? "Nháp" : "Đã mở"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <span>Đã đẩy đề thi từ {timeAgo(exam.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        navigate(`/instructor/exams/${exam.id}/edit`)
                      }
                      className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl"
                      title="Chỉnh sửa đề thi"
                    >
                      <FiEdit className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => handleDelete(exam.id)}
                      className="p-3 text-red-600 hover:bg-red-50 rounded-xl"
                      title="Xóa"
                    >
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignExam;
