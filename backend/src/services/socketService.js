const socketIO = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { pubClient, subClient, getIsRedisEnabled } = require("../config/redis");

let io = null;

// State management with Redis fallback
// Local storage as backup
const localExamInstructors = new Map();
const localActiveSubmissions = new Map();
const localServerLogsHistory = [];
const MAX_LOGS_HISTORY = 100;

/**
 * Helper to get active submissions (Shared across instances if Redis enabled)
 */
async function getActiveSubmissions() {
  if (getIsRedisEnabled()) {
    try {
      const data = await pubClient.hgetall("oem:active_submissions");
      return Object.values(data).map(v => JSON.parse(v));
    } catch (err) {
      console.warn("⚠️ [SocketState] Redis hgetall failed:", err.message);
    }
  }
  return Array.from(localActiveSubmissions.values());
}

/**
 * Thêm log vào history và broadcast tới admin
 */
async function addServerLog(type, message) {
  const log = {
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    type,
    message,
    timestamp: new Date().toISOString(),
  };

  // 1. Persist log
  if (getIsRedisEnabled()) {
    try {
      await pubClient.lpush("oem:server_logs", JSON.stringify(log));
      await pubClient.ltrim("oem:server_logs", 0, MAX_LOGS_HISTORY - 1);
    } catch (err) {
      console.warn("⚠️ [SocketState] Redis lpush failed:", err.message);
    }
  }
  
  localServerLogsHistory.push(log);
  if (localServerLogsHistory.length > MAX_LOGS_HISTORY) localServerLogsHistory.shift();

  // 2. Broadcast
  if (io) io.to('admin:logs').emit('server:log', log);
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
        "http://oes.io.vn",
        "https://oes.io.vn",
        "http://www.oes.io.vn",
        "https://www.oes.io.vn",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 10000,
    upgradeTimeout: 30000,
    transports: ["websocket", "polling"],
  });

  // Attach Redis Adapter if enabled
  if (getIsRedisEnabled()) {
    io.adapter(createAdapter(pubClient, subClient));
    console.log("🔗 [Socket] Redis Adapter attached for cross-instance scaling");
  }

  io.on("connection", (socket) => {
    console.log(`✅ [Socket] New connection: ${socket.id}`);

    socket.on("instructor:join-exam", async (examId) => {
      // Support array of examIds for global monitoring (Overlay)
      if (Array.isArray(examId)) {
        examId.forEach(id => socket.join(`exam:${id}`));
        console.log(`📡 [Socket] Instructor joined multiple rooms: ${examId.join(', ')}`);
      } else {
        socket.join(`exam:${examId}`);
        socket.examId = examId;
        console.log(`📡 [Socket] Instructor joined room: ${examId}`);
      }

      // Send current submissions for this exam (if single ID)
      if (!Array.isArray(examId)) {
        const allSubmissions = await getActiveSubmissions();
        const examSubmissions = allSubmissions.filter(sub => sub.examId === parseInt(examId));
        socket.emit("instructor:active-submissions", examSubmissions);
      }
    });

    socket.on("admin:join-logs", async () => {
      socket.join('admin:logs');
      let history = localServerLogsHistory;
      if (getIsRedisEnabled()) {
        try {
          const redisLogs = await pubClient.lrange("oem:server_logs", 0, -1);
          history = redisLogs.map(l => JSON.parse(l)).reverse();
        } catch {}
      }
      socket.emit('server:logs-history', history);
    });

    socket.on("student:register-submission", async ({ submissionId, studentId, examId, studentName, attempt_no }) => {
      const subData = {
        submissionId: parseInt(submissionId),
        studentId: parseInt(studentId),
        examId: parseInt(examId),
        studentName,
        socketId: socket.id,
        attempt_no: parseInt(attempt_no) || 1
      };

      // Store in Redis & Local
      if (getIsRedisEnabled()) {
        await pubClient.hset("oem:active_submissions", submissionId, JSON.stringify(subData));
      }
      localActiveSubmissions.set(submissionId, subData);

      socket.join(`submission:${submissionId}`);
      io.to(`exam:${examId}`).emit("student:registered", subData);
    });

    socket.on("disconnect", async () => {
      // Cleanup active submissions
      for (const [subId, sub] of localActiveSubmissions.entries()) {
        if (sub.socketId === socket.id) {
          if (getIsRedisEnabled()) await pubClient.hdel("oem:active_submissions", subId);
          localActiveSubmissions.delete(subId);
          break;
        }
      }
    });
  });

  return io;
}

function broadcastCheatingEvent(examId, cheatingData) {
  if (!io) return;
  // Remove .volatile to ensure notifications are delivered even during brief connectivity jitter
  io.to(`exam:${examId}`).emit("cheating:detected", {
    ...cheatingData,
    detectedAt: new Date(cheatingData.detectedAt).toISOString(),
    timestamp: new Date().toISOString(),
    examId: parseInt(examId),
  });
}

async function broadcastSubmissionFinished(examId, submissionId, studentId) {
  if (!io) return;
  if (getIsRedisEnabled()) await pubClient.hdel("oem:active_submissions", submissionId);
  localActiveSubmissions.delete(submissionId);

  io.to(`exam:${examId}`).emit("student:submission-finished", {
    submissionId: parseInt(submissionId),
    studentId: parseInt(studentId),
    timestamp: new Date().toISOString(),
  });
}

async function sendToSubmission(submissionId, eventName, data) {
  if (!io) return false;
  io.to(`submission:${submissionId}`).emit(eventName, data);
  return true;
}

module.exports = {
  initializeSocket,
  broadcastCheatingEvent,
  broadcastSubmissionFinished,
  sendToSubmission,
  addServerLog,
  getIO: () => io,
};
