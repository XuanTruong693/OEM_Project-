import React from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import {
  HiChartBar,
  HiClipboardList,
  HiClock,
  HiCheckCircle,
  HiSave,
  HiCamera,
  HiExclamationCircle,
  HiAcademicCap,
  HiIdentification,
  HiDocumentText,
  HiUser,
  HiTrendingUp,
  HiUserGroup,
  HiStar,
} from "react-icons/hi";
import Toast from "../../components/common/Toast";
import ConfirmModal from "../../components/common/ConfirmModal";

const cls = (...a) => a.filter(Boolean).join(" ");

const Badge = ({ color = "slate", children }) => (
  <span
    className={cls(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
      color === "emerald" &&
      "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20",
      color === "amber" &&
      "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20",
      color === "rose" &&
      "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20",
      color === "slate" &&
      "bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/20"
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
      <div className="mt-2 text-3xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        {value}
      </div>
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
const toFinal = (r) => {
  // Suggested = AI + MCQ (stored in suggested_total_score or calculated)
  const score = r.instructor_confirmed ? (r.suggested_total_score ?? r.final_score ?? 0) : (r.suggested_total_score ?? 0);
  return Number(score) || 0;
  return Number(score) || 0;
};

// Format duration: show seconds if < 60s, otherwise show minutes
const fmtDuration = (seconds, minutes) => {
  if (seconds == null && minutes == null) return "-";

  const sec = Number(seconds);
  const min = Number(minutes);

  if (!isNaN(sec)) {
    if (sec < 60) {
      return `${sec}s`;
    } else {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return s > 0 ? `${m}m ${s}s` : `${m}m`;
    }
  }

  if (!isNaN(min)) {
    return min > 0 ? `${min}m` : "< 1m";
  }

  return "-";
};

export default function Result() {
  const nav = useNavigate();

  const [examId, setExamId] = React.useState("");
  const [examList, setExamList] = React.useState([]);
  const [summary, setSummary] = React.useState(null);
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [sort, setSort] = React.useState("name_asc");
  const [minScore, setMinScore] = React.useState("");
  const [maxScore, setMaxScore] = React.useState("");
  const [passThreshold, setPassThreshold] = React.useState(50);

  const [drawer, setDrawer] = React.useState({ open: false, row: null });
  const [cheatingDetails, setCheatingDetails] = React.useState(null);
  const [faceImageData, setFaceImageData] = React.useState(null);
  const [cardImageData, setCardImageData] = React.useState(null);
  const [submissionQuestions, setSubmissionQuestions] = React.useState(null); // Câu hỏi và đáp án
  const [submissionInfo, setSubmissionInfo] = React.useState(null); // Thông tin về submission (is_best, exam_status, etc)
  const [originalScores, setOriginalScores] = React.useState({
    total_score: 0,
    ai_score: 0,
  });
  const [scoreError, setScoreError] = React.useState("");
  const [essayScores, setEssayScores] = React.useState({}); // { answerId: score }
  const [savingEssayId, setSavingEssayId] = React.useState(null); // Track which answer is saving
  const [adminModifiedIds, setAdminModifiedIds] = React.useState([]); // Track submissions modified by admin
  const [zoomImage, setZoomImage] = React.useState(null); // { src: string, alt: string } for zoom modal

  // Toast notifications
  const [toast, setToast] = React.useState({
    show: false,
    type: "",
    message: "",
  });
  const [confirmDialog, setConfirmDialog] = React.useState({
    show: false,
    message: "",
    onConfirm: null,
  });

  // ✅ Live Score Calculation Hooks - Use drawer.row values (same as table)
  const liveMcqScore = React.useMemo(() => {
    if (!drawer.open || !drawer.row) return 0;
    // Always use drawer.row values to stay consistent with table
    return Number(drawer.row.total_score ?? drawer.row.mcq_score ?? 0);
  }, [drawer.open, drawer.row]);

  const liveAiScore = React.useMemo(() => {
    if (!drawer.open || !drawer.row) return 0;
    // If user is editing essay scores, calculate live from edits
    if (Object.keys(essayScores).length > 0 && submissionQuestions) {
      return submissionQuestions.reduce((acc, q) => {
        if (q.type?.toUpperCase() !== "MCQ") {
          const ansId = q.answer?.id;
          const override = essayScores[ansId];
          return acc + (override !== undefined ? Number(override) : Number(q.answer?.score || 0));
        }
        return acc;
      }, 0);
    }
    // Otherwise use drawer.row value (same as table)
    return Number(drawer.row.ai_score ?? 0);
  }, [drawer.open, drawer.row, submissionQuestions, essayScores]);

  const liveTotalScore = React.useMemo(() => {
    return liveMcqScore + liveAiScore;
  }, [liveMcqScore, liveAiScore]);

  // Toast helper functions
  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: "", message: "" }), 3000);
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmDialog({ show: true, message, onConfirm });
  };

  const handleConfirm = () => {
    if (confirmDialog.onConfirm) confirmDialog.onConfirm();
    setConfirmDialog({ show: false, message: "", onConfirm: null });
  };

  const handleCancel = () => {
    setConfirmDialog({ show: false, message: "", onConfirm: null });
  };

  const load = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, r, adminMod] = await Promise.all([
        axiosClient.get(`/instructor/exams/${id}/summary`),
        axiosClient.get(`/instructor/exams/${id}/results`),
        axiosClient.get(`/instructor/exams/${id}/admin-modified`).catch(() => ({ data: { submission_ids: [] } })),
      ]);
      setSummary(s?.data || null);
      setRows(Array.isArray(r?.data) ? r.data : []);
      setAdminModifiedIds(adminMod?.data?.submission_ids || []);
    } catch {
      setRows([]);
      setSummary(null);
      setAdminModifiedIds([]);
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
        let examToLoad = null;
        if (idQ) {
          setExamId(idQ);
          examToLoad = list.find((e) => String(e.id) === String(idQ));
        } else {
          examToLoad =
            list.find((e) => String(e.status) === "published") || list[0];
          if (examToLoad) setExamId(String(examToLoad.id));
        }
        if (examToLoad) load(String(examToLoad.id));

        // ✅ Polling: Kiểm tra time_close và tự động archive + reload kết quả
        if (examToLoad) {
          const interval = setInterval(async () => {
            try {
              const statusRes = await axiosClient.get(
                `/instructor/exams/${examToLoad.id}/check-status`
              );
              if (
                statusRes?.data?.status_changed &&
                statusRes.data.current_status === "archived"
              ) {
                console.log("✅ Exam archived, reloading results...");
                clearInterval(interval);
                load(String(examToLoad.id));
              }
            } catch (err) {
              console.error("Failed to check exam status:", err);
            }
          }, 5000); // Kiểm tra mỗi 5s
          return () => clearInterval(interval);
        }
      } catch (err) {
        console.error("Failed to fetch exam list:", err);
      }
    })();
  }, []);

  const onPick = (e) => {
    const id = e.target.value.trim();
    setExamId(id);
    load(id);
  };
  React.useEffect(() => {
    if (!examId) return;

    let isActive = true;
    let currentCount = rows.length;

    const waitForNewSubmissions = async () => {
      while (isActive) {
        try {
          const res = await axiosClient.get(
            `/instructor/exams/${examId}/submissions/count?lastCount=${currentCount}`
          );

          if (!isActive) break;

          if (res.data?.hasChanges) {
            const newCount = res.data.count;

            const [summaryRes, resultsRes] = await Promise.all([
              axiosClient.get(`/instructor/exams/${examId}/summary`),
              axiosClient.get(`/instructor/exams/${examId}/results`),
            ]);

            setSummary(summaryRes?.data || null);

            const newData = Array.isArray(resultsRes?.data)
              ? resultsRes.data
              : [];
            setRows((prevRows) => {
              const existingMap = new Map(
                prevRows.map((row) => [row.student_id, row])
              );

              return newData.map((newRow) => {
                const existing = existingMap.get(newRow.student_id);
                if (existing) {
                  return {
                    ...existing,

                    status: newRow.status || existing.status,
                    submitted_at: newRow.submitted_at || existing.submitted_at,
                  };
                }

                return newRow;
              });
            });

            currentCount = newCount;
          }

          // Prevent busy loop - Wait 3s before next check
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (err) {
          console.error("Long polling error:", err);
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    };

    waitForNewSubmissions();

    return () => {
      isActive = false;
    };
  }, [examId, rows.length]);

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

    // Clone array for sorting
    const sorted = [...arr];

    // Check if score sorting is active (by button or by filter)
    const isScoreSorting = sort === "score_desc" || sort === "score_asc";
    const hasScoreFilter = min != null || max != null;

    if (isScoreSorting || hasScoreFilter) {
      // Sort by score when filter or sort button is used
      if (sort === "score_asc") {
        sorted.sort((a, b) => toFinal(a) - toFinal(b));
      } else {
        // Default to desc when filtering by score
        sorted.sort((a, b) => toFinal(b) - toFinal(a));
      }
    } else {
      // Default: Sort by student name A-Z (Vietnamese collation)
      sorted.sort((a, b) => {
        const nameA = String(a.student_name || "").toLowerCase();
        const nameB = String(b.student_name || "").toLowerCase();
        return nameA.localeCompare(nameB, 'vi');
      });
    }

    return sorted;
  }, [rows, q, status, sort, minScore, maxScore]);

  const exportCsv = () => {
    // Get exam title
    const examTitle =
      examList.find((e) => String(e.id) === String(examId))?.title ||
      `Exam #${examId}`;
    const currentDate = new Date().toLocaleString("vi-VN");

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
      "Student ID",
      "Submission ID",
      "MCQ",
      "Essay (AI)",
      "Suggested",
      "Final",
      "Start",
      "Submitted",
      "Duration (s)",
      "Duration (min)",
      "Cheating Count",
      "Has Face",
      "Has Card",
      "Status",
    ];
    lines.push(header.join(","));
    filtered.forEach((r) => {
      const line = [
        r.student_name ?? "",
        r.student_id ?? "",
        r.submission_id ?? "",
        r.total_score ?? "",
        r.ai_score ?? "",
        r.suggested_total_score ?? "",
        r.instructor_confirmed === 1 ? r.suggested_total_score ?? "" : "",
        r.started_at ? new Date(r.started_at).toLocaleString() : "",
        r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "",
        r.duration_seconds ?? "",
        r.duration_minutes ?? "",
        r.cheating_count ?? "0",
        r.has_face_image ? "Yes" : "No",
        r.has_student_card ? "Yes" : "No",
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
      const examTitle =
        examList.find((e) => String(e.id) === String(examId))?.title ||
        `Exam #${examId}`;
      const currentDate = new Date().toLocaleString("vi-VN");

      // Import ExcelJS
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Results");

      // Load logo image
      let logoImageId = null;
      try {
        const logoResponse = await fetch("/Logo.png");
        const logoBlob = await logoResponse.blob();
        const logoArrayBuffer = await logoBlob.arrayBuffer();

        logoImageId = workbook.addImage({
          buffer: logoArrayBuffer,
          extension: "png",
        });
      } catch (err) {
        console.warn("Failed to load logo:", err);
      }

      // Add logo to header (row 1-3, A1:B3)
      if (logoImageId !== null) {
        worksheet.addImage(logoImageId, {
          tl: { col: 0, row: 0 }, // Top-left at A1
          br: { col: 2, row: 3 }, // Bottom-right at C4 (columns A-B, rows 1-3)
          editAs: "oneCell",
        });
      }

      // Add title rows (logo takes A1:B3, title starts at C1)
      worksheet.mergeCells("C1:O3");
      worksheet.getCell("C1").value = "🎓 ONLINE EXAM MONITORING SYSTEM";
      worksheet.getCell("C1").font = {
        bold: true,
        size: 18,
        color: { argb: "FF1F4788" },
      };
      worksheet.getCell("C1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      worksheet.getCell("C1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8F0FE" },
      };
      worksheet.getRow(1).height = 20;
      worksheet.getRow(2).height = 20;
      worksheet.getRow(3).height = 20;

      worksheet.getRow(4).height = 10;

      worksheet.mergeCells("A5:O5");
      worksheet.getCell("A5").value = `Bài thi: ${examTitle}`;
      worksheet.getCell("A5").font = { bold: true, size: 12 };
      worksheet.getCell("A5").alignment = {
        horizontal: "left",
        vertical: "middle",
      };

      worksheet.mergeCells("A6:O6");
      worksheet.getCell("A6").value = `Ngày xuất: ${currentDate}`;
      worksheet.getCell("A6").font = { size: 11 };
      worksheet.getCell("A6").alignment = {
        horizontal: "left",
        vertical: "middle",
      };

      worksheet.getRow(7).height = 10;

      worksheet.mergeCells("A8:O8");
      worksheet.getCell("A8").value = "DANH SÁCH SINH VIÊN THAM GIA";
      worksheet.getCell("A8").font = {
        bold: true,
        size: 13,
        color: { argb: "FF1F4788" },
      };
      worksheet.getCell("A8").alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      worksheet.getCell("A8").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD0E1F9" },
      };
      worksheet.getRow(8).height = 25;

      worksheet.getRow(9).height = 10;

      const headerRow = worksheet.getRow(10);
      const headers = [
        "Student",
        "Student ID",
        "Submission ID",
        "MCQ",
        "Essay (AI)",
        "Suggested",
        "Final",
        "Start",
        "Submitted",
        "Duration (s)",
        "Duration (min)",
        "Cheating Count",
        "Face Image",
        "Card Image",
        "Status",
      ];

      headers.forEach((header, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = header;
        cell.font = { bold: true, size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4A90E2" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
      });

      // Set column widths
      worksheet.columns = [
        { width: 20 }, // Student
        { width: 10 }, // Student ID
        { width: 12 }, // Submission ID
        { width: 8 }, // MCQ
        { width: 12 }, // Essay (AI)
        { width: 10 }, // Suggested
        { width: 8 }, // Final
        { width: 18 }, // Start
        { width: 18 }, // Submitted
        { width: 12 }, // Duration (s)
        { width: 12 }, // Duration (min)
        { width: 14 }, // Cheating Count
        { width: 20 }, // Face Image
        { width: 20 }, // Card Image
        { width: 12 }, // Status
      ];

      // Add data rows starting from row 11
      let currentRow = 11;

      for (const r of filtered) {
        const row = worksheet.getRow(currentRow);

        // Set row height for images
        row.height = 80;

        // Add data
        row.getCell(1).value = r.student_name ?? "";
        row.getCell(2).value = r.student_id ?? "";
        row.getCell(3).value = r.submission_id ?? "";
        row.getCell(4).value = r.total_score ?? "";
        row.getCell(5).value = r.ai_score ?? "";
        row.getCell(6).value = r.suggested_total_score ?? "";
        row.getCell(7).value =
          r.instructor_confirmed === 1 ? r.suggested_total_score ?? "" : "";
        row.getCell(8).value = r.started_at
          ? new Date(r.started_at).toLocaleString("vi-VN")
          : "";
        row.getCell(9).value = r.submitted_at
          ? new Date(r.submitted_at).toLocaleString("vi-VN")
          : "";
        row.getCell(10).value = r.duration_seconds ?? "";
        row.getCell(11).value = r.duration_minutes ?? "";
        row.getCell(12).value = r.cheating_count ?? "0";
        row.getCell(13).value = r.has_face_image ? "Yes" : "No";
        row.getCell(14).value = r.has_student_card ? "Yes" : "No";
        row.getCell(15).value = r.status ?? "";

        // Style cells
        for (let col = 1; col <= 15; col++) {
          const cell = row.getCell(col);
          cell.alignment = { horizontal: "left", vertical: "middle" };
          cell.border = {
            top: { style: "hair", color: { argb: "FFCCCCCC" } },
            bottom: { style: "hair", color: { argb: "FFCCCCCC" } },
            left: { style: "hair", color: { argb: "FFCCCCCC" } },
            right: { style: "hair", color: { argb: "FFCCCCCC" } },
          };
          if (currentRow % 2 === 0) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8F9FA" },
            };
          }
        }

        // Load and embed face image
        if (r.has_face_image && r.submission_id) {
          try {
            const res = await axiosClient.get(
              `/instructor/submissions/${r.submission_id}/face-image`,
              {
                responseType: "arraybuffer",
              }
            );

            const imageId = workbook.addImage({
              buffer: res.data,
              extension: "jpeg",
            });

            worksheet.addImage(imageId, {
              tl: { col: 12, row: currentRow - 1 }, // Top-left (column M, 0-indexed)
              br: { col: 13, row: currentRow }, // Bottom-right
              editAs: "oneCell",
            });
          } catch (err) {
            // Silent fail for face image
          }
        }

        // Load and embed card image
        if (r.has_student_card && r.submission_id) {
          try {
            const res = await axiosClient.get(
              `/instructor/submissions/${r.submission_id}/student-card`,
              {
                responseType: "arraybuffer",
              }
            );

            const imageId = workbook.addImage({
              buffer: res.data,
              extension: "jpeg",
            });

            worksheet.addImage(imageId, {
              tl: { col: 13, row: currentRow - 1 }, // Top-left (column N, 0-indexed)
              br: { col: 14, row: currentRow }, // Bottom-right
              editAs: "oneCell",
            });
          } catch (err) {
            // Silent fail for card image
          }
        }

        currentRow++;
      }

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cleanTitle = examTitle.replace(/[/:*?"<>|]/g, "-");
      const cleanDate = currentDate.replace(/[/:]/g, "-").replace(/,/g, "");
      a.href = url;
      a.download = `${cleanTitle}_${cleanDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      showToast(
        "success",
        "Xuất Excel thành công với logo và ảnh đính kèm!"
      );
    } catch (err) {
      console.error("Excel export error:", err);
      showToast("error", "❌ Lỗi xuất Excel: " + err.message);
      exportCsv();
    }
  };

  const openDrawer = async (row) => {
    setDrawer({ open: true, row });
    setFaceImageData(null);
    setCardImageData(null);
    setSubmissionQuestions(null);
    setScoreError("");
    setOriginalScores({
      total_score: Number(row.total_score ?? 0),
      ai_score: Number(row.ai_score ?? 0),
    });

    // Load cheating details if submission_id exists
    if (row.submission_id) {
      axiosClient
        .get(`/instructor/submissions/${row.submission_id}/cheating-details`)
        .then((res) => setCheatingDetails(res.data))
        .catch(() => setCheatingDetails(null));

      // Load questions and answers
      axiosClient
        .get(`/instructor/submissions/${row.submission_id}/questions`)
        .then((res) => {
          const questions = res.data?.questions || [];
          const answers = res.data?.answers || [];
          const options = res.data?.options || [];

          // Lưu thông tin submission
          setSubmissionInfo({
            is_best_submission: res.data?.is_best_submission,
            exam_status: res.data?.exam_status,
            actual_submission_id: res.data?.submission_id,
            original_submission_id: res.data?.original_submission_id,
          });

          // Hiển thị thông báo nếu đang xem submission có điểm cao nhất
          if (
            res.data?.exam_status === "archived" &&
            !res.data?.is_best_submission
          ) {
            console.log(
              `✅ [Result] Showing best submission #${res.data?.submission_id} instead of #${res.data?.original_submission_id}`
            );
          }

          // Map answers to questions
          const answerMap = new Map(answers.map((a) => [a.question_id, a]));
          const optionsByQ = (options || []).reduce((acc, o) => {
            (acc[o.question_id] ||= []).push(o);
            return acc;
          }, {});

          const merged = questions.map((q) => {
            const answer = answerMap.get(q.question_id);
            console.log(`Question ${q.question_id} (${q.type}):`, answer);
            return {
              ...q,
              options: q.type === "MCQ" ? optionsByQ[q.question_id] || [] : [],
              answer: answer || null,
            };
          });

          console.log("[Result] Merged questions:", merged);
          setSubmissionQuestions(merged);
        })
        .catch((err) => {
          console.error("Error loading questions:", err);
          setSubmissionQuestions([]);
        });

      // Load face image blob
      if (row.has_face_image) {
        try {
          const res = await axiosClient.get(
            `/instructor/submissions/${row.submission_id}/face-image`,
            {
              responseType: "blob",
            }
          );
          const imageUrl = URL.createObjectURL(res.data);
          setFaceImageData(imageUrl);
        } catch (err) {
          console.error("Failed to load face image:", err);
        }
      }

      // Load student card blob
      if (row.has_student_card) {
        try {
          const res = await axiosClient.get(
            `/instructor/submissions/${row.submission_id}/student-card`,
            {
              responseType: "blob",
            }
          );
          const imageUrl = URL.createObjectURL(res.data);
          setCardImageData(imageUrl);
        } catch (err) {
          console.error("Failed to load student card:", err);
        }
      }
    }
  };
  const closeDrawer = () => {
    // Cleanup blob URLs
    if (faceImageData) URL.revokeObjectURL(faceImageData);
    if (cardImageData) URL.revokeObjectURL(cardImageData);

    setDrawer({ open: false, row: null });
    setCheatingDetails(null);
    setFaceImageData(null);
    setCardImageData(null);
    setSubmissionInfo(null); // Reset submission info
    setScoreError("");
    setOriginalScores({ total_score: 0, ai_score: 0 });
  };

  const saveScore = async () => {
    const r = drawer.row;
    if (!r) return;

    const newTotalScore = Number(r.total_score ?? 0);
    const newAiScore = Number(r.ai_score ?? 0);

    // Validation 0: Không cho điểm âm
    if (newTotalScore < 0 || newAiScore < 0) {
      setScoreError("❌ Điểm không được là số âm!");
      showToast("error", "Điểm không được là số âm!");
      return;
    }

    // Validation 1: Không cho điểm thành phần > 10
    if (newTotalScore > 10 || newAiScore > 10) {
      setScoreError("❌ Điểm thành phần không được vượt quá 10!");
      showToast("error", "Điểm thành phần không được vượt quá 10!");
      return;
    }

    // Validation 1.2: Tổng điểm không được vượt quá 10
    const finalSum = newTotalScore + newAiScore;
    if (finalSum > 10) {
      setScoreError(`❌ Tổng điểm (${finalSum.toFixed(1)}) không được vượt quá 10! Vui lòng điều chỉnh lại.`);
      showToast("error", `Tổng điểm ${finalSum.toFixed(1)}/10 không hợp lệ!`);
      return;
    }

    // Validation 1.5: Điểm phải từ 0.1-10 (không cho 0 hoặc quá nhỏ)
    if ((newTotalScore > 0 && newTotalScore < 0.1) || (newAiScore > 0 && newAiScore < 0.1)) {
      setScoreError("❌ Điểm phải từ 0.1 đến 10 (hoặc để 0 nếu không có điểm)!");
      showToast("error", "Điểm phải từ 0.1 đến 10!");
      return;
    }

    // Validation 2: Confirm nếu giảm điểm
    const oldTotal = originalScores.total_score;
    const oldAi = originalScores.ai_score;
    const oldSum = oldTotal + oldAi;
    const newSum = newTotalScore + newAiScore;

    if (newSum < oldSum) {
      const message = `Bạn đang giảm điểm từ ${oldSum.toFixed(
        1
      )} xuống ${newSum.toFixed(1)}. Bạn có chắc chắn muốn tiếp tục?`;
      showConfirm(message, async () => {
        await performSave(newTotalScore, newAiScore, r);
      });
      return;
    }

    // Lưu trực tiếp nếu không giảm điểm
    await performSave(newTotalScore, newAiScore, r);
  };

  const performSave = async (newTotalScore, newAiScore, r) => {
    setScoreError("");

    try {
      // Save all pending essay scores first
      const submissionId = r.submission_id;
      if (submissionId && Object.keys(essayScores).length > 0) {
        const savePromises = [];
        for (const [answerId, score] of Object.entries(essayScores)) {
          const numScore = Number(score);
          if (!isNaN(numScore) && numScore >= 0) {
            savePromises.push(
              axiosClient.put(
                `/instructor/submissions/${submissionId}/answers/${answerId}/score`,
                { score: numScore }
              ).catch(err => {
                console.warn(`Failed to save essay score for answer ${answerId}:`, err);
                return null; // Continue with other saves
              })
            );
          }
        }

        if (savePromises.length > 0) {
          const results = await Promise.all(savePromises);
          // Recalculate ai_score from the last successful response
          const lastSuccess = results.filter(r => r?.data?.new_ai_score !== undefined).pop();
          if (lastSuccess?.data?.new_ai_score !== undefined) {
            newAiScore = lastSuccess.data.new_ai_score;
          }
        }
      }

      // ✅ Payload: total_score = MCQ, ai_score = Essay
      const payload = {
        total_score: newTotalScore, // MCQ Score → saved to submissions.total_score
        ai_score: newAiScore,       // Essay Score → saved to submissions.ai_score
        student_name: r.student_name,
      };

      // ✅ Use backend response to get accurate values from DB
      const response = await axiosClient.put(
        `/instructor/exams/${examId}/students/${r.student_id}/score`,
        payload
      );

      showToast("success", "✅ Lưu điểm thành công!");

      // Clear pending essay scores
      setEssayScores({});

      // ✅ Use values from DB response if available, otherwise use submitted values
      const dbRow = response.data;
      const updatedMcq = dbRow?.total_score ?? newTotalScore;
      const updatedAi = dbRow?.ai_score ?? newAiScore;
      const updatedSuggested = dbRow?.suggested_total_score ?? ((updatedMcq || 0) + (updatedAi || 0));

      // Update local state with DB values
      setRows((prevRows) =>
        prevRows.map((row) => {
          if (row.student_id === r.student_id) {
            return {
              ...row,
              total_score: updatedMcq,
              ai_score: updatedAi,
              suggested_total_score: updatedSuggested,
              instructor_confirmed: 1,
              status: "confirmed",
            };
          }
          return row;
        })
      );

      // Update drawer row with DB values
      setDrawer((prev) => ({
        ...prev,
        row: {
          ...prev.row,
          total_score: updatedMcq,
          ai_score: updatedAi,
          suggested_total_score: updatedSuggested,
          instructor_confirmed: 1,
          status: "confirmed",
        },
      }));

      setTimeout(() => closeDrawer(), 1000);
    } catch (err) {
      console.error("Save score error:", err);
      showToast("error", "❌ Lỗi khi lưu điểm!");
      setScoreError("❌ Lỗi khi lưu điểm!");
    }
  };

  const approveAllScores = async () => {
    if (!examId) return;

    const message = `Bạn có chắc muốn duyệt tất cả ${filtered.length} bài thi?`;

    showConfirm(message, async () => {
      try {
        console.log(`📝 [Result] Approving all scores for exam ${examId}...`);

        const res = await axiosClient.post(
          `/instructor/exams/${examId}/approve-all-scores`
        );

        console.log(
          `✅ [Result] Approved ${res.data?.approved || 0} submissions`
        );

        showToast(
          "success",
          `✅ Đã duyệt thành công ${res.data?.approved || 0} bài thi!`
        );

        // Update local state instead of full reload
        setRows((prevRows) =>
          prevRows.map((row) => ({
            ...row,
            instructor_confirmed: 1,
            status: "confirmed",
          }))
        );
      } catch (err) {
        console.error("❌ [Result] Failed to approve all scores:", err);
        showToast("error", "❌ Lỗi khi duyệt điểm!");
      }
    });
  };

  const deleteStudentExam = async (row) => {
    if (!examId || !row.student_id) return;

    const message = `⚠️ Xóa bài thi của "${row.student_name}"?\n\nHành động này không thể hoàn tác!`;

    showConfirm(message, async () => {
      try {
        await axiosClient.delete(
          `/instructor/exams/${examId}/students/${row.student_id}`
        );

        showToast("success", `✅ Đã xóa bài thi!`);

        load(examId);
      } catch (err) {
        const errorMsg =
          err?.response?.data?.message || "Lỗi khi xóa bài thi!";
        showToast("error", `❌ ${errorMsg}`);
      }
    });
  };

  // Save individual essay question score
  const saveEssayScore = async (answerId, questionId, maxPoints) => {
    const submissionId = drawer.row?.submission_id;
    if (!submissionId || !answerId) return;

    const newScore = Number(essayScores[answerId] ?? 0);

    // Validation
    if (isNaN(newScore) || newScore < 0) {
      showToast("error", "Điểm không hợp lệ!");
      return;
    }
    if (newScore > maxPoints) {
      showToast("error", `Điểm không được vượt quá ${maxPoints}!`);
      return;
    }

    setSavingEssayId(answerId);

    try {
      const res = await axiosClient.put(
        `/instructor/submissions/${submissionId}/answers/${answerId}/score`,
        { score: newScore }
      );

      showToast(
        "success",
        res.data?.score_increased
          ? "✅ Điểm đã tăng - AI sẽ học từ câu này!"
          : "✅ Đã cập nhật điểm!"
      );

      // Update the drawer row's ai_score with new total
      if (res.data?.new_ai_score !== undefined) {
        setDrawer(prev => ({
          ...prev,
          row: {
            ...prev.row,
            ai_score: res.data.new_ai_score,
            total_score: res.data.new_mcq_score, // ✅ MCQ Score
            suggested_total_score: res.data.new_grand_total, // ✅ Grand Total
            instructor_confirmed: 1,
            status: "confirmed"
          }
        }));

        // Also update the main rows list
        setRows(prevRows => prevRows.map(row => {
          if (row.student_id === drawer.row?.student_id) {
            return {
              ...row,
              ai_score: res.data.new_ai_score,
              total_score: res.data.new_mcq_score, // ✅ MCQ Score
              suggested_total_score: res.data.new_grand_total, // ✅ Grand Total
              instructor_confirmed: 1,
              status: "confirmed"
            };
          }
          return row;
        }));

        // ✅ Clear essayScores so liveAiScore uses new drawer.row.ai_score
        setEssayScores({});
      }

      // Update submissionQuestions to reflect new score
      setSubmissionQuestions(prev => prev?.map(q => {
        if (q.answer?.id === answerId) {
          return {
            ...q,
            answer: { ...q.answer, score: newScore }
          };
        }
        return q;
      }));

    } catch (err) {
      console.error("Error saving essay score:", err);
      showToast("error", err?.response?.data?.message || "Lỗi khi lưu điểm!");
    } finally {
      setSavingEssayId(null);
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
                <HiClipboardList className="text-xl text-indigo-600" />
                Chọn bài thi khác
              </span>
            </button>

            <select
              value={examId}
              onChange={onPick}
              className="rounded-xl bg-white text-slate-800 px-4 py-3 shadow-lg hover:shadow-xl transition-all border-2 border-indigo-400 font-semibold text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[180px] max-w-[280px] truncate"
              style={{ backgroundColor: 'white', color: '#1e293b' }}
            >
              <option value="" style={{ backgroundColor: 'white', color: '#1e293b' }}>Chọn bài thi…</option>
              {examList.map((e) => (
                <option key={e.id} value={e.id} style={{ backgroundColor: 'white', color: '#1e293b', padding: '8px' }}>
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
            icon={<HiChartBar className="text-blue-500" />}
            label="Total Submissions"
            value={summary?.total_submissions ?? summary?.total ?? 0}
          />
          <StatCard
            icon={<HiUserGroup className="text-emerald-500" />}
            label="Total Students"
            value={summary?.total_students ?? 0}
          />
          <StatCard
            icon={<HiStar className="text-amber-500" />}
            label="Avg Score"
            value={
              summary?.avg_score != null
                ? Number(summary.avg_score).toFixed(2)
                : "-"
            }
          />
          <StatCard
            icon={<HiClock className="text-slate-500" />}
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                🔍
              </span>
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

        {/* Table - Desktop View */}
        <Section title="Danh sách bài nộp">
          <div className="hidden md:block overflow-auto rounded-xl border border-slate-200/50 shadow-inner max-h-[600px]">
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
                        <span className="text-slate-600 font-medium">
                          Đang tải...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-6xl">📭</span>
                        <span className="text-slate-600 font-medium">
                          Không có dữ liệu
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={`${r.student_id}-${r.student_name}`}
                      onClick={() => openDrawer(r)}
                      className="border-t border-slate-100 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all cursor-pointer"
                    >
                      <td className="p-4 font-semibold text-slate-800">
                        {r.student_name}
                      </td>
                      <td className="p-4 text-slate-700">
                        {r.total_score != null
                          ? parseFloat(Number(r.total_score).toFixed(2))
                          : "-"}
                      </td>
                      <td className="p-4 text-slate-700">
                        {r.ai_score != null
                          ? parseFloat(Number(r.ai_score).toFixed(2))
                          : "-"}
                      </td>
                      <td className="p-4 text-slate-700">
                        {r.suggested_total_score != null
                          ? parseFloat(Number(r.suggested_total_score).toFixed(2))
                          : "-"}
                      </td>
                      <td className="p-4">
                        {Number(r.instructor_confirmed) === 1 &&
                          r.suggested_total_score != null ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white font-bold text-base shadow-lg">
                              {parseFloat(Number(r.suggested_total_score).toFixed(2))}
                            </span>
                            {adminModifiedIds.includes(r.submission_id) && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-600 text-xs font-medium border border-orange-500/30"
                                title="Admin đã can thiệp sửa điểm"
                              >
                                🛡️ Admin
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 font-medium text-sm">
                            Chưa duyệt
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-600">
                        {fmtDate(r.started_at)}
                      </td>
                      <td className="p-4 text-xs text-slate-600">
                        {fmtDate(r.submitted_at)}
                      </td>
                      <td className="p-4 text-slate-700 font-medium">
                        {fmtDuration(r.duration_seconds, r.duration_minutes)}
                      </td>
                      <td className="p-4">
                        {r.cheating_count > 0 || r.has_cheating_flag ? (
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            <span className="text-red-600 font-semibold">
                              {r.cheating_count || "!"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-emerald-500 font-medium">
                            ✓
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {r.has_face_image || r.face_image_url ? (
                          <span className="text-indigo-600 font-medium">✓</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        {r.has_student_card || r.student_card_url ? (
                          <span className="text-indigo-600 font-medium">✓</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-4">{StatusPill(r.status)}</td>
                      <td className="p-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStudentExam(r);
                          }}
                          className="rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-white px-3 py-2 shadow-lg hover:shadow-xl transition-all hover:scale-[1.05] font-medium text-sm"
                          title="Xóa bài thi của sinh viên này"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4 max-h-[600px] overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-slate-600 font-medium">Đang tải...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <span className="text-6xl">📭</span>
                <span className="text-slate-600 font-medium">
                  Không có dữ liệu
                </span>
              </div>
            ) : (
              filtered.map((r) => (
                <div
                  key={`${r.student_id}-${r.student_name}`}
                  onClick={() => openDrawer(r)}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4 cursor-pointer active:scale-[0.98]"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3 pb-3 border-b border-slate-100">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-slate-800">
                        {r.student_name}
                      </h3>
                      <div className="text-xs text-slate-500 mt-1">
                        {fmtDate(r.submitted_at)}
                      </div>
                    </div>
                    {r.instructor_confirmed === 1 &&
                      r.suggested_total_score != null ? (
                      <span className="px-3 py-1 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white font-bold text-lg shadow-lg">
                        {parseFloat(Number(r.suggested_total_score).toFixed(2))}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 font-medium text-xs">
                        Chưa duyệt
                      </span>
                    )}
                  </div>

                  {/* Scores Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center">
                      <div className="text-xs text-slate-500 mb-1">MCQ</div>
                      <div className="font-semibold text-slate-800">
                        {r.total_score != null
                          ? parseFloat(Number(r.total_score).toFixed(2))
                          : "-"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-500 mb-1">AI</div>
                      <div className="font-semibold text-slate-800">
                        {r.ai_score != null
                          ? parseFloat(Number(r.ai_score).toFixed(2))
                          : "-"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-500 mb-1">Gợi ý</div>
                      <div className="font-semibold text-slate-800">
                        {r.suggested_total_score != null
                          ? parseFloat(Number(r.suggested_total_score).toFixed(2))
                          : "-"}
                      </div>
                    </div>
                  </div>

                  {/* Info Row */}
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <HiClock className="text-base text-purple-500" />
                      <span>
                        {fmtDuration(r.duration_seconds, r.duration_minutes)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {r.cheating_count > 0 || r.has_cheating_flag ? (
                        <>
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          <span className="text-red-600 font-semibold">
                            {r.cheating_count || "!"}
                          </span>
                        </>
                      ) : (
                        <span className="text-emerald-500 font-medium flex items-center gap-1">
                          <HiCheckCircle className="text-base" /> Không gian lận
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Verification Icons */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-xs">
                      {r.has_face_image || r.face_image_url ? (
                        <span className="text-indigo-600 flex items-center gap-1">
                          <HiCamera className="text-base" /> Khuôn mặt ✓
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1">
                          <HiCamera className="text-base" /> Khuôn mặt —
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      {r.has_student_card || r.student_card_url ? (
                        <span className="text-indigo-600 flex items-center gap-1">
                          <HiIdentification className="text-base" /> CMND ✓
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1">
                          <HiIdentification className="text-base" /> CMND —
                        </span>
                      )}
                    </div>
                    <div className="ml-auto">{StatusPill(r.status)}</div>
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteStudentExam(r);
                      }}
                      className="w-full rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-white px-3 py-2 shadow-lg hover:shadow-xl transition-all font-medium text-sm"
                    >
                      Xóa bài thi
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Approve All Button - Below table */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={approveAllScores}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-3 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] font-medium flex items-center gap-2 text-lg"
              disabled={!examId || filtered.length === 0}
            >
              <span>✓</span>
              Duyệt tất cả điểm
            </button>
          </div>
        </Section>

        {/* Drawer */}
        {drawer.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-7xl max-h-[95vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between bg-slate-800 p-6 flex-shrink-0">
                <div>
                  <h4 className="text-xl font-bold text-white">
                    Cập nhật điểm
                  </h4>
                  <div className="text-sm text-slate-300 mt-1">
                    Save & Confirm sẽ công bố điểm cuối cùng cho sinh viên
                  </div>
                </div>
                <button
                  onClick={closeDrawer}
                  className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-white transition-all font-medium"
                >
                  ✕ Đóng
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Best Submission Indicator */}
                {submissionInfo?.exam_status === "archived" &&
                  submissionInfo?.is_best_submission === false && (
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 text-white shadow-md">
                      <div className="flex items-center gap-3">
                        <HiStar className="text-2xl animate-pulse" />
                        <div className="flex-1">
                          <div className="font-bold text-base">
                            Đang hiển thị bài thi có điểm cao nhất
                          </div>
                          <div className="text-xs text-blue-50 mt-0.5">
                            Bài thi đã kết thúc - Hệ thống tự động chọn lần thi
                            có điểm cao nhất (Submission #
                            {submissionInfo?.actual_submission_id})
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Container flex column để nút nằm dưới grid */}
                <div className="flex flex-col">
                  {/* Grid with fixed height for equal columns */}
                  <div className="px-6">
                    <div
                      className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6"
                      style={{ maxHeight: "calc(95vh - 280px)" }}
                    >
                      {/* Left Column - Thông tin & Điểm - NO SCROLL */}
                      <div className="pr-2 space-y-4">
                        {/* Error Message */}
                        {scoreError && (
                          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 text-center">
                            <div className="text-red-700 font-bold">
                              {scoreError}
                            </div>
                          </div>
                        )}

                        {/* Student Name - Read Only */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <label className="text-xs font-semibold text-slate-600 uppercase">
                            Tên sinh viên
                          </label>
                          <div className="mt-1 text-lg font-bold text-slate-900">
                            {drawer.row.student_name || ""}
                          </div>
                        </div>

                        {/* Additional Info - Read Only */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-4">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <label className="text-xs font-semibold text-blue-700 uppercase">
                              Submission ID
                            </label>
                            <div className="mt-1 text-base font-semibold text-blue-900">
                              #{drawer.row.submission_id || "N/A"}
                            </div>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <label className="text-xs font-semibold text-blue-700 uppercase">
                              Student ID
                            </label>
                            <div className="mt-1 text-base font-semibold text-blue-900">
                              {drawer.row.student_id || "N/A"}
                            </div>
                          </div>
                        </div>

                        {/* Time Info */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-4">
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <label className="text-xs font-semibold text-green-700 uppercase flex items-center gap-1">
                              <HiClock className="text-base" /> Bắt đầu
                            </label>
                            <div className="mt-1 text-sm font-medium text-green-900">
                              {fmtDate(drawer.row.started_at)}
                            </div>
                          </div>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <label className="text-xs font-semibold text-green-700 uppercase flex items-center gap-1">
                              <HiCheckCircle className="text-base" /> Nộp bài
                            </label>
                            <div className="mt-1 text-sm font-medium text-green-900">
                              {fmtDate(drawer.row.submitted_at)}
                            </div>
                          </div>
                        </div>

                        {/* Duration & Cheating */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                            <label className="text-xs font-semibold text-purple-700 uppercase">
                              Thời gian
                            </label>
                            <div className="mt-1 text-lg font-bold text-purple-900">
                              {fmtDuration(
                                drawer.row.duration_seconds,
                                drawer.row.duration_minutes
                              )}
                            </div>
                          </div>
                          <div
                            className={`border-2 rounded-lg p-3 text-center ${drawer.row.cheating_count > 0 ||
                              drawer.row.has_cheating_flag
                              ? "bg-red-50 border-red-300"
                              : "bg-emerald-50 border-emerald-200"
                              }`}
                          >
                            <label
                              className="text-xs font-semibold uppercase"
                              style={{
                                color:
                                  drawer.row.cheating_count > 0 ||
                                    drawer.row.has_cheating_flag
                                    ? "#dc2626"
                                    : "#059669",
                              }}
                            >
                              Gian lận
                            </label>
                            <div
                              className="mt-1 text-lg font-bold"
                              style={{
                                color:
                                  drawer.row.cheating_count > 0 ||
                                    drawer.row.has_cheating_flag
                                    ? "#dc2626"
                                    : "#059669",
                              }}
                            >
                              {drawer.row.cheating_count > 0
                                ? drawer.row.cheating_count
                                : "✓"}
                            </div>
                          </div>
                          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
                            <label className="text-xs font-semibold text-indigo-700 uppercase">
                              Trạng thái
                            </label>
                            <div className="mt-1">
                              {StatusPill(drawer.row.status)}
                            </div>
                          </div>
                        </div>

                        {/* Score Input Grid */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-4">
                          <div
                            className={`bg-white border-2 rounded-lg p-4 ${Number(drawer.row.total_score ?? 0) > 10
                              ? "border-red-500"
                              : "border-slate-300"
                              }`}
                          >
                            <label className="text-xs font-semibold text-slate-700 uppercase block mb-2">
                              Điểm MCQ
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="10"
                              className="w-full text-2xl font-bold text-slate-900 bg-transparent border-none focus:outline-none"
                              value={parseFloat(liveMcqScore.toFixed(2))}
                              onChange={(e) => {
                                const val = e.target.value;
                                const num = Number(val);

                                // Kiểm tra số âm
                                if (num < 0) {
                                  setScoreError("❌ Điểm MCQ không được là số âm!");
                                  return;
                                }

                                // Kiểm tra vượt quá 10
                                if (num > 10) {
                                  setScoreError(
                                    "❌ Điểm MCQ phải từ 0.1 đến 10!"
                                  );
                                } else if (val !== "" && num > 0 && num < 0.1) {
                                  setScoreError(
                                    "❌ Điểm MCQ tối thiểu là 0.1!"
                                  );
                                } else {
                                  setScoreError("");
                                }

                                setDrawer((d) => ({
                                  ...d,
                                  row: { ...d.row, total_score: val },
                                }));
                              }}
                            />
                          </div>
                          <div
                            className={`bg-white border-2 rounded-lg p-4 ${Number(drawer.row.ai_score ?? 0) > 10
                              ? "border-red-500"
                              : "border-slate-300"
                              }`}
                          >
                            <label className="text-xs font-semibold text-slate-700 uppercase block mb-2">
                              Điểm essay (AI)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="10"
                              className="w-full text-2xl font-bold text-slate-900 bg-transparent border-none focus:outline-none"
                              value={parseFloat(liveAiScore.toFixed(2))}
                              onChange={(e) => {
                                const val = e.target.value;
                                const num = Number(val);

                                // Kiểm tra số âm
                                if (num < 0) {
                                  setScoreError("❌ Điểm AI không được là số âm!");
                                  return;
                                }

                                // Kiểm tra vượt quá 10
                                if (num > 10) {
                                  setScoreError(
                                    "❌ Điểm AI phải từ 0.1 đến 10!"
                                  );
                                } else if (val !== "" && num > 0 && num < 0.1) {
                                  setScoreError(
                                    "❌ Điểm AI tối thiểu là 0.1!"
                                  );
                                } else {
                                  setScoreError("");
                                }

                                setDrawer((d) => ({
                                  ...d,
                                  row: { ...d.row, ai_score: val },
                                }));
                              }}
                            />
                          </div>
                        </div>

                        {/* Total Score Display */}
                        {(() => {
                          const sum = liveTotalScore;
                          const isInvalid = sum > 10;
                          return (
                            <div className={`border-2 rounded-lg p-6 text-center transition-colors ${isInvalid
                              ? "bg-red-50 border-red-500 animate-pulse"
                              : "bg-slate-100 border-slate-400"
                              }`}>
                              <div className={`text-xs font-bold uppercase mb-2 ${isInvalid ? "text-red-700" : "text-slate-600"}`}>
                                {isInvalid ? "⚠️ Tổng điểm quá cao" : "Tổng điểm"}
                              </div>
                              <div className={`text-5xl font-black ${isInvalid ? "text-red-600" : "text-slate-900"}`}>
                                {parseFloat(sum.toFixed(2))}
                              </div>
                              <div className={`text-lg font-bold mt-1 ${isInvalid ? "text-red-400" : "text-slate-500"}`}>
                                / 10
                              </div>
                            </div>
                          );
                        })()}

                        {/* Face & Card Images */}
                        {(drawer.row.has_face_image ||
                          drawer.row.has_student_card) && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                              <h5 className="text-xs font-bold text-slate-700 uppercase mb-3">
                                Ảnh xác thực
                              </h5>
                              <div className="grid grid-cols-2 gap-4">
                                {drawer.row.has_face_image && (
                                  <div>
                                    <div className="text-xs font-semibold text-slate-600 mb-2">
                                      Khuôn mặt
                                    </div>
                                    {faceImageData ? (
                                      <img
                                        src={faceImageData}
                                        alt="Face"
                                        className="w-full h-40 object-cover rounded-lg border border-slate-300 cursor-pointer hover:opacity-90 hover:shadow-lg transition-all"
                                        onClick={() => setZoomImage({ src: faceImageData, alt: "Khuôn mặt" })}
                                        title="Click để phóng to"
                                      />
                                    ) : (
                                      <div className="w-full h-40 bg-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-400">
                                        <div className="animate-spin text-xl mb-1">
                                          ⏳
                                        </div>
                                        <span className="text-xs">
                                          Đang tải...
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {drawer.row.has_student_card && (
                                  <div>
                                    <div className="text-xs font-semibold text-slate-600 mb-2">
                                      Thẻ sinh viên
                                    </div>
                                    {cardImageData ? (
                                      <img
                                        src={cardImageData}
                                        alt="Student Card"
                                        className="w-full h-40 object-cover rounded-lg border border-slate-300 cursor-pointer hover:opacity-90 hover:shadow-lg transition-all"
                                        onClick={() => setZoomImage({ src: cardImageData, alt: "Thẻ sinh viên" })}
                                        title="Click để phóng to"
                                      />
                                    ) : (
                                      <div className="w-full h-40 bg-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-400">
                                        <div className="animate-spin text-xl mb-1">
                                          ⏳
                                        </div>
                                        <span className="text-xs">
                                          Đang tải...
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        {/* Cheating Details */}
                        {cheatingDetails &&
                          cheatingDetails.logs &&
                          cheatingDetails.logs.length > 0 && (
                            <div className="rounded-2xl bg-red-50/50 backdrop-blur-xl border border-red-200 p-4 space-y-3">
                              <h5 className="text-sm font-bold text-red-700 flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                Cảnh báo gian lận (
                                {cheatingDetails.summary?.total_incidents || 0}{" "}
                                lần)
                              </h5>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {cheatingDetails.logs.map((log, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white/80 rounded-lg p-3 text-xs"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span
                                        className={`font-semibold ${log.severity === "high"
                                          ? "text-red-600"
                                          : log.severity === "medium"
                                            ? "text-orange-600"
                                            : "text-yellow-600"
                                          }`}
                                      >
                                        {log.event_type
                                          .replace(/_/g, " ")
                                          .toUpperCase()}
                                      </span>
                                      <span className="text-slate-500">
                                        {new Date(
                                          log.detected_at
                                        ).toLocaleTimeString("vi-VN")}
                                      </span>
                                    </div>
                                    {log.event_details &&
                                      typeof log.event_details === "object" && (
                                        <div className="text-slate-600 text-xs mt-1">
                                          {JSON.stringify(log.event_details)}
                                        </div>
                                      )}
                                  </div>
                                ))}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="bg-red-100 rounded px-2 py-1 text-center">
                                  <div className="font-bold text-red-700">
                                    {cheatingDetails.summary?.high_count || 0}
                                  </div>
                                  <div className="text-red-600">
                                    Nghiêm trọng
                                  </div>
                                </div>
                                <div className="bg-orange-100 rounded px-2 py-1 text-center">
                                  <div className="font-bold text-orange-700">
                                    {cheatingDetails.summary?.medium_count || 0}
                                  </div>
                                  <div className="text-orange-600">
                                    Trung bình
                                  </div>
                                </div>
                                <div className="bg-yellow-100 rounded px-2 py-1 text-center">
                                  <div className="font-bold text-yellow-700">
                                    {cheatingDetails.summary?.low_count || 0}
                                  </div>
                                  <div className="text-yellow-600">Thấp</div>
                                </div>
                              </div>
                            </div>
                          )}
                      </div>

                      {/* Right Column - Câu hỏi & Đáp án - WITH SCROLL */}
                      <div className="overflow-y-auto pr-2 h-full">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
                          <h5 className="text-sm font-bold text-indigo-900 uppercase flex items-center gap-2">
                            <HiDocumentText className="text-xl" /> Câu hỏi và
                            Đáp án của Sinh viên
                          </h5>
                        </div>

                        {submissionQuestions === null ? (
                          <div className="text-center py-8 text-slate-500">
                            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                            Đang tải câu hỏi...
                          </div>
                        ) : submissionQuestions.length === 0 ? (
                          <div className="text-center py-8 text-slate-500">
                            Không có dữ liệu câu hỏi
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {submissionQuestions.map((q, idx) => (
                              <div
                                key={q.question_id}
                                className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                              >
                                {/* Question Header */}
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-semibold ${q.type?.toUpperCase() === "MCQ"
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-purple-100 text-purple-700"
                                          }`}
                                      >
                                        {q.type?.toUpperCase() === "MCQ"
                                          ? "Trắc nghiệm"
                                          : "Tự luận"}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {q.points || 1} điểm
                                      </span>
                                    </div>
                                    <div
                                      className="text-sm font-medium text-slate-800"
                                      dangerouslySetInnerHTML={{
                                        __html: (q.question_text || "").replace(/^(?:Câu|Question)?\\s*\\d+[:.]?\\s*/i, ""),
                                      }}
                                    />
                                  </div>
                                </div>

                                {/* MCQ Options */}
                                {q.type?.toUpperCase() === "MCQ" &&
                                  q.options &&
                                  q.options.length > 0 && (
                                    <div className="ml-11 space-y-2">
                                      {q.options.map((opt) => {
                                        const isSelected =
                                          opt.option_id ===
                                          q.answer?.selected_option_id ||
                                          opt.id ===
                                          q.answer?.selected_option_id;
                                        const isCorrect =
                                          opt.is_correct || opt.correct;

                                        return (
                                          <div
                                            key={opt.option_id || opt.id}
                                            className={`flex items-start gap-2 p-2 rounded ${isSelected && isCorrect
                                              ? "bg-green-50 border border-green-300"
                                              : isSelected && !isCorrect
                                                ? "bg-red-50 border border-red-300"
                                                : isCorrect
                                                  ? "bg-green-50/30 border border-green-200"
                                                  : "bg-slate-50"
                                              }`}
                                          >
                                            <div className="flex-shrink-0 mt-0.5">
                                              {isSelected ? (
                                                isCorrect ? (
                                                  <span className="text-green-600 font-bold">
                                                    ✓
                                                  </span>
                                                ) : (
                                                  <span className="text-red-600 font-bold">
                                                    ✗
                                                  </span>
                                                )
                                              ) : isCorrect ? (
                                                <span className="text-green-500 text-xs">
                                                  ✓
                                                </span>
                                              ) : (
                                                <span className="w-4 h-4 rounded-full border-2 border-slate-300 inline-block"></span>
                                              )}
                                            </div>
                                            <div className="flex-1 text-sm text-slate-700">
                                              {opt.option_text}
                                            </div>
                                            {isSelected && (
                                              <span className="text-xs font-semibold text-slate-600">
                                                Đã chọn
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                {/* Essay Answer */}
                                {q.type?.toUpperCase() !== "MCQ" && (
                                  <div className="ml-11 mt-2 space-y-3">
                                    {/* Câu trả lời của sinh viên */}
                                    <div>
                                      <div className="text-xs font-semibold text-slate-600 uppercase mb-1">
                                        Câu trả lời:
                                      </div>
                                      {q.answer?.answer_text ? (
                                        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-sm text-slate-700 whitespace-pre-wrap">
                                          {q.answer.answer_text}
                                        </div>
                                      ) : (
                                        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600 italic">
                                          Sinh viên chưa trả lời câu này
                                        </div>
                                      )}
                                    </div>

                                    {/* Đáp án mẫu */}
                                    {q.model_answer && (
                                      <div>
                                        <div className="text-xs font-semibold text-emerald-700 uppercase mb-1 flex items-center gap-1">
                                          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                          Đáp án mẫu:
                                        </div>
                                        <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-sm text-emerald-800 whitespace-pre-wrap">
                                          {q.model_answer}
                                        </div>
                                      </div>
                                    )}

                                    {/* Score Editing Section for Essay */}
                                    {q.answer?.id && (
                                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg p-4 mt-3">
                                        <div className="flex items-center justify-between gap-4">
                                          <div className="flex-1">
                                            <div className="text-xs font-semibold text-indigo-700 uppercase mb-2 flex items-center gap-2">
                                              <HiAcademicCap className="text-base" />
                                              Chấm điểm câu này
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <div className="text-sm text-slate-600">
                                                AI gợi ý: <span className="font-bold text-indigo-600">{q.answer?.score ?? 0}/{q.points || 1}</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="number"
                                                  step="0.1"
                                                  min="0"
                                                  max={q.points || 10}
                                                  className="w-20 px-3 py-2 border-2 border-indigo-300 rounded-lg text-center font-bold text-indigo-800 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                                                  value={essayScores[q.answer.id] ?? q.answer?.score ?? 0}
                                                  onChange={(e) => setEssayScores(prev => ({
                                                    ...prev,
                                                    [q.answer.id]: e.target.value
                                                  }))}
                                                />
                                                <span className="text-sm text-slate-600 font-medium">/ {q.points || 1} điểm</span>
                                              </div>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => saveEssayScore(q.answer.id, q.question_id, q.points || 1)}
                                            disabled={savingEssayId === q.answer.id}
                                            className={`px-4 py-2 rounded-lg font-semibold text-white transition-all flex items-center gap-2 ${savingEssayId === q.answer.id
                                              ? "bg-slate-400 cursor-not-allowed"
                                              : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-xl"
                                              }`}
                                          >
                                            {savingEssayId === q.answer.id ? (
                                              <>
                                                <span className="animate-spin">⏳</span>
                                                Đang lưu...
                                              </>
                                            ) : (
                                              <>
                                                <HiSave className="text-lg" />
                                                Lưu điểm
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button - Fixed at bottom */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
                <button
                  onClick={saveScore}
                  className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 px-6 py-4 font-bold text-white transition-all text-lg flex items-center justify-center gap-2"
                >
                  <HiSave className="text-xl" /> Lưu & Xác nhận
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shared Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, type: "", message: "" })}
        />
      )}

      {/* Shared Confirm Modal */}
      <ConfirmModal
        isOpen={confirmDialog.show}
        title="Xác nhận"
        message={confirmDialog.message}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        confirmText="Xác nhận"
        cancelText="Hủy"
        type="warning"
      />

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setZoomImage(null)}
              className="absolute -top-12 right-0 md:top-2 md:right-2 z-10 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white font-bold text-xl flex items-center justify-center transition-all backdrop-blur-sm"
              title="Đóng"
            >
              ✕
            </button>

            {/* Image title */}
            <div className="absolute -top-10 left-0 text-white text-sm font-medium md:hidden">
              {zoomImage.alt}
            </div>

            {/* Zoomed image */}
            <img
              src={zoomImage.src}
              alt={zoomImage.alt}
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />

            {/* Image label - Desktop */}
            <div className="hidden md:block absolute -bottom-10 left-0 right-0 text-center text-white text-sm font-medium">
              {zoomImage.alt} — Click ngoài hoặc nút ✕ để đóng
            </div>

            {/* Mobile instruction */}
            <div className="md:hidden absolute -bottom-8 left-0 right-0 text-center text-white/70 text-xs">
              Nhấn ngoài để đóng
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
      } catch { }
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
      } catch { }
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
