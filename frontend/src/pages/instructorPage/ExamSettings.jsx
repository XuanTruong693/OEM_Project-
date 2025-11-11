import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";

const Label = ({ children }) => (
  <label className="text-sm text-slate-600">{children}</label>
);

const Input = ({ type = "text", value, onChange, min }) => (
  <input
    type={type}
    min={min}
    className="w-full mt-1 border border-slate-300 rounded-xl p-2 bg-white transition focus:outline-none focus:ring-2 focus:ring-blue-300 hover:border-blue-300"
    value={value}
    onChange={onChange}
  />
);

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      checked ? "bg-emerald-500" : "bg-slate-300"
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
        checked ? "translate-x-5" : "translate-x-1"
      }`}
    />
  </button>
);

const SectionCard = ({ icon, title, subtitle, children }) => (
  <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl grid place-items-center text-white bg-gradient-to-br from-blue-500 to-indigo-500">
          {icon}
        </div>
        <div>
          <h2 className="font-semibold text-slate-800 leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const ModeSwitch = ({ combined, setCombined }) => (
  <div className="hidden md:flex items-center gap-2 text-sm">
    <span className="text-slate-500">Chế độ:</span>
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
      <button
        onClick={() => setCombined(true)}
        className={`px-3 py-1.5 rounded-lg transition ${
          combined ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
        }`}
      >
        Chung
      </button>
      <button
        onClick={() => setCombined(false)}
        className={`px-3 py-1.5 rounded-lg transition ${
          !combined ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
        }`}
      >
        Theo tab
      </button>
    </div>
  </div>
);

const Tabs = ({ tab, setTab }) => (
  <div className="mb-4 flex gap-2 border-b border-slate-200">
    {["overview", "anti"].map((k) => (
      <button
        key={k}
        onClick={() => setTab(k)}
        className={`px-3 py-2 text-sm rounded-t-lg border-b-2 -mb-px ${
          tab === k
            ? "border-blue-600 text-blue-700"
            : "border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        {k === "overview" ? "Tổng quan" : "Chống gian lận"}
      </button>
    ))}
    <span className="px-3 py-2 text-sm text-slate-400">Làm chủ</span>
    <span className="px-3 py-2 text-sm text-slate-400">Game hoá</span>
  </div>
);

const Page = ({ children, examId, nav, combined, setCombined, submitting, submit }) => (
  <div className="min-h-screen bg-slate-50">
    {/* Sticky header */}
    <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b border-slate-200">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg md:text-xl font-semibold text-slate-800">Cấu hình phòng thi</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav(`/exams/${examId}/preview`)}
            className="hidden md:inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700"
            title="Xem lại đề đã chọn"
          >
            Xem lại đề
          </button>
          <button
            onClick={() => nav('/open-exam')}
            className="hidden md:inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700"
            title="Quay lại danh sách đề"
          >
            ← Quay lại danh sách
          </button>
          <ModeSwitch combined={combined} setCombined={setCombined} />
          <button
            disabled={submitting}
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-60"
          >
            {submitting ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                Đang lưu…
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Mở phòng</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>

    {/* Content */}
    <main className="mx-auto max-w-6xl p-4">{children}</main>
  </div>
);

