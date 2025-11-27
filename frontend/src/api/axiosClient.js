import axios from "axios";

const axiosClient = axios.create({
  baseURL: "http://localhost:5000/api",
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      const data = error.response.data;
      if (data?.needVerifyRoom) {
        window.location.href = "/verify-room";
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
