// 📁 src/pages/instructor/EditExam.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiTrash2, FiPlus, FiX } from "react-icons/fi";
import axios from "axios";
import LoadingSpinner from "../../components/LoadingSpinner";
import * as XLSX from "xlsx";

const EditExam = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [editingExam, setEditingExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [apiError, setApiError] = useState("");
  const [valMap, setValMap] = useState({});

  // Upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [newQuestions, setNewQuestions] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const lastSavedCountRef = React.useRef(0);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const res = await axios.get(
          `http://localhost:5000/api/edit-exam/exams/${id}/edit`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const processedQuestions = res.data.questions.map((q) => {
          if (q.type?.toLowerCase() === "essay") {
            const match = q.content?.match(
              /(.*)\((\d+(?:\.\d+)?)\s*đ\)\s*Câu trả lời:\s*(.*)/i
            );
            if (match) {
              q.content = match[1].trim();
              q.points = parseFloat(match[2]);
              q.modelAnswer = match[3].trim();
            }
            if (!q.modelAnswer) q.modelAnswer = "";
          }
          if (!q.points) q.points = q.points === 0 ? 0 : q.points || 0.1;
          if (!q.options) q.options = [];
          return q;
        });
        setEditingExam({ ...res.data, questions: processedQuestions });
        lastSavedCountRef.current = (processedQuestions || []).length;
      } catch (err) {
        console.error(err);
        setApiError(
          err?.response?.data?.message ||
            "Không thể tải chi tiết đề thi! Chỉ có thể chỉnh sửa đề nháp."
        );
        navigate("/exam-bank");
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [id, token, navigate]);

  // ---------- Helpers ----------
  const normalizeType = (t) =>
    (t || "").toString().toLowerCase() === "essay" ? "essay" : "MCQ";

  const computeTotalPoints = (questions) =>
    Math.round(
      (questions.reduce((s, q) => s + (parseFloat(q.points) || 0), 0) +
        Number.EPSILON) *
        10
    ) / 10;

  // helper to normalize text when so khớp trùng
  const norm = (s) =>
    (s || "").toString().trim().replace(/\s+/g, " ").toLowerCase();

  const areMCQEqual = (a, b) => {
    if (norm(a.content) !== norm(b.content)) return false;
    if ((a.options?.length || 0) !== (b.options?.length || 0)) return false;
    for (let i = 0; i < a.options.length; i++) {
      const oa = norm(a.options[i].content);
      const ob = norm(b.options[i]?.content);
      if (oa !== ob) return false;
      if (!!a.options[i].is_correct !== !!b.options[i].is_correct) return false;
    }
    return true;
  };

  const areEssayEqual = (a, b) => {
    return (
      norm(a.content) === norm(b.content) &&
      norm(a.modelAnswer) === norm(b.modelAnswer)
    );
  };

  // ---------- Validation ----------
  const validateQuestions = (questions) => {
    const map = {};
    const add = (qid, msg) => {
      if (!map[qid]) map[qid] = [];
      map[qid].push(msg);
    };
    questions.forEach((q) => {
      const type = normalizeType(q.type);
      const qid = q.id;
      const content = (q.content || "").trim();
      const points = parseFloat(q.points) || 0;
      if (!content) add(qid, "Nội dung câu hỏi không được để trống.");
      if (!(points > 0)) add(qid, "Điểm phải lớn hơn 0.");
      if (type === "MCQ") {
        const opts = q.options || [];
        const nonEmpty = opts.filter(
          (o) => (o.content || "").trim().length > 0
        );
        if (nonEmpty.length < 2)
          add(qid, "Trắc nghiệm phải có ít nhất 2 đáp án không rỗng.");
        let correctCount = 0;
        opts.forEach((o, i) => {
          const t = (o.content || "").trim();
          if (!t) add(qid, `Đáp án ${String.fromCharCode(65 + i)} bị trống.`);
          if (o.is_correct) correctCount += 1;
        });
        if (correctCount !== 1)
          add(qid, "Phải chọn đúng 1 đáp án đúng cho câu trắc nghiệm.");
      } else {
        const model = (q.modelAnswer || "").trim();
        if (!model) add(qid, "Tự luận phải có đáp án mẫu.");
      }
    });
    const ok = Object.keys(map).length === 0;
    return { ok, map };
  };

  // ---------- Save + reload helpers ----------
  const reloadExam = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/edit-exam/exams/${id}/edit`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const processedQuestions = res.data.questions.map((q) => ({
        ...q,
        points: q.points || 0.1,
        options: q.options || [],
      }));
      setEditingExam({ ...res.data, questions: processedQuestions });
      lastSavedCountRef.current = (processedQuestions || []).length;
    } catch (e) {}
  };

  const showSuccess = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 3000);
  };

  const handleSaveExam = async (examOverride = null, options = {}) => {
    setApiError("");
    setErrorMessage("");
    setValMap({});

    const examData = examOverride || editingExam;

    if (!examData.title?.trim()) {
      setErrorMessage("Tiêu đề đề thi không được để trống!");
      return;
    }

    const v = validateQuestions(examData.questions);
    if (!v.ok) {
      setValMap(v.map);
      setErrorMessage("Vui lòng sửa các lỗi bên dưới trước khi lưu.");
      return;
    }

    const totalPoints = computeTotalPoints(examData.questions);
    if (totalPoints !== 10) {
      setErrorMessage(
        `Tổng điểm hiện tại là ${totalPoints.toFixed(
          1
        )}. Tổng điểm phải bằng 10 để lưu bài thi!`
      );
      return;
    }

    try {
      const updatedQuestions = examData.questions.map((q) => ({
        ...q,
        type: normalizeType(q.type),
      }));

      await axios.put(
        `http://localhost:5000/api/edit-exam/exams/${id}`,
        { ...examData, questions: updatedQuestions },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const added =
        options.toast === "added" ||
        examData.questions.length > lastSavedCountRef.current;
      const msg = added
        ? "Thêm câu hỏi thành công"
        : "Cập nhật đề thi thành công";
      if (options.stay) {
        showSuccess(msg);
        await reloadExam();
      } else {
        showSuccess(msg);
        setTimeout(() => navigate("/exam-bank"), 3200);
      }
    } catch (err) {
      setApiError(err?.response?.data?.message || "Cập nhật đề thi thất bại!");
    }
  };

  // ---------- File select & parse ----------
  const handleFileSelect = (e) => {
    setSelectedFile(e.target.files?.[0] || null);
    setParsedQuestions([]);
    setNewQuestions([]);
    setPreviewOpen(false);
    setPreviewError("");
  };

  const parseExcelToQuestions = (workbook) => {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    const scorePattern = /\((\d+(?:[.,]\d+)?)\s*đ\)/i;
    let section = null; // 'MCQ' | 'Essay'
    const out = [];

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const c0 = (row[0] || "").toString().trim();
      if (!c0) continue;

      const lower = c0.toLowerCase();
      if (/trắc nghiệm|mcq/.test(lower)) {
        section = "MCQ";
        continue;
      }
      if (/tự luận|essay/.test(lower)) {
        section = "Essay";
        continue;
      }

      if (section === "MCQ") {
        // Column A: question with (đ). Columns B..H: options, one has *
        const m = c0.match(scorePattern);
        const points = m ? parseFloat(m[1].replace(",", ".")) : 0;
        const content = m ? c0.replace(scorePattern, "").trim() : c0;
        // Collect options from all non-empty cells starting col1
        const opts = [];
        for (let ci = 1; ci < row.length; ci++) {
          const raw = (row[ci] || "").toString().trim();
          if (!raw) continue;
          const isStar = /\*+$/.test(raw);
          opts.push({
            tempId: `${r}-${ci}`,
            content: raw.replace(/\*+$/, "").trim(),
            is_correct: isStar,
          });
        }
        out.push({
          type: "MCQ",
          content,
          points,
          options: opts,
          sourceRow: r + 1,
        });
        continue;
      }

      if (section === "Essay") {
        // Column A may contain both question and answer with labels
        const joined = row.map((c) => (c || "").toString().trim()).join(" ");
        const qMatch = joined.match(
          /Câu\s*hỏi:\s*([^]+?)(?=Câu\s*trả\s*lời:|$)/i
        );
        const aMatch = joined.match(/Câu\s*trả\s*lời:\s*([^]+)$/i);
        const m = joined.match(scorePattern);
        const points = m ? parseFloat(m[1].replace(",", ".")) : 0;
        const content = (qMatch?.[1] || c0).replace(scorePattern, "").trim();
        const modelAnswer = (aMatch?.[1] || "").trim();
        out.push({
          type: "essay",
          content,
          points,
          modelAnswer,
          sourceRow: r + 1,
        });
        continue;
      }

      // Unknown section: try auto-detect (fallback)
      const m = c0.match(scorePattern);
      if (m) {
        const points = parseFloat(m[1].replace(",", "."));
        const content = c0.replace(scorePattern, "").trim();
        // Try read options from rest cells
        const opts = [];
        for (let ci = 1; ci < row.length; ci++) {
          const raw = (row[ci] || "").toString().trim();
          if (!raw) continue;
          const isStar = /\*+$/.test(raw);
          opts.push({
            tempId: `${r}-${ci}`,
            content: raw.replace(/\*+$/, "").trim(),
            is_correct: isStar,
          });
        }
        if (opts.length)
          out.push({
            type: "MCQ",
            content,
            points,
            options: opts,
            sourceRow: r + 1,
          });
        else
          out.push({
            type: "essay",
            content,
            points,
            modelAnswer: "",
            sourceRow: r + 1,
          });
      }
    }

    return out;
  };

  // (removed duplicate older equality helpers — now using normalized versions below)

  const isDuplicateAgainstExisting = (qFromFile, existingQs) => {
    return existingQs.some((exist) => {
      if (normalizeType(exist.type) !== normalizeType(qFromFile.type))
        return false;
      if (qFromFile.type === "MCQ") return areMCQEqual(qFromFile, exist);
      return areEssayEqual(qFromFile, exist);
    });
  };

  const handleAnalyzeFile = () => {
    if (!selectedFile) {
      alert("Vui lòng chọn file Excel trước.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const fileQuestions = parseExcelToQuestions(workbook);
        setParsedQuestions(fileQuestions);

        const existing = editingExam.questions || [];
        let uniques = fileQuestions.filter(
          (fq) => !isDuplicateAgainstExisting(fq, existing)
        );

        const invalids = [];
        const valids = [];
        uniques.forEach((q) => {
          const msgs = [];
          const p = parseFloat(q.points) || 0;
          if (!q.content?.trim()) msgs.push("Nội dung câu hỏi trống");
          if (!(p > 0)) msgs.push("Điểm phải > 0");
          if (normalizeType(q.type) === "MCQ") {
            const opts = q.options || [];
            if (opts.length < 2) msgs.push("MCQ phải có ≥ 2 đáp án");
            const c = opts.filter((o) => !!o.is_correct).length;
            if (c !== 1) msgs.push("MCQ phải có đúng 1 đáp án đúng");
          } else {
            if (!q.modelAnswer?.trim()) msgs.push("Tự luận phải có đáp án mẫu");
          }
          if (msgs.length) invalids.push({ row: q.sourceRow || "?", msgs, q });
          else valids.push(q);
        });

        const duplicatesCount = fileQuestions.length - uniques.length;

        if (valids.length === 0) {
          setPreviewError(
            duplicatesCount === fileQuestions.length
              ? "Không có câu hỏi mới nào trong file, vui lòng thêm câu hỏi để cập nhật"
              : `Tất cả câu hỏi mới đều sai định dạng: ${invalids
                  .map((it) => `Row ${it.row}: ${it.msgs.join("; ")}`)
                  .join(" | ")}`
          );
          setNewQuestions([]);
          setPreviewOpen(false);
          return;
        }

        // Nếu tất cả trong file đều là mới & hợp lệ và tổng điểm hợp lệ → tự động thêm + lưu + reload
        if (duplicatesCount === 0 && invalids.length === 0) {
          const merged = [
            ...editingExam.questions,
            ...valids.map((q, i) => ({
              id: Date.now() + i,
              type: normalizeType(q.type),
              content: q.content,
              points: parseFloat(q.points) || 0.1,
              modelAnswer: q.modelAnswer || "",
              options:
                normalizeType(q.type) === "MCQ"
                  ? q.options.map((o, idx) => ({
                      id: Date.now() + 100 + idx,
                      content: o.content,
                      is_correct: o.is_correct,
                    }))
                  : [],
            })),
          ];
          const newTotal = computeTotalPoints(merged);
          if (newTotal === 10) {
            const nextExam = { ...editingExam, questions: merged };
            setPreviewError("");
            setNewQuestions([]);
            setPreviewOpen(false);
            handleSaveExam(nextExam, { stay: true, toast: "added" });
            return;
          }
        }

        // Nếu không auto-save, show preview các câu mới để xác nhận
        const withSelected = valids.map((q, i) => ({
          ...q,
          selected: true,
          tempId: `preview-${Date.now()}-${i}`,
        }));
        setNewQuestions(withSelected);
        setPreviewOpen(true);
        setPreviewError(
          invalids.length
            ? `Đã bỏ qua ${invalids.length} câu hỏi do sai định dạng: ${invalids
                .map((it) => `Row ${it.row}`)
                .join(", ")}`
            : duplicatesCount === fileQuestions.length
            ? "Không có câu hỏi mới nào trong file, vui lòng thêm câu hỏi để cập nhật"
            : ""
        );
      } catch (err) {
        console.error(err);
        alert("Đọc file thất bại. Vui lòng kiểm tra file Excel.");
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  // ------------ Preview / add flow -------------
  const updatePreviewQuestion = (tempId, patch) => {
    setNewQuestions((prev) =>
      prev.map((q) => (q.tempId === tempId ? { ...q, ...patch } : q))
    );
  };

  const toggleSelectPreview = (tempId) => {
    setNewQuestions((prev) =>
      prev.map((q) =>
        q.tempId === tempId ? { ...q, selected: !q.selected } : q
      )
    );
  };

  const handleAddSelectedQuestionsToExam = () => {
    const selected = newQuestions.filter((q) => q.selected);
    if (selected.length === 0) {
      setPreviewError("Chưa chọn câu hỏi nào để thêm.");
      return;
    }

    const currentTotal = computeTotalPoints(editingExam.questions);
    const addTotal = computeTotalPoints(selected);
    const newTotal = Math.round((currentTotal + addTotal) * 10) / 10;
    if (newTotal !== 10) {
      setPreviewError(
        `Tổng điểm sau khi thêm sẽ là ${newTotal.toFixed(
          1
        )}. Tổng điểm của đề phải bằng 10. Vui lòng điều chỉnh điểm trước khi thêm.`
      );
      return;
    }

    const assigned = selected.map((q, i) => {
      const baseId = Date.now() + i + Math.floor(Math.random() * 1000);
      if (normalizeType(q.type) === "MCQ") {
        const options = q.options.map((o, idx) => ({
          id: baseId + 100 + idx,
          content: o.content,
          is_correct: o.is_correct,
        }));
        return {
          id: baseId,
          type: "MCQ",
          content: q.content,
          points: parseFloat(q.points) || 0.1,
          options,
        };
      } else {
        return {
          id: baseId,
          type: "essay",
          content: q.content,
          points: parseFloat(q.points) || 0.1,
          modelAnswer: q.modelAnswer || "",
        };
      }
    });
    // Build next exam payload and save immediately (stay on page)
    const nextExam = {
      ...editingExam,
      questions: [...editingExam.questions, ...assigned],
    };
    setPreviewOpen(false);
    setPreviewError("");
    setNewQuestions([]);
    setParsedQuestions([]);
    setSelectedFile(null);
    // Persist to DB and reload view, show success toast
    handleSaveExam(nextExam, { stay: true, toast: "added" });
  };

  // ---------- render ----------
  if (loading) return <LoadingSpinner size="lg" />;
  if (!editingExam)
    return (
      <div className="p-6 text-center text-gray-600">Không có dữ liệu</div>
    );

  const mcqQuestions = editingExam.questions.filter(
    (q) => normalizeType(q.type) === "MCQ"
  );
  const essayQuestions = editingExam.questions.filter(
    (q) => normalizeType(q.type) === "essay"
  );

  return (
    <div className="min-h-screen p-8 max-lg:p-0 max-md:p-4 max-sm:p-0 ">
      <div className="max-w-4xl md:max-w-6xl lg:max-w-full mx-auto bg-white rounded-2xl shadow-2xl p-6">
        {successToast && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-xl text-base font-medium">
              {successToast}
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Chỉnh sửa đề thi</h2>
          <button
            onClick={() => navigate("/exam-bank")}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {(errorMessage || apiError) && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            {errorMessage || apiError}
          </div>
        )}

        {/* Title */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tiêu đề đề thi
            </label>
            <input
              type="text"
              value={editingExam.title}
              onChange={(e) => {
                setEditingExam({ ...editingExam, title: e.target.value });
                if (errorMessage) setErrorMessage("");
                if (apiError) setApiError("");
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* UPLOAD PANEL */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-800">
              Upload câu hỏi từ file Excel
            </label>

            <div className="flex items-center gap-3">
              <label
                htmlFor="excel-upload"
                className={`
                  flex-1 flex items-center justify-center gap-2
                  px-4 py-3 rounded-xl border-2 border-dashed
                  ${
                    selectedFile
                      ? "border-green-500 bg-green-50"
                      : "border-gray-300 hover:border-gray-400"
                  }
                  cursor-pointer transition-colors duration-200
                `}
              >
                <span className="text-sm font-medium text-gray-700 truncate">
                  {selectedFile ? selectedFile.name : "Chọn file .xlsx / .xls"}
                </span>
              </label>

              <input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAnalyzeFile}
                disabled={!selectedFile}
                className={`
                  flex-1 flex items-center justify-center gap-2
                  px-4 py-2.5 rounded-xl font-medium text-sm transition-all
                  ${
                    selectedFile
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }
                `}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Phân tích file
              </button>

              <button
                onClick={() => {
                  setSelectedFile(null);
                  setParsedQuestions([]);
                  setNewQuestions([]);
                  setPreviewOpen(false);
                }}
                className={`
                  px-4 py-2.5 rounded-xl font-medium text-sm border
                  ${
                    selectedFile
                      ? "border-gray-300 text-gray-700 hover:bg-gray-50"
                      : "border-gray-200 text-gray-400 cursor-not-allowed"
                  }
                  transition-colors
                `}
              >
                Hủy
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-medium">Format:</span> type (MCQ/essay),
              content, points, optionA..D (MCQ), correctOption (A/B/C/D),
              modelAnswer (essay)
            </p>
          </div>
        </div>

        {/* Thông báo phân tích file (hiển thị cả khi không mở preview) */}
        {previewError && !previewOpen && (
          <div className="mb-4 p-3 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
            {previewError}
          </div>
        )}

        {/* PREVIEW */}
        {previewOpen && newQuestions.length > 0 && (
          <div className="mb-6 border rounded-lg p-5 bg-gray-50">
            <h4 className="font-semibold mb-2">
              Preview: Các câu hỏi mới tìm được trong file
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Tick chọn câu muốn thêm, chỉnh điểm nếu cần. Tổng điểm sau khi
              thêm phải bằng 10.
            </p>

            {previewError && (
              <div className="mb-3 p-3 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                {previewError}
              </div>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {newQuestions.map((q) => (
                <div
                  key={q.tempId}
                  className="p-4 bg-white border rounded-lg shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!q.selected}
                        onChange={() => toggleSelectPreview(q.tempId)}
                        className="w-5 h-5 text-blue-600 rounded"
                      />
                      <strong className="text-indigo-700">
                        {normalizeType(q.type) === "MCQ" ? "MCQ" : "Essay"}
                      </strong>
                      <span className="text-sm text-gray-700 max-w-xl truncate">
                        {q.content}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Điểm</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={q.points}
                        onChange={(e) =>
                          updatePreviewQuestion(q.tempId, {
                            points: parseFloat(e.target.value),
                          })
                        }
                        className="w-20 px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  </div>

                  {normalizeType(q.type) === "MCQ" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {q.options.map((opt, i) => (
                        <div
                          key={opt.tempId}
                          className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded"
                        >
                          <span className="font-medium text-gray-800 w-6">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          <span className="flex-1">{opt.content}</span>
                          {opt.is_correct && (
                            <span className="text-green-600 font-medium">
                              (Đáp án đúng)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {normalizeType(q.type) === "essay" && (
                    <div className="mt-3">
                      <div className="font-medium text-gray-800 mb-1">
                        Đáp án mẫu:
                      </div>
                      <div className="p-2 bg-gray-50 rounded text-sm whitespace-pre-wrap">
                        {q.modelAnswer || "(Trống)"}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 border rounded-xl hover:bg-gray-50"
              >
                Đóng
              </button>
              <button
                onClick={handleAddSelectedQuestionsToExam}
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
              >
                Thêm các câu chọn vào đề thi
              </button>
            </div>
          </div>
        )}

        {/* MCQ SECTION */}
        <div className="space-y-6 mb-10">
          <h3 className="text-lg font-semibold text-green-700 mb-4">
            Phần trắc nghiệm ({mcqQuestions.length} câu)
          </h3>

          {mcqQuestions.map((q, idx) => (
            <div
              key={q.id}
              className="border border-gray-200 rounded-xl p-5 bg-gray-50"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="font-medium text-gray-700">
                  Câu {idx + 1}:
                </span>
                <button
                  onClick={() => {
                    if (window.confirm("Xóa câu hỏi này?")) {
                      setEditingExam({
                        ...editingExam,
                        questions: editingExam.questions.filter(
                          (x) => x.id !== q.id
                        ),
                      });
                    }
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <FiTrash2 className="w-5 h-5" />
                </button>
              </div>

              <textarea
                value={q.content}
                onChange={(e) => {
                  const updated = [...editingExam.questions];
                  const originalIdx = updated.findIndex((x) => x.id === q.id);
                  updated[originalIdx].content = e.target.value;
                  setEditingExam({ ...editingExam, questions: updated });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-purple-500"
                rows="2"
                placeholder="Nội dung câu hỏi"
              />

              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-600">Điểm:</span>
                <input
                  type="number"
                  value={q.points}
                  onChange={(e) => {
                    const updated = [...editingExam.questions];
                    const originalIdx = updated.findIndex((x) => x.id === q.id);
                    updated[originalIdx].points =
                      parseFloat(e.target.value) || 0.1;
                    setEditingExam({ ...editingExam, questions: updated });
                  }}
                  className="w-20 px-2 py-1 border rounded-lg text-sm"
                  min="0.1"
                  step="0.1"
                />
              </div>

              <div className="space-y-2">
                {q.options.map((opt, optIndex) => (
                  <div
                    key={opt.id}
                    className="flex items-center gap-3 max-sm:gap-1.5 bg-white p-3 rounded-lg border"
                  >
                    <span className="font-medium text-gray-700">
                      {String.fromCharCode(65 + optIndex)}.
                    </span>
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      checked={opt.is_correct}
                      onChange={() => {
                        const updated = [...editingExam.questions];
                        const originalIdx = updated.findIndex(
                          (x) => x.id === q.id
                        );
                        updated[originalIdx].options.forEach(
                          (o, i) => (o.is_correct = i === optIndex)
                        );
                        setEditingExam({ ...editingExam, questions: updated });
                      }}
                    />
                    <input
                      type="text"
                      value={opt.content}
                      onChange={(e) => {
                        const updated = [...editingExam.questions];
                        const originalIdx = updated.findIndex(
                          (x) => x.id === q.id
                        );
                        updated[originalIdx].options[optIndex].content =
                          e.target.value;
                        setEditingExam({ ...editingExam, questions: updated });
                      }}
                      className="flex-1 px-3 max-sm:px-1 py-1 text-sm"
                      placeholder="Nội dung đáp án"
                    />
                    <button
                      onClick={() => {
                        const updated = [...editingExam.questions];
                        const originalIdx = updated.findIndex(
                          (x) => x.id === q.id
                        );
                        updated[originalIdx].options.splice(optIndex, 1);
                        setEditingExam({ ...editingExam, questions: updated });
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const updated = [...editingExam.questions];
                    const originalIdx = updated.findIndex((x) => x.id === q.id);
                    updated[originalIdx].options.push({
                      id: Date.now(),
                      content: `Lựa chọn ${String.fromCharCode(
                        65 + q.options.length
                      )}`,
                      is_correct: false,
                    });
                    setEditingExam({ ...editingExam, questions: updated });
                  }}
                  className="text-sm text-green-600 hover:underline"
                >
                  + Thêm đáp án
                </button>
              </div>

              {valMap[q.id] && (
                <div className="mt-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                  {valMap[q.id].map((m, i) => (
                    <div key={i}>• {m}</div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={() => {
              const newQuestion = {
                id: Date.now(),
                type: "MCQ",
                content: "Câu hỏi trắc nghiệm mới",
                points: 0.1,
                modelAnswer: "",
                options: [
                  {
                    id: Date.now() + 1,
                    content: "Lựa chọn A",
                    is_correct: true,
                  },
                  {
                    id: Date.now() + 2,
                    content: "Lựa chọn B",
                    is_correct: false,
                  },
                ],
              };
              setEditingExam({
                ...editingExam,
                questions: [...editingExam.questions, newQuestion],
              });
            }}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
          >
            <FiPlus /> Thêm câu hỏi trắc nghiệm
          </button>
        </div>

        {/* ESSAY SECTION */}
        <div className="space-y-6 mb-6">
          <h3 className="text-lg font-semibold text-purple-700 mb-4">
            Phần tự luận ({essayQuestions.length} câu)
          </h3>

          {essayQuestions.map((q, idx) => (
            <div
              key={q.id}
              className="border border-gray-200 rounded-xl p-5 bg-gray-50"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="font-medium text-gray-700">
                  Câu {mcqQuestions.length + idx + 1}:
                </span>
                <button
                  onClick={() => {
                    if (window.confirm("Xóa câu hỏi này?")) {
                      setEditingExam({
                        ...editingExam,
                        questions: editingExam.questions.filter(
                          (x) => x.id !== q.id
                        ),
                      });
                    }
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <FiTrash2 className="w-5 h-5" />
                </button>
              </div>

              <textarea
                value={q.content}
                onChange={(e) => {
                  const updated = [...editingExam.questions];
                  const originalIdx = updated.findIndex((x) => x.id === q.id);
                  updated[originalIdx].content = e.target.value;
                  setEditingExam({ ...editingExam, questions: updated });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-purple-500"
                rows="4"
                placeholder="Nội dung câu hỏi tự luận"
              />

              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-600">Điểm:</span>
                <input
                  type="number"
                  value={q.points}
                  onChange={(e) => {
                    const updated = [...editingExam.questions];
                    const originalIdx = updated.findIndex((x) => x.id === q.id);
                    updated[originalIdx].points =
                      parseFloat(e.target.value) || 0.1;
                    setEditingExam({ ...editingExam, questions: updated });
                  }}
                  className="w-20 px-2 py-1 border rounded-lg text-sm"
                  min="0.1"
                  step="0.1"
                />
              </div>

              <label className="block text-sm font-medium text-gray-700">
                Đáp án mẫu
              </label>
              <textarea
                value={q.modelAnswer || ""}
                onChange={(e) => {
                  const updated = [...editingExam.questions];
                  const originalIdx = updated.findIndex((x) => x.id === q.id);
                  updated[originalIdx].modelAnswer = e.target.value;
                  setEditingExam({ ...editingExam, questions: updated });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                rows="4"
                placeholder="Nhập đáp án mẫu cho câu tự luận"
              />

              {valMap[q.id] && (
                <div className="mt-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                  {valMap[q.id].map((m, i) => (
                    <div key={i}>• {m}</div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={() => {
              const newQuestion = {
                id: Date.now(),
                type: "essay",
                content: "Câu hỏi tự luận mới",
                points: 0.1,
                modelAnswer: "",
              };
              setEditingExam({
                ...editingExam,
                questions: [...editingExam.questions, newQuestion],
              });
            }}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
          >
            <FiPlus /> Thêm câu hỏi tự luận
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate("/exam-bank")}
            className="px-6 py-2 border border-gray-300 rounded-xl hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            onClick={() => handleSaveExam(null, { stay: true })}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg"
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditExam;
