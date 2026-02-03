import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

export default function OpenRoomSuccess() {
  const nav = useNavigate();
  const { examId } = useParams();
  const [search] = useSearchParams();
  const room = search.get('room') || '';

  // State để hiển thị dấu tick sau khi copy
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room);
      setCopied(true);
      // Reset về trạng thái ban đầu sau 2 giây để có thể copy lại
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Mở phòng thi thành công</h1>
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <div className="text-slate-400 text-sm">Mã tham gia</div>
          <div className="mt-1 font-mono text-4xl tracking-widest">{room || '———'}</div>
        </div>
        <button
          onClick={copy}
          className={`ml-4 px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300 ${copied
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : 'bg-slate-700 hover:bg-slate-600'
            }`}
        >
          {copied ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Đã copy</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => nav('/open-exam')} className="px-4 py-2 rounded-lg border border-slate-300">Quay lại danh sách</button>
        <button onClick={() => nav(`/exams/${examId}/preview`)} className="px-4 py-2 rounded-lg border border-slate-300">Xem lại đề</button>
      </div>
    </div>
  );
}
