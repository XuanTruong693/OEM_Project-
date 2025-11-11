import React from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useUi } from '../../context/UiContext.jsx';

export default function OpenExam() {
  const nav = useNavigate();
  const { t } = useUi();
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('all'); // all | draft | published

  React.useEffect(()=>{
    (async()=>{
      try {
        const res = await axiosClient.get('/instructor/exams/my');
        setRows(res.data||[]);
      } catch(e){ setRows([]);} finally { setLoading(false); }
    })();
  },[]);

  const openPreview = (examId) => {
    setErr('');
    nav(`/exams/${examId}/preview`);
  };

  const filtered = React.useMemo(()=>{
    const norm = (s)=> String(s||'').toLowerCase();
    return (rows||[])
      .filter(r => status==='all' ? true : String(r.status||'draft')===status)
      .filter(r => norm(r.title||r.id).includes(norm(q)));
  }, [rows, q, status]);

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-3">{t('open_exam_title','Mở phòng thi','Open Room')}</h1>
      <div className="mx-auto w-full">
        <section className="w-full bg-white backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 white:text-slate-100 mb-3">{t('my_exams','Đề thi của tôi','My Exams')}</h2>
          {/* Filters */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={q}
              onChange={(e)=> setQ(e.target.value)}
              placeholder="Tìm tên đề thi..."
              className="px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
              {['all','draft','published'].map(s => (
                <button key={s} onClick={()=> setStatus(s)} className={`px-3 py-2 text-sm ${status===s? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50'}`}>
                  {s==='all'? t('all','Tất cả','All') : s==='draft'? 'Draft' : 'Published'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p>Đang tải…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có đề thi.</p>
          ) : (
            <ul className="space-y-3">
              {filtered.map(e => (
                <li key={e.id}>
                  <button
                    onClick={()=> openPreview(e.id)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{e.title || `Exam #${e.id}`}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Trạng thái: <span className={`px-2 py-0.5 rounded ${e.status==='published'?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}>{e.status || 'draft'}</span></div>
                    </div>
                    <span className="text-sm text-blue-600">Xem →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {err && <div className="text-red-600 text-sm mt-3">{err}</div>}
      </div>
    </div>
  );
}
