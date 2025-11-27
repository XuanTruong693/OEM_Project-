import React from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";

const cls = (...a) => a.filter(Boolean).join(" ");

const Badge = ({ color = "slate", children }) => (
  <span
    className={cls(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
      color === "emerald" &&
        "bg-emerald-50 text-emerald-700 border-emerald-200",
      color === "amber" && "bg-amber-50 text-amber-700 border-amber-200",
      color === "rose" && "bg-rose-50 text-rose-700 border-rose-200",
      color === "slate" && "bg-slate-50 text-slate-700 border-slate-200"
    )}
  >
    {children}
  </span>
);

const StatCard = ({ label, value, subtle }) => (
  <div className="group rounded-2xl border  border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all">
    <div className="text-slate-500 text-sm">{label}</div>
    <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    {subtle ? (
      <div className="text-xs text-slate-400 mt-1">{subtle}</div>
    ) : null}
  </div>
);

const Section = ({ title, right, children }) => (
  <section className="rounded-2xl border   border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {right}
    </div>
    {children}
  </section>
);

const StatusPill = (v) => {
  const s = String(v || "").toLowerCase();
  if (s === "confirmed") return <Badge color="emerald">Confirmed</Badge>;
  if (s === "graded") return <Badge color="amber">Awaiting Approval</Badge>;
  if (s === "pending") return <Badge color="slate">Pending</Badge>;
  return <Badge>—</Badge>;
};

const fmtDate = (s) => (s ? new Date(s).toLocaleString() : "-");
const toFinal = (r) => r.total_score ?? r.suggested_total_score ?? 0;

