import React from 'react';
import axiosClient from '../../api/axiosClient';

export default function ResultsDashboard() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState('date_desc'); // date_desc | score_desc | score_asc

  React.useEffect(()=>{
    (async ()=>{
      try {
        const res = await axiosClient.get('/results/my');
        setRows(res.data || []);
      } catch (e) {
        setRows([]);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = React.useMemo(()=>{
    const norm = (s)=> String(s||'').toLowerCase();
    let arr = (rows||[]).filter(r => norm(r.exam_title||r.exam_id).includes(norm(q)));
    if (sort === 'score_desc') {
      arr = arr.sort((a,b)=> ((b.suggested_total_score ?? b.total_score ?? 0) - (a.suggested_total_score ?? a.total_score ?? 0)));
    } else if (sort === 'score_asc') {
      arr = arr.sort((a,b)=> ((a.suggested_total_score ?? a.total_score ?? 0) - (b.suggested_total_score ?? b.total_score ?? 0)));
    } else { // date_desc
      arr = arr.sort((a,b)=> new Date(b.submitted_at||0) - new Date(a.submitted_at||0));
    }
    return arr;
  }, [rows, q, sort]);

  const stats = React.useMemo(()=>{
    const n = rows.length;
    const best = rows.reduce((m,r)=> Math.max(m, Number(r.suggested_total_score ?? r.total_score ?? 0)), 0);
    const avg = n ? Math.round(rows.reduce((s,r)=> s + Number(r.suggested_total_score ?? r.total_score ?? 0), 0) / n) : 0;
    return { n, best, avg };
  }, [rows]);

  const badge = (v)=> {
    if (v == null) return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">-</span>;
    const s = Number(v);
    if (s >= 80) return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">{s}</span>;
    if (s >= 50) return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">{s}</span>;
    return <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold">{s}</span>;
  };

  return (
    <div className="p-4">
      {/* Hero */}
      <div className="rounded-2xl p-5 mb-5 border shadow-sm bg-[radial-gradient(900px_500px_at_-10%_-10%,#c7d2fe_0,transparent_60%),radial-gradient(900px_600px_at_120%_10%,#a7f3d0_0,transparent_55%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Kết quả của tôi</h1>
            <p className="text-slate-600">Xem điểm các bài thi đã nộp</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm shadow">{stats.n} bài</div>
            <div className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-sm shadow">TB: {stats.avg}</div>
            <div className="px-3 py-1 rounded-lg bg-violet-50 text-violet-700 text-sm shadow">Cao nhất: {stats.best}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Tìm bài thi..."
            className="px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={q}
            onChange={(e)=> setQ(e.target.value)}
          />
          <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
            <button onClick={()=> setSort('date_desc')} className={`px-3 py-2 text-sm ${sort==='date_desc'?'bg-blue-600 text-white':'bg-white hover:bg-slate-50'}`}>Mới nhất</button>
            <button onClick={()=> setSort('score_desc')} className={`px-3 py-2 text-sm ${sort==='score_desc'?'bg-blue-600 text-white':'bg-white hover:bg-slate-50'}`}>Điểm ↓</button>
            <button onClick={()=> setSort('score_asc')} className={`px-3 py-2 text-sm ${sort==='score_asc'?'bg-blue-600 text-white':'bg-white hover:bg-slate-50'}`}>Điểm ↑</button>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <div className="overflow-auto rounded-2xl border border-slate-200 shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 text-slate-700">
              <tr className="text-left">
                <th className="p-3">Bài thi</th>
                <th className="p-3">MCQ</th>
                <th className="p-3">Tự luận</th>
                <th className="p-3">Tổng tạm</th>
                <th className="p-3">Ngày thi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i)=> {
                const mcq = (r.total_score ?? r.mcq_score);
                const essay = r.essay_score;
                const total = r.suggested_total_score ?? (Number(mcq||0) + Number(essay||0));
                return (
                  <tr key={r.submission_id} className={`border-t hover:bg-indigo-50/30 transition ${i%2?'bg-slate-50/40':''}`}>
                    <td className="p-3 font-medium text-slate-800">{r.exam_title || r.exam_id}</td>
                    <td className="p-3">{badge(mcq)}</td>
                    <td className="p-3">{badge(essay)}</td>
                    <td className="p-3">{badge(total)}</td>
                    <td className="p-3 text-slate-600">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
