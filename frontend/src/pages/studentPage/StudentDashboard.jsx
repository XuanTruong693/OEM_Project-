import React from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState({ fullname: '', avatar: '' });

  React.useEffect(() => {
    (async () => {
      try {
        const res = await axiosClient.get('/results/my');
        setResults((res.data || []).slice(0, 6));
      } catch (e) {
        setResults([]);
      } finally { setLoading(false); }
    })();
  }, []);

  // Load profile for greeting (ưu tiên API, fallback localStorage)
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
          } catch {}
          return;
        }
      } catch {}
      // fallback
      const fullname = localStorage.getItem('fullname') || 'Người dùng';
      const avatar = localStorage.getItem('avatar') || '/icons/UI Image/default-avatar.png';
      setUser({ fullname, avatar });
    })();
  }, []);

  const logout = () => {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    navigate('/login');
  };

  const Card = ({ title, desc, action, onClick, icon }) => (
    <button onClick={onClick} className="group text-left rounded-2xl p-4 bg-white border border-slate-200 hover:border-blue-300 hover:shadow transition">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 group-hover:from-blue-200 group-hover:to-indigo-200">
          {icon || '📘'}
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">{desc}</p>
        </div>
      </div>
      <div className="mt-3 text-sm font-medium text-blue-600">{action} →</div>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-3">
              <img src="/Logo.png" alt="Logo" className="h-9 w-auto" />
              <h1 className="text-base font-semibold text-slate-700">Student Dashboard</h1>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src={user.avatar || '/icons/UI Image/default-avatar.png'} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
              <span className="text-sm text-slate-600">Xin chào, <span className="font-semibold text-slate-800">{user.fullname || 'Người dùng'}</span></span>
            </div>
            <button onClick={logout} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:border-slate-400">Đăng xuất</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {/* Hero */}
        <section className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-800">Chào mừng bạn trở lại 👋</h2>
          <p className="text-slate-600">Bắt đầu bằng cách xác minh mã phòng thi hoặc xem kết quả gần đây.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => navigate('/student-dashboard/results')} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:border-slate-400">Kết quả của tôi</button>
          </div>
        </section>

        {/* Quick actions mapped to user stories */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Card title="Vào thi" desc="Nhập mã phòng được giảng viên cung cấp." action="Xác minh ngay" onClick={() => navigate('/verify-room')} icon="🔐" />
          <Card title="Kết quả & lịch sử" desc="Xem điểm các bài đã thi." action="Xem bảng điểm" onClick={() => navigate('/student-dashboard/results')} icon="📊" />
          <Card title="Khoá học" desc="Duyệt các khoá học mở." action="Xem khoá học" onClick={() => alert('Tính năng duyệt khoá học (US12) — sẽ tích hợp sau.')} icon="📚" />
          <Card title="Hồ sơ" desc="Cập nhật thông tin cá nhân, avatar." action="Cập nhật" onClick={() => navigate('/profile')} icon="👤" />
          <Card title="Hướng dẫn làm bài" desc="Quy tắc & chống gian lận." action="Xem hướng dẫn" onClick={() => alert('Hiển thị hướng dẫn/FAQ chống gian lận.')} icon="🛡️" />
          <Card title="Trợ giúp" desc="Liên hệ hỗ trợ khi gặp lỗi." action="Gửi yêu cầu" onClick={() => alert('Liên hệ hỗ trợ qua email/Zalo theo hướng dẫn.')} icon="❓" />
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
                    <th className="py-2 pr-4">Ngày nộp</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.submission_id} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-700">{r.exam_title || r.exam_id}</td>
                      <td className="py-2 pr-4">{(r.total_score ?? r.mcq_score) ?? '-'}</td>
                      <td className="py-2 pr-4">{r.essay_score ?? '-'}</td>
                      <td className="py-2 pr-4">{r.suggested_total_score ?? '-'}</td>
                      <td className="py-2 pr-4">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
