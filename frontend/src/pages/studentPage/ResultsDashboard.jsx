import React from 'react';
import axiosClient from '../../api/axiosClient';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSearch, FiTrendingUp, FiAward, FiCalendar, FiCheckCircle, FiX, FiXCircle, FiInfo } from 'react-icons/fi';
import io from 'socket.io-client';
import { SOCKET_URL } from '../../api/config';

export default function ResultsDashboard() {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState('date_desc');

  // Real-time & Detail Modal
  const [detailModal, setDetailModal] = React.useState({ isOpen: false, submissionId: null });
  const socketRef = React.useRef(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await axiosClient.get('/results/my');
        setRows(res.data || []);
      } catch (e) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();

    // Initialize Socket for real-time config updates
    socketRef.current = io(SOCKET_URL || window.location.origin, {
      withCredentials: true,
      transports: ["websocket"]
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to results socket");
    });

    socketRef.current.on("exam:config-updated", (data) => {
      if (data.allow_view_answers !== undefined) {
        setRows(prev => prev.map(row =>
          String(row.exam_id) === String(data.examId || data.id)
            ? { ...row, allow_view_answers: !!data.allow_view_answers }
            : row
        ));
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const filtered = React.useMemo(() => {
    const norm = (s) => String(s || '').toLowerCase();
    let arr = (rows || []).filter(r => norm(r.exam_title || r.exam_id).includes(norm(q)));
    const examMap = new Map();
    arr.forEach(r => {
      const examId = r.exam_id;
      const existing = examMap.get(examId);
      const currentScore = Number(r.suggested_total_score ?? r.total_score ?? 0);
      const existingScore = existing ? Number(existing.suggested_total_score ?? existing.total_score ?? 0) : -1;

      if (!existing) {
        examMap.set(examId, r);
      } else {
        // Priority 1: instructor_confirmed = 1 (approved)
        const currentConfirmed = r.instructor_confirmed === 1 || r.status === 'confirmed';
        const existingConfirmed = existing.instructor_confirmed === 1 || existing.status === 'confirmed';

        if (currentConfirmed && !existingConfirmed) {
          examMap.set(examId, r);
        } else if (!currentConfirmed && existingConfirmed) {
          // Keep existing
        } else {
          // Both confirmed or both not confirmed: take higher score
          if (currentScore > existingScore) {
            examMap.set(examId, r);
          }
        }
      }
    });

    arr = Array.from(examMap.values());

    if (sort === 'score_desc') {
      arr = arr.sort((a, b) => ((b.suggested_total_score ?? b.total_score ?? 0) - (a.suggested_total_score ?? a.total_score ?? 0)));
    } else if (sort === 'score_asc') {
      arr = arr.sort((a, b) => ((a.suggested_total_score ?? a.total_score ?? 0) - (b.suggested_total_score ?? b.total_score ?? 0)));
    } else {
      arr = arr.sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));
    }
    return arr;
  }, [rows, q, sort]);

  const stats = React.useMemo(() => {
    const n = rows.length;
    const best = rows.reduce((m, r) => Math.max(m, Number(r.suggested_total_score ?? r.total_score ?? 0)), 0);
    const avg = n ? (rows.reduce((s, r) => s + Number(r.suggested_total_score ?? r.total_score ?? 0), 0) / n).toFixed(1) : 0;
    const passCount = rows.filter(r => Number(r.suggested_total_score ?? r.total_score ?? 0) >= 5).length;
    const passRate = n ? Math.round((passCount / n) * 100) : 0;
    return { n, best, avg, passRate };
  }, [rows]);

  const getScoreBadge = (score) => {
    if (score == null) return { label: '-', color: 'slate', icon: '○' };
    const s = Number(score);
    if (s >= 8) return { label: s.toFixed(1), color: 'emerald', icon: '🏆', grade: 'Xuất sắc' };
    if (s >= 5) return { label: s.toFixed(1), color: 'amber', icon: '⭐', grade: 'Đạt' };
    return { label: s.toFixed(1), color: 'rose', icon: '○', grade: 'Chưa đạt' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/student-dashboard")}
            className="flex items-center gap-2 px-3 py-2 text-slate-700 rounded-lg hover:bg-slate-100 transition-all"
          >
            <FiArrowLeft className="w-5 h-5" />
            <span className="font-semibold hidden sm:inline">Quay lại</span>
          </button>

          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
            <img src="/Logo.png" alt="Logo" className="h-10 sm:h-12 w-auto" />
            <span className="hidden sm:inline text-base font-semibold text-slate-700"></span>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <FiCalendar className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-600 hidden sm:inline">{new Date().toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2">
            Kết quả học tập
          </h1>
          <p className="text-slate-600 text-lg">
            Theo dõi điểm số và tiến độ của bạn
          </p>
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm bài thi..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setSort('date_desc')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sort === 'date_desc'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                Mới nhất
              </button>
              <button
                onClick={() => setSort('score_desc')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sort === 'score_desc'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                Điểm cao
              </button>
              <button
                onClick={() => setSort('score_asc')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sort === 'score_asc'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                Điểm thấp
              </button>
            </div>
          </div>
        </div>

        {/* Results Table/Cards */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200">
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-600">Đang tải kết quả...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200">
            <div className="text-center">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                {q ? 'Không tìm thấy kết quả' : 'Chưa có bài thi nào'}
              </h3>
              <p className="text-slate-600">
                {q ? 'Thử tìm kiếm với từ khóa khác' : 'Các bài thi đã hoàn thành sẽ hiển thị ở đây'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((r, i) => {
              const mcq = r.mcq_score ?? r.total_score;
              const essay = r.essay_score ?? r.ai_score;
              const total = r.suggested_total_score ?? (Number(mcq || 0) + Number(essay || 0));
              const totalBadge = getScoreBadge(total);
              const mcqBadge = getScoreBadge(mcq);
              const essayBadge = getScoreBadge(essay);

              // Check if confirmed by instructor
              const isConfirmed = r.instructor_confirmed === 1 || r.status === 'confirmed';
              const statusLabel = isConfirmed ? 'Đã duyệt' : 'Chưa duyệt';
              const statusColor = isConfirmed ? 'emerald' : 'amber';

              return (
                <div
                  key={r.submission_id}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Left: Exam Info */}
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl text-2xl">
                          {totalBadge.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-800 mb-1">
                            {r.exam_title || `Bài thi #${r.exam_id}`}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <FiCalendar className="w-4 h-4" />
                              {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </span>

                            {/* Status Badge */}
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${statusColor === 'emerald'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                              }`}>
                              {isConfirmed ? '✓' : '⏳'} {statusLabel}
                            </span>

                            {totalBadge.grade && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${totalBadge.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                                totalBadge.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                                  'bg-rose-100 text-rose-700'
                                }`}>
                                {totalBadge.grade}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Scores */}
                    <div className="flex items-center gap-4 lg:gap-6">
                      <div className="text-center">
                        <div className="text-xs text-slate-500 mb-1">Trắc nghiệm</div>
                        <div className={`text-2xl font-bold ${mcqBadge.color === 'emerald' ? 'text-emerald-600' :
                          mcqBadge.color === 'amber' ? 'text-amber-600' :
                            mcqBadge.color === 'rose' ? 'text-rose-600' :
                              'text-slate-400'
                          }`}>
                          {mcqBadge.label}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-xs text-slate-500 mb-1">Tự luận</div>
                        <div className={`text-2xl font-bold ${essayBadge.color === 'emerald' ? 'text-emerald-600' :
                          essayBadge.color === 'amber' ? 'text-amber-600' :
                            essayBadge.color === 'rose' ? 'text-rose-600' :
                              'text-slate-400'
                          }`}>
                          {essayBadge.label}
                        </div>
                      </div>

                      <div className="h-12 w-px bg-slate-200"></div>

                      <div className="text-center">
                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1 justify-center">
                          Tổng điểm
                          {isConfirmed && <span className="text-emerald-600">✓</span>}
                        </div>
                        <div className={`text-3xl font-bold ${totalBadge.color === 'emerald' ? 'text-emerald-600' :
                          totalBadge.color === 'amber' ? 'text-amber-600' :
                            totalBadge.color === 'rose' ? 'text-rose-600' :
                              'text-slate-400'
                          }`}>
                          {totalBadge.label}
                        </div>
                        {isConfirmed && (
                          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                            Điểm chính thức
                          </div>
                        )}
                      </div>

                      {/* View Answers Button */}
                      {r.allow_view_answers ? (
                        <button
                          onClick={() => setDetailModal({ isOpen: true, submissionId: r.submission_id })}
                          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95 shrink-0"
                        >
                          <FiCheckCircle /> Xem đáp án
                        </button>
                      ) : (
                        <div className="hidden lg:block w-32"></div> // Spacer to maintain alignment
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Detail Modal */}
        <DetailedResultModal
          isOpen={detailModal.isOpen}
          onClose={() => setDetailModal({ ...detailModal, isOpen: false })}
          submissionId={detailModal.submissionId}
        />

        {/* Footer Info */}
        {!loading && filtered.length > 0 && (
          <div className="mt-6 text-center text-sm text-slate-500">
            Hiển thị {filtered.length} / {rows.length} bài thi
          </div>
        )}
      </div>
    </div>
  );
}

const DetailedResultModal = ({ isOpen, onClose, submissionId }) => {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (isOpen && submissionId) {
      fetchDetail();
    }
  }, [isOpen, submissionId]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axiosClient.get(`/results/${submissionId}/detail`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải chi tiết câu trả lời.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white w-full md:w-[80vw] max-h-[90vh] rounded-lg shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Chi tiết bài làm</h2>
            {data && <p className="text-sm text-gray-600 font-medium">{data.exam_title}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-3"></div>
              <p className="text-gray-400 text-sm">Đang tải dữ liệu...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 p-6 rounded text-center">
              <p className="text-red-700 font-bold mb-1">Lỗi tải dữ liệu</p>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button
                onClick={fetchDetail}
                className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded text-sm hover:bg-red-50 transition-colors"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {data.questions.map((q, idx) => {
                const answer = data.answers.find(a => a.question_id === q.question_id);
                const isUnanswered = q.type === 'MCQ' 
                  ? (!answer || !answer.selected_option_id)
                  : (!answer || !answer.answer_text || answer.answer_text.trim() === '');
                
                return (
                  <div key={q.question_id} className={`border rounded-lg overflow-hidden ${isUnanswered ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
                    {/* Question Header */}
                    <div className="p-6 border-b border-inherit flex items-start gap-4">
                      <div className={`w-9 h-9 rounded border-2 flex items-center justify-center text-lg font-black shrink-0 ${isUnanswered ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-300">
                              {q.type === 'MCQ' ? 'Trắc nghiệm' : 'Tự luận'}
                            </span>
                            {isUnanswered && (
                              <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-red-600 text-white shadow-sm shadow-red-200 animate-pulse">
                                Chưa trả lời
                              </span>
                            )}
                          </div>
                          <span className="text-base font-black text-gray-600">
                            Điểm: {answer?.score || 0} / {q.points}
                          </span>
                        </div>
                        <h3 className="text-gray-900 font-bold text-lg leading-snug">{q.question_text}</h3>
                      </div>
                    </div>

                    {/* Options / Answers */}
                    <div className="p-6">
                      {q.type === 'MCQ' ? (
                        <div className="space-y-3">
                          {data.options.filter(o => o.question_id === q.question_id).map(opt => {
                            const isSelected = answer?.selected_option_id === opt.option_id;
                            const isTrue = !!opt.is_correct;

                            let styles = "border-gray-200 bg-white text-gray-700 hover:border-gray-300";
                            if (isSelected && isTrue) styles = "border-green-500 bg-green-50 text-green-800 font-bold ring-1 ring-green-500/10";
                            else if (isSelected && !isTrue) styles = "border-red-500 bg-red-50 text-red-800 font-bold ring-1 ring-red-500/10";
                            else if (!isSelected && isTrue) styles = "border-green-400 bg-green-50/50 text-green-700 italic";

                            return (
                              <div key={opt.option_id} className={`p-4 rounded-lg border-2 text-base flex items-center gap-4 transition-all ${styles}`}>
                                <div className="shrink-0">
                                  {isTrue ? (
                                    <FiCheckCircle className="w-6 h-6 text-green-600" />
                                  ) : isSelected ? (
                                    <FiXCircle className="w-6 h-6 text-red-600" />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                                  )}
                                </div>
                                <span className="leading-relaxed">{opt.option_text}</span>
                                {isSelected && (
                                  <span className="ml-auto text-xs font-black uppercase tracking-widest text-inherit opacity-80">
                                    Đáp án của bạn
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <div className={`p-5 rounded-lg border-2 ${isUnanswered ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Bài làm của bạn</label>
                            <p className="text-base text-gray-800 whitespace-pre-wrap leading-relaxed font-medium">{answer?.answer_text || "Không có nội dung bài làm."}</p>
                          </div>

                          <div className="p-5 rounded-lg border-2 bg-blue-50 border-blue-200">
                            <label className="text-xs font-black text-blue-500 uppercase tracking-widest block mb-2">Đáp án mẫu / Gợi ý</label>
                            <p className="text-base text-blue-900 whitespace-pre-wrap leading-relaxed">{q.model_answer || "Chưa cập nhật đáp án mẫu."}</p>
                          </div>

                          {answer?.instructor_feedback && (
                            <div className="p-5 rounded-lg border-2 bg-amber-50 border-amber-200">
                              <label className="text-xs font-black text-amber-600 uppercase tracking-widest block mb-2 flex items-center gap-2">
                                <FiInfo className="w-4 h-4" /> Phản hồi từ giảng viên
                              </label>
                              <p className="text-base text-amber-900 font-medium leading-relaxed">{answer.instructor_feedback}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 text-center bg-gray-50">
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Hệ thống khảo thí thông minh OEM</p>
        </div>
      </div>
    </div>
  );
};
