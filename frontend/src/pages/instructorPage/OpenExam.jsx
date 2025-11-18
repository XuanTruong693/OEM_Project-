import React from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { useUi } from "../../context/UiContext.jsx";

export default function OpenExam() {
  const nav = useNavigate();
  const { t } = useUi();
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");

  React.useEffect(() => {
    (async () => {
      try {
        const res = await axiosClient.get("/instructor/exams/my");
        setRows(res.data || []);
      } catch (e) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openPreview = (examId) => {
    setErr("");
    nav(`/exams/${examId}/preview`);
  };

  const getPhase = (e) => {
    const now = new Date();
    const open = e.time_open ? new Date(e.time_open) : null;
    const close = e.time_close ? new Date(e.time_close) : null;
    // Chưa mở: chưa set hoặc now < time_open
    if ((!open && !close) || (open && now < open))
      return { label: "Chưa mở", cls: "bg-slate-100 text-slate-700" };
    // Đã đóng: có close và now > close
    if (close && now > close)
      return { label: "Đã đóng thi", cls: "bg-rose-50 text-rose-700" };
    // Trong quá trình: có open/close và now trong khoảng
    if (open && close && now >= open && now <= close)
      return {
        label: "Trong quá trình",
        cls: "bg-emerald-50 text-emerald-700",
      };
    // Fallback
    return { label: "Chưa mở", cls: "bg-slate-100 text-slate-700" };
  };

  const filtered = React.useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    return (rows || [])
      .filter((r) =>
        status === "all" ? true : String(r.status || "draft") === status
      )
      .filter((r) => norm(r.title || r.id).includes(norm(q)));
  }, [rows, q, status]);

  return (
    <div className="p-4 mt-0 max-lg:mt-10">
      <h1 className="text-xl font-semibold mb-3">
        {t("open_exam_title", "Mở phòng thi", "Open Room")}
      </h1>
      <div className="mx-auto w-full">
        <section className="w-full bg-white backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            {t("my_exams", "Đề thi của tôi", "My Exams")}
          </h2>
          <div className="mb-3 max-lg:mb-4 flex flex-wrap  items-center gap-2">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tên đề thi..."
              className="px-3 w-full py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="inline-flex  max-lg:mb-10 rounded-xl border border-slate-200 overflow-hidden">
              {["all", "draft", "published"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-2 text-sm ${
                    status === s
                      ? "bg-blue-600 text-white"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  {s === "all"
                    ? t("all", "Tất cả", "All")
                    : s === "draft"
                    ? "Draft"
                    : "Published"}
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
              {filtered.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => openPreview(e.id)}
                    className="w-full text-left px-4 py-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:ring-2 hover:ring-sky-400"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-800">
                          {e.title || `Exam #${e.id}`}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center max-lg:flex-col max-lg:justify-start max-lg:items-start gap-2 max-lg:space-y-1">
                          <span>Trạng thái:</span>
                          <span
                            className={`px-2 py-0.5 rounded ${
                              e.status === "published"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {e.status || "draft"}
                          </span>
                          {/* Pha thi theo time_open/time_close */}
                          {(() => {
                            const p = getPhase(e);
                            return (
                              <span className={`px-2 py-0.5 rounded ${p.cls}`}>
                                {p.label}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 flex max-lg:flex-col max-lg:mt-2 items-center gap-2">
                          {e.time_open && (
                            <span>
                              Open: {new Date(e.time_open).toLocaleString()}
                            </span>
                          )}
                          {e.time_close && (
                            <span>
                              Close: {new Date(e.time_close).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-blue-600 ">Xem →</span>
                    </div>
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
