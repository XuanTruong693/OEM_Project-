import React, { useState, useEffect } from "react";
import {
  FiEye,
  FiEdit,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiCopy,
  FiArrowLeft,
  FiCheck,
  FiX,
  FiType,
  FiAlignLeft,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import LoadingSpinner from "../../components/LoadingSpinner";

const ExamList = () => {
  const navigate = useNavigate();
  
  // States cho quản lý đề thi
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editExam, setEditExam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 10,
  });

  // Fetch danh sách đề thi
  const fetchExams = async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: pagination.limit,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
      };

      const response = await axiosClient.get("/exams", { params });
      if (response.data.status === "success") {
        setExams(response.data.data.exams);
        setPagination(response.data.data.pagination);
      }
    } catch (err) {
      console.error("Error fetching exams:", err);
      setError("Lỗi khi tải danh sách đề thi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [searchTerm, statusFilter]);

  // View exam details
  const handleViewDetails = async (examId) => {
    try {
      setLoading(true);
      const response = await axiosClient.get(`/exams/${examId}`);
      if (response.data.status === "success") {
        setSelectedExam(response.data.data);
        setIsDetailModalOpen(true);
        setEditMode(false);
        setEditExam(null);
      }
    } catch (err) {
      console.error("Error fetching exam details:", err);
      setError("Lỗi khi tải chi tiết đề thi");
    } finally {
      setLoading(false);
    }
  };

  // Edit exam (open in edit mode)
  const handleEditExam = async (examId) => {
    try {
      setLoading(true);
      const response = await axiosClient.get(`/exams/${examId}`);
      if (response.data.status === "success") {
        const data = response.data.data;
        // Chuẩn hóa dữ liệu Essay: tách phần "Câu trả lời:" nếu người dùng dán chung
        const normalized = (() => {
          const deep = JSON.parse(JSON.stringify(data || {}));
          const questions = Array.isArray(deep.questions) ? deep.questions : [];
          const cleanPrefix = (s) => s
            .replace(/^Câu\s*\d+\s*[:.-]?\s*/i, "")
            .replace(/^Câu\s*hỏi\s*[:.-]?\s*/i, "")
            .trim();
          const stripScore = (s) => s.replace(/\(\s*\d+(?:\.\d+)?\s*đ\s*\)\s*$/i, '').trim();

          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if ((q?.type === 'Essay' || (q?.type||'').toUpperCase() === 'ESSAY')) {
              const text = (q.question_text || '').toString();
              const hasAnswerMarker = /Câu\s*trả\s*lời\s*:/i.test(text);
              if (hasAnswerMarker) {
                const parts = text.split(/Câu\s*trả\s*lời\s*:/i);
                let questionPart = parts[0] || '';
                let extractedAnswer = parts.slice(1).join(':').trim();
                questionPart = stripScore(cleanPrefix(questionPart));
                // Nếu vẫn trống, thử cắt đến dấu ? gần nhất
                if (!questionPart && text.includes('?')) {
                  const pos = text.lastIndexOf('?');
                  if (pos !== -1) questionPart = stripScore(cleanPrefix(text.substring(0, pos + 1)));
                }
                deep.questions[i].question_text = questionPart;
                // Nếu đã có model_answer thì giữ cái đầy đủ; nếu rỗng hoặc chứa luôn marker, thay bằng extracted
                const currentAns = (q.model_answer || '').toString().trim();
                if (!currentAns || /Câu\s*trả\s*lời\s*:/i.test(currentAns)) {
                  deep.questions[i].model_answer = extractedAnswer;
                } else {
                  deep.questions[i].model_answer = currentAns;
                }
              }
            }
          }
          return deep;
        })();
        setSelectedExam(data);
        // Tạo bản sao để chỉnh sửa (sau khi normalize)
        setEditExam(normalized);
        setEditMode(true);
        setIsDetailModalOpen(true);
      }
    } catch (err) {
      console.error("Error opening edit exam:", err);
      setError("Lỗi khi mở chế độ chỉnh sửa");
    } finally {
      setLoading(false);
    }
  };

  // Save edited exam
  const handleSaveExam = async () => {
    if (!editExam) return;
    try {
      setLoading(true);
      const payload = {
        title: editExam.title,
        duration: Number(editExam.duration || 0),
        status: editExam.status,
        questions: (editExam.questions || []).map((q, idx) => ({
          question_text: q.question_text,
          type: q.type,
          model_answer: q.model_answer || null,
          points: Number.isFinite(q.points) ? q.points : 1,
          order_index: idx + 1,
          options: (q.options || []).map((op) => ({
            option_text: op.option_text,
            is_correct: !!op.is_correct,
          })),
        })),
      };
      await axiosClient.put(`/exams/${editExam.id}`, payload);
      setIsDetailModalOpen(false);
      setEditMode(false);
      setEditExam(null);
      await fetchExams(pagination.currentPage);
      alert("✅ Cập nhật đề thi thành công");
    } catch (err) {
      console.error("Error saving exam:", err);
      const errorMsg = err.response?.data?.message || "Lỗi khi lưu đề thi";
      const debug = err.response?.data?.debug;
      const sql = err.response?.data?.sql;
      let extra = "";
      if (debug) extra += `\nChi tiết: ${debug}`;
      if (sql) extra += `\nSQL: ${sql}`;
      alert(`❌ ${errorMsg}${extra}`);
    } finally {
      setLoading(false);
    }
  };

  const updateQuestionField = (qIndex, field, value) => {
    setEditExam((prev) => {
      const copy = { ...prev };
      copy.questions = [...(copy.questions || [])];
      copy.questions[qIndex] = { ...copy.questions[qIndex], [field]: value };
      return copy;
    });
  };

  const updateOptionField = (qIndex, optIndex, field, value) => {
    setEditExam((prev) => {
      const copy = { ...prev };
      const qs = [...(copy.questions || [])];
      const q = { ...qs[qIndex] };
      const opts = [...(q.options || [])];
      opts[optIndex] = { ...opts[optIndex], [field]: value };
      q.options = opts;
      qs[qIndex] = q;
      copy.questions = qs;
      return copy;
    });
  };

  const setCorrectOption = (qIndex, optIndex) => {
    setEditExam((prev) => {
      const copy = { ...prev };
      const qs = [...(copy.questions || [])];
      const q = { ...qs[qIndex] };
      q.options = (q.options || []).map((op, idx) => ({
        ...op,
        is_correct: idx === optIndex,
      }));
      qs[qIndex] = q;
      copy.questions = qs;
      return copy;
    });
  };

  // Add a new question
  const addQuestion = (type = "MCQ") => {
    setEditExam((prev) => {
      const copy = { ...prev };
      const qs = [...(copy.questions || [])];
      const base = {
        id: `temp-${Date.now()}-${qs.length}`,
        question_text: "",
        type,
        model_answer: null,
        points: 1,
        order_index: qs.length + 1,
        options: type === "MCQ" ? [
          { option_text: "", is_correct: true },
          { option_text: "", is_correct: false }
        ] : []
      };
      qs.push(base);
      copy.questions = qs;
      return copy;
    });
  };

  const removeQuestion = (qIndex) => {
    if (!confirm("Xóa câu hỏi này?")) return;
    setEditExam(prev => {
      const copy = { ...prev };
      let qs = [...(copy.questions || [])];
      qs.splice(qIndex, 1);
      // reassign order_index
      qs = qs.map((q, i) => ({ ...q, order_index: i + 1 }));
      copy.questions = qs;
      return copy;
    });
  };

  const changeQuestionType = (qIndex, newType) => {
    setEditExam(prev => {
      const copy = { ...prev };
      const qs = [...(copy.questions || [])];
      const q = { ...qs[qIndex] };
      if (newType === q.type) return prev;
      q.type = newType;
      if (newType === 'MCQ') {
        q.options = [
          { option_text: "", is_correct: true },
          { option_text: "", is_correct: false }
        ];
        q.model_answer = null;
      } else { // Essay
        q.model_answer = q.model_answer || "";
        q.options = [];
      }
      qs[qIndex] = q;
      copy.questions = qs;
      return copy;
    });
  };

  const addOption = (qIndex) => {
    setEditExam(prev => {
      const copy = { ...prev };
      const qs = [...(copy.questions || [])];
      const q = { ...qs[qIndex] };
      const opts = [...(q.options || [])];
      opts.push({ option_text: "", is_correct: false });
      q.options = opts;
      qs[qIndex] = q;
      copy.questions = qs;
      return copy;
    });
  };

  const removeOption = (qIndex, optIndex) => {
    setEditExam(prev => {
      const copy = { ...prev };
      const qs = [...(copy.questions || [])];
      const q = { ...qs[qIndex] };
      let opts = [...(q.options || [])];
      if (opts.length <= 2) return prev; // giữ tối thiểu 2
      const wasCorrect = opts[optIndex]?.is_correct;
      opts.splice(optIndex, 1);
      if (wasCorrect) {
        // đảm bảo vẫn có 1 đáp án đúng
        if (!opts.some(o => o.is_correct)) {
          if (opts[0]) opts[0].is_correct = true;
        }
      }
      q.options = opts;
      qs[qIndex] = q;
      copy.questions = qs;
      return copy;
    });
  };

  // Delete exam
  const handleDeleteExam = async (examId) => {
    if (!confirm("Bạn có chắc chắn muốn xóa đề thi này?")) return;

    try {
      setLoading(true);
      await axiosClient.delete(`/exams/${examId}`);
      fetchExams(pagination.currentPage);
      alert("✅ Xóa đề thi thành công!");
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Lỗi khi xóa đề thi";
      alert(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate room code
  const handleGenerateRoomCode = async (examId) => {
    try {
      setLoading(true);
      const response = await axiosClient.post(`/exams/${examId}/generate-room-code`);
      if (response.data.status === "success") {
        fetchExams(pagination.currentPage);
        alert(`✅ Mã phòng thi: ${response.data.data.roomCode}`);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Lỗi khi tạo mã phòng thi";
      alert(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      draft: { label: "Bản nháp", color: "bg-gray-500" },
      published: { label: "Đã xuất bản", color: "bg-green-500" },
      archived: { label: "Lưu trữ", color: "bg-red-500" },
    };
    const { label, color } = statusMap[status] || statusMap.draft;
    return (
      <span className={`px-2 py-1 text-xs text-white rounded ${color}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate("/instructor-dashboard")}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <FiArrowLeft size={20} />
            <span>Quay lại Dashboard</span>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Danh sách đề thi
            </h1>
            <p className="text-gray-600">
              Quản lý tất cả các đề thi đã tạo
            </p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm đề thi..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="draft">Bản nháp</option>
                <option value="published">Đã xuất bản</option>
                <option value="archived">Lưu trữ</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{pagination.total}</div>
              <div className="text-sm text-gray-600">Tổng đề thi</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {exams.filter(exam => exam.status === 'published').length}
              </div>
              <div className="text-sm text-gray-600">Đã xuất bản</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {exams.filter(exam => exam.status === 'draft').length}
              </div>
              <div className="text-sm text-gray-600">Bản nháp</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {exams.reduce((sum, exam) => sum + (exam.total_questions || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Tổng câu hỏi</div>
            </div>
          </div>
        </div>

        {/* Exams List */}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Đề thi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Câu hỏi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bài thi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Điểm TB
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ngày tạo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {exams.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                        Không có đề thi nào được tìm thấy
                      </td>
                    </tr>
                  ) : (
                    exams.map((exam) => (
                      <tr key={exam.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {exam.title}
                            </div>
                            <div className="text-sm text-gray-500">
                              {exam.duration} phút
                            </div>
                            {exam.exam_room_code && (
                              <div className="text-xs text-blue-600 font-mono">
                                Mã: {exam.exam_room_code}
                              </div>
                            )}
                            {exam.course_title && (
                              <div className="text-xs text-green-600">
                                Khóa: {exam.course_title}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(exam.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium">{exam.total_questions || 0}</span>
                          {exam.total_points && (
                            <div className="text-xs text-gray-500">
                              {exam.total_points} điểm
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {exam.total_submissions || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {exam.avg_score ? Number(exam.avg_score).toFixed(1) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(exam.created_at).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewDetails(exam.id)}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded"
                              title="Xem chi tiết"
                            >
                              <FiEye size={16} />
                            </button>
                            <button
                              onClick={() => handleEditExam(exam.id)}
                              className="text-gray-600 hover:text-gray-800 p-1 rounded"
                              title="Chỉnh sửa đề thi"
                            >
                              <FiEdit size={16} />
                            </button>
                            {!exam.exam_room_code && (
                              <button
                                onClick={() => handleGenerateRoomCode(exam.id)}
                                className="text-green-600 hover:text-green-800 p-1 rounded"
                                title="Tạo mã phòng thi"
                              >
                                <FiCopy size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteExam(exam.id)}
                              className="text-red-600 hover:text-red-800 p-1 rounded"
                              title="Xóa đề thi"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Hiển thị {(pagination.currentPage - 1) * pagination.limit + 1} đến{" "}
                  {Math.min(pagination.currentPage * pagination.limit, pagination.total)} của{" "}
                  {pagination.total} kết quả
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.currentPage === 1}
                    onClick={() => fetchExams(pagination.currentPage - 1)}
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Trước
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    Trang {pagination.currentPage} / {pagination.totalPages}
                  </span>
                  <button
                    disabled={pagination.currentPage === pagination.totalPages}
                    onClick={() => fetchExams(pagination.currentPage + 1)}
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Exam Details Modal */}
        {isDetailModalOpen && selectedExam && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {editMode ? "Chỉnh sửa đề thi" : "Chi tiết đề thi"}
                </h2>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiX size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Exam Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Tên đề thi</h3>
                    {editMode ? (
                      <input
                        className="w-full mt-1 border rounded px-3 py-2"
                        value={editExam?.title || ""}
                        onChange={(e) => setEditExam({ ...editExam, title: e.target.value })}
                      />
                    ) : (
                      <p className="text-gray-600">{selectedExam.title}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Thời gian</h3>
                    {editMode ? (
                      <input
                        type="number"
                        min="1"
                        className="w-full mt-1 border rounded px-3 py-2"
                        value={editExam?.duration || 0}
                        onChange={(e) => setEditExam({ ...editExam, duration: e.target.value })}
                      />
                    ) : (
                      <p className="text-gray-600">{selectedExam.duration} phút</p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Trạng thái</h3>
                    {getStatusBadge(editMode ? editExam?.status : selectedExam.status)}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Mã phòng thi</h3>
                    <p className="text-gray-600 font-mono">
                      {selectedExam.exam_room_code || "Chưa có"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Tổng câu hỏi</h3>
                    <p className="text-gray-600">{(editMode ? editExam?.questions?.length : selectedExam.total_questions) || 0}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Tổng điểm</h3>
                    <p className="text-gray-600">{selectedExam.total_points || 0} điểm</p>
                  </div>
                </div>

                {/* Questions List */}
                {(editMode ? editExam?.questions : selectedExam.questions) && (editMode ? editExam?.questions : selectedExam.questions).length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-4">
                      Danh sách câu hỏi ({(editMode ? editExam?.questions : selectedExam.questions).length})
                    </h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {(editMode ? editExam?.questions : selectedExam.questions).map((question, index) => (
                        <div key={question.id} className="p-4 border rounded-lg bg-white">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                {editMode ? (
                                  <select
                                    className="text-sm border rounded px-2 py-1"
                                    value={question.type}
                                    onChange={(e) => changeQuestionType(index, e.target.value)}
                                  >
                                    <option value="MCQ">Trắc nghiệm</option>
                                    <option value="Essay">Tự luận</option>
                                  </select>
                                ) : (
                                  question.type === "MCQ" ? (
                                    <div className="flex items-center gap-1 text-blue-600">
                                      <FiType size={16} />
                                      <span className="text-sm font-medium">Trắc nghiệm</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-green-600">
                                      <FiAlignLeft size={16} />
                                      <span className="text-sm font-medium">Tự luận</span>
                                    </div>
                                  )
                                )}
                                {editMode ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    className="w-24 text-sm border rounded px-2 py-1"
                                    value={Number.isFinite(question.points) ? question.points : 1}
                                    onChange={(e) => updateQuestionField(index, "points", Number(e.target.value))}
                                  />
                                ) : (
                                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {question.points} điểm
                                  </span>
                                )}
                              </div>
                              
                              {editMode ? (
                                question.type !== 'Essay' && (
                                  <textarea
                                    className="w-full border rounded px-3 py-2 mb-3"
                                    value={question.question_text}
                                    onChange={(e) => updateQuestionField(index, "question_text", e.target.value)}
                                  />
                                )
                              ) : (
                                question.type !== 'Essay' && (
                                  <p className="text-gray-900 mb-3 leading-relaxed">
                                    {question.question_text}
                                  </p>
                                )
                              )}

                              {/* MCQ Options */}
                              {question.type === 'MCQ' && question.options && question.options.length > 0 && (
                                <div className="space-y-2 mb-3">
                                  {question.options.map((option, optIndex) => (
                                    <div key={option.id || optIndex} className={`text-sm p-3 rounded-lg border ${option.is_correct ? "bg-green-50 border-green-200 text-green-800" : "bg-gray-50 border-gray-200 text-gray-700"}`}>
                                      <div className="flex items-center gap-2 w-full">
                                        <span className="font-medium">
                                          {String.fromCharCode(65 + optIndex)}.
                                        </span>
                                        {editMode ? (
                                          <input
                                            className="flex-1 border rounded px-2 py-1"
                                            value={option.option_text}
                                            onChange={(e) => updateOptionField(index, optIndex, "option_text", e.target.value)}
                                          />
                                        ) : (
                                          <span>{option.option_text}</span>
                                        )}
                                        {editMode ? (
                                          <input
                                            type="radio"
                                            name={`correct-${index}`}
                                            checked={!!option.is_correct}
                                            onChange={() => setCorrectOption(index, optIndex)}
                                            title="Đánh dấu đáp án đúng"
                                          />
                                        ) : (
                                          option.is_correct && (
                                            <FiCheck className="ml-auto text-green-600" size={16} />
                                          )
                                        )}
                                        {editMode && question.options.length > 2 && (
                                          <button
                                            type="button"
                                            onClick={() => removeOption(index, optIndex)}
                                            className="text-red-500 text-xs ml-2 hover:underline"
                                          >Xóa</button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {editMode && (
                                    <button
                                      type="button"
                                      onClick={() => addOption(index)}
                                      className="text-xs text-blue-600 hover:underline"
                                    >+ Thêm lựa chọn</button>
                                  )}
                                </div>
                              )}

                              {/* Essay Model Answer */}
                              {question.type === 'Essay' && (
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-col">
                                    <h4 className="text-sm font-medium text-blue-800 mb-1">Câu hỏi</h4>
                                    {editMode ? (
                                      <textarea
                                        className="w-full flex-1 border rounded px-3 py-2"
                                        value={question.question_text || ''}
                                        onChange={(e) => updateQuestionField(index, 'question_text', e.target.value)}
                                      />
                                    ) : (
                                      <p className="text-sm text-blue-700 leading-relaxed whitespace-pre-wrap">{question.question_text}</p>
                                    )}
                                  </div>
                                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex flex-col">
                                    <h4 className="text-sm font-medium text-yellow-800 mb-1">Đáp án mẫu</h4>
                                    {editMode ? (
                                      <textarea
                                        className="w-full flex-1 border rounded px-3 py-2"
                                        value={question.model_answer || ''}
                                        onChange={(e) => updateQuestionField(index, 'model_answer', e.target.value)}
                                      />
                                    ) : (
                                      <p className="text-sm text-yellow-700 leading-relaxed whitespace-pre-wrap">{question.model_answer}</p>
                                    )}
                                  </div>
                                </div>
                              )}
                              {editMode && (
                                <div className="mt-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => removeQuestion(index)}
                                    className="text-xs text-red-600 hover:underline"
                                  >Xóa câu hỏi</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {editMode && (
                      <div className="mt-4 flex gap-3">
                        <button
                          type="button"
                          onClick={() => addQuestion('MCQ')}
                          className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >+ Thêm câu trắc nghiệm</button>
                        <button
                          type="button"
                          onClick={() => addQuestion('Essay')}
                          className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >+ Thêm câu tự luận</button>
                      </div>
                    )}
                  </div>
                )}

                {/* No Questions */}
                {(!((editMode ? editExam?.questions : selectedExam.questions)) || (editMode ? editExam?.questions : selectedExam.questions).length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <FiAlignLeft size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>Đề thi này chưa có câu hỏi nào</p>
                  </div>
                )}

                {editMode && (
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => { setEditMode(false); setEditExam(null); }}
                      className="px-4 py-2 border rounded hover:bg-gray-50"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSaveExam}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Lưu thay đổi
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamList;