import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useUi } from '../../context/UiContext.jsx';

export default function ExamPreview() {
  const { examId } = useParams();
  const nav = useNavigate();
  const { t } = useUi();
  const [data, setData] = React.useState({ questions: [] });
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');

  React.useEffect(()=>{
    (async()=>{
      try {
        const res = await axiosClient.get(`/instructor/exams/${examId}/preview`);
        setData(res.data || { questions: [] });
      } catch(e){ setErr('Không thể tải preview đề thi.'); }
      finally { setLoading(false); }
    })();
  }, [examId]);

  const qs = data.questions || [];
  const total = qs.length;
  const mcq = qs.filter(q=> q.type==='MCQ').length;
  const essay = total - mcq;


  const splitQA = (q) => {
    const text = (q?.question_text || '').trim();
    const direct = (q?.model_answer || '').trim();
    const markers = ['câu trả lời:', 'cau tra loi:', 'answer:'];
    const lower = text.toLowerCase();
    let cut = -1; let markerLen = 0;
    for (const m of markers) {
      const i = lower.indexOf(m);
      if (i >= 0) { cut = i; markerLen = m.length; break; }
    }
    if (direct) {
      if (cut >= 0) return { stem: text.substring(0, cut).trim(), model: direct };
      return { stem: text, model: direct };
    }
    if (cut >= 0) {
      const stem = text.substring(0, cut).trim().replace(/[\s:]*$/, '');
      const model = text.substring(cut + markerLen).trim();
      return { stem, model };
    }
    return { stem: text, model: '' };
  };

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-5 rounded-2xl px-4 py-3 border border-slate-200 bg-gradient-to-r from-white to-slate-50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl grid place-items-center bg-blue-600 text-white shadow">📄</div>
          <h1 className="text-lg font-semibold text-slate-800">{t('preview_title','Preview – Xem trước','Preview')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold shadow-sm">{total} Tổng cộng</div>
          <div className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold shadow-sm">{mcq} Trắc nghiệm</div>
          <div className="px-3 py-1 rounded-lg bg-violet-50 text-violet-700 text-sm font-semibold shadow-sm">{essay} Tự luận</div>
        </div>
      </header>

      {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
      {loading ? (
        <p>Đang tải…</p>
      ) : (
        <div className="space-y-3 max-h-[75vh] overflow-auto pr-2">
          {qs.map((q, idx)=> (
            <section key={q.question_id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 hover:border-blue-300 hover:shadow transition">
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold">T</span>
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700">{q.type}</span>
              </div>
              {q.type==='Essay' ? (
                <div className="font-semibold mb-2">Câu {idx+1}: {splitQA(q).stem}</div>
              ) : (
                <div className="font-semibold mb-2">Câu {idx+1}: {q.question_text}</div>
              )}
              {q.type==='MCQ' ? (
                <ul className="space-y-1">
                  {(q.options||[]).map((o, i)=> (
                    <li key={o.option_id} className={`flex items-center gap-2 ${o.is_correct? 'text-emerald-600 font-medium':''}`}>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700">{String.fromCharCode(65+i)}</span>
                      <span>{o.option_text}</span>
                      {o.is_correct && <span>✓</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-700">
                  <div className="italic text-slate-500">Đáp án mẫu:</div>
                  <div className="mt-1 whitespace-pre-wrap">{splitQA(q).model || '—'}</div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button onClick={()=> nav('/open-exam')} className="text-blue-600 hover:underline">← Quay lại danh sách</button>
        <button onClick={()=> nav(`/exam-settings/${examId}`)} className="px-4 py-2 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow hover:brightness-105">Bắt đầu mở phòng</button>
      </div>
    </div>
  );
}
