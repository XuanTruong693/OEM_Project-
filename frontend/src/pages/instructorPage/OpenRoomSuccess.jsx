import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

export default function OpenRoomSuccess() {
  const nav = useNavigate();
  const { examId } = useParams();
  const [search] = useSearchParams();
  const room = (search.get('room') || '');

  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!navigator.clipboard) {
      alert("Trình duyệt không hỗ trợ sao chép tự động. Hãy sao chép mã thủ công.");
      return;
    }
    try {
      await navigator.clipboard.writeText(room);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  return (
    <div className="w-full py-12 px-2 sm:px-6 md:px-10">
      <header className="mb-10 font-sans flex flex-col items-center text-center">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm transition-transform hover:scale-110">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            <span>Mở phòng thi thành công</span>
          </h1>
        </div>
        <p className="text-slate-500 text-sm max-w-md">
          <span>Phòng thi đã sẵn sàng. Hãy gửi mã tham gia bên dưới cho sinh viên của bạn.</span>
        </p>
      </header>

      {/* Main Code Box Container */}
      <section className="bg-white border-2 border-slate-800 rounded-none p-8 md:px-20 md:py-12 shadow-sm transition-all hover:shadow-md">
        <div className="flex flex-col items-center">
          <div className="inline-block px-4 py-1.5 bg-slate-50 rounded-none mb-6 border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
              <span>EXAM_ACCESS_CODE</span>
            </span>
          </div>

          <div className="flex flex-col items-center gap-10 w-full">
            <div className="font-mono text-6xl md:text-8xl font-black text-slate-900 tracking-[0.2em] py-4">
              <span>{room || '———'}</span>
            </div>

            <button
              onClick={copy}
              className={`w-full max-w-sm flex items-center justify-center gap-3 py-4 rounded-none font-bold text-base transition-all duration-300 active:scale-[0.98] ${copied
                  ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-100'
                  : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-100'
                }`}
            >
              {copied ? (
                <>
                  <svg className="w-5 h-5 animate-in zoom-in" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Đã sao chép mã</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Sao chép mã phòng</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Footer Navigation */}
      <footer className="mt-12">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => nav('/open-exam')}
            className="w-full sm:flex-1 py-4 px-6 rounded-none border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Quay lại danh sách</span>
          </button>
          <button
            onClick={() => nav(`/exams/${examId}/preview`)}
            className="w-full sm:flex-1 py-4 px-6 rounded-none border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 group"
          >
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Xem lại đề</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
