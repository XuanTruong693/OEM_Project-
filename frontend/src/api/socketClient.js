// ===== Socket.IO Client Utilities =====
// Mục đích: Wrapper functions để dễ dàng quản lý WebSocket connections

import io from "socket.io-client";
import { SOCKET_URL } from "./config";

let socket = null;

/**
 * Kết nối tới WebSocket server
 */
export function connectSocket(url = null) {
  if (socket?.connected) {
    console.log("✅ [Socket] Already connected");
    return socket;
  }

  // Use provided URL, SOCKET_URL from config, or current window origin
  const serverUrl = url || SOCKET_URL || window.location.origin;
  console.log("🔌 [Socket] Connecting to:", serverUrl);

  socket = io(serverUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,  // Never stop trying to reconnect
    timeout: 60000,                  // Connection timeout 60s
    transports: ["websocket", "polling"],
    forceNew: false,
    autoConnect: true,
  });

  socket.on("connect", () => {
    console.log("✅ [Socket] Connected to server, ID:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ [Socket] Disconnected:", reason);
    // Auto reconnect if not intentional disconnect
    if (reason === "io server disconnect") {
      // Server disconnected us, try to reconnect
      socket.connect();
    }
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("🔄 [Socket] Reconnected after", attemptNumber, "attempts");
  });

  socket.on("reconnect_attempt", (attemptNumber) => {
    console.log("🔄 [Socket] Reconnecting... attempt", attemptNumber);
  });

  socket.on("reconnect_error", (err) => {
    console.warn("⚠️ [Socket] Reconnect error:", err.message);
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
