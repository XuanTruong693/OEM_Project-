import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { useExamContext } from "../../context/ExamContext";
import {
  Clock,
  Shield,
  ChevronLeft,
  Eye,
  Play,
  RotateCcw,
  MonitorSmartphone,
  UserCheck,
  CreditCard,
  Shuffle,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

const ToggleButton = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
      checked ? "bg-blue-600" : "bg-slate-200"
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

const SectionHeading = ({ icon: Icon, title, description }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 text-slate-900 mb-1">
      <div className="p-1.5 rounded-md bg-slate-100/80 text-slate-700">
        <Icon className="w-5 h-5" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
    {description && <p className="text-sm text-slate-500">{description}</p>}
  </div>
);

const LabeledToggle = ({ icon: Icon, label, description, checked, onChange }) => (
  <div className="flex items-start sm:items-center justify-between gap-4 py-4 border-b border-slate-100 last:border-0 last:pb-0">
    <div className="flex items-center gap-4">
      <div className="hidden sm:flex p-2.5 rounded-full bg-slate-50 text-slate-400 border border-slate-100">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="font-medium text-slate-800">{label}</div>
        <div className="text-sm text-slate-500 mt-0.5">{description}</div>
      </div>
    </div>
    <div className="pt-1 sm:pt-0">
      <ToggleButton checked={checked} onChange={onChange} />
    </div>
  </div>
);

const ModeSwitch = ({ combined, setCombined }) => (
  <div className="hidden md:flex items-center gap-2 text-sm">
    <span className="text-slate-500 font-medium">Chế độ hiển thị:</span>
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
      <button
        onClick={() => setCombined(true)}
        className={`px-3 py-1.5 rounded-md transition-all text-sm font-medium ${
          combined
            ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-900/5"
            : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
        }`}
      >
        Chung
      </button>
      <button
        onClick={() => setCombined(false)}
        className={`px-3 py-1.5 rounded-md transition-all text-sm font-medium ${
          !combined
            ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-900/5"
            : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
        }`}
      >
        Theo tab
      </button>
    </div>
  </div>
);

const Tabs = ({ tab, setTab }) => (
  <div className="mb-6 flex gap-6 border-b border-slate-200">
    {[
      { id: "overview", label: "Tổng quan" },
      { id: "anti", label: "Chống gian lận" }
    ].map((t) => (
      <button
        key={t.id}
        onClick={() => setTab(t.id)}
        className={`pb-3 text-sm font-medium transition-colors border-b-2 relative -mb-[1px] ${
          tab === t.id
            ? "border-blue-600 text-blue-700"
            : "border-transparent text-slate-500 hover:text-slate-800"
        }`}
      >
        {t.label}
      </button>
    ))}
    <span className="pb-3 text-sm font-medium text-slate-300 cursor-not-allowed hidden sm:inline-block">Làm chủ (Sắp tới)</span>
    <span className="pb-3 text-sm font-medium text-slate-300 cursor-not-allowed hidden sm:inline-block">Game hoá (Sắp tới)</span>
  </div>
);

export default function ExamSettings() {
  const { examId } = useParams();
  const { setActiveExamId } = useExamContext();
  const nav = useNavigate();
  
  const [tab, setTab] = useState("overview");
  const [combined, setCombined] = useState(true);
  
  const [form, setForm] = useState({
    duration: 60,
    duration_minutes: 60,
    time_open: "",
    time_close: "",
    max_attempts: 0,
    require_face_check: false,
    require_student_card: false,
    monitor_screen: false,
    intent_shuffle: false,
    grading_mode: "general",
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [room, setRoom] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState(null);

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (examId) {
      console.log(`📍 [ExamSettings] Setting activeExamId: ${examId}`);
      setActiveExamId(parseInt(examId));
    }
  }, [examId, setActiveExamId]);

  const nowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  useEffect(() => {
    const open = new Date();
    const close = new Date(open.getTime() + 2 * 3600 * 1000);
    open.setMinutes(open.getMinutes() - open.getTimezoneOffset());
    close.setMinutes(close.getMinutes() - close.getTimezoneOffset());
    setForm((s) => ({
      ...s,
      time_open: open.toISOString().slice(0, 16),
      time_close: close.toISOString().slice(0, 16),
    }));
  }, []);

  const validate = () => {
    setErr("");
    const o = new Date(form.time_open);
    const c = new Date(form.time_close);
    const now = new Date();
    
    if (o.getTime() < now.getTime()) {
      setErr("Thời gian bắt đầu phải từ hiện tại trở đi.");
      return false;
    }
    if (c.getTime() <= o.getTime()) {
      setErr("Thời gian kết thúc phải lớn hơn thời gian bắt đầu.");
      return false;
    }
    if (!form.duration || !form.duration_minutes) {
      setErr("Vui lòng nhập đầy đủ thời lượng thi.");
      return false;
    }
    if (Number(form.duration) <= 0 || Number(form.duration_minutes) <= 0) {
      setErr("Thời lượng thi phải là số dương.");
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const payload = {
        ...form,
        max_points: 10,
        max_attempts: form.max_attempts ? Number(form.max_attempts) : 0,
        duration: Number(form.duration),
        duration_minutes: Number(form.duration_minutes),
        intent_shuffle: form.intent_shuffle ? 1 : 0,
        grading_mode: form.grading_mode || "general",
      };
      const toISO = (s) => new Date(s).toISOString();
      payload.time_open = toISO(form.time_open);
      payload.time_close = toISO(form.time_close);
      
      const res = await axiosClient.post(`/instructor/exams/${examId}/open`, payload);
      const code = res.data?.exam_room_code || "";
      setRoom(code);
      setNotice("Mở phòng thi thành công. Đang chuyển hướng...");
      nav(`/open-success/${examId}?room=${encodeURIComponent(code)}`);
    } catch (e) {
      setErr(e?.response?.data?.message || "Không thể lưu cấu hình phòng thi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans pb-10">
      {/* Sticky header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900 leading-tight">Cấu hình phòng thi</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200">ID: {examId}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 self-start md:self-auto w-full md:w-auto mt-2 md:mt-0 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => nav("/open-exam")}
              className="hidden md:flex text-sm font-medium text-slate-500 hover:text-slate-800 items-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-0.5" />
              Danh sách đề
            </button>
            <button
              onClick={() => nav(`/exams/${examId}/preview`)}
              className="inline-flex justify-center items-center px-3 py-2 md:py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 transition-colors whitespace-nowrap"
            >
              <Eye className="w-4 h-4 mr-1.5 text-slate-500" />
              Xem đề
            </button>
            
            <div className="hidden md:block w-px h-6 bg-slate-200"></div>
            
            <ModeSwitch combined={combined} setCombined={setCombined} />
            
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex justify-center items-center px-4 py-2 md:py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap ml-auto md:ml-0"
            >
              {submitting ? (
                <RotateCcw className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-1.5" />
              )}
              {submitting ? "Đang xử lý..." : "Mở phòng"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8">
        {!combined && <Tabs tab={tab} setTab={setTab} />}
        
        <div className="space-y-6">
          
          {/* Error / Notice Display */}
          {err && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              <div>
                <h3 className="font-medium text-red-900">Có lỗi xảy ra</h3>
                <p className="text-sm text-red-700 mt-1">{err}</p>
              </div>
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-100 text-green-800 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600" />
              <div>
                <h3 className="font-medium text-green-900">Hoàn tất</h3>
                <p className="text-sm text-green-700 mt-1">{notice}</p>
              </div>
            </div>
          )}

          {/* Main settings sections */}
          {(combined || tab === "overview") && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <SectionHeading 
                icon={Clock} 
                title="Thời gian & Chấm điểm" 
                description="Thiết lập thời lượng, khung giờ mở phòng và cách thức chấm điểm của hệ thống." 
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Thời lượng (phút)</label>
                  <input
                    type="number"
                    min="1"
                    className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                    value={form.duration}
                    onChange={(e) => onChange("duration", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Số phút tính giờ (Duration Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors bg-slate-50"
                    value={form.duration_minutes}
                    onChange={(e) => onChange("duration_minutes", e.target.value)}
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">Thường giống với thời lượng thực tế.</p>
                </div>
                
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-100/80">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Thời gian bắt đầu</label>
                    <input
                      type="datetime-local"
                      min={nowLocal()}
                      className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors bg-white"
                      value={form.time_open}
                      onChange={(e) => onChange("time_open", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Thời gian kết thúc</label>
                    <input
                      type="datetime-local"
                      min={form.time_open}
                      className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors bg-white"
                      value={form.time_close}
                      onChange={(e) => onChange("time_close", e.target.value)}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Số lần làm lại tối đa</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors pr-12"
                      value={form.max_attempts}
                      onChange={(e) => onChange("max_attempts", e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-slate-400 sm:text-sm">{form.max_attempts == 0 ? "Vô hạn" : "lần"}</span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">Nhập 0 để cho phép làm lại không giới hạn.</p>
                </div>
                
                <div className="md:col-span-2 pt-2 border-t border-slate-100">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Mô hình chấm bài tự động AI</label>
                  <select
                    className="block w-full rounded-lg border border-slate-300 px-3.5 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors bg-white"
                    value={form.grading_mode}
                    onChange={(e) => onChange("grading_mode", e.target.value)}
                  >
                    <option value="general">Linh hoạt - Mở rộng dựa trên ngữ nghĩa (General Mode)</option>
                    <option value="technical">Khắt khe - Kiểm tra cú pháp kỹ thuật, lập trình (Technical Mode)</option>
                  </select>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={`p-3.5 rounded-xl border transition-colors ${form.grading_mode === 'general' ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200 transparent opacity-60'}`}>
                      <strong className="block text-xs text-slate-800 mb-1">Mode: Linh hoạt</strong>
                      <span className="text-xs text-slate-600 leading-relaxed block">AI tự động nhận diện điểm nếu bài làm khớp ngữ nghĩa hoặc ý tưởng. Thích hợp cho môn luật, triết học.</span>
                    </div>
                    <div className={`p-3.5 rounded-xl border transition-colors ${form.grading_mode === 'technical' ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 transparent opacity-60'}`}>
                      <strong className="block text-xs text-slate-800 mb-1">Mode: Khắt khe</strong>
                      <span className="text-xs text-slate-600 leading-relaxed block">AI kiểm tra chính xác cấu trúc khối code, tên hàm theo quy chuẩn. Thích hợp cho môn lập trình.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(combined || tab === "anti") && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <SectionHeading 
                icon={Shield} 
                title="Chống gian lận" 
                description="Bảo mật phòng thi thông qua xác thực thông tin và theo dõi môi trường làm bài." 
              />
              
              <div className="mt-4 space-y-1">
                <LabeledToggle
                  icon={UserCheck}
                  label="Xác minh khuôn mặt trước khi thi"
                  description="Đối chiếu ảnh chụp trực tiếp với hồ sơ trên hệ thống."
                  checked={form.require_face_check}
                  onChange={(v) => onChange("require_face_check", v)}
                />
                <LabeledToggle
                  icon={CreditCard}
                  label="Xác minh thẻ Sinh viên"
                  description="Sinh viên phải tải lên hình ảnh thẻ để kiểm tra."
                  checked={form.require_student_card}
                  onChange={(v) => onChange("require_student_card", v)}
                />
                <LabeledToggle
                  icon={MonitorSmartphone}
                  label="Theo dõi màn hình (Proctoring)"
                  description="Yêu cầu chế độ Fullscreen, cảnh báo và ghi nhận khi chuyển đổi tab."
                  checked={form.monitor_screen}
                  onChange={(v) => onChange("monitor_screen", v)}
                />
                <LabeledToggle
                  icon={Shuffle}
                  label="Xáo trộn câu hỏi"
                  description="Mỗi sinh viên sẽ nhận đề với thứ tự câu hỏi ngẫu nhiên."
                  checked={form.intent_shuffle}
                  onChange={(v) => onChange("intent_shuffle", v)}
                />
              </div>
            </div>
          )}
          
          {/* Action Button */}
          <div className="flex justify-end pt-4 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed transition-all w-full sm:w-auto"
            >
              {submitting ? (
                <RotateCcw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Play className="w-5 h-5 mr-2" />
              )}
              {submitting ? "Hệ thống đang mở phòng..." : "Mở phòng thi ngay"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
