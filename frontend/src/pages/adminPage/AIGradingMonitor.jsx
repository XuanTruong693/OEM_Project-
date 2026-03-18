import React, { useState, useEffect } from "react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import { Search, Bot, AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import AIGradingDetailsModal from "../../components/admin/AIGradingDetailsModal";
import axiosClient from '../../api/axiosClient';

const AIGradingMonitor = () => {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmRetryId, setConfirmRetryId] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get("/admin/ai-grading-logs", {
        params: { page, limit: 10, status: filterStatus, search: searchTerm }
      });
      if (response.data.success) {
        setLogs(response.data.logs);
        setSummary(response.data.summary);
        setTotalPages(response.data.totalPages);
      }
    } catch (error) {
      console.error("Error fetching AI logs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000); // Auto refresh every 15s
    return () => clearInterval(interval);
  }, [page, filterStatus, searchTerm]);

  const handleRetryClick = (submissionId) => {
    setConfirmRetryId(submissionId);
    setShowConfirmModal(true);
  };

  const confirmRetry = async () => {
    if (!confirmRetryId) return;
    setShowConfirmModal(false);
    try {
      await axiosClient.post(`/admin/ai-grading-logs/${confirmRetryId}/retry`);
      fetchLogs(); // Refresh after retry
    } catch (error) {
      console.error("Error retrying AI grading", error);
      alert(error.response?.data?.message || "Lỗi khi yêu cầu chấm lại");
    } finally {
      setConfirmRetryId(null);
    }
  };

  const StatusBadge = ({ status }) => {
    const styles = {
      pending: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
      in_progress: "bg-blue-600/20 text-blue-400 border-blue-600/30",
      completed: "bg-green-600/20 text-green-400 border-green-600/30",
      failed: "bg-red-600/20 text-red-400 border-red-600/30",
      not_required: "bg-gray-600/20 text-gray-400 border-gray-600/30",
    };
    const icons = {
      pending: <Clock size={14} className="mr-1 inline-block" />,
      in_progress: <RefreshCw size={14} className="mr-1 inline-block animate-spin" />,
      completed: <CheckCircle size={14} className="mr-1 inline-block" />,
      failed: <AlertCircle size={14} className="mr-1 inline-block" />,
      not_required: <CheckCircle size={14} className="mr-1 inline-block" />
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
        {icons[status] || null}
        {status.replace("_", " ").toUpperCase()}
      </span>
    );
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-900 overflow-hidden">
      <AdminSidebar activeTab="ai-grading" />
      <div className="flex-1 flex flex-col p-4 pt-20 md:p-8 overflow-y-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 mb-8">
           <div>
             <h1 className="text-3xl font-semibold text-white flex items-center gap-2">
                 Thống Kê Chấm Điểm AI
             </h1>
             <p className="text-gray-300 mt-1">Giám sát và can thiệp chấm tự luận tự động.</p>
           </div>
        </div>

        <main className="">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-gray-600 transition">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-600/20 text-blue-400"><Bot size={28} /></div>
                <div><p className="text-sm text-gray-400 font-medium">Tổng Bài Tham Gia</p><h3 className="text-2xl font-bold text-white">{summary.total}</h3></div>
              </div>
            </div>
            <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-gray-600 transition">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-600/20 text-yellow-400"><Clock size={28} /></div>
                <div><p className="text-sm text-gray-400 font-medium">Chờ Xử Lý (Queue)</p><h3 className="text-2xl font-bold text-white">{summary.pending}</h3></div>
              </div>
            </div>
            <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-gray-600 transition">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-600/20 text-red-400"><AlertCircle size={28} /></div>
                <div><p className="text-sm text-gray-400 font-medium">Lỗi Bất Thường</p><h3 className="text-2xl font-bold text-white">{summary.failed}</h3></div>
              </div>
            </div>
            <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-gray-600 transition">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-600/20 text-green-400"><CheckCircle size={28} /></div>
                <div><p className="text-sm text-gray-400 font-medium">Hoàn Thành (OK)</p><h3 className="text-2xl font-bold text-white">{summary.completed}</h3></div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <div className="p-5 border-b border-gray-700 flex flex-col sm:flex-row gap-4 justify-between bg-gray-800">
              <div className="relative flex-1 w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input
                  type="text"
                  placeholder="Tìm theo Mã bài, tên sinh viên hoặc email..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                />
              </div>
              <div className="flex gap-4">
                <select
                  className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm"
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                >
                  <option value="all">Tất cả Trạng Thái</option>
                  <option value="pending">⏳ Pending (Chờ Xử Lý)</option>
                  <option value="in_progress">🔄 In Progress (Đang Xử Lý)</option>
                  <option value="completed">✅ Completed (Đã Hoàn Thành)</option>
                  <option value="failed">❌ Failed (Lỗi)</option>
                </select>
                <button
                  onClick={fetchLogs}
                  className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 border border-gray-600 transition-colors shadow-sm font-medium"
                >
                  <RefreshCw size={18} className={loading && "animate-spin"} /> 
                  <span className="hidden sm:inline">Tải Lại Bảng</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Sinh Viên</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Bài Thi (Đợt)</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">T.Gian Nộp</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[150px]">Trạng Thái AI</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Quản Lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {loading && logs.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-300">Đang đồng bộ dữ liệu với hệ thống AI...</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-300">Không có bài thi nào khớp theo yêu cầu.</td></tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.submission_id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-300">#{log.submission_id}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-white">{log.student_name}</p>
                          <p className="text-xs text-gray-400">{log.student_email}</p>
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-sm text-gray-300">{log.exam_title}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300">
                          {new Date(log.submitted_at).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={log.status} />
                          {log.error && (
                            <p className="text-xs text-red-400 mt-2 truncate max-w-[200px] border-l border-red-500/50 pl-2" title={log.error}>
                              Lỗi: {log.error}
                            </p>
                          )}
                          {log.retry_count > 0 && <p className="text-xs text-yellow-500 mt-1">Đã thử lại: {log.retry_count} lần</p>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedSubmissionId(log.submission_id)}
                              className="px-3 py-1.5 bg-gray-700 border border-gray-600 text-blue-400 hover:bg-gray-600 rounded-md text-sm font-medium transition-colors shadow-sm"
                            >
                              Xem Log ↳
                            </button>
                            {(log.status === 'failed' || log.status === 'pending') && (
                              <button
                                onClick={() => handleRetryClick(log.submission_id)}
                                className="px-3 py-1.5 bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 border border-yellow-600/30 rounded-md text-sm font-medium transition-colors flex items-center gap-1 shadow-sm"
                              >
                                <RefreshCw size={14} /> Fix Lỗi
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-700 flex justify-between items-center bg-gray-800">
                <span className="text-sm text-gray-300">
                  Hiển thị trang <span className="font-bold text-white">{page}</span> trong tổng số <span className="font-bold text-white">{totalPages}</span>
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 text-white disabled:opacity-50 text-sm font-medium transition-all shadow-sm"
                  >
                    ❮ Trang Trước
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 text-white disabled:opacity-50 text-sm font-medium transition-all shadow-sm"
                  >
                    Trang Sau ❯
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedSubmissionId && (
        <AIGradingDetailsModal
          submissionId={selectedSubmissionId}
          onClose={() => setSelectedSubmissionId(null)}
          onRetrySuccess={() => {
            fetchLogs();
          }}
        />
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-md mx-4 animate-fade-in-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-yellow-500" size={32} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Xác nhận chấm lại</h2>
              <p className="text-gray-300 mb-6">
                Bạn có chắc muốn tự động xóa lịch sử và chấm lại bài thi ID #{confirmRetryId}?
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => { setShowConfirmModal(false); setConfirmRetryId(null); }}
                  className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={confirmRetry}
                  className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold rounded-xl transition-colors"
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIGradingMonitor;
