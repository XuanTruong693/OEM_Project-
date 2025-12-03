// ===== Socket.IO Client Utilities =====
// Mục đích: Wrapper functions để dễ dàng quản lý WebSocket connections

import io from "socket.io-client";

let socket = null;

/**
 * Kết nối tới WebSocket server
 */
export function connectSocket(url = null) {
  if (socket?.connected) {
    console.log("✅ [Socket] Already connected");
    return socket;
  }

  const serverUrl =
    url || process.env.REACT_APP_API_URL || "http://localhost:5000";

  socket = io(serverUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("✅ [Socket] Connected to server");
  });

  socket.on("disconnect", () => {
    console.log("❌ [Socket] Disconnected from server");
  });

  socket.on("error", (err) => {
    console.error("❌ [Socket] Error:", err);
  });

  return socket;
}

/**
 * Lấy socket instance
 */
export function getSocket() {
  return socket;
}

/**
 * Ngắt kết nối
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Emit event với Promise-based callback
 */
export function emitEvent(eventName, data = {}) {
  return new Promise((resolve, reject) => {
    try {
      if (!socket?.connected) {
        reject(new Error("Socket not connected"));
        return;
      }
      socket.emit(eventName, data, (response) => {
        resolve(response);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Listen event
 */
export function onEvent(eventName, callback) {
  if (!socket) {
    console.warn("⚠️ [Socket] Socket not initialized");
    return;
  }
  socket.on(eventName, callback);

  // Return unsubscribe function
  return () => {
    if (socket) {
      socket.off(eventName, callback);
    }
  };
}

export default {
  connectSocket,
  getSocket,
  disconnectSocket,
  emitEvent,
  onEvent,
};
