import React from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

export default function PublishedResultsList(){
  const nav = useNavigate();
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');

  React.useEffect(()=>{
    (async ()=>{
      try{
        const res = await axiosClient.get('/instructor/exams/my');
        const list = (res.data||[]).filter(e => String(e.status)==='published');
        setRows(list);
      }catch{ setRows([]);} finally{ setLoading(false); }
    })();
  },[]);

  const filtered = React.useMemo(()=>{
    const norm = (s)=> String(s||'').toLowerCase();
    return rows.filter(r => norm(r.title||r.id).includes(norm(q)));
  }, [rows, q]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Các bài thi đã publish</h1>
        <input value={q} onChange={e=> setQ(e.target.value)} placeholder="Tìm bài thi..." className="px-3 py-2 border rounded-lg"/>
      </div>

      {loading ? (
        <p>Đang tải…</p>
      ) : filtered.length===0 ? (
        <p className="text-slate-600">Chưa có bài thi publish.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map(e => (
            <li key={e.id}>
              <button
                onClick={()=> nav(`/result?exam_id=${e.id}`)}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-800">{e.title || `Exam #${e.id}`}</div>
                  <div className="text-xs text-slate-500 mt-0.5">ID: {e.id}</div>
                </div>
                <span className="text-sm text-blue-600">Xem kết quả →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