export default function Result() {
  const nav = useNavigate();

  const [examId, setExamId] = React.useState("");
  const [examList, setExamList] = React.useState([]);
  const [summary, setSummary] = React.useState(null);
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [sort, setSort] = React.useState("score_desc");
  const [minScore, setMinScore] = React.useState("");
  const [maxScore, setMaxScore] = React.useState("");
  const [passThreshold, setPassThreshold] = React.useState(50);

  const [drawer, setDrawer] = React.useState({ open: false, row: null });

  const load = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        axiosClient.get(`/instructor/exams/${id}/summary`),
        axiosClient.get(`/instructor/exams/${id}/results`),
      ]);
      setSummary(s?.data || null);
      setRows(Array.isArray(r?.data) ? r.data : []);
    } catch {
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    (async () => {
      try {
        const res = await axiosClient.get("/instructor/exams/my");
        const list = Array.isArray(res.data) ? res.data : [];
        setExamList(list);

        const url = new URL(window.location.href);
        const idQ = url.searchParams.get("exam_id");
        if (idQ) {
          setExamId(idQ);
          load(idQ);
        } else {
          const first =
            list.find((e) => String(e.status) === "published") || list[0];
          if (first) {
            setExamId(String(first.id));
            load(String(first.id));
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const onPick = (e) => {
    const id = e.target.value.trim();
    setExamId(id);
    load(id);
  };

  const filtered = React.useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    let arr = (rows || []).filter((r) =>
      norm(r.student_name).includes(norm(q))
    );

    if (status !== "all")
      arr = arr.filter((r) =>
        String(r.status || "")
          .toLowerCase()
          .includes(status)
      );

    const min = minScore !== "" ? Number(minScore) : null;
    const max = maxScore !== "" ? Number(maxScore) : null;
    if (min != null) arr = arr.filter((r) => toFinal(r) >= min);
    if (max != null) arr = arr.filter((r) => toFinal(r) <= max);

    // always sort on a clone to avoid mutating state
    const sorted = [...arr];
    if (sort === "score_desc") sorted.sort((a, b) => toFinal(b) - toFinal(a));
    if (sort === "score_asc") sorted.sort((a, b) => toFinal(a) - toFinal(b));

    return sorted;
  }, [rows, q, status, sort, minScore, maxScore]);

  const exportCsv = () => {
    const header = [
      "Student",
      "MCQ",
      "AI",
      "Suggested",
      "Final",
      "Status",
      "Start",
      "Submitted",
      "Duration(min)",
      "Cheating",
      "FaceURL",
      "CardURL",
    ];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      const line = [
        r.student_name ?? "",
        r.mcq_score ?? "",
        r.ai_score ?? "",
        r.suggested_total_score ?? "",
        r.total_score ?? "",
        r.status ?? "",
        r.started_at ? new Date(r.started_at).toLocaleString() : "",
        r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "",
        r.duration_minutes ?? "",
        r.cheating_flag ? "Yes" : "No",
        r.face_image_url ?? "",
        r.student_card_url ?? "",
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",");
      lines.push(line);
    });
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results_exam_${examId || "unknown"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = async () => {
    try {
      const data = filtered.map((r) => ({
        Student: r.student_name,
        MCQ: r.mcq_score,
        AI: r.ai_score,
        Suggested: r.suggested_total_score,
        Final: r.total_score ?? r.suggested_total_score,
        Status: r.status,
        Start: r.started_at ? new Date(r.started_at).toLocaleString() : "",
        Submitted: r.submitted_at
          ? new Date(r.submitted_at).toLocaleString()
          : "",
        "Duration (min)": r.duration_minutes ?? "",
        Cheating: r.cheating_flag ? "Yes" : "No",
        FaceURL: r.face_image_url ?? "",
        CardURL: r.student_card_url ?? "",
      }));
      const mod = await import(/* @vite-ignore */ "xlsx");
      const ws = mod.utils.json_to_sheet(data);
      const wb = mod.utils.book_new();
      mod.utils.book_append_sheet(wb, ws, "Results");
      mod.writeFile(wb, `results_exam_${examId || "unknown"}.xlsx`);
    } catch {
      exportCsv();
    }
  };

  const openDrawer = (row) => setDrawer({ open: true, row });
  const closeDrawer = () => setDrawer({ open: false, row: null });

  const saveScore = async () => {
    const r = drawer.row;
    if (!r) return;
    try {
      const payload = {
        mcq_score: Number(r.mcq_score ?? 0),
        ai_score: Number(r.ai_score ?? 0),
        student_name: r.student_name,
      };
      await axiosClient.put(
        `/instructor/exams/${examId}/students/${r.student_id}/score`,
        payload
      );
      await load(examId);
      closeDrawer();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header + actions */}
      <div className="flex max-xl:flex-col flex-row max-lg:justify-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exam Results</h1>
          <p className="text-slate-500 text-sm">
            Xem, lọc, chỉnh & công bố điểm cho từng bài thi đã publish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav("/results-exams")}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm hover:bg-slate-50 transition"
          >
            Chọn bài thi khác
          </button>

          <select
            value={examId}
            onChange={onPick}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm hover:border-slate-300"
          >
            <option value="">Chọn bài thi…</option>
            {examList.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title || `Exam #${e.id}`} {e.status ? `(${e.status})` : ""}
              </option>
            ))}
          </select>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm hover:bg-slate-50 transition"
            >
              Export CSV
            </button>
            <button
              onClick={exportXlsx}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm hover:bg-slate-50 transition"
            >
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid max-lg:grid-cols-2 grid-cols-4 gap-3">
        <StatCard
          label="Total Submissions"
          value={summary?.total_submissions ?? summary?.total ?? 0}
        />
        <StatCard label="Total Students" value={summary?.total_students ?? 0} />
        <StatCard
          label="Avg Score"
          value={
            summary?.avg_score != null
              ? Number(summary.avg_score).toFixed(2)
              : "-"
          }
        />
        <StatCard
          label="Last Submission"
          value={fmtDate(summary?.last_submission_time)}
        />
      </div>

      {/* Filters */}
      <Section
        title="Bộ lọc"
        right={
          <div className="text-xs text-slate-400">
            {filtered.length} bản ghi hiển thị
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tên sinh viên…"
            className="w-56 rounded-xl border border-slate-300 px-3 py-2 shadow-sm focus:outline-none focus:ring focus:ring-indigo-100"
          />
          <div className="inline-flex rounded-xl border border-slate-300 overflow-hidden bg-white shadow-sm">
            {["all", "pending", "graded", "confirmed"].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cls(
                  "px-3 py-2 text-sm",
                  status === s
                    ? "bg-indigo-600 text-white"
                    : "hover:bg-slate-50"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            type="number"
            placeholder="Min"
            className="w-24 rounded-xl border border-slate-300 border- px-3 py-2 shadow-sm"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
          />
          <input
            type="number"
            placeholder="Max"
            className="w-24 rounded-xl border border-slate-300 px-3 py-2 shadow-sm"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
          />
          <div className="inline-flex rounded-xl border border-slate-300 overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => setSort("score_desc")}
              className={cls(
                "px-3 py-2 text-sm",
                sort === "score_desc"
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-slate-50  "
              )}
            >
              Điểm ↓
            </button>
            <button
              onClick={() => setSort("score_asc")}
              className={cls(
                "px-3 py-2 text-sm",
                sort === "score_asc"
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-slate-50"
              )}
            >
              Điểm ↑
            </button>
          </div>
        </div>
      </Section>

      {/* Charts + Export row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Phân bố điểm (Histogram)">
          <Histogram rows={filtered} />
        </Section>
        <Section
          title="Tỉ lệ đạt (Pass/Fail)"
          right={
            <div className="flex items-center gap-2 text-sm">
              <span>Ngưỡng:</span>
              <input
                type="number"
                className="w-20 rounded-lg border border-slate-300 px-2 py-1 shadow-sm"
                value={passThreshold}
                onChange={(e) => setPassThreshold(e.target.value)}
              />
            </div>
          }
        >
          <PassFail
            rows={filtered}
            passThreshold={Number(passThreshold || 0)}
          />
        </Section>
        <Section
          title="Xuất báo cáo"
          right={<div className="text-xs text-slate-400">CSV/Excel</div>}
        >
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCsv}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm hover:bg-slate-50 transition"
            >
              Export CSV
            </button>
            <button
              onClick={exportXlsx}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm hover:bg-slate-50 transition"
            >
              Export Excel
            </button>
          </div>
        </Section>
      </div>

      {/* Table */}
      <Section title="Danh sách bài nộp">
        <div className="overflow-auto rounded-xl border border-slate-300">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left text-slate-700">
                <th className="p-3">Student</th>
                <th className="p-3">MCQ</th>
                <th className="p-3">Essay (AI)</th>
                <th className="p-3">Suggested</th>
                <th className="p-3">Final</th>
                <th className="p-3">Start</th>
                <th className="p-3">Submitted</th>
                <th className="p-3">Duration (min)</th>
                <th className="p-3">Cheating</th>
                <th className="p-3">Face</th>
                <th className="p-3">Card</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="p-6 text-center text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-6 text-center text-slate-500">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={`${r.student_id}-${r.student_name}`}
                    className="border-t hover:bg-indigo-50/40 transition"
                  >
                    <td className="p-3 font-medium text-slate-800">
                      {r.student_name}
                    </td>
                    <td className="p-3">{r.mcq_score != null ? Number(r.mcq_score).toFixed(1) : "-"}</td>
                    <td className="p-3">{r.ai_score != null ? Number(r.ai_score).toFixed(1) : "-"}</td>
                    <td className="p-3">{r.suggested_total_score != null ? Number(r.suggested_total_score).toFixed(1) : "-"}</td>
                    <td className="p-3 font-semibold">
                      {(r.total_score ?? r.suggested_total_score) != null
                        ? Number(r.total_score ?? r.suggested_total_score).toFixed(1)
                        : "-"}
                    </td>
                    <td className="p-3">{fmtDate(r.started_at)}</td>
                    <td className="p-3">{fmtDate(r.submitted_at)}</td>
                    <td className="p-3">{r.duration_minutes ?? "-"}</td>
                    <td className="p-3">
                      {r.cheating_flag ? (
                        <Badge color="rose">Yes</Badge>
                      ) : (
                        <Badge>No</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {r.face_image_url ? (
                        <a
                          className="text-indigo-600 underline hover:text-indigo-800"
                          href={r.face_image_url}
                          target="_blank"
                        >
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      {r.student_card_url ? (
                        <a
                          className="text-indigo-600 underline hover:text-indigo-800"
                          href={r.student_card_url}
                          target="_blank"
                        >
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">{StatusPill(r.status)}</td>
                    <td className="p-3">
                      <button
                        onClick={() => openDrawer(r)}
                        className="rounded-lg border bg-white px-3 py-1.5 shadow-sm hover:bg-slate-50 transition"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Drawer */}
      {drawer.open && (
        <div className="fixed inset-0 z-50 flex bg-black/30">
          <div className="ml-auto h-full w-full max-w-md bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h4 className="text-lg font-semibold">Cập nhật điểm</h4>
                <div className="text-xs text-slate-500">
                  Save & Confirm sẽ công bố điểm cuối cùng cho sinh viên
                </div>
              </div>
              <button
                onClick={closeDrawer}
                className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm text-slate-600">Tên sinh viên</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 shadow-sm focus:outline-none focus:ring focus:ring-indigo-100"
                  value={drawer.row.student_name || ""}
                  onChange={(e) =>
                    setDrawer((d) => ({
                      ...d,
                      row: { ...d.row, student_name: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-600">Điểm MCQ (0-10)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    className="mt-1 w-full rounded-lg border px-3 py-2 shadow-sm focus:outline-none focus:ring focus:ring-indigo-100"
                    value={drawer.row.mcq_score ?? 0}
                    onChange={(e) =>
                      setDrawer((d) => ({
                        ...d,
                        row: { ...d.row, mcq_score: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Điểm AI (0-10)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    className="mt-1 w-full rounded-lg border px-3 py-2 shadow-sm focus:outline-none focus:ring focus:ring-indigo-100"
                    value={drawer.row.ai_score ?? 0}
                    onChange={(e) =>
                      setDrawer((d) => ({
                        ...d,
                        row: { ...d.row, ai_score: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-3">
                <div className="text-sm text-slate-600">Tổng điểm</div>
                <div className="mt-1 text-xl font-semibold">
                  {(
                    Number(drawer.row.mcq_score ?? 0) +
                    Number(drawer.row.ai_score ?? 0)
                  ).toFixed(1)} / 10
                </div>
              </div>

              <button
                onClick={saveScore}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 transition"
              >
                Lưu & Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Histogram({ rows }) {
  const finals = rows.map(toFinal).filter((v) => !isNaN(Number(v)));

  const bins = new Array(10).fill(0);
  finals.forEach((v) => {
    const i = Math.max(0, Math.min(9, Math.floor(Number(v) / 10)));
    bins[i]++;
  });
  const data = bins.map((c, i) => ({
    name: `${i * 10}-${i * 10 + 9}`,
    cnt: c,
  }));

  const [lib, setLib] = React.useState(null);
  React.useEffect(() => {
    (async () => {
      try {
        const m = await import("recharts");
        setLib(m);
      } catch {}
    })();
  }, []);
  if (!lib)
    return <div className="text-sm text-slate-500">Đang tải biểu đồ…</div>;

  const { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid } =
    lib;

  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <Tooltip />
          <Bar dataKey="cnt" radius={[8, 8, 0, 0]} fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PassFail({ rows, passThreshold }) {
  const finals = rows.map(toFinal).filter((v) => !isNaN(Number(v)));
  const pass = finals.filter((v) => Number(v) >= passThreshold).length;
  const fail = finals.length - pass;

  const [lib, setLib] = React.useState(null);
  React.useEffect(() => {
    (async () => {
      try {
        const m = await import("recharts");
        setLib(m);
      } catch {}
    })();
  }, []);
  if (!lib)
    return <div className="text-sm text-slate-500">Đang tải biểu đồ…</div>;

  const { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } = lib;
  const data = [
    { name: "Pass", value: pass },
    { name: "Fail", value: fail },
  ];

  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={80}
          >
            <Cell fill="#10b981" />
            <Cell fill="#f43f5e" />
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
