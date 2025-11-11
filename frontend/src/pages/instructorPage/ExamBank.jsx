import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit, FiTrash2, FiHash, FiFileText } from "react-icons/fi";
import axios from "axios";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { timeAgo } from "../../../../backend/src/utils/timeAgo";

const ExamBank = () => {
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
      const msg = err.response?.data?.message || "Không thể tải danh sách đề thi. Vui lòng thử lại.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [currentPage, searchTerm, filterStatus]);

  // no inline preview; navigate to edit page instead

  const parseTs = (v) => (v ? new Date(String(v).replace(' ', 'T')) : null);
  const isValid = (d) => d instanceof Date && !isNaN(d.getTime());
  // Chỉ dựa vào khoảng thời gian open/close để xác định đang thi
  const isInProgress = (exam) => {
    const open = parseTs(exam.time_open);
    const close = parseTs(exam.time_close);
    if (!isValid(open) || !isValid(close)) return false;
    const now = new Date();
    return now >= open && now <= close;
  };

  // Cho phép sửa/xóa TẤT CẢ ngoại trừ khi đang thi trong khoảng thời gian
  const canEditExam = (exam) => !isInProgress(exam);

  const getPhase = (e) => {
    const now = new Date();
    const open = e.time_open ? new Date(e.time_open) : null;
    const close = e.time_close ? new Date(e.time_close) : null;
    if ((!open && !close) || (open && now < open)) return { label: 'Chưa mở', cls: 'bg-slate-100 text-slate-700' };
    if (close && now > close) return { label: 'Đã đóng thi', cls: 'bg-rose-50 text-rose-700' };
    if (open && close && now >= open && now <= close) return { label: 'Trong quá trình', cls: 'bg-emerald-50 text-emerald-700' };
    // return { label: 'Chưa mở', cls: 'bg-slate-100 text-slate-700' };
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đề thi này?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/assign-bank/exams/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Xóa đề thi thành công!");
      fetchExams();
    } catch (err) {
      const msg = err.response?.data?.message || "Xóa đề thi thất bại. Vui lòng thử lại.";
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
      const msg = err.response?.data?.message || "Không thể mở phòng thi. Vui lòng thử lại.";
      alert(msg);
    }
  };

  const filteredExams = exams.filter((exam) => {
    const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || exam.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ngân hàng đề thi</h1>
            <p className="text-gray-600 mt-1">Quản lý và phân công đề thi cho học viên</p>
          </div>
          {/* Loại bỏ nút Tạo đề thi mới theo yêu cầu */}
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
            <button onClick={() => navigate("/instructor/upload-exam")} className="text-purple-600 hover:underline">
              Tạo đề thi đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredExams.map((exam) => (
              <div key={exam.id} className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{exam.title}</h3>
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
                      {/* Bỏ nhãn pha (Chưa mở/Trong quá trình/Đã đóng) theo yêu cầu */}
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <span>Đã đẩy đề thi từ {timeAgo(exam.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canEditExam(exam) ? (
                      <button
                        onClick={() => navigate(`/instructor/exams/${exam.id}/edit`)}
                        className="p-3 rounded-xl text-blue-600 hover:bg-blue-50"
                        title="Chỉnh sửa đề"
                      >
                        <FiEdit className="w-5 h-5" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => navigate(`/exams/${exam.id}/preview`)}
                          className="p-3 rounded-xl text-emerald-700 hover:bg-emerald-50"
                          title="Xem đề đã mở (read-only)"
                        >
                          Xem
                        </button>
                        {isInProgress(exam) && (
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                            Đang thi, không thể chỉnh sửa
                          </span>
                        )}
                      </>
                    )}

                    {canEditExam(exam) || String(exam.status)==='draft' ? (
                      <button
                        onClick={() => handleDelete(exam.id)}
                        className="p-3 text-red-600 hover:bg-red-50 rounded-xl"
                        title="Xóa"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        disabled
                        className="p-3 text-slate-400 bg-slate-100 rounded-xl cursor-not-allowed"
                        title="Không thể xóa khi bài thi đang trong thời gian mở phòng"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                {isInProgress(exam) && (
                  <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 inline-block px-2 py-1 rounded">
                    Bài thi đang trong quá trình thi, chỉ được xem, không thể chỉnh sửa/xóa.
                  </div>
                )}
                {/* Thời gian open/close nếu có */}
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-3">
                  {exam.time_open && (
                    <span className="px-2 py-0.5 rounded bg-gray-50">
                      Open: {new Date(exam.time_open).toLocaleString()}
                    </span>
                  )}
                  {exam.time_close && (
                    <span className="px-2 py-0.5 rounded bg-gray-50">
                      Close: {new Date(exam.time_close).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamBank;
