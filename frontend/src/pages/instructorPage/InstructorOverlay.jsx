import React, { useEffect, useRef, useState } from "react";
import axiosClient from "../../api/axiosClient";
import { useParams, useLocation } from "react-router-dom";
import { useExamContext } from "../../context/ExamContext";
import io from "socket.io-client";

export default function InstructorOverlay() {
  const { examId: routeExamId } = useParams();
  const location = useLocation();
  const { activeExamId } = useExamContext();
  const [show, setShow] = useState(false);
  const [event, setEvent] = useState(null);
  const [queue, setQueue] = useState([]); // Queue of pending notifications
  const socketRef = useRef(null);
  const lastEventRef = useRef(null);
  const audioRef = useRef(null);
  const [examIds, setExamIds] = useState([]); // List of exams instructor is monitoring

  // ===== Extract examId from current route or use context =====
  const getExamIdFromRoute = () => {
    // Pattern: /exam-settings/:examId, /exams/:examId/preview, /open-success/:examId, etc.
    const match = location.pathname.match(/exam[^/]*\/(\d+)|\/(\d+)(?:\/|$)/);
    return match ? match[1] || match[2] : routeExamId;
  };

  const examId = activeExamId || getExamIdFromRoute();

  console.log(
    "📍 [InstructorOverlay] examId extracted:",
    examId,
    "from route:",
    location.pathname,
    "from context:",
    activeExamId,
    "examIds:",
    examIds
  );

  // ===== Fetch instructor's exams on mount =====
  useEffect(() => {
    const fetchInstructorExams = async () => {
      try {
        const res = await axiosClient.get("/instructor/exams/my");
        const exams = res.data || [];
        const ids = exams.map((e) => e.id).filter((id) => id);
        console.log("📚 [InstructorOverlay] Fetched instructor exams:", ids);
        setExamIds(ids);
      } catch (err) {
        console.warn(
          "⚠️ [InstructorOverlay] Failed to fetch exams:",
          err.message
        );
      }
    };

    fetchInstructorExams();
  }, []);

  // ===== Initialize WebSocket Connection =====
  useEffect(() => {
    // If we have exams list, use those. Otherwise wait for examId from route.
    const idsToJoin = examIds.length > 0 ? examIds : examId ? [examId] : [];

    if (idsToJoin.length === 0) {
      console.warn(
        "⚠️ [InstructorOverlay] No exams to join, skipping socket connection"
      );
      return;
    }

    console.log(
      `🔌 [InstructorOverlay] Connecting to WebSocket for exams:`,
      idsToJoin
    );

    // Kết nối tới WebSocket server
    // Nếu ở localhost:4000 (Vite dev), socket.io sẽ auto-proxy thông qua vite.config.js
    // Nếu ở production, dùng environment variable
    const socketUrl = import.meta.env.REACT_APP_API_URL
      ? import.meta.env.REACT_APP_API_URL
      : window.location.origin; // Auto-use current origin (localhost:4000 in dev)

    console.log(`🔗 [InstructorOverlay] Socket URL: ${socketUrl}`);

    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    // Khi kết nối thành công, join tất cả exam rooms
    socket.on("connect", () => {
      console.log("✅ [Instructor] Connected to WebSocket");
      idsToJoin.forEach((id) => {
        console.log(
          `📨 [Instructor] Emitting instructor:join-exam for exam ${id}`
        );
        socket.emit("instructor:join-exam", id);
      });
    });

    // ===== LISTEN FOR CHEATING EVENTS =====
    socket.on("cheating:detected", (data) => {
      console.log("🚨 [Instructor] Cheating detected:", data);

      // ✅ Phát âm thanh cảnh báo
      playAlarmSound();

      // ✅ Add to queue instead of replacing
      const newNotification = {
        id: data.submissionId,
        student_name: data.studentName,
        timestamp: data.detectedAt,
        details: data.eventDetails || {},
        cheating_count: data.cheatingCount,
        severity: data.severity,
        eventType: data.eventType,
        examId: data.examId,
        queueId: Date.now() + Math.random(), // Unique ID for queue item
      };

      setQueue((prev) => {
        const updated = [...prev, newNotification];
        // Sort by timestamp (oldest first - priority)
        updated.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        console.log(
          `📬 [Instructor] Queue updated. Total: ${updated.length} notifications`
        );
        return updated;
      });

      // If modal not showing, show first item from updated queue
      setShow((currentShow) => {
        if (!currentShow) {
          setEvent(newNotification);
          console.log(
            `🎯 [Instructor] Showing first notification (modal was hidden)`
          );
        } else {
          console.log(
            `📦 [Instructor] Notification queued (modal already showing). Will auto-advance in 10s`
          );
        }
        return true; // Always show modal
      });
    });

    // ===== Handle Disconnect =====
    socket.on("disconnect", () => {
      console.log("❌ [Instructor] Disconnected from WebSocket");
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [examIds, examId]);

  // ===== Play Alarm Sound =====
  const playAlarmSound = () => {
    // Tạo beep sound bằng Web Audio API
    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Cài đặt âm thanh: tần số cao, thời lượng ngắn, âm thanh lặp
      oscillator.frequency.value = 800; // Tần số cao (Hz)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      // Phát 3 tiếng beep
      for (let i = 1; i < 3; i++) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.3, audioContext.currentTime + i * 0.6);
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + i * 0.6 + 0.5
        );

        osc.start(audioContext.currentTime + i * 0.6);
        osc.stop(audioContext.currentTime + i * 0.6 + 0.5);
      }
    } catch (err) {
      console.log("⚠️ [Audio] Could not play alarm sound:", err.message);
    }
  };

  // ===== Format Event Type Display =====
  const getEventTypeDisplay = (eventType) => {
    const typeMap = {
      blocked_key: "Phím bị chặn",
      visibility_hidden: "Rời tab / ẩn cửa sổ",
      fullscreen_lost: "Thoát toàn màn hình",
      window_blur: "Rời cửa sổ",
      tab_switch: "Chuyển tab",
      alt_tab: "Alt + Tab",
      multiple_faces: "Phát hiện nhiều khuôn mặt",
      no_face_detected: "Không phát hiện khuôn mặt",
      copy_paste: "Copy / Paste",
    };
    return typeMap[eventType] || eventType;
  };

  // ===== Get detailed description of what student did =====
  const getDetailedDescription = (eventType, details = {}) => {
    const descriptions = {
      blocked_key: () => {
        const key = details.key || "F11";
        return `Sinh viên đã nhấn phím ${key} - cố gắng thoát fullscreen hoặc refresh trang`;
      },
      fullscreen_lost: () => {
        return `Sinh viên đã thoát chế độ toàn màn hình - có thể xem nội dung khác`;
      },
      visibility_hidden: () => {
        return `Sinh viên đã chuyển qua tab khác hoặc ẩn cửa sổ trình duyệt`;
      },
      window_blur: () => {
        return `Sinh viên đã click ra ngoài cửa sổ bài thi - mất tập trung`;
      },
      tab_switch: () => {
        return `Sinh viên đã chuyển tab trong trình duyệt`;
      },
      alt_tab: () => {
        return `Sinh viên đã sử dụng Alt+Tab để chuyển ứng dụng`;
      },
      copy_paste: () => {
        return `Sinh viên đã cố gắng copy/paste nội dung`;
      },
      multiple_faces: () => {
        return `Phát hiện nhiều khuôn mặt trong camera - có thể có người khác`;
      },
      no_face_detected: () => {
        return `Không phát hiện khuôn mặt sinh viên - có thể rời khỏi vị trí`;
      },
    };

    const descFunc = descriptions[eventType];
    return descFunc ? descFunc() : `Phát hiện vi phạm: ${eventType}`;
  };

  // ===== Format Severity Badge =====
  const getSeverityColor = (severity) => {
    if (severity === "high") return "bg-red-600";
    if (severity === "medium") return "bg-yellow-600";
    return "bg-orange-600";
  };

  // ===== Close current notification and show next in queue =====
  const handleCloseNotification = () => {
    setQueue((prev) => {
      const remaining = prev.filter((n) => n.queueId !== event?.queueId);

      if (remaining.length > 0) {
        // Show next notification (first in sorted queue)
        setEvent(remaining[0]);
        console.log(
          `📬 [Instructor] Showing next notification from queue. Remaining: ${remaining.length}`
        );
      } else {
        // No more notifications
        setShow(false);
        setEvent(null);
        console.log(`✅ [Instructor] All notifications cleared`);
      }

      return remaining;
    });
  };

  // ===== Auto-advance to next notification after 10 seconds (only if there's queue) =====
  useEffect(() => {
    if (!show || !event || queue.length <= 1) return;

    const timer = setTimeout(() => {
      console.log(
        `⏰ [Instructor] Auto-advancing to next notification after 10s`
      );
      handleCloseNotification();
    }, 10000);

    return () => clearTimeout(timer);
  }, [event, show, queue.length]);

  if (!show || !event) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden ">
        {/* Header - Red Alert Bar */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
          <div className="text-4xl">🚨</div>
          <h2 className="text-2xl font-bold text-white">CẢNH CÁO GIAN LẬN</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Student Name */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Sinh viên
            </p>
            <p className="text-xl font-bold text-slate-900">
              {event.student_name}
            </p>
          </div>

          {/* Violation Type */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Loại vi phạm
            </p>
            <p className="text-lg font-semibold text-red-700 mb-2">
              {getEventTypeDisplay(event.eventType)}
            </p>
            <p className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded border border-slate-100">
              📋 {getDetailedDescription(event.eventType, event.details)}
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Severity */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Mức độ
              </p>
              <div
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white font-bold text-sm ${getSeverityColor(
                  event.severity
                )}`}
              >
                {event.severity === "high"
                  ? "🔴 CAO"
                  : event.severity === "medium"
                  ? "🟡 TRUNG BÌNH"
                  : "🟠 THẤP"}
              </div>
            </div>

            {/* Violation Count */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Lần vi phạm
              </p>
              <p
                className={`text-lg font-bold ${
                  event.cheating_count >= 5 ? "text-red-600" : "text-orange-600"
                }`}
              >
                {event.cheating_count} / 5
              </p>
            </div>
          </div>

          {/* Timestamp */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Thời gian phát hiện
            </p>
            <p className="text-sm text-slate-700 font-mono">
              {new Date(event.timestamp).toLocaleString("vi-VN")}
            </p>
          </div>
        </div>

        {/* Warning Message - If auto-submit */}
        {event.cheating_count >= 5 && (
          <div className="bg-red-50 border-t border-red-200 px-6 py-4 flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <p className="text-red-800 font-semibold text-sm leading-relaxed">
              Sinh viên vượt quá giới hạn vi phạm (5/5). Bài thi sẽ được tự động
              nộp.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4">
          <button
            onClick={handleCloseNotification}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition duration-200 flex items-center justify-center gap-2"
          >
            ✓ Tiếp tục giám sát
            {queue.length > 1 && (
              <span className="ml-2 bg-blue-800 px-2 py-1 rounded text-xs">
                +{queue.length - 1}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
