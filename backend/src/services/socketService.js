// ===== Socket.IO Service - Quản lý WebSocket connections =====
// Mục đích: Broadcast real-time cheating notifications từ backend tới frontend giảng viên

const socketIO = require("socket.io");

let io = null;

// Map để tracking exam instructor connections
// examId -> Set of socket ids
const examInstructors = new Map();

// Map để tracking student submissions
// submissionId -> { studentId, examId, studentName, socketId }
const activeSubmissions = new Map();

// ===== SERVER LOGS =====
// Lưu trữ logs history để gửi khi admin connect
const serverLogsHistory = [];
const MAX_LOGS_HISTORY = 100;

/**
 * Thêm log vào history và broadcast tới admin
 */
function addServerLog(type, message) {
  const log = {
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    type, // 'info', 'warn', 'error'
    message,
    timestamp: new Date().toISOString(),
  };

  // Thêm vào history
  serverLogsHistory.push(log);
  if (serverLogsHistory.length > MAX_LOGS_HISTORY) {
    serverLogsHistory.shift(); // Xóa log cũ nhất
  }

  // Broadcast tới tất cả admin đang theo dõi
  if (io) {
    io.to('admin:logs').emit('server:log', log);
  }

  return log;
}

/**
 * Khởi tạo Socket.IO server
 */
function initializeSocket(httpServer) {
  io = socketIO(httpServer, {
    cors: {
      origin: [
        "http://localhost:4000",
        "http://127.0.0.1:4000",
        "http://localhost:5173",
        "http://oem.io.vn",
        "https://oem.io.vn",
        "http://www.oem.io.vn",
        "https://www.oem.io.vn",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Keep connection alive settings - optimized for real-time notifications
    pingTimeout: 20000,        // 20 seconds - faster disconnect detection
    pingInterval: 10000,       // 10 seconds - more frequent pings for reliability
    upgradeTimeout: 30000,     // 30 seconds for upgrade
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(`✅ [Socket] New connection: ${socket.id}`);

    // ===== INSTRUCTOR JOINS EXAM MONITORING =====
    // Giảng viên kết nối để giám sát bài thi
    socket.on("instructor:join-exam", (examId) => {
      if (!examInstructors.has(examId)) {
        examInstructors.set(examId, new Set());
      }
      examInstructors.get(examId).add(socket.id);

      socket.join(`exam:${examId}`);
      socket.examId = examId;

      // Gửi lại danh sách submissions hiện tại để hiển thị
      const submissions = Array.from(activeSubmissions.values())
        .filter((sub) => sub.examId === parseInt(examId))
        .map((sub) => ({
          submissionId: sub.submissionId,
          studentId: sub.studentId,
          studentName: sub.studentName,
          examId: sub.examId,
        }));

      socket.emit("instructor:active-submissions", submissions);
    });

    // ===== ADMIN JOINS SERVER LOGS MONITORING =====
    socket.on("admin:join-logs", () => {
      console.log(`📋 [Socket] Admin ${socket.id} joined server logs monitoring`);
      socket.join('admin:logs');
      // Gửi logs history
      socket.emit('server:logs-history', serverLogsHistory);
    });

    socket.on("admin:leave-logs", () => {
      console.log(`📋 [Socket] Admin ${socket.id} left server logs monitoring`);
      socket.leave('admin:logs');
    });

    // ===== STUDENT REGISTERS SUBMISSION =====
    // Sinh viên đăng ký submission khi bắt đầu thi
    socket.on(
      "student:register-submission",
      ({ submissionId, studentId, examId, studentName }) => {
        console.log(
          `🎓 [Socket] Student ${studentId} registered submission ${submissionId} for exam ${examId}`
        );

        activeSubmissions.set(submissionId, {
          submissionId: parseInt(submissionId),
          studentId: parseInt(studentId),
          examId: parseInt(examId),
          studentName,
          socketId: socket.id,
        });

        // Thông báo tới tất cả instructors của exam này
        io.to(`exam:${examId}`).emit("student:registered", {
          submissionId: parseInt(submissionId),
          studentId: parseInt(studentId),
          studentName,
        });
      }
    );

    // ===== HANDLE DISCONNECT =====
    socket.on("disconnect", () => {
      console.log(`❌ [Socket] Disconnected: ${socket.id}`);

      // Xóa khỏi exam instructors
      if (socket.examId) {
        const instructors = examInstructors.get(socket.examId);
        if (instructors) {
          instructors.delete(socket.id);
          if (instructors.size === 0) {
            examInstructors.delete(socket.examId);
          }
        }
      }

      // Xóa khỏi active submissions
      for (const [subId, sub] of activeSubmissions.entries()) {
        if (sub.socketId === socket.id) {
          activeSubmissions.delete(subId);
          break;
        }
      }
    });
  });

  return io;
}

/**
 * Broadcast cheating event tới tất cả instructors của exam đó
 */
function broadcastCheatingEvent(examId, cheatingData) {
  if (!io) {
    console.warn("⚠️ [Socket] Socket.IO not initialized");
    return;
  }

  const {
    submissionId,
    studentId,
    studentName,
    eventType,
    severity,
    detectedAt,
    eventDetails,
    cheatingCount,
  } = cheatingData;

  console.log(
    `🚨 [Socket] Broadcasting cheating event: Student ${studentId} (${studentName}) - ${eventType} - Severity: ${severity}`
  );

  // Use volatile emit for faster delivery (will drop if client not ready)
  // Also emit to all connected sockets in the room immediately
  io.to(`exam:${examId}`).volatile.emit("cheating:detected", {
    submissionId: parseInt(submissionId),
    studentId: parseInt(studentId),
    studentName,
    eventType,
    severity,
    detectedAt: new Date(detectedAt).toISOString(),
    eventDetails,
    cheatingCount: parseInt(cheatingCount) || 0,
    timestamp: new Date().toISOString(),
    examId: parseInt(examId), // Include examId for filtering
  });
}

/**
 * Broadcast student submission finished
 */
function broadcastSubmissionFinished(examId, submissionId, studentId) {
  if (!io) return;

  activeSubmissions.delete(submissionId);

  io.to(`exam:${examId}`).emit("student:submission-finished", {
    submissionId: parseInt(submissionId),
    studentId: parseInt(studentId),
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  initializeSocket,
  broadcastCheatingEvent,
  broadcastSubmissionFinished,
  addServerLog,
  getIO: () => io,
};
