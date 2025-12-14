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

// ===== SERVER LOGS STREAMING =====
// Buffer để lưu logs gần đây (giữ 100 logs)
const serverLogsBuffer = [];
const MAX_LOGS_BUFFER = 100;

// Set để tracking admin subscribers
const adminLogSubscribers = new Set();

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Function để broadcast log tới tất cả admins
function broadcastServerLog(type, args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');

  // Filter sensitive data
  const filteredMessage = message
    .replace(/password['":\s]*['"]?[^'"\s,}]+['"]?/gi, 'password: [REDACTED]')
    .replace(/token['":\s]*['"]?[A-Za-z0-9._-]+['"]?/gi, 'token: [REDACTED]');

  const logEntry = {
    id: Date.now() + Math.random(),
    timestamp,
    type,
    message: filteredMessage
  };

  // Add to buffer
  serverLogsBuffer.push(logEntry);
  if (serverLogsBuffer.length > MAX_LOGS_BUFFER) {
    serverLogsBuffer.shift();
  }

  // Broadcast to all admin subscribers
  if (io && adminLogSubscribers.size > 0) {
    for (const socketId of adminLogSubscribers) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('server:log', logEntry);
      }
    }
  }
}

// Override console methods to capture logs
console.log = function (...args) {
  originalConsoleLog.apply(console, args);
  broadcastServerLog('info', args);
};

console.warn = function (...args) {
  originalConsoleWarn.apply(console, args);
  broadcastServerLog('warn', args);
};

console.error = function (...args) {
  originalConsoleError.apply(console, args);
  broadcastServerLog('error', args);
};

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
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
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

    // ===== ADMIN JOINS SERVER LOGS =====
    // Admin subscribe để nhận server logs real-time
    socket.on("admin:join-logs", () => {
      console.log(`🔍 [Socket] Admin ${socket.id} joined server logs`);
      adminLogSubscribers.add(socket.id);
      socket.isAdminLogSubscriber = true;

      // Gửi buffer logs hiện tại
      socket.emit('server:logs-history', serverLogsBuffer);
    });

    // Admin leaves server logs
    socket.on("admin:leave-logs", () => {
      console.log(`👋 [Socket] Admin ${socket.id} left server logs`);
      adminLogSubscribers.delete(socket.id);
      socket.isAdminLogSubscriber = false;
    });

    // ===== HANDLE DISCONNECT =====
    socket.on("disconnect", () => {
      console.log(`❌ [Socket] Disconnected: ${socket.id}`);

      // Xóa khỏi admin log subscribers
      if (socket.isAdminLogSubscriber) {
        adminLogSubscribers.delete(socket.id);
      }

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

  // Gửi event tới tất cả instructors trong room này
  io.to(`exam:${examId}`).emit("cheating:detected", {
    submissionId: parseInt(submissionId),
    studentId: parseInt(studentId),
    studentName,
    eventType,
    severity,
    detectedAt: new Date(detectedAt).toISOString(),
    eventDetails,
    cheatingCount: parseInt(cheatingCount) || 0,
    timestamp: new Date().toISOString(),
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
  getIO: () => io,
};
