import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

export default function OpenRoomSuccess(){
  const nav = useNavigate();
  const { examId } = useParams();
  const [search] = useSearchParams();
  const room = search.get('room') || '';

  const copy = async () => {
    try { await navigator.clipboard.writeText(room); } catch {}
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Mở phòng thi thành công</h1>
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <div className="text-slate-400 text-sm">Mã tham gia</div>
          <div className="mt-1 font-mono text-4xl tracking-widest">{room || '———'}</div>
        </div>
        <button onClick={copy} className="ml-4 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600">Copy</button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={()=> nav('/open-exam')} className="px-4 py-2 rounded-lg border border-slate-300">Quay lại danh sách</button>
        <button onClick={()=> nav(`/exams/${examId}/preview`)} className="px-4 py-2 rounded-lg border border-slate-300">Xem lại đề</button>
      </div>
    </div>
  );
}
