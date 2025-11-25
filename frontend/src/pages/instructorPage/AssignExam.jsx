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
const AssignExam = () => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [examTitle, setExamTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [duration, setDuration] = useState("");
  const [message, setMessage] = useState("");
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

      // ✅ KIỂM TRA MEDIA TRƯỚC KHI PARSE - Kiểm tra workbook metadata
      console.log("🔍 Bắt đầu kiểm tra media trong file Excel...");

      // 1. Kiểm tra workbook có chứa media không
      if (workbook.Sheets) {
        Object.keys(workbook.Sheets).forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];

          // Kiểm tra các thuộc tính media trong sheet
          if (sheet["!images"]) {
            console.error("❌ Phát hiện images trong sheet:", sheet["!images"]);
            throw new Error(
              `❌ File chứa hình ảnh!\n\n` +
                `Sheet "${sheetName}" có ${sheet["!images"].length} hình ảnh.\n\n` +
                `File Excel KHÔNG được chứa hình ảnh, âm thanh, video.\n` +
                `Vui lòng xóa tất cả media và thử lại.`
            );
          }

          if (sheet["!drawings"]) {
            console.error(
              "❌ Phát hiện drawings trong sheet:",
              sheet["!drawings"]
            );
            throw new Error(
              `❌ File chứa hình vẽ/biểu đồ!\n\n` +
                `Sheet "${sheetName}" có drawing objects.\n\n` +
                `Vui lòng xóa tất cả hình vẽ, biểu đồ và thử lại.`
            );
          }

          if (sheet["!objects"]) {
            console.error(
              "❌ Phát hiện objects trong sheet:",
              sheet["!objects"]
            );
            throw new Error(
              `❌ File chứa objects không hợp lệ!\n\n` +
                `Sheet "${sheetName}" có embedded objects.\n\n` +
                `Vui lòng xóa tất cả objects và thử lại.`
            );
          }
        });
      }

      // 2. Kiểm tra workbook-level media
      if (workbook.Media && workbook.Media.length > 0) {
        console.error("❌ Phát hiện Media trong workbook:", workbook.Media);
        throw new Error(
          `❌ File chứa ${workbook.Media.length} file media!\n\n` +
            `File Excel KHÔNG được chứa hình ảnh, âm thanh, video.\n` +
            `Vui lòng xóa tất cả media và thử lại.`
        );
      }

      console.log("✅ Kiểm tra workbook metadata - Không phát hiện media");

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (jsonData.length < 2) {
        throw new Error("File Excel phải có ít nhất 1 dòng dữ liệu");
      }

      // ✅ KIỂM TRA CELLS - Quét từng cell trong jsonData
      console.log("🔍 Kiểm tra từng cell trong data...");
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        for (let j = 0; j < row.length; j++) {
          const cell = row[j];

          // Log để debug
          if (cell && typeof cell === "object") {
            console.log(
              `Cell [${i + 1}, ${j + 1}] type:`,
              typeof cell,
              cell.constructor?.name,
              cell
            );
          }

          // Kiểm tra object (không phải Date, không phải null)
          if (cell && typeof cell === "object" && !(cell instanceof Date)) {
            console.error(
              `❌ Phát hiện object tại dòng ${i + 1}, cột ${j + 1}:`,
              cell
            );
            throw new Error(
              `❌ File chứa dữ liệu không hợp lệ!\n\n` +
                `Vị trí: Dòng ${i + 1}, Cột ${j + 1}\n` +
                `Loại: ${cell.constructor?.name || "Object"}\n\n` +
                `File Excel chỉ được chứa văn bản thuần túy.\n` +
                `Vui lòng xóa tất cả media/objects và thử lại.`
            );
          }
        }
      }
      console.log("✅ Kiểm tra cells hoàn tất - File hợp lệ");

      // Parse data by sections - Support multiple markers
      const questions = [];
      let currentSection = null;
      let rowIndex = 0;
      let hasMCQMarker = false;
      let hasEssayMarker = false;

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
        // Check for section markers (có thể xuất hiện nhiều lần)
        if (rowText.includes("Trắc nghiệm") && rowText.includes("MCQ")) {
          currentSection = "MCQ";
          hasMCQMarker = true;
          rowIndex++;
          continue;
        } else if (rowText.includes("Tự luận") && rowText.includes("Essay")) {
          currentSection = "Essay";
          hasEssayMarker = true;
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

          // Loại bỏ đánh số câu tự động (Câu 1:, Câu 2:, etc.)
          const cleanedQuestionText = questionText
            .replace(/^Câu\s+\d+:\s*/i, "")
            .trim();

          const options = [];
          for (let j = 1; j <= 4; j++) {
            const opt = row[j]?.toString().trim() || "";
            if (opt) {
              options.push(opt);
            }
          }
          const questionData = {
            row: rowIndex + 1,
            question_text: cleanedQuestionText,
            original_question_text: questionText, // Lưu câu hỏi gốc để so sánh
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

          // Loại bỏ đánh số câu tự động
          const cleanedFullText = fullText
            .replace(/^Câu\s+\d+:\s*/i, "")
            .trim();
          const questionMatch = cleanedFullText.match(
            /Câu hỏi:\s*(.+?)(?=Câu trả lời:|$)/i
          );
          const answerMatch = cleanedFullText.match(/Câu trả lời:\s*(.+)/i);

          if (questionMatch || answerMatch) {
            const questionData = {
              row: rowIndex + 1,
              question_text: questionMatch ? questionMatch[1].trim() : "",
              original_question_text: fullText, // Lưu câu hỏi gốc để so sánh
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

      // ✅ KIỂM TRA TRÙNG LẶP TRƯỚC KHI GỘP VÀ ĐÁNH SỐ
      const duplicateErrors = [];
      const seenQuestions = new Map();

      questions.forEach((q) => {
        if (!q.question_text) return;

        // Normalize: lowercase, loại bỏ khoảng trắng thừa
        const normalizedText = q.question_text
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

        if (seenQuestions.has(normalizedText)) {
          const firstRow = seenQuestions.get(normalizedText);
          duplicateErrors.push(
            `Câu hỏi trùng lặp tại dòng ${
              q.row
            } và dòng ${firstRow}: "${q.question_text.substring(0, 60)}${
              q.question_text.length > 60 ? "..." : ""
            }"`
          );
        } else {
          seenQuestions.set(normalizedText, q.row);
        }
      });

      if (duplicateErrors.length > 0) {
        throw new Error(
          "❌ Phát hiện câu hỏi trùng lặp!\n\n" +
            duplicateErrors.join("\n") +
            "\n\nVui lòng xóa các câu hỏi trùng lặp và thử lại."
        );
      }

      // ✅ Gộp và sắp xếp câu hỏi theo loại
      const mcqQuestions = questions.filter((q) => q.type === "MCQ");
      const essayQuestions = questions.filter((q) => q.type === "Essay");

      // Tự động đánh số lại
      mcqQuestions.forEach((q, idx) => {
        q.autoNumber = idx + 1;
        q.question_text = `Câu ${idx + 1}: ${q.question_text}`;
      });

      essayQuestions.forEach((q, idx) => {
        q.autoNumber = idx + 1;
        q.question_text = `Câu ${idx + 1}: ${q.question_text}`;
      });

      // Gộp lại: MCQ trước, Essay sau
      const sortedQuestions = [...mcqQuestions, ...essayQuestions];

      const mcqCount = mcqQuestions.length;
      const essayCount = essayQuestions.length;
      const totalQuestions = sortedQuestions.length;
      const errorCount = sortedQuestions.filter(
        (q) => q.errors.length > 0
      ).length;

      // ✅ Kiểm tra xem file có marker phân loại không
      if (!hasMCQMarker && !hasEssayMarker) {
        throw new Error(
          "❌ File thiếu marker phân loại!\n\n" +
            "File Excel của bạn PHẢI có ít nhất 1 trong 2 marker sau:\n" +
            "• 'Trắc nghiệm (MCQ)' - cho phần câu hỏi trắc nghiệm\n" +
            "• 'Tự luận (Essay)' - cho phần câu hỏi tự luận\n\n" +
            "Vui lòng thêm dòng marker vào đầu mỗi phần câu hỏi để hệ thống có thể nhận biết loại câu hỏi.\n\n" +
            "Ví dụ:\n" +
            "Dòng 1: Trắc nghiệm (MCQ)\n" +
            "Dòng 2: Câu 1: What is AI? | Option A | Option B* | ...\n" +
            "Dòng 8: Tự luận (Essay)\n" +
            "Dòng 9: Câu hỏi: ... Câu trả lời: ..."
        );
      }

      // ✅ Kiểm tra nếu không có câu hỏi nào được parse
      if (totalQuestions === 0) {
        if (hasMCQMarker || hasEssayMarker) {
          throw new Error(
            "⚠️ File có marker nhưng không tìm thấy câu hỏi!\n\n" +
              "Hệ thống đã phát hiện marker phân loại nhưng không đọc được câu hỏi nào.\n\n" +
              "Kiểm tra lại:\n" +
              "• Các câu hỏi có nằm DƯỚI dòng marker không?\n" +
              "• Format câu hỏi có đúng theo hướng dẫn không?\n" +
              "• MCQ: Câu hỏi + 4 đáp án (có dấu * cho đáp án đúng)\n" +
              "• Essay: 'Câu hỏi: ...' và 'Câu trả lời: ...'"
          );
        } else {
          throw new Error("File không có dữ liệu câu hỏi hợp lệ.");
        }
      }
      const validationErrors = [];
      const summary = {
        total: totalQuestions,
        mcq: mcqCount,
        essay: essayCount,
        errors: errorCount,
        validationErrors: validationErrors,
      };

      return { preview: sortedQuestions, summary, validationErrors };
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

    // Check for validation errors
    if (
      previewData.validationErrors &&
      previewData.validationErrors.length > 0
    ) {
      setError(
        `❌ Không thể lưu đề thi:\n${previewData.validationErrors.join("\n")}`
      );
      return;
    }

    // Check for question-level errors
    const hasErrors = previewData.preview.some((q) => q.errors.length > 0);
    if (hasErrors) {
      setError("⚠️ Có câu hỏi bị lỗi. Vui lòng kiểm tra lại trước khi commit");
      return;
    }

    // Final validation check
    const mcqCount = previewData.summary.mcq;
    const essayCount = previewData.summary.essay;
    const totalCount = previewData.summary.total;

    if (mcqCount > 50) {
      setError(
        `❌ Số câu trắc nghiệm không được vượt quá 50 câu (hiện có ${mcqCount} câu)`
      );
      return;
    }

    if (essayCount > 10) {
      setError(
        `❌ Số câu tự luận không được vượt quá 10 câu (hiện có ${essayCount} câu)`
      );
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
        setMessage(
          `✅ Import thành công! Đã thêm ${previewData.summary.total} câu hỏi vào ngân hàng.\nExam ID: ${response.data.exam_id}`
        );
        setTimeout(() => setMessage(""), 10000);
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
  const renderQuestionText = (q) => {
    const scorePattern = /\((\d+(?:[.,]\d+)?)đ\)/i;
    const match = q.question_text.match(scorePattern);
    const point = match ? match[1].replace(",", ".") : q.points || "?";
    const textWithoutPoint = q.question_text.replace(scorePattern, "").trim();
    return `${textWithoutPoint} (${point}đ)`;
  };
  return (
    <div className="p-6 max-lg:p-4 max-sm:p-0 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Tạo đề thi mới
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
            <div className="bg-yellow-50 p-2 rounded border border-yellow-300">
              <p className="font-semibold text-yellow-800">
                🔖 BẮT BUỘC - Marker phân loại:
              </p>
              <p className="text-yellow-700">
                • File <strong>PHẢI CÓ</strong> dòng marker để hệ thống nhận
                biết loại câu hỏi
              </p>
              <p className="text-yellow-700">
                • Marker MCQ: <strong>"Trắc nghiệm (MCQ)"</strong> (viết đúng
                chính tả)
              </p>
              <p className="text-yellow-700">
                • Marker Essay: <strong>"Tự luận (Essay)"</strong> (viết đúng
                chính tả)
              </p>
              <p className="text-yellow-700 font-semibold mt-1">
                ⚠️ Thiếu marker = File bị từ chối!
              </p>
            </div>
            <div>
              <p className="font-semibold">📝 Phần Trắc nghiệm (MCQ):</p>
              <p>
                • <strong>Bước 1:</strong> Thêm dòng marker:{" "}
                <strong>"Trắc nghiệm (MCQ)"</strong>
              </p>
              <p>
                • <strong>Bước 2:</strong> Mỗi dòng tiếp theo: Câu hỏi (cột 1) +
                4 đáp án (cột 2-5)
              </p>
              <p>• Đánh dấu * ở cuối đáp án đúng</p>
              <p>
                • Ví dụ: "What is AI?" | "Option A" | "Option B*" | "Option C" |
                "Option D"
              </p>
            </div>
            <div className="mt-2 border-t pt-2">
              <p className="font-semibold">✍️ Phần Tự luận (Essay):</p>
              <p>
                • <strong>Bước 1:</strong> Thêm dòng marker:{" "}
                <strong>"Tự luận (Essay)"</strong>
              </p>
              <p>
                • <strong>Bước 2:</strong> Format mỗi câu:{" "}
                <strong>"Câu hỏi: ..."</strong> và{" "}
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
          {(uploadedFile || previewData) && (
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition flex items-center gap-2"
            >
              <FiX className="w-5 h-5" />
              Reset
            </button>
          )}
          {/* Thông báo thành công */}
          {message && (
            <span className="text-green-400 font-semibold ml-2">{message}</span>
          )}
        </div>
        {/* Error message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-red-600 text-xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 mb-1">
                  Lỗi phân tích file
                </p>
                <pre className="text-sm text-red-700 whitespace-pre-wrap font-sans">
                  {error}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Preview Section */}
      {previewData && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          {/* Validation Errors Alert */}
          {previewData.validationErrors &&
            previewData.validationErrors.length > 0 && (
              <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                <p className="text-sm font-bold text-red-800 mb-2">
                  ❌ Lỗi kiểm tra định dạng:
                </p>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {previewData.validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
                <p className="text-xs text-red-600 mt-2 font-semibold">
                  ⚠️ File không hợp lệ. Vui lòng sửa lại và upload lại.
                </p>
              </div>
            )}

          <div className="flex max-lg:flex-col  items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
              <FiFile className="w-6 h-6" />
              Preview - Xem trước
            </h2>
            {/* Summary */}
            <div className="flex gap-4 mt-0 max-lg:mt-4">
              <div className="text-center px-4 py-2 rounded-lg bg-blue-50">
                <p className="text-2xl font-bold text-blue-600">
                  {previewData.summary.total}
                </p>
                <p className="text-xs text-blue-600">Tổng cộng</p>
              </div>
              <div className="text-center px-4 py-2 bg-green-50 rounded-lg">
                <p
                  className={`text-2xl font-bold ${
                    previewData.summary.mcq > 50
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {previewData.summary.mcq}
                </p>
                <p
                  className={`text-xs ${
                    previewData.summary.mcq > 50
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  Trắc nghiệm{" "}
                  {previewData.summary.mcq > 50 ? "(Vượt giới hạn!)" : ""}
                </p>
              </div>
              <div className="text-center px-4 py-2 bg-purple-50 rounded-lg">
                <p
                  className={`text-2xl font-bold ${
                    previewData.summary.essay > 10
                      ? "text-red-600"
                      : "text-purple-600"
                  }`}
                >
                  {previewData.summary.essay}
                </p>
                <p
                  className={`text-xs ${
                    previewData.summary.essay > 10
                      ? "text-red-600"
                      : "text-purple-600"
                  }`}
                >
                  Tự luận{" "}
                  {previewData.summary.essay > 10 ? "(Vượt giới hạn!)" : ""}
                </p>
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
                      {renderQuestionText(q)}
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
            <div className="mt-6 flex max-lg:flex-col flex-row items-center justify-between gap-4">
              <div className="flex-1 max-w-xl max-lg:w-full">
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
                  disabled={
                    previewData.validationErrors &&
                    previewData.validationErrors.length > 0
                  }
                />
              </div>
              {/* Nút lưu */}
              <div className="shrink-0">
                <button
                  onClick={handleCommit}
                  disabled={
                    loading ||
                    (previewData.validationErrors &&
                      previewData.validationErrors.length > 0)
                  }
                  className="px-8 py-4 bg-green-600 text-white text-lg rounded-lg hover:bg-green-700 
                   disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center gap-2 "
                  title={
                    previewData.validationErrors &&
                    previewData.validationErrors.length > 0
                      ? "Không thể lưu do file không hợp lệ"
                      : ""
                  }
                >
                  {loading ? (
                    <LoadingSpinner size="sm" text="Đang xử lý..." />
                  ) : (
                    <>
                      <FiCheck className="w-5 h-5" />
                      {previewData.validationErrors &&
                      previewData.validationErrors.length > 0
                        ? "Không thể lưu (File lỗi)"
                        : "Xác nhận & lưu"}
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
export default AssignExam;
