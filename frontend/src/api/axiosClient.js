import axios from "axios";
import { API_BASE_URL } from "./config";

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
});

// Flag to prevent multiple refresh requests
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors
    if (error.response?.status === 401) {
      const data = error.response.data;

      // Token expired - try to refresh
      if (data?.tokenExpired && !originalRequest._retry) {
        if (isRefreshing) {
          // Wait for the other refresh request to complete
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosClient(originalRequest);
          }).catch(err => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = localStorage.getItem("refreshToken");
          if (!refreshToken) {
            throw new Error("No refresh token");
          }

          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const newToken = res.data.accessToken;
          localStorage.setItem("token", newToken);

          processQueue(null, newToken);
          isRefreshing = false;

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          console.log("🔄 [Auth] Token refreshed successfully");
          return axiosClient(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          isRefreshing = false;

          // Refresh failed - clear tokens and redirect to login
          console.log("❌ [Auth] Refresh failed, logging out");
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");

          // Only redirect if not already on login page
          if (!window.location.pathname.includes("/login") &&
            !window.location.pathname.includes("/register")) {
            window.location.href = "/";
          }
          return Promise.reject(refreshError);
        }
      }

      // Token revoked (logout from another device)
      if (data?.tokenRevoked) {
        console.log("🚫 [Auth] Token revoked, logging out");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.href = "/";
        return Promise.reject(error);
      }
    }

    // Handle 403 errors (existing logic)
    if (error.response?.status === 403) {
      const data = error.response.data;
      if (data?.needVerifyRoom) {
        return Promise.reject(error);
      }

      if (data?.requireFaceCheck || data?.requireCardCheck) {
        const examId = data.exam_id;
        const submissionId = data.submission_id;
        if (submissionId && examId) {
          window.location.href = `/exam/${examId}/prepare?submission_id=${submissionId}`;
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;