export default function ExamSettings() {
  const { examId } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = React.useState("overview");
  const [combined, setCombined] = React.useState(true); 
  const [form, setForm] = React.useState({
    duration: 60,
    duration_minutes: 60,
    time_open: "",
    time_close: "",
    max_points: "",
    require_face_check: false,
    require_student_card: false,
    monitor_screen: false,
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [room, setRoom] = React.useState("");
  const [err, setErr] = React.useState("");
  const [notice, setNotice] = React.useState(null);

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const nowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  React.useEffect(() => {
    // mặc định time_open = now, time_close = +2h
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
      setErr("Thời gian bắt đầu phải từ hiện tại trở đi");
      return false;
    }
    if (c.getTime() <= o.getTime()) {
      setErr("Thời gian kết thúc phải sau thời gian bắt đầu");
      return false;
    }
    if (!form.duration || !form.duration_minutes) {
      setErr("Vui lòng nhập thời lượng");
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
        max_points: form.max_points ? Number(form.max_points) : null,
        duration: Number(form.duration),
        duration_minutes: Number(form.duration_minutes),
      };
      const toISO = (s) => new Date(s).toISOString();
      payload.time_open = toISO(form.time_open);
      payload.time_close = toISO(form.time_close);
      const res = await axiosClient.post(`/instructor/exams/${examId}/open`, payload);
      const code = res.data?.exam_room_code || "";
      setRoom(code);
      setNotice("Mở phòng thành công. Đang chuyển...");
      nav(`/open-success/${examId}?room=${encodeURIComponent(code)}`);
    } catch (e) {
      setErr(e?.response?.data?.message || "Không thể lưu cấu hình");
    } finally {
      setSubmitting(false);
    }
  };

  // các component con đã chuyển ra ngoài để tránh remount

  return (
    <Page examId={examId} nav={nav} combined={combined} setCombined={setCombined} submitting={submitting} submit={submit}>
      {!combined && <Tabs tab={tab} setTab={setTab} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left (main) */}
        <div className="lg:col-span-2 space-y-4">
          {(combined || tab === "overview") && (
            <SectionCard icon="⚙️" title="Tổng quan" subtitle="Cấu hình thời lượng và khung giờ mở/đóng phòng">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Duration (phút)</Label>
                  <Input
                    type="number"
                    value={form.duration}
                    onChange={(e) => onChange("duration", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Duration minutes</Label>
                  <Input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => onChange("duration_minutes", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Thời gian bắt đầu</Label>
                  <Input
                    type="datetime-local"
                    min={nowLocal()}
                    value={form.time_open}
                    onChange={(e) => onChange("time_open", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Thời gian kết thúc</Label>
                  <Input
                    type="datetime-local"
                    min={form.time_open}
                    value={form.time_close}
                    onChange={(e) => onChange("time_close", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Tổng điểm (max_points)</Label>
                  <Input
                    type="number"
                    value={form.max_points}
                    onChange={(e) => onChange("max_points", e.target.value)}
                  />
                </div>
              </div>
            </SectionCard>
          )}

          {(combined || tab === "anti") && (
            <SectionCard icon="🛡️" title="Chống gian lận" subtitle="Thiết lập xác minh danh tính và kiểm soát môi trường làm bài">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-800">Yêu cầu xác minh khuôn mặt</div>
                    <div className="text-sm text-slate-500">Bật xác minh bằng ảnh khuôn mặt trước khi vào thi</div>
                  </div>
                  <Toggle
                    checked={form.require_face_check}
                    onChange={(v) => onChange("require_face_check", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-800">Yêu cầu xác minh thẻ SV</div>
                    <div className="text-sm text-slate-500">Tải ảnh thẻ sinh viên để đối chiếu</div>
                  </div>
                  <Toggle
                    checked={form.require_student_card}
                    onChange={(v) => onChange("require_student_card", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-800">Theo dõi màn hình</div>
                    <div className="text-sm text-slate-500">Yêu cầu fullscreen, ghi nhận rời tab/thoát toàn màn hình</div>
                  </div>
                  <Toggle
                    checked={form.monitor_screen}
                    onChange={(v) => onChange("monitor_screen", v)}
                  />
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        {/* Right (help / tips) */}
        <aside className="space-y-4">
          <section className="bg-gradient-to-br from-sky-50 to-indigo-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl grid place-items-center bg-white text-indigo-600 shadow-sm">ℹ️</div>
              <div>
                <div className="font-medium text-slate-800">Mẹo</div>
                <ul className="mt-1 text-sm text-slate-600 list-disc list-inside space-y-1">
                  <li>Đặt khung giờ đủ dài để sinh viên vào phòng.</li>
                  <li>Sử dụng theo dõi màn hình cho các kỳ thi quan trọng.</li>
                  <li>Kiểm tra kỹ thời lượng và điểm tối đa trước khi mở.</li>
                </ul>
              </div>
            </div>
          </section>

          {(err || notice) && (
            <section className={`${err ? "bg-rose-50" : "bg-emerald-50"} border border-slate-200 rounded-2xl p-4`}>
              <div className="flex items-start gap-3">
                <div className={`h-9 w-9 rounded-xl grid place-items-center ${
                  err ? "bg-white text-rose-600" : "bg-white text-emerald-600"
                } shadow-sm`}>{err ? "⚠️" : "✅"}</div>
                <div>
                  <div className={`font-medium ${err ? "text-rose-700" : "text-emerald-700"}`}>
                    {err ? "Có lỗi xảy ra" : "Thành công"}
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{err || notice}</p>
                </div>
              </div>
            </section>
          )}

          <section className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-sm text-slate-600">Kiểm tra kỹ cấu hình trước khi mở phòng.</div>
            <button
              disabled={submitting}
              onClick={submit}
              className="mt-3 w-full px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-60"
            >
              {submitting ? "Đang lưu…" : "Mở phòng"}
            </button>
          </section>
        </aside>
      </div>
    </Page>
  );
}
