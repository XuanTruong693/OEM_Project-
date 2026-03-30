import React from 'react';
import axiosClient from '../../api/axiosClient';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSearch, FiTrendingUp, FiAward, FiCalendar } from 'react-icons/fi';

export default function ResultsDashboard() {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState('date_desc');

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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
