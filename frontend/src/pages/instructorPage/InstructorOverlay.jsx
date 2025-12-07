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

  const playAlarmSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYJGGS56+efTgwOUKPh8LNiHAU2j9TwynosBSx+zPLaizsKFlm46+mjUhELTKXh8LVjHwU0kNXwynosBSx+zPHbi0ILFWa46umkVBQLTavp8Ldl5wU4ktXxzYQ1BzGB0/HbikMLFluz7emkUxMLTKjr8bhmIAU7lNnwyXo0BTuA0fLciUQNFl215+mjUhMLTKfq8LVl5gU6kdXwzIU1BTuA0PLbiUUNFl616umjUhMMSann8rZmIQU6ktbxzYYzBz2C1fLej0YOFmG37emjUhMLSqno8rZmIgU6ktbxy4U1BTuA0PLciUUNFly16+mjURMMSajm8rVmIgU6ktbxy4YzCDyB0/LdjkcNFl616+mjURMMSajm8bVmIQU6ktbxyoU1BTx/0fLciUUNFly16+mjURMMS6jo8rVmIwU5kdbxy4U1BTuA0fHbikUNFl+47OmjUxMMSqnn8rZnIgU7lNbxy4YzBzuB0/HaikYNFl6z6+ijUhMMSqnn8bVnIQU6ktXxyoU1BTx/0fHbiUUNFly06+ijUhMMSqno8rVnIwU5k9bxy4UzBzuB0/LajkYOFl216+ijUhMMSanm8bVmIgU7lNbxyoUzBzx/0fHbiUQOFlu06+mjUhMMSqnn87VnIwU5k9bxy4UzBzyA0vLbjkUOFl206+mjUhMMSanm8bVmIwU6k9bxyoU0Bzx+0PHaikQOFluz6+mjUhMLSqnn8rZnIgU7k9bxyoUzBzx/0fHaiUQOFlu06+mjUxMMSajm8rVnIQU6k9bwyoU0Bzx/0PHajkQOFluz6+mjUhMMSanm8rZnIgU7k9bxy4UzBzyA0/LajkUOFl206+mjUhMMSanm8rZnIgU6k9bxyoUzBzx/0fHaiUQOFlu06+mjUhMLSqnn8rZnIwU6k9bwyoU0Bzx/0fHaikQOFl206+mjUhMMSanm8bVnIgU7k9bxyoU0Bzt/0fHaikQOFl206+mjUhMLSajm8rZnIgU7k9bxy4UzBzx/0fLajkQOFly16+mjUhMLSajm8rZnIgU7k9bxy4UzBzx/0fLajkQOFl206+mjUhMLSajm8bVnIgU7k9bxy4UzBzx/0fLajkQOFl206+mjUhMLSajm8rZnIgU6k9bxy4UzBzx/0fHaikQOFl206+mjUhMLSajm8rZnIgU6k9bxyoU0Bzt+0fHaiUQOFl206+ijUhMLSajm8bVnIgU7k9bxy4UzBzx/0fHajkQOFl206+mjUhMLSajm8bVnIgU7k9bxy4UzBzx/0fHajkQOFly16+mjUhMLSajm8bVnIgU7k9bxy4UzBzx/0fHajkUOFly16+mjUhMLSajm8bVnIgU7k9bxy4UzBzx/0fHajkQOFly16+mjUhMLSajm8rZnIgU7k9bxy4UzBzx/0fHaikQOFl206+mjUhMLSajm8rZnIgU6k9bxy4UzBzx/0fHaikQOFl206+mjUhMLSajm8rZnIgU6k9bxyoUzBzx/0fHaikQOFl206+mjUhMLSajm8rZnIgU6k9bxyoU0Bzt/0fHaikQOFly16+mjUhMLSajm8rZnIgU6k9bxyoUzBzx/0fHajkQOFl206+mjUhMLSajm8rZnIgU6k9bxyoUzBzx/0fHajkQOFl206+mjUhMLSajm8rZnIgU6k9bxyoUzBzx/0fHajkQOFl206+mjUhMLSajm8rZnIgU6k9bxyoUzBzx/0fHajkQOFl206+mjUhMLSajm8rZnIgU6k9bxyoUzBzx/0fHajkQOFl206+mjUhMLSajm8rZnIgU6k9bxy4UzBzx/0fHaikUOFly16+mjUhMLSajm8rZnIgU6k9bxy4UzBzx/0fHaikUOFl206+mjUhMLSajm8rZnIgU6k9bxy4UzBzx/0fHajkUOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkUOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkUOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fLajkUOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fLajkUOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fLajkUOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fLajkUOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fLajkUOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fLajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fLajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fLajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fLajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkQOFly16+mjUhMLSajm8bVnIgU6k9bxy4UzBzx/0fHajkQO');
  
      let playCount = 0;
      const maxPlays = 12; 
      
      const playBeep = () => {
        if (playCount < maxPlays) {
          audio.currentTime = 0;
          audio.play().catch(e => console.log('Audio play failed:', e));
          playCount++;
          setTimeout(playBeep, 400); 
        }
      };
      
      playBeep();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const duration = 5; 
      const beepInterval = 0.4;
      const beepCount = Math.floor(duration / beepInterval);

      for (let i = 0; i < beepCount; i++) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.frequency.value = 600;
        gain.gain.setValueAtTime(0.5, audioContext.currentTime + i * beepInterval);
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + i * beepInterval + 0.3
        );

        osc.start(audioContext.currentTime + i * beepInterval);
        osc.stop(audioContext.currentTime + i * beepInterval + 0.3);
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
      fullscreen_exit_attempt: "Cố thoát fullscreen", // 🆕
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
        const stage = details.stage || "exam";
        return `Sinh viên đã nhấn phím ${key} ${stage === 'prepare' ? 'trong giai đoạn chuẩn bị' : ''} - cố gắng thoát fullscreen hoặc refresh trang`;
      },
      fullscreen_lost: () => {
        return `Sinh viên đã thoát chế độ toàn màn hình - có thể xem nội dung khác`;
      },
      fullscreen_exit_attempt: () => { // 🆕
        const stage = details.stage || "exam";
        return `Sinh viên cố gắng thoát fullscreen ${stage === 'prepare' ? 'trong PrepareExam' : 'trong TakeExam'} - Hệ thống đã tự động khôi phục`;
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
        <div className="bg-gradient-to-r from-red-700 to-red-700 px-6 py-4 flex items-center justify-center gap-3">
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
