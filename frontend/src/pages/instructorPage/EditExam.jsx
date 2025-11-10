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

  // Upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [newQuestions, setNewQuestions] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);

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
      } catch (err) {
        alert("Không thể tải chi tiết đề thi!");
        navigate("/assign-exam");
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

  // ---------- Save exam ----------
  const handleSaveExam = async () => {
    const totalPoints = computeTotalPoints(editingExam.questions);
    if (totalPoints !== 10) {
      setErrorMessage(
        `Tổng điểm hiện tại là ${totalPoints.toFixed(
          1
        )}. Tổng điểm phải bằng 10 để lưu bài thi!`
      );
      return;
    }

    if (!editingExam.title?.trim()) {
      alert("Tiêu đề đề thi không được để trống!");
      return;
    }

    try {
      const updatedQuestions = editingExam.questions.map((q) => ({
        ...q,
        type: normalizeType(q.type),
      }));

      await axios.put(
        `http://localhost:5000/api/edit-exam/exams/${id}`,
        { ...editingExam, questions: updatedQuestions },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Cập nhật đề thi thành công!");
      navigate("/assign-exam");
    } catch (err) {
      alert("Cập nhật đề thi thất bại!");
    }
  };

  // ---------- File select & parse ----------
  const handleFileSelect = (e) => {
    setSelectedFile(e.target.files?.[0] || null);
    setParsedQuestions([]);
    setNewQuestions([]);
    setPreviewOpen(false);
  };

  const parseExcelToQuestions = (workbook) => {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const dataRows = rows.slice(1);

    const questionsFromFile = dataRows
      .map((row, rowIdx) => {
        const rawType = (row[0] || "").toString().trim();
        if (!rawType) return null;

        const type = normalizeType(rawType);
        const content = (row[1] || "").toString().trim();
        const points = parseFloat(row[2]) || 0;
        if (!content) return null;

        // --- MCQ ---
        if (type === "MCQ") {
          const opts = ["A", "B", "C", "D"]
            .map((letter, i) => {
              const txt = (row[3 + i] || "").toString().trim();
              return txt
                ? {
                    tempId: `${rowIdx}-${letter}`,
                    content: txt,
                    is_correct: false,
                  }
                : null;
            })
            .filter(Boolean);

          const correct = ((row[7] || "") + "").toString().trim().toUpperCase();
          opts.forEach((o) => {
            if (o.tempId.endsWith(`-${correct}`)) o.is_correct = true;
          });

          return { type: "MCQ", content, points, options: opts };
        }

        // --- ESSAY ---
        const modelAnswer = (row[3] || "").toString().trim();
        return { type: "essay", content, points, modelAnswer };
      })
      .filter(Boolean);

    return questionsFromFile;
  };

  const areMCQEqual = (a, b) => {
    if (a.content?.trim() !== b.content?.trim()) return false;
    if ((a.options?.length || 0) !== (b.options?.length || 0)) return false;
    for (let i = 0; i < a.options.length; i++) {
      const oa = (a.options[i].content || "").trim();
      const ob = (b.options[i]?.content || "").trim();
      if (oa !== ob) return false;
      if (!!a.options[i].is_correct !== !!b.options[i].is_correct) return false;
    }
    return true;
  };

  const areEssayEqual = (a, b) => {
    return (
      (a.content || "").trim() === (b.content || "").trim() &&
      (a.modelAnswer || "").trim() === (b.modelAnswer || "").trim()
    );
  };

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
        const uniques = fileQuestions.filter(
          (fq) => !isDuplicateAgainstExisting(fq, existing)
        );

        if (uniques.length === 0) {
          alert(
            "Không có câu hỏi mới nào trong file, vui lòng thêm câu hỏi mới để cập nhật"
          );
          setNewQuestions([]);
          setPreviewOpen(false);
          return;
        }

        const withSelected = uniques.map((q, i) => ({
          ...q,
          selected: true,
          tempId: `preview-${Date.now()}-${i}`,
        }));
        setNewQuestions(withSelected);
        setPreviewOpen(true);
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
      alert("Chưa chọn câu hỏi nào để thêm.");
      return;
    }

    const currentTotal = computeTotalPoints(editingExam.questions);
    const addTotal = computeTotalPoints(selected);
    const newTotal = Math.round((currentTotal + addTotal) * 10) / 10;
    if (newTotal !== 10) {
      alert(
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

    setEditingExam((prev) => ({
      ...prev,
      questions: [...prev.questions, ...assigned],
    }));

    setNewQuestions([]);
    setParsedQuestions([]);
    setSelectedFile(null);
    setPreviewOpen(false);
    alert(
      "Đã thêm các câu chọn vào bài thi. Nhớ nhấn Lưu thay đổi để cập nhật lên server."
    );
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
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-full mx-auto bg-white rounded-2xl shadow-2xl p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Chỉnh sửa đề thi</h2>
          <button
            onClick={() => navigate("/assign-exam")}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            {errorMessage}
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
              onChange={(e) =>
                setEditingExam({ ...editingExam, title: e.target.value })
              }
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
                    className="flex items-center gap-3 bg-white p-3 rounded-lg border"
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
                      className="flex-1 px-3 py-1 text-sm"
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
            onClick={() => navigate("/assign-exam")}
            className="px-6 py-2 border border-gray-300 rounded-xl hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSaveExam}
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
