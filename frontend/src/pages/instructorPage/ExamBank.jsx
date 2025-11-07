import React, { useState } from "react";
import {
  FiUpload,
  FiFile,
  FiCheck,
  FiX,
  FiType,
  FiAlignLeft,
} from "react-icons/fi";
import axios from "axios";
import * as XLSX from "xlsx";
import LoadingSpinner from "../../components/LoadingSpinner";

const ExamBank = () => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [examTitle, setExamTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [duration, setDuration] = useState("");

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setError("⚠️ Vui lòng chọn file Excel (.xlsx hoặc .xls)");
      return;
    }

    setUploadedFile(file);
    setError(null);
    setPreviewData(null);
    setJobId(null);
  };

  // Parse Excel and classify questions
  const parseExcelFile = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("File Excel không có sheet nào");
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error("File Excel phải có ít nhất 1 dòng dữ liệu");
      }

      // Parse data by sections
      const questions = [];
      let currentSection = null;
      let rowIndex = 0;

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) {
          rowIndex++;
          continue;
        }

        // Convert row to text
        const rowText = row
          .map((cell) => cell?.toString().trim() || "")
          .join(" ");

        // Check for section markers
        if (rowText.includes("Trắc nghiệm") && rowText.includes("MCQ")) {
          currentSection = "MCQ";
          rowIndex++;
          continue;
        } else if (rowText.includes("Tự luận") && rowText.includes("Essay")) {
          currentSection = "Essay";
          rowIndex++;
          continue;
        }

        // Skip empty rows or section headers
        if (!currentSection || rowText.length === 0) {
          rowIndex++;
          continue;
        }

        // Parse based on section
        if (currentSection === "MCQ") {
          // MCQ: Each row has question + 4 options
          const questionText = row[0]?.toString().trim() || "";
          if (!questionText) {
            rowIndex++;
            continue;
          }

          const options = [];
          for (let j = 1; j <= 4; j++) {
            const opt = row[j]?.toString().trim() || "";
            if (opt) {
              options.push(opt);
            }
          }

          const questionData = {
            row: rowIndex + 1,
            question_text: questionText,
            type: "MCQ",
            errors: [],
          };

          // Find correct answer (marked with *)
          let correctOption = null;
          const cleanOptions = options.map((opt, idx) => {
            const trimmed = opt.trim();
            if (trimmed.endsWith("*")) {
              correctOption = idx;
              return trimmed.replace(/\*+$/, "").trim();
            }
            return trimmed;
          });

          // Validation
          if (options.length < 2) {
            questionData.errors.push(
              "Câu hỏi trắc nghiệm phải có ít nhất 2 đáp án"
            );
          }
          if (correctOption === null && options.length > 0) {
            questionData.errors.push(
              "Không tìm thấy đáp án đúng (cần đánh dấu * ở cuối đáp án)"
            );
          }

          questionData.options = cleanOptions;
          questionData.correct_option =
            correctOption !== null ? correctOption : null;

          questions.push(questionData);
        } else if (currentSection === "Essay") {
          // Essay: Look for "Câu hỏi:" and "Câu trả lời:" in the text
          const fullText = row
            .map((cell) => cell?.toString().trim() || "")
            .join(" ");

          // Try to find question and answer pattern
          const questionMatch = fullText.match(/Câu hỏi:\s*([^\n]+)/i);
          const answerMatch = fullText.match(/Câu trả lời:\s*([^\n]+)/i);

          if (questionMatch || answerMatch) {
            const questionData = {
              row: rowIndex + 1,
              question_text: questionMatch ? questionMatch[1].trim() : "",
              type: "Essay",
              model_answer: answerMatch ? answerMatch[1].trim() : "",
              errors: [],
            };

            if (!questionData.question_text) {
              questionData.errors.push(
                'Không tìm thấy "Câu hỏi:" trong văn bản'
              );
            }
            if (!questionData.model_answer) {
              questionData.errors.push(
                'Không tìm thấy "Câu trả lời:" trong văn bản'
              );
            }

            questions.push(questionData);
          }
        }

        rowIndex++;
      }

      const summary = {
        total: questions.length,
        mcq: questions.filter((q) => q.type === "MCQ").length,
        essay: questions.filter((q) => q.type === "Essay").length,
        errors: questions.filter((q) => q.errors.length > 0).length,
      };

      return { preview: questions, summary };
    } catch (err) {
      throw new Error(`Lỗi parse file Excel: ${err.message}`);
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!uploadedFile) {
      setError("⚠️ Vui lòng chọn file trước khi upload");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await parseExcelFile(uploadedFile);
      setPreviewData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle commit to database
  const handleCommit = async () => {
    if (!previewData) {
      setError("⚠️ Không có dữ liệu để commit");
      return;
    }

    if (!examTitle || examTitle.trim() === "") {
      setError("⚠️ Vui lòng nhập tên đề thi trước khi lưu");
      return;
    }

    const hasErrors = previewData.preview.some((q) => q.errors.length > 0);
    if (hasErrors) {
      setError("⚠️ Có câu hỏi bị lỗi. Vui lòng kiểm tra lại trước khi commit");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://localhost:5000/api/exam-bank/import-commit",
        {
          preview: previewData.preview,
          summary: previewData.summary,
          exam_title: examTitle,
          duration: parseInt(duration, 10) || 60,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.status === "success") {
        alert(
          `✅ Import thành công! Đã thêm ${previewData.summary.total} câu hỏi vào ngân hàng.\nExam ID: ${response.data.exam_id}`
        );

        setPreviewData(null);
        setUploadedFile(null);
        setExamTitle("");
        const fileInput = document.getElementById("fileInput");
        if (fileInput) fileInput.value = "";
      } else {
        setError(
          "❌ Import thất bại! Backend không trả về trạng thái success."
        );
      }
    } catch (err) {
      setError(
        "❌ Lỗi khi commit dữ liệu: " +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle reset
  const handleReset = () => {
    setPreviewData(null);
    setUploadedFile(null);
    setError(null);
    const fileInput = document.getElementById("fileInput");
    if (fileInput) fileInput.value = "";
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Ngân hàng đề thi
        </h1>
        <p className="text-gray-600">
          Upload file Excel để import câu hỏi vào hệ thống
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <FiUpload className="w-6 h-6" />
          Upload file Excel
        </h2>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition">
          <div className="flex flex-col items-center gap-4">
            <input
              id="fileInput"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />

            {uploadedFile ? (
              <div className="flex items-center gap-3 text-blue-600">
                <FiFile className="w-6 h-6" />
                <span className="font-medium">{uploadedFile.name}</span>
                <span className="text-sm text-gray-500">
                  ({(uploadedFile.size / 1024).toFixed(2)} KB)
                </span>
              </div>
            ) : (
              <label htmlFor="fileInput" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2 text-gray-400 hover:text-blue-500 transition">
                  <FiUpload className="w-12 h-12" />
                  <span className="text-sm font-medium">
                    Click để chọn file
                  </span>
                  <span className="text-xs">.xlsx hoặc .xls</span>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm font-semibold text-blue-800 mb-2">
            📋 Hướng dẫn format file Excel:
          </p>
          <div className="text-sm text-blue-700 space-y-2">
            <div>
              <p className="font-semibold">📝 Phần Trắc nghiệm (MCQ):</p>
              <p>
                • Thêm tiêu đề: <strong>"Trắc nghiệm (MCQ)"</strong>
              </p>
              <p>• Mỗi dòng: Câu hỏi (cột 1) + 4 đáp án (cột 2-5)</p>
              <p>• Đánh dấu * ở cuối đáp án đúng</p>
              <p>
                • Ví dụ: "What is AI?" | "Option A" | "Option B*" | "Option C" |
                "Option D"
              </p>
            </div>
            <div className="mt-2 border-t pt-2">
              <p className="font-semibold">✍️ Phần Tự luận (Essay):</p>
              <p>
                • Thêm tiêu đề: <strong>"Tự luận (Essay):"</strong>
              </p>
              <p>
                • Format trong Excel: <strong>"Câu hỏi: ..."</strong> và{" "}
                <strong>"Câu trả lời: ..."</strong>
              </p>
              <p>
                • Ví dụ: "Câu 1: Câu hỏi: trong lịch sử việt nam có bao nhiêu vị
                vua? Câu trả lời: Có 8 vị vua."
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleUpload}
            disabled={!uploadedFile || loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {loading ? (
              <LoadingSpinner size="sm" text="" />
            ) : (
              <>
                <FiUpload className="w-5 h-5" />
                Phân tích file
              </>
            )}
          </button>

          {previewData && (
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition flex items-center gap-2"
            >
              <FiX className="w-5 h-5" />
              Reset
            </button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Preview Section */}
      {previewData && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
              <FiFile className="w-6 h-6" />
              Preview - Xem trước
            </h2>

            {/* Summary */}
            <div className="flex gap-4">
              <div className="text-center px-4 py-2 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {previewData.summary.total}
                </p>
                <p className="text-xs text-blue-600">Tổng cộng</p>
              </div>
              <div className="text-center px-4 py-2 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {previewData.summary.mcq}
                </p>
                <p className="text-xs text-green-600">Trắc nghiệm</p>
              </div>
              <div className="text-center px-4 py-2 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">
                  {previewData.summary.essay}
                </p>
                <p className="text-xs text-purple-600">Tự luận</p>
              </div>
              {previewData.summary.errors > 0 && (
                <div className="text-center px-4 py-2 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">
                    {previewData.summary.errors}
                  </p>
                  <p className="text-xs text-red-600">Lỗi</p>
                </div>
              )}
            </div>
          </div>

          {/* Questions list */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {previewData.preview.map((q, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-2 ${
                  q.errors.length > 0
                    ? "border-red-300 bg-red-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      q.type === "MCQ" ? "bg-green-100" : "bg-purple-100"
                    }`}
                  >
                    {q.type === "MCQ" ? (
                      <FiType className="w-5 h-5 text-green-600" />
                    ) : (
                      <FiAlignLeft className="w-5 h-5 text-purple-600" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-500">
                        Row {q.row}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          q.type === "MCQ"
                            ? "bg-green-100 text-green-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {q.type}
                      </span>
                    </div>

                    <p className="font-medium text-gray-800 mb-2">
                      {q.question_text}
                    </p>

                    {/* MCQ Options */}
                    {q.type === "MCQ" && q.options && (
                      <div className="ml-4 space-y-1">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`text-sm flex items-center gap-2 ${
                              optIdx === q.correct_option
                                ? "text-green-600 font-semibold"
                                : "text-gray-600"
                            }`}
                          >
                            <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            {opt}
                            {optIdx === q.correct_option && (
                              <span className="text-green-600">✓</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Essay Model Answer */}
                    {q.type === "Essay" && q.model_answer && (
                      <div className="ml-4 p-2 bg-gray-100 rounded text-sm text-gray-700">
                        <strong>Đáp án mẫu:</strong> {q.model_answer}
                      </div>
                    )}

                    {/* Errors */}
                    {q.errors.length > 0 && (
                      <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700">
                        {q.errors.map((err, errIdx) => (
                          <p key={errIdx}>⚠️ {err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Commit button */}
          {previewData.summary.errors === 0 && (
            <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1 max-w-xl">
                <input
                  id="examTitle"
                  type="text"
                  value={examTitle}
                  onChange={(e) => {
                    setExamTitle(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Nhập tên đề thi của bạn"
                  className="w-full border border-gray-300 rounded-lg px-5 py-4 text-lg text-gray-800
                   focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400
                   placeholder-gray-400 transition"
                />
              </div>

              {/* Nút lưu */}
              <div className="shrink-0">
                <button
                  onClick={handleCommit}
                  disabled={loading}
                  className="px-8 py-4 bg-green-600 text-white text-lg rounded-lg hover:bg-green-700 
                   disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" text="Đang xử lý..." />
                  ) : (
                    <>
                      <FiCheck className="w-5 h-5" />
                      Xác nhận & lưu
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExamBank;
