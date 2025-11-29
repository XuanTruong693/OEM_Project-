import React from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";

const cls = (...a) => a.filter(Boolean).join(" ");

const Badge = ({ color = "slate", children }) => (
  <span
    className={cls(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
      color === "emerald" &&
        "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20",
      color === "amber" && "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20",
      color === "rose" && "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20",
      color === "slate" && "bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/20"
    )}
  >
    {children}
  </span>
);

const StatCard = ({ label, value, subtle, icon }) => (
  <div className="group relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20 hover:scale-[1.02]">
    <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-2xl"></div>
    <div className="relative">
      {icon && <div className="text-3xl mb-3">{icon}</div>}
      <div className="text-slate-600 text-sm font-medium">{label}</div>
      <div className="mt-2 text-3xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">{value}</div>
      {subtle && <div className="text-xs text-slate-500 mt-2">{subtle}</div>}
    </div>
  </div>
);

const Section = ({ title, right, children }) => (
  <section className="rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-lg border border-white/20">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
        <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></span>
        {title}
      </h3>
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
    // Get exam title
    const examTitle = examList.find(e => String(e.id) === String(examId))?.title || `Exam #${examId}`;
    const currentDate = new Date().toLocaleString('vi-VN');
    
    // Create header rows
    const lines = [
      "=== ONLINE EXAM MONITORING SYSTEM ===",
      "",
      `Bai thi: ${examTitle}`,
      `Ngay xuat: ${currentDate}`,
      "",
      "=== DANH SACH SINH VIEN THAM GIA ===",
      "", // Empty line
    ];
    
    const header = [
      "Student",
      "MCQ",
      "Essay (AI)",
      "Suggested",
      "Final",
      "Start",
      "Submitted",
      "Duration (min)",
      "Cheating",
      "Face",
      "Card",
      "Status",
    ];
    lines.push(header.join(","));
    filtered.forEach((r) => {
      const line = [
        r.student_name ?? "",
        r.mcq_score ?? "",
        r.ai_score ?? "",
        r.suggested_total_score ?? "",
        r.total_score ?? r.suggested_total_score ?? "",
        r.started_at ? new Date(r.started_at).toLocaleString() : "",
        r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "",
        r.duration_minutes ?? "",
        r.cheating_flag ? "Yes" : "No",
        r.face_image_url ?? "",
        r.student_card_url ?? "",
        r.status ?? "",
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
      // Get exam title
      const examTitle = examList.find(e => String(e.id) === String(examId))?.title || `Exam #${examId}`;
      const currentDate = new Date().toLocaleString('vi-VN');
      
      const data = filtered.map((r) => ({
        "Student": r.student_name ?? "",
        "MCQ": r.mcq_score ?? "",
        "Essay (AI)": r.ai_score ?? "",
        "Suggested": r.suggested_total_score ?? "",
        "Final": r.total_score ?? r.suggested_total_score ?? "",
        "Start": r.started_at ? new Date(r.started_at).toLocaleString('vi-VN') : "",
        "Submitted": r.submitted_at ? new Date(r.submitted_at).toLocaleString('vi-VN') : "",
        "Duration (min)": r.duration_minutes ?? "",
        "Cheating": r.cheating_flag ? "Yes" : "No",
        "Face": r.face_image_url ?? "",
        "Card": r.student_card_url ?? "",
        "Status": r.status ?? "",
      }));
      
      const mod = await import(/* @vite-ignore */ "xlsx");
      
      // Add data starting from row 7 (to leave space for logo and headers)
      const dataRows = data.map(obj => Object.values(obj));
      const ws = mod.utils.aoa_to_sheet([
        [], // Row 1 - Space for logo
        [], // Row 2 - Space for logo
        [], // Row 3 - Empty
        [`Bài thi: ${examTitle}`], // Row 4
        [`Ngày xuất: ${currentDate}`], // Row 5
        [], // Row 6 - Empty
        ["DANH SÁCH SINH VIÊN THAM GIA"], // Row 7
        [], // Row 8 - Empty
        ["Student", "MCQ", "Essay (AI)", "Suggested", "Final", "Start", "Submitted", "Duration (min)", "Cheating", "Face", "Card", "Status"], // Row 9 - Headers
        ...dataRows // Row 10+ - Data
      ]);
      
      // Add logo image placeholder text in first row
      ws['A1'] = { v: "🎓 ONLINE EXAM MONITORING SYSTEM", t: "s" };
      
      // Style the cells
      if (!ws['!rows']) ws['!rows'] = [];
      ws['!rows'][0] = { hpt: 30 }; // Row 1 height for logo
      ws['!rows'][1] = { hpt: 10 }; // Row 2 height
      ws['!rows'][6] = { hpt: 25 }; // Row 7 height for label
      
      // Merge cells
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, // Logo/Title - Row 1, columns A-L
        { s: { r: 3, c: 0 }, e: { r: 3, c: 11 } }, // Exam title - Row 4
        { s: { r: 4, c: 0 }, e: { r: 4, c: 11 } }, // Date - Row 5
        { s: { r: 6, c: 0 }, e: { r: 6, c: 11 } }, // Label - Row 7
      ];
      
      // Set column widths
      ws['!cols'] = [
        { wch: 20 }, // Student
        { wch: 8 },  // MCQ
        { wch: 12 }, // Essay (AI)
        { wch: 10 }, // Suggested
        { wch: 8 },  // Final
        { wch: 18 }, // Start
        { wch: 18 }, // Submitted
        { wch: 15 }, // Duration
        { wch: 10 }, // Cheating
        { wch: 10 }, // Face
        { wch: 10 }, // Card
        { wch: 12 }, // Status
      ];
      
      // Apply styles to specific cells
      const range = mod.utils.decode_range(ws['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = mod.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) continue;
          
          if (!ws[cellAddress].s) ws[cellAddress].s = {};
          
          // Row 1 (Logo/Title)
          if (R === 0) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 16, color: { rgb: "1F4788" } },
              alignment: { horizontal: "center", vertical: "center" },
              fill: { fgColor: { rgb: "E8F0FE" } }
            };
          }
          // Row 4 (Exam title)
          else if (R === 3) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 12 },
              alignment: { horizontal: "left", vertical: "center" }
            };
          }
          // Row 5 (Date)
          else if (R === 4) {
            ws[cellAddress].s = {
              font: { sz: 11 },
              alignment: { horizontal: "left", vertical: "center" }
            };
          }
          // Row 7 (Label)
          else if (R === 6) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 13, color: { rgb: "1F4788" } },
              alignment: { horizontal: "center", vertical: "center" },
              fill: { fgColor: { rgb: "D0E1F9" } }
            };
          }
          // Row 9 (Column headers)
          else if (R === 8) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 11 },
              alignment: { horizontal: "center", vertical: "center" },
              fill: { fgColor: { rgb: "4A90E2" } },
              border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
              }
            };
          }
          // Data rows (10+)
          else if (R >= 9) {
            ws[cellAddress].s = {
              alignment: { horizontal: "left", vertical: "center" },
              border: {
                top: { style: "hair", color: { rgb: "CCCCCC" } },
                bottom: { style: "hair", color: { rgb: "CCCCCC" } },
                left: { style: "hair", color: { rgb: "CCCCCC" } },
                right: { style: "hair", color: { rgb: "CCCCCC" } }
              }
            };
            // Alternate row colors
            if (R % 2 === 0) {
              ws[cellAddress].s.fill = { fgColor: { rgb: "F8F9FA" } };
            }
          }
        }
      }
      
      const wb = mod.utils.book_new();
      mod.utils.book_append_sheet(wb, ws, "Results");
      
      // Clean filename
      const cleanTitle = examTitle.replace(/[/:*?"<>|]/g, '-');
      const cleanDate = currentDate.replace(/[/:]/g, '-').replace(/,/g, '');
      mod.writeFile(wb, `${cleanTitle}_${cleanDate}.xlsx`);
    } catch (err) {
      console.error('Excel export error:', err);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-1/3 -left-24 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-24 left-1/3 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative p-6 max-w-7xl mx-auto space-y-6">
        {/* Header + actions */}
        <div className="flex max-xl:flex-col flex-row max-lg:justify-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Exam Results
            </h1>
            <p className="text-slate-600 text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Xem, lọc, chỉnh & công bố điểm cho từng bài thi đã publish.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => nav("/results-exams")}
              className="group relative overflow-hidden rounded-xl bg-white/80 backdrop-blur-xl px-4 py-2.5 shadow-lg hover:shadow-xl transition-all border border-white/20 hover:scale-[1.02]"
            >
              <span className="relative z-10 flex items-center gap-2 font-medium text-slate-700">
                <span>📋</span>
                Chọn bài thi khác
              </span>
            </button>

            <select
              value={examId}
              onChange={onPick}
              className="rounded-xl bg-white/90 backdrop-blur-xl text-slate-700 px-4 py-2.5 shadow-lg hover:shadow-xl transition-all border border-indigo-300 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Chọn bài thi…</option>
              {examList.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title || `Exam #${e.id}`} {e.status ? `(${e.status})` : ""}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={exportCsv}
                className="rounded-xl bg-white/80 backdrop-blur-xl px-4 py-2.5 shadow-lg hover:shadow-xl transition-all border border-white/20 hover:scale-[1.02] font-medium text-slate-700"
              >
                Export CSV
              </button>
              <button
                onClick={exportXlsx}
                className="rounded-xl bg-white/80 backdrop-blur-xl px-4 py-2.5 shadow-lg hover:shadow-xl transition-all border border-white/20 hover:scale-[1.02] font-medium text-slate-700"
              >
                Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid max-lg:grid-cols-2 grid-cols-4 gap-4">
          <StatCard
            icon="📊"
            label="Total Submissions"
            value={summary?.total_submissions ?? summary?.total ?? 0}
          />
          <StatCard 
            icon="👥"
            label="Total Students" 
            value={summary?.total_students ?? 0} 
          />
          <StatCard
            icon="⭐"
            label="Avg Score"
            value={
              summary?.avg_score != null
                ? Number(summary.avg_score).toFixed(2)
                : "-"
            }
          />
          <StatCard
            icon="🕐"
            label="Last Submission"
            value={fmtDate(summary?.last_submission_time)}
          />
        </div>

        {/* Filters */}
        <Section
          title="Bộ lọc"
          right={
            <div className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-sm font-semibold text-indigo-700">
              {filtered.length} bản ghi
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm tên sinh viên…"
                className="w-56 pl-10 rounded-xl border border-slate-200 bg-white/50 backdrop-blur-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
              />
            </div>
            <div className="inline-flex rounded-xl overflow-hidden bg-slate-100 p-1 gap-1">
              {["all", "pending", "graded", "confirmed"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cls(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                    status === s
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg"
                      : "text-slate-700 hover:bg-white/50"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Min"
              className="w-24 rounded-xl border border-slate-200 bg-white/50 backdrop-blur-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
            />
            <input
              type="number"
              placeholder="Max"
              className="w-24 rounded-xl border border-slate-200 bg-white/50 backdrop-blur-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
            />
            <div className="inline-flex rounded-xl overflow-hidden bg-slate-100 p-1 gap-1">
              <button
                onClick={() => setSort("score_desc")}
                className={cls(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                  sort === "score_desc"
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg"
                    : "text-slate-700 hover:bg-white/50"
                )}
              >
                Điểm ↓
              </button>
              <button
                onClick={() => setSort("score_asc")}
                className={cls(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                  sort === "score_asc"
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg"
                    : "text-slate-700 hover:bg-white/50"
                )}
              >
                Điểm ↑
              </button>
            </div>
          </div>
        </Section>

        {/* Table */}
        <Section title="Danh sách bài nộp">
          <div className="overflow-auto rounded-xl border border-slate-200/50 shadow-inner">
            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-br from-slate-50 to-blue-50/30 sticky top-0 backdrop-blur-xl">
                <tr className="text-left text-slate-700">
                  <th className="p-4 font-bold">Student</th>
                  <th className="p-4 font-bold">MCQ</th>
                  <th className="p-4 font-bold">Essay (AI)</th>
                  <th className="p-4 font-bold">Suggested</th>
                  <th className="p-4 font-bold">Final</th>
                  <th className="p-4 font-bold">Start</th>
                  <th className="p-4 font-bold">Submitted</th>
                  <th className="p-4 font-bold">Duration (min)</th>
                  <th className="p-4 font-bold">Cheating</th>
                  <th className="p-4 font-bold">Face</th>
                  <th className="p-4 font-bold">Card</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white/60 backdrop-blur-sm">
                {loading ? (
                  <tr>
                    <td colSpan={13} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <span className="text-slate-600 font-medium">Đang tải...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-6xl">📭</span>
                        <span className="text-slate-600 font-medium">Không có dữ liệu</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={`${r.student_id}-${r.student_name}`}
                      className="border-t border-slate-100 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all"
                    >
                      <td className="p-4 font-semibold text-slate-800">
                        {r.student_name}
                      </td>
                      <td className="p-4 text-slate-700">{r.mcq_score != null ? Number(r.mcq_score).toFixed(1) : "-"}</td>
                      <td className="p-4 text-slate-700">{r.ai_score != null ? Number(r.ai_score).toFixed(1) : "-"}</td>
                      <td className="p-4 text-slate-700">{r.suggested_total_score != null ? Number(r.suggested_total_score).toFixed(1) : "-"}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-base shadow-lg">
                          {(r.total_score ?? r.suggested_total_score) != null
                            ? Number(r.total_score ?? r.suggested_total_score).toFixed(1)
                            : "-"}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-600">{fmtDate(r.started_at)}</td>
                      <td className="p-4 text-xs text-slate-600">{fmtDate(r.submitted_at)}</td>
                      <td className="p-4 text-slate-700">{r.duration_minutes ?? "-"}</td>
                      <td className="p-4">
                        {r.cheating_flag ? (
                          <Badge color="rose">⚠️ Yes</Badge>
                        ) : (
                          <Badge color="emerald">✓ No</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {r.face_image_url ? (
                          <a
                            className="text-indigo-600 font-medium hover:text-indigo-800 hover:underline transition-all"
                            href={r.face_image_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            👤 View
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        {r.student_card_url ? (
                          <a
                            className="text-indigo-600 font-medium hover:text-indigo-800 hover:underline transition-all"
                            href={r.student_card_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            🪪 View
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-4">{StatusPill(r.status)}</td>
                      <td className="p-4">
                        <button
                          onClick={() => openDrawer(r)}
                          className="rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white px-4 py-2 shadow-lg hover:shadow-xl transition-all hover:scale-[1.05] font-medium"
                        >
                          ✏️ Edit
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
          <div className="fixed inset-0 z-50 flex bg-black/30 backdrop-blur-sm">
            <div className="ml-auto h-full w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
                <div>
                  <h4 className="text-xl font-bold text-white">Cập nhật điểm</h4>
                  <div className="text-sm text-blue-100 mt-1">
                    Save & Confirm sẽ công bố điểm cuối cùng cho sinh viên
                  </div>
                </div>
                <button
                  onClick={closeDrawer}
                  className="rounded-lg bg-white/20 backdrop-blur-xl px-4 py-2 text-white hover:bg-white/30 transition-all font-medium"
                >
                  ✕ Đóng
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <span className="w-1 h-4 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></span>
                    Tên sinh viên
                  </label>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white/50 backdrop-blur-xl px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                    value={drawer.row.student_name || ""}
                    onChange={(e) =>
                      setDrawer((d) => ({
                        ...d,
                        row: { ...d.row, student_name: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Điểm MCQ (0-10)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white/50 backdrop-blur-xl px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
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
                    <label className="text-sm font-semibold text-slate-700">Điểm AI (0-10)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white/50 backdrop-blur-xl px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
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

                <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-indigo-200 p-6">
                  <div className="text-sm font-medium text-slate-600">Tổng điểm</div>
                  <div className="mt-2 text-4xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {(
                      Number(drawer.row.mcq_score ?? 0) +
                      Number(drawer.row.ai_score ?? 0)
                    ).toFixed(1)} <span className="text-2xl">/ 10</span>
                  </div>
                </div>

                <button
                  onClick={saveScore}
                  className="w-full rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 px-6 py-4 font-bold text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-lg"
                >
                  💾 Lưu & Xác nhận
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
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
