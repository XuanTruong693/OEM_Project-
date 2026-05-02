import React from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { getFullImageUrl } from '../../utils/imageUtils';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState({ fullname: '', avatar: '' });

  React.useEffect(() => {
    (async () => {
      try {
        const res = await axiosClient.get('/results/my');
        const allResults = res.data || [];

        const examMap = new Map();
        allResults.forEach(r => {
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
            } else {
              if (currentScore > existingScore) {
                examMap.set(examId, r);
              }
            }
          }
        });

        const filteredResults = Array.from(examMap.values()).sort((a, b) =>
          new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0)
        );

        setResults(filteredResults);
      } catch (e) {
        setResults([]);
      } finally { setLoading(false); }
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await axiosClient.get('/profile');
        const u = res?.data?.data;
        if (u) {
          setUser({ fullname: u.full_name || 'Người dùng', avatar: u.avatar || '/icons/UI Image/default-avatar.png' });
          try {
            localStorage.setItem('fullname', u.full_name || '');
            if (u.avatar) localStorage.setItem('avatar', u.avatar);
          } catch { }
          return;
        }
      } catch { }

      const fullname = localStorage.getItem('fullname') || 'Người dùng';
      const avatar = localStorage.getItem('avatar') || '/icons/UI Image/default-avatar.png';
      setUser({ fullname, avatar });
    })();
  }, []);

  // Calculate statistics
  const stats = React.useMemo(() => {
    const n = results.length;
    const best = results.reduce((m, r) => Math.max(m, Number(r.suggested_total_score ?? r.total_score ?? 0)), 0);
    const avg = n ? (results.reduce((s, r) => s + Number(r.suggested_total_score ?? r.total_score ?? 0), 0) / n) : 0;
    const passCount = results.filter(r => Number(r.suggested_total_score ?? r.total_score ?? 0) >= 5).length;
    const passRate = n ? Math.round((passCount / n) * 100) : 0;

    // Lấy 7 bài thi gần nhất
    const recent7 = results.slice(0, Math.min(7, results.length));

    // 1. Chart Tổng bài thi: Số bài thi theo 7 NGÀY gần nhất
    const now = new Date();
    const chartDataTotal = [6, 5, 4, 3, 2, 1, 0].map(daysAgo => {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - daysAgo);
      targetDate.setHours(0, 0, 0, 0);

      const nextDate = new Date(targetDate);
      nextDate.setDate(targetDate.getDate() + 1);

      const count = results.filter(r => {
        if (!r.submitted_at) return false;
        const submitDate = new Date(r.submitted_at);
        return submitDate >= targetDate && submitDate < nextDate;
      }).length;

      return count; // Số bài thi trong ngày đó
    });

    // 2. Chart Điểm TB: Điểm trung bình cộng theo 7 ngày
    const chartDataAvg = [6, 5, 4, 3, 2, 1, 0].map(daysAgo => {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - daysAgo);
      targetDate.setHours(0, 0, 0, 0);

      const nextDate = new Date(targetDate);
      nextDate.setDate(targetDate.getDate() + 1);

      const dayResults = results.filter(r => {
        if (!r.submitted_at) return false;
        const submitDate = new Date(r.submitted_at);
        return submitDate >= targetDate && submitDate < nextDate;
      });

      if (dayResults.length === 0) return 0;

      const sum = dayResults.reduce((s, r) => s + Number(r.suggested_total_score ?? r.total_score ?? 0), 0);
      return sum / dayResults.length; // Trung bình cộng trong ngày
    });

    // 3. Chart Cao nhất: Điểm cao nhất trong mỗi ngày (7 ngày gần nhất)
    const chartDataBest = [6, 5, 4, 3, 2, 1, 0].map(daysAgo => {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - daysAgo);
      targetDate.setHours(0, 0, 0, 0);

      const nextDate = new Date(targetDate);
      nextDate.setDate(targetDate.getDate() + 1);

      const dayResults = results.filter(r => {
        if (!r.submitted_at) return false;
        const submitDate = new Date(r.submitted_at);
        return submitDate >= targetDate && submitDate < nextDate;
      });

      if (dayResults.length === 0) return 0;

      return Math.max(...dayResults.map(r => Number(r.suggested_total_score ?? r.total_score ?? 0)));
    });

    // 4. Chart Tỷ lệ đạt: Điểm bài thi gần nhất trong mỗi ngày
    const chartDataPass = [6, 5, 4, 3, 2, 1, 0].map(daysAgo => {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - daysAgo);
      targetDate.setHours(0, 0, 0, 0);

      const nextDate = new Date(targetDate);
      nextDate.setDate(targetDate.getDate() + 1);

      const dayResults = results.filter(r => {
        if (!r.submitted_at) return false;
        const submitDate = new Date(r.submitted_at);
        return submitDate >= targetDate && submitDate < nextDate;
      });

      if (dayResults.length === 0) return 0;

      // Lấy bài gần nhất trong ngày đó
      return Number(dayResults[0].suggested_total_score ?? dayResults[0].total_score ?? 0);
    });

    const finalStats = {
      n,
      best,
      avg: avg.toFixed(1),
      passRate,
      chartDataTotal,
      chartDataAvg,
      chartDataBest,
      chartDataPass
    };

    return finalStats;
  }, [results]);

  const logout = () => {
    try { localStorage.clear(); sessionStorage.clear(); } catch { }
    navigate('/login');
  };

  const Card = ({ title, desc, action, onClick, icon }) => (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl p-4 bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-blue-200"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 transition-colors duration-200 group-hover:from-blue-200 group-hover:to-indigo-200">
          {icon || "📘"}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">{desc}</p>
        </div>
      </div>
      <div className="mt-3 text-sm font-medium text-blue-600 group-hover:translate-x-0.5 transition-transform">
        {action} →
      </div>
    </button>
  );

  const StatCard = ({ icon, iconBg, title, value, subtitle, chartData, barColor }) => {
    const [animated, setAnimated] = React.useState(false);
    const [lineProgress, setLineProgress] = React.useState(0);

    React.useEffect(() => {

      const lineTimer = setTimeout(() => {
        setLineProgress(100);
      }, 50);

      // Animation cho bars
      const barTimer = setTimeout(() => {
        setAnimated(true);
      }, 400);

      return () => {
        clearTimeout(lineTimer);
        clearTimeout(barTimer);
      };
    }, [])

    const maxHeight = chartData && chartData.length > 0 ? Math.max(...chartData, 1) : 1;

    return (
      <div className="bg-white rounded-2xl p-5 border border-slate-200 hover:shadow-lg transition-all">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg} shadow-sm`}>
            <span className="text-xl">{icon}</span>
          </div>
          <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">{title}</span>
        </div>

        <div className="mb-3">
          <div className="text-3xl font-bold text-slate-800 mb-1">{value}</div>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>

        {/* Mini bar chart với 7 cột */}
        <div className="relative flex items-end gap-1 h-16 bg-slate-100/50 rounded-lg px-1.5 pb-1 pt-2 overflow-hidden">
          {chartData && chartData.length > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none z-0"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{ width: '100%', height: 'calc(100% - 12px)' }}
            >
              <defs>
                <linearGradient id={`gradient-${title.replace(/\s/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="50%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#f472b6" />
                </linearGradient>
              </defs>
              <polyline
                points={chartData.map((height, index) => {
                  const x = ((index + 0.5) / chartData.length) * 100;
                  const barHeightPercent = maxHeight > 0 ? (height / maxHeight) * 100 : 0;
                  const y = 100 - barHeightPercent;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke={`url(#gradient-${title.replace(/\s/g, '')})`}
                strokeWidth="0.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.7"
                pathLength="1"
                style={{
                  strokeDasharray: '1',
                  strokeDashoffset: lineProgress === 100 ? 0 : 1,
                  transition: 'stroke-dashoffset 1200ms ease-in-out'
                }}
              />
            </svg>
          )}

          {chartData && chartData.length > 0 ? (
            chartData.map((height, index) => {
              const barHeight = maxHeight > 0 ? (height / maxHeight) * 100 : 0;
              const finalHeight = barHeight;

              return (
                <div key={index} className="flex-1 flex flex-col items-center justify-end gap-0.5 relative z-10" style={{ height: '100%' }}>
                  {/* Bar */}
                  <div className="w-full flex items-end" style={{ flex: 1 }}>
                    <div
                      className={`w-full rounded-t ${barColor}`}
                      style={{
                        height: animated ? `${finalHeight}%` : '0%',
                        transition: 'height 700ms ease-out',
                        transitionDelay: `${index * 80}ms`,
                        minWidth: '6px'
                      }}
                    />
                  </div>
                  {/* Label - chỉ hiển thị khi có giá trị */}
                  {height > 0 && (
                    <div className="text-[8px] text-slate-500 font-medium">
                      {height.toFixed(0)}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-xs text-slate-400">Không có dữ liệu</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => navigate('/')} className="flex items-center gap-1 sm:gap-3">
              <img src="/Logo.png" alt="Logo" className="h-6 sm:h-9 w-auto" />
              <h1 className="text-xs sm:text-base font-semibold text-slate-700 truncate max-w-[45px] xs:max-w-[70px] sm:max-w-none">
                Student
              </h1>
            </button>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex items-center gap-1 sm:gap-2 text-left group focus-visible:outline-none flex-shrink-0"
            >
              <img
                src={getFullImageUrl(user.avatar)}
                alt="avatar"
                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover border border-slate-200"
              />
              <span className="text-[11px] sm:text-sm text-slate-600 truncate max-w-[65px] xs:max-w-[100px] sm:max-w-none">
                <span className="hidden sm:inline">Xin chào, </span>
                <span className="font-semibold text-slate-800 group-hover:text-blue-700 underline underline-offset-2">
                  {user.fullname || 'Người dùng'}
                </span>
              </span>
            </button>
            <button onClick={logout} className="px-1.5 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-sm rounded-lg border border-slate-300 text-slate-700 hover:border-slate-400 flex-shrink-0">
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {/* Hero */}
        <section className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-800">Chào mừng bạn trở lại 👋</h2>
          <p className="text-slate-600">Theo dõi điểm số và tiến độ của bạn</p>
        </section>

        {/* Stats Cards - Mini Bar Charts */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon="🎓"
            iconBg="bg-gradient-to-br from-blue-100 to-blue-200"
            title="Tổng bài thi"
            value={stats.n}
            subtitle="Bài đã hoàn thành"
            chartData={stats.chartDataTotal}
            barColor="bg-gradient-to-t from-blue-500 to-blue-400"
          />
          <StatCard
            icon="📈"
            iconBg="bg-gradient-to-br from-emerald-100 to-emerald-200"
            title="Điểm TB"
            value={stats.avg}
            subtitle="Trung bình cộng"
            chartData={stats.chartDataAvg}
            barColor="bg-gradient-to-t from-emerald-500 to-emerald-400"
          />
          <StatCard
            icon="🏆"
            iconBg="bg-gradient-to-br from-violet-100 to-violet-200"
            title="Cao nhất"
            value={`${Number(stats.best).toFixed(1)}/10`}
            subtitle="Điểm tốt nhất"
            chartData={stats.chartDataBest}
            barColor="bg-gradient-to-t from-violet-500 to-violet-400"
          />
          <StatCard
            icon="📊"
            iconBg="bg-gradient-to-br from-amber-100 to-amber-200"
            title="Tỷ lệ đạt"
            value={`${stats.passRate}%`}
            subtitle="Bài đạt ≥ 5.0đ"
            chartData={stats.chartDataPass}
            barColor="bg-gradient-to-t from-amber-500 to-amber-400"
          />
        </section>

        {/* Quick actions mapped to user stories */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Card
            title="Vào thi"
            desc="Nhập mã phòng được giảng viên cung cấp."
            action="Xác minh ngay"
            onClick={() => {
              // Xóa toàn bộ session trước khi vào verify room
              try {
                sessionStorage.removeItem('room_token');
                sessionStorage.removeItem('exam_flags');
                sessionStorage.removeItem('pending_exam_duration');
                sessionStorage.removeItem('room_code');
                sessionStorage.removeItem('exam_id');
                sessionStorage.removeItem('exam_duration');
              } catch (err) {
                console.error('Error clearing session:', err);
              }
              navigate('/verify-room', { state: { fromStudentDashboard: true } });
            }}
            icon="🔐"
          />
          <Card
            title="Kết quả & lịch sử"
            desc="Xem điểm các bài đã thi."
            action="Xem bảng điểm"
            onClick={() => navigate('/student-dashboard/results')}
            icon="📊"
          />
          <Card
            title="Hồ sơ"
            desc="Cập nhật thông tin cá nhân, avatar."
            action="Cập nhật"
            onClick={() => navigate('/profile')}
            icon="👤"
          />
        </section>

        {/* Centered bottom cards */}
        <section className="flex justify-center mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full">
            <Card
              title="Hướng dẫn & Trợ giúp"
              desc="Quy tắc chống gian lận & liên hệ hỗ trợ."
              action="Xem hướng dẫn"
              onClick={() => navigate('/student-dashboard/guidelines')}
              icon="🛡️"
            />
            <Card
              title="Trợ giúp"
              desc="Liên hệ hỗ trợ khi gặp lỗi."
              action="Gửi yêu cầu"
              onClick={() => navigate('/student-dashboard/support')}
              icon="❓"
            />
          </div>
        </section>

        {/* Recent results */}
        <section className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Kết quả gần đây</h3>
            <button onClick={() => navigate('/student-dashboard/results')} className="text-sm text-blue-600 hover:underline">Xem tất cả</button>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
              <div className="h-12 w-full bg-slate-200 rounded animate-pulse" />
              <div className="h-12 w-full bg-slate-200 rounded animate-pulse" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-slate-500 text-sm">Chưa có kết quả nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-4">Bài thi</th>
                    <th className="py-2 pr-4">MCQ</th>
                    <th className="py-2 pr-4">Tự luận</th>
                    <th className="py-2 pr-4">Tổng tạm</th>
                    <th className="py-2 pr-4">Trạng thái</th>
                    <th className="py-2 pr-4">Ngày nộp</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 6).map((r) => {
                    const isConfirmed = r.instructor_confirmed === 1 || r.status === 'confirmed';
                    return (
                      <tr key={r.submission_id} className="border-t border-slate-100">
                        <td className="py-2 pr-4 font-medium text-slate-700">{r.exam_title || r.exam_id}</td>
                        <td className="py-2 pr-4">{(r.mcq_score ?? r.total_score) != null ? Number(r.mcq_score ?? r.total_score).toFixed(1) : '-'}</td>
                        <td className="py-2 pr-4">{(r.essay_score ?? r.ai_score) != null ? Number(r.essay_score ?? r.ai_score).toFixed(1) : '-'}</td>
                        <td className="py-2 pr-4 font-semibold">{r.suggested_total_score != null ? Number(r.suggested_total_score).toFixed(1) : '-'}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isConfirmed
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                            }`}>
                            {isConfirmed ? '✓ Đã duyệt' : '⏳ Chưa duyệt'}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
