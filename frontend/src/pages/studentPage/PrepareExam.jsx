import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";

export default function PrepareExam() {
  const { examId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(
    () => localStorage.getItem("examTheme") || "dark"
  );
  const [faceOk, setFaceOk] = useState(false);
  const [cardOk, setCardOk] = useState(false);
  const [monitorOk, setMonitorOk] = useState(false);
  const [reqs, setReqs] = useState({
    face: false,
    card: false,
    monitor: false,
  });
  const [examInfo, setExamInfo] = useState(null);
  const [faceErr, setFaceErr] = useState("");
  const [cardErr, setCardErr] = useState("");

  //Multiple screen detection
  const [multiScreenDetected, setMultiScreenDetected] = useState(false);
  const [screenCount, setScreenCount] = useState(1);
  const [monitorWarning, setMonitorWarning] = useState("");
  const [showMultiScreenModal, setShowMultiScreenModal] = useState(false);
  const fullscreenLockRef = useRef(false);
  // Live guide + preview states
  const [faceGuideOk, setFaceGuideOk] = useState(false);
  const [faceGuideMsg, setFaceGuideMsg] = useState(
    "Hãy căn khuôn mặt vào khung và nhìn thẳng"
  );
  const [facePreviewUrl, setFacePreviewUrl] = useState("");
  const [cardPreviewUrl, setCardPreviewUrl] = useState("");

  // Verification logs
  const [cardVerifyLog, setCardVerifyLog] = useState("");
  const [faceVerifyLog, setFaceVerifyLog] = useState("");
  const [compareLog, setCompareLog] = useState("");
  const [isVerifyingCard, setIsVerifyingCard] = useState(false);
  const [isVerifyingFace, setIsVerifyingFace] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Upload status
  const [cardUploaded, setCardUploaded] = useState(false);
  const [faceUploaded, setFaceUploaded] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);
  const [cardVerified, setCardVerified] = useState(false);
  const [facesCompared, setFacesCompared] = useState(false);

  // Success message for final upload
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState("");

  const submissionId = search.get("submission_id");
  const duration = Number(
    sessionStorage.getItem("pending_exam_duration") || "60"
  );

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceApiRef = useRef({ loaded: false, loading: false });
  const guideIntervalRef = useRef(null);
  const offCanvasRef = useRef(null);
  const facePreviewBlobRef = useRef(null);
  const cardBlobRef = useRef(null); // Lưu blob thẻ SV
  const stableOkCountRef = useRef(0);
  const prevFacePositionRef = useRef(null); // Lưu vị trí khuôn mặt trước đó
  const eyesOpenCountRef = useRef(0); // Đếm số lần mắt mở liên tiếp
  const isVerifyingRef = useRef(false); // Tránh verify nhiều lần
  const violationTimerRef = useRef(null); // Timer cho violation cleanup

  const loadFaceApi = async () => {
    if (faceApiRef.current.loaded) return true;
    if (faceApiRef.current.loading) {
      // wait until loaded
      return new Promise((resolve) => {
        const i = setInterval(() => {
          if (faceApiRef.current.loaded) {
            clearInterval(i);
            resolve(true);
          }
        }, 100);
      });
    }
    faceApiRef.current.loading = true;
    const scriptUrl =
      "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js";
    const modelBase =
      "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = scriptUrl;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    if (!window.faceapi) {
      faceApiRef.current.loading = false;
      return false;
    }
    try {
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(modelBase);
      await window.faceapi.nets.faceLandmark68Net.loadFromUri(modelBase);
      faceApiRef.current.loaded = true;
      return true;
    } catch {
      faceApiRef.current.loading = false;
      return false;
    }
  };

  // Theme
  useEffect(() => {
    try {
      localStorage.setItem("examTheme", theme);
    } catch {}
    if (theme === "light") document.documentElement.classList.remove("dark");
    else document.documentElement.classList.add("dark");
  }, [theme]);

  useEffect(() => {
    if (!submissionId || !examId || isVerifyingRef.current) return;
    isVerifyingRef.current = true;

    (async () => {
      try {
        // Gọi API yêu cầu verify room - nếu chưa verify sẽ bị 403
        await axiosClient.get(`/exams/${examId}/public-info`);
        // OK - đã verify room, không làm gì
      } catch (error) {
        if (
          error?.response?.status === 403 &&
          error?.response?.data?.needVerifyRoom
        ) {
          navigate("/verify-room", { replace: true });
        }
      }
    })();
  }, [examId, submissionId, navigate]);

  // Load flags & auto-join if thiếu submissionId
  useEffect(() => {
    try {
      const s = sessionStorage.getItem("exam_flags");
      if (s) setReqs(JSON.parse(s));
    } catch {}

    if (!submissionId) {
      const roomToken = sessionStorage.getItem("room_token");
      if (!roomToken) {
        navigate("/verify-room");
        return;
      }
      (async () => {
        try {
          const res = await axiosClient.post("/exams/join", {
            room_token: roomToken,
          });
          const sid = res.data?.submission_id;
          try {
            sessionStorage.setItem(
              "exam_flags",
              JSON.stringify(res.data?.flags || {})
            );
          } catch {}
          if (sid) {
            navigate(`/exam/${res.data.exam_id}/prepare?submission_id=${sid}`, {
              replace: true,
            });
          }
        } catch {
          navigate("/verify-room");
        }
      })();
    }
  }, [submissionId, navigate]);

  // Load exam public info + submission verification status
  useEffect(() => {
    if (!submissionId || !examId) return;

    (async () => {
      try {
        // Load exam info
        const examRes = await axiosClient.get(`/exams/${examId}/public-info`);
        setExamInfo(examRes.data);

        // Load requirements từ exam API thay vì sessionStorage
        const examReqs = {
          face: !!examRes.data?.require_face_check,
          card: !!examRes.data?.require_student_card,
          monitor: !!examRes.data?.monitor_screen,
        };
        setReqs(examReqs);
        sessionStorage.setItem("exam_flags", JSON.stringify(examReqs));

        // Load submission verification status
        const subRes = await axiosClient.get(
          `/submissions/${submissionId}/status`
        );
        if (subRes.data) {
          if (subRes.data.face_image_url || subRes.data.face_verified) {
            setFaceOk(true);
            setFaceErr("");
          }
          if (subRes.data.student_card_url || subRes.data.card_verified) {
            setCardOk(true);
            setCardErr("");
          }
        }
      } catch (error) {}
    })();
  }, [examId, submissionId]);

  // 🆕 Fullscreen lock - Tự động trở lại fullscreen khi thoát
  useEffect(() => {
    if (!monitorOk || !fullscreenLockRef.current) return;

    const handleFullscreenChange = async () => {
      // Nếu thoát fullscreen (document.fullscreenElement === null)
      if (!document.fullscreenElement && fullscreenLockRef.current) {
        console.warn(
          "⚠️ [Fullscreen Lock] User exited fullscreen - forcing re-entry"
        );
        setMonitorWarning(
          "⚠️ CẢNH BÁO: Bạn đã thoát toàn màn hình! Hệ thống tự động khôi phục..."
        );

        // Tự động quay lại fullscreen sau 500ms
        setTimeout(async () => {
          try {
            if (document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen();
              setMonitorWarning(""); // Xóa warning khi đã quay lại
              console.log(
                "✅ [Fullscreen Lock] Re-entered fullscreen automatically"
              );
            }
          } catch (err) {
            console.error("❌ [Fullscreen Lock] Failed to re-enter:", err);
            setMonitorWarning(
              '❌ Không thể khôi phục toàn màn hình. Vui lòng nhấn lại nút "Bật toàn màn hình".'
            );
            setTimeout(() => setMonitorWarning(""), 3000);
            setMonitorOk(false);
            fullscreenLockRef.current = false;
          }
        }, 500);
      }
    };

    const handleKeyDown = (e) => {
      if (!fullscreenLockRef.current) return;

      // 🆕 Danh sách TẤT CẢ phím bị chặn khi fullscreen locked
      const blockedKeys = [
        "Escape", // Thoát fullscreen
        "F11", // Toggle fullscreen
        "F5", // Refresh
        "F3", // Search
        "F12", // DevTools
        "Tab", // Switch focus (nếu kết hợp Alt)
        "F4", // Close window (nếu kết hợp Alt)
      ];

      // Kiểm tra phím đơn
      const isBlockedKey = blockedKeys.includes(e.key);

      // Kiểm tra tổ hợp phím
      const isAltTab = e.altKey && e.key === "Tab";
      const isAltF4 = e.altKey && e.key === "F4";
      const isCtrlW = e.ctrlKey && (e.key === "w" || e.key === "W");
      const isCtrlR = e.ctrlKey && (e.key === "r" || e.key === "R");
      const isCtrlShiftI =
        e.ctrlKey && e.shiftKey && (e.key === "i" || e.key === "I"); // DevTools
      const isCtrlShiftJ =
        e.ctrlKey && e.shiftKey && (e.key === "j" || e.key === "J"); // Console
      const isCtrlShiftC =
        e.ctrlKey && e.shiftKey && (e.key === "c" || e.key === "C"); // Inspect
      const isCtrlU = e.ctrlKey && (e.key === "u" || e.key === "U"); // View source
      const isCmdOption = e.metaKey && e.altKey; // Mac: Command+Option combinations

      const isDangerousCombination =
        isAltTab ||
        isAltF4 ||
        isCtrlW ||
        isCtrlR ||
        isCtrlShiftI ||
        isCtrlShiftJ ||
        isCtrlShiftC ||
        isCtrlU ||
        isCmdOption;

      // Nếu là phím nguy hiểm hoặc tổ hợp nguy hiểm
      if (isBlockedKey || isDangerousCombination) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); // Ngăn tất cả listeners khác

        // Xác định loại vi phạm
        let keyDescription = e.key;
        if (isAltTab) keyDescription = "Alt+Tab";
        else if (isAltF4) keyDescription = "Alt+F4";
        else if (isCtrlW) keyDescription = "Ctrl+W";
        else if (isCtrlR) keyDescription = "Ctrl+R";
        else if (isCtrlShiftI) keyDescription = "Ctrl+Shift+I";
        else if (isCtrlShiftJ) keyDescription = "Ctrl+Shift+J";
        else if (isCtrlShiftC) keyDescription = "Ctrl+Shift+C";
        else if (isCtrlU) keyDescription = "Ctrl+U";

        setMonitorWarning(`🚫 Phím "${keyDescription}" bị chặn!`);
        setTimeout(() => setMonitorWarning(""), 3000);

        // 🆕 Tự động khôi phục fullscreen nếu bị thoát
        setTimeout(async () => {
          if (!document.fullscreenElement && fullscreenLockRef.current) {
            try {
              await document.documentElement.requestFullscreen();
              console.log(
                "✅ [Auto Recovery] Re-entered fullscreen after blocked key"
              );
            } catch (err) {
              console.error("❌ [Auto Recovery] Failed:", err);
            }
          }
        }, 300);

        console.warn(`⚠️ [Fullscreen Lock] Blocked key: ${keyDescription}`);
        return false; // Extra safety
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown, true); // Capture phase để bắt trước
    window.addEventListener("keyup", handleKeyDown, true); // Bắt cả keyup để chắc chắn

    // 🆕 Chặn right-click menu khi fullscreen locked
    const handleContextMenu = (e) => {
      if (fullscreenLockRef.current) {
        e.preventDefault();
        setMonitorWarning("🚫 Không được phép mở menu chuột phải!");
        setTimeout(() => setMonitorWarning(""), 3000);
      }
    };

    // 🆕 Chặn print screen
    const handleBeforePrint = (e) => {
      if (fullscreenLockRef.current) {
        e.preventDefault();
        setMonitorWarning("🚫 Không được phép in màn hình!");
        setTimeout(() => setMonitorWarning(""), 3000);
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("beforeprint", handleBeforePrint);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyDown, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("beforeprint", handleBeforePrint);

      // 🆕 Cleanup violation timer
      if (violationTimerRef.current) {
        clearTimeout(violationTimerRef.current);
      }
    };
  }, [monitorOk, submissionId]);

  // Chặn một số phím (chỉ để bảo vệ UI, không tính vi phạm)
  // VI PHẠM CHỈ ĐƯỢC TÍNH TRONG TakeExam, KHÔNG PHẢI PrepareExam
  useEffect(() => {
    const onKey = (e) => {
      const blockKeys = ["Escape", "F11"];
      if (blockKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", onKey, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [submissionId]);

  // Helper: Lưu blob vào localStorage (chuyển thành base64)
  const saveBlobToLocal = (blob, key) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          localStorage.setItem(key, reader.result);
          resolve(true);
        } catch (e) {
          console.error("LocalStorage full:", e);
          resolve(false);
        }
      };
      reader.readAsDataURL(blob);
    });
  };

  // Helper: Lấy blob từ localStorage
  const getBlobFromLocal = async (key) => {
    const dataUrl = localStorage.getItem(key);
    if (!dataUrl) return null;

    const res = await fetch(dataUrl);
    return await res.blob();
  };

  // Upload helpers - LƯU VÀO LOCALSTORAGE thay vì DB
  const handleUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (type === "card") {
        cardBlobRef.current = file;
        const preview = URL.createObjectURL(file);
        setCardPreviewUrl(preview);

        // Lưu vào localStorage
        await saveBlobToLocal(file, `exam_${submissionId}_card`);

        setCardUploaded(true);
        setCardErr("");
        console.log("[Upload] ✅ Ảnh thẻ SV đã lưu vào localStorage");
      }
    } catch (err) {
      const errorMsg = "Lỗi lưu ảnh";
      if (type === "face") setFaceErr(errorMsg);
      if (type === "card") setCardErr(errorMsg);
    }
  };

  // Bật fullscreen với kiểm tra nhiều màn hình
  const enableMonitor = async () => {
    try {
      // 🆕 Kiểm tra số lượng màn hình
      const screens = window.screen;
      const hasMultipleScreens =
        screens.isExtended ||
        (window.screenLeft !== 0 && window.screenTop !== 0);

      // Sử dụng Screen Detection API nếu có
      let detectedScreenCount = 1;
      if ("getScreenDetails" in window) {
        try {
          const screenDetails = await window.getScreenDetails();
          detectedScreenCount = screenDetails.screens?.length || 1;
        } catch (err) {
          // Fallback: Ước tính dựa vào window position
          const windowOutsidePrimary =
            window.screenLeft < 0 || window.screenLeft > window.screen.width;
          detectedScreenCount = windowOutsidePrimary ? 2 : 1;
        }
      } else {
        // Fallback detection method
        const windowOutsidePrimary =
          window.screenLeft < 0 || window.screenLeft > window.screen.width;
        detectedScreenCount = windowOutsidePrimary ? 2 : 1;
      }

      setScreenCount(detectedScreenCount);

      // ⚠️ Nếu phát hiện nhiều màn hình
      if (detectedScreenCount > 1) {
        setMultiScreenDetected(true);
        setMonitorWarning(
          `⚠️ Phát hiện ${detectedScreenCount} màn hình! Vui lòng TẮT màn hình phụ và CHỈ SỬ DỤNG 1 màn hình chính để thi. Sau khi tắt, nhấn lại "Bật toàn màn hình".`
        );
        setMonitorOk(false);

        // 🆕 Hiển thị modal thay vì alert
        setShowMultiScreenModal(true);
        return;
      }

      // ✅ Chỉ có 1 màn hình - cho phép bật fullscreen
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }

      setMonitorOk(true);
      setMultiScreenDetected(false);
      setMonitorWarning("");
      fullscreenLockRef.current = true; // 🔒 Kích hoạt khóa fullscreen

      console.log(
        "✅ [Monitor] Fullscreen enabled with lock - single screen confirmed"
      );
    } catch (err) {
      console.error("❌ [Monitor] Fullscreen error:", err);
      setMonitorOk(false);
      setMonitorWarning("❌ Không thể bật toàn màn hình. Vui lòng thử lại.");
    }
  };

  // Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // Reset stable count để bắt đầu đếm lại
      stableOkCountRef.current = 0;

      // Warmup face detection for live guide
      if (!("FaceDetector" in window)) {
        await loadFaceApi();
      }
      // Prepare offscreen canvas for faster detection
      if (!offCanvasRef.current) {
        const c = document.createElement("canvas");
        c.width = 480;
        c.height = 360; // small size for speed
        offCanvasRef.current = c;
      }
      // Start live guidance loop
      clearInterval(guideIntervalRef.current);
      guideIntervalRef.current = setInterval(async () => {
        try {
          const v = videoRef.current;
          const c = offCanvasRef.current;
          if (!v || !c) return;
          c.width = v.videoWidth || 640;
          c.height = v.videoHeight || 480;
          const g = c.getContext("2d");
          g.drawImage(v, 0, 0, c.width, c.height);

          let ok = false;
          let msg = "";
          const center = { x: c.width / 2, y: c.height / 2 };
          const needCenterTol = 0.25; // Nới lỏng: cho phép lệch 25% từ tâm
          const needSizeMin = 0.08; // Nới lỏng: khuôn mặt tối thiểu 8% khung

          if ("FaceDetector" in window) {
            const detector = new window.FaceDetector({ fastMode: true });
            const faces = await detector.detect(c);
            if (faces && faces.length === 1) {
              const box = faces[0].boundingBox;
              const cx = box.x + box.width / 2;
              const cy = box.y + box.height / 2;
              const dx = Math.abs(cx - center.x) / c.width;
              const dy = Math.abs(cy - center.y) / c.height;
              const sizeRatio = Math.max(
                box.width / c.width,
                box.height / c.height
              );
              ok =
                dx <= needCenterTol &&
                dy <= needCenterTol &&
                sizeRatio >= needSizeMin;
              msg = ok
                ? "Giữ nguyên 1 giây để hệ thống chụp"
                : "Di chuyển khuôn mặt vào giữa, tiến gần hơn";

              // Debug log
              if (!ok) {
                console.log(
                  `[Face Guide] dx=${(dx * 100).toFixed(1)}% (max ${
                    needCenterTol * 100
                  }%), dy=${(dy * 100).toFixed(1)}%, size=${(
                    sizeRatio * 100
                  ).toFixed(1)}% (min ${needSizeMin * 100}%)`
                );
              }
            } else if (faces && faces.length > 1) {
              ok = false;
              msg = "Phát hiện nhiều khuôn mặt - chỉ 1 người";
            } else {
              ok = false;
              msg = "Không nhìn thấy rõ khuôn mặt";
            }
          } else if (window.faceapi && faceApiRef.current.loaded) {
            const detections = await window.faceapi
              .detectAllFaces(
                c,
                new window.faceapi.TinyFaceDetectorOptions({
                  scoreThreshold: 0.3,
                })
              )
              .withFaceLandmarks();

            if (detections && detections.length === 1) {
              const det = detections[0];
              const box = det.detection.box;
              const landmarks = det.landmarks;

              const cx = box.x + box.width / 2;
              const cy = box.y + box.height / 2;
              const dx = Math.abs(cx - center.x) / c.width;
              const dy = Math.abs(cy - center.y) / c.height;
              const sizeRatio = Math.max(
                box.width / c.width,
                box.height / c.height
              );

              // 1. Kiểm tra vị trí và kích thước
              const positionOk =
                dx <= needCenterTol &&
                dy <= needCenterTol &&
                sizeRatio >= needSizeMin;

              // 2. Kiểm tra mắt mở (qua landmarks) - nới lỏng hơn
              const leftEye = landmarks.getLeftEye();
              const rightEye = landmarks.getRightEye();
              const leftEyeHeight = Math.abs(leftEye[1].y - leftEye[5].y);
              const rightEyeHeight = Math.abs(rightEye[1].y - rightEye[5].y);
              const eyesOpen = leftEyeHeight > 2 && rightEyeHeight > 2;

              // 3. Kiểm tra nhìn thẳng (không nghiêng đầu nhiều) - nới lỏng hơn
              const nose = landmarks.getNose();
              const jawline = landmarks.getJawOutline();
              const faceAngle = Math.abs(
                (nose[0].x - jawline[8].x) / box.width
              );
              const lookingStraight = faceAngle < 0.2;

              // 4. Kiểm tra giữ im (so sánh với vị trí trước)
              let notMoving = true;
              if (prevFacePositionRef.current) {
                const prev = prevFacePositionRef.current;
                const movementX = Math.abs(cx - prev.cx) / c.width;
                const movementY = Math.abs(cy - prev.cy) / c.height;
                notMoving = movementX < 0.03 && movementY < 0.03; // Tăng từ 0.02 lên 0.03 (3%)
              }
              prevFacePositionRef.current = { cx, cy };

              // Kết hợp tất cả điều kiện
              ok = positionOk && eyesOpen && lookingStraight && notMoving;

              // Thông báo cụ thể
              if (!positionOk) {
                msg = "Căn giữa, tiến gần hơn";
              } else if (!eyesOpen) {
                msg = "Vui lòng mở mắt";
              } else if (!lookingStraight) {
                msg = "Nhìn thẳng vào camera";
              } else if (!notMoving) {
                msg = "Giữ đầu đứng yên";
              } else {
                msg = "Giữ nguyên 1 giây để hệ thống chụp";
              }

              // Debug log
              if (!ok) {
                console.log(
                  `[Face Guide] pos=${positionOk}, eyes=${eyesOpen} (L:${leftEyeHeight.toFixed(
                    1
                  )}, R:${rightEyeHeight.toFixed(
                    1
                  )}), straight=${lookingStraight} (angle:${(
                    faceAngle * 100
                  ).toFixed(1)}%), still=${notMoving}`
                );
              } else {
                console.log(
                  `[Face OK] ✅ Tất cả điều kiện đạt, count=${stableOkCountRef.current}/3`
                );
              }
            } else if (detections && detections.length > 1) {
              ok = false;
              msg = "Phát hiện nhiều khuôn mặt - chỉ 1 người";
              prevFacePositionRef.current = null;
            } else {
              ok = false;
              msg = "Không nhìn thấy rõ khuôn mặt";
              prevFacePositionRef.current = null;
            }
          }
          setFaceGuideOk(ok);
          setFaceGuideMsg(
            msg || (ok ? "Sẵn sàng chụp" : "Căn giữa, nhìn thẳng vào camera")
          );

          // TỰ ĐỘNG CHỤP khi giữ ổn định 1 giây (vòng xanh)
          if (ok && !facePreviewUrl) {
            stableOkCountRef.current += 1;
            if (stableOkCountRef.current >= 3) {
              const snap = document.createElement("canvas");
              snap.width = v.videoWidth || 640;
              snap.height = v.videoHeight || 480;
              const sctx = snap.getContext("2d");
              if (!sctx) return;
              sctx.drawImage(v, 0, 0);
              snap.toBlob(
                async (blob) => {
                  if (!blob) return;
                  facePreviewBlobRef.current = blob;
                  setFacePreviewUrl(URL.createObjectURL(blob));
                  stableOkCountRef.current = 0;

                  // Lưu vào localStorage
                  await saveBlobToLocal(blob, `exam_${submissionId}_face`);

                  console.log(
                    "[Auto Capture] ✅ Đã chụp và lưu vào localStorage"
                  );
                  // Dừng camera sau khi chụp
                  try {
                    streamRef.current?.getTracks()?.forEach((t) => t.stop());
                  } catch {}
                  clearInterval(guideIntervalRef.current);
                },
                "image/jpeg",
                0.9
              );
            }
          } else if (!ok) {
            stableOkCountRef.current = 0;
            prevFacePositionRef.current = null;
          }
        } catch {}
      }, 450);
    } catch {
      alert("Không thể bật camera. Vui lòng cấp quyền hoặc thử lại.");
    }
  };
  const captureFace = async () => {
    if (!videoRef.current) return;
    const snap = document.createElement("canvas");
    snap.width = videoRef.current.videoWidth || 640;
    snap.height = videoRef.current.videoHeight || 480;
    const sctx = snap.getContext("2d");
    sctx.drawImage(videoRef.current, 0, 0, snap.width, snap.height);
    snap.toBlob(
      (blob) => {
        if (!blob) return;
        facePreviewBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setFacePreviewUrl(url);
      },
      "image/jpeg",
      0.9
    );
  };

  const uploadFacePreview = async () => {
    if (!facePreviewBlobRef.current || !submissionId) return;
    try {
      const form = new FormData();
      form.append("face_image", facePreviewBlobRef.current, "face.jpg");
      const res = await axiosClient.post(
        `/submissions/${submissionId}/upload-images`,
        form
      );

      if (res?.data?.ok && res.data.face_uploaded) {
        setFacePreviewUrl(res.data.face_preview);
        setFaceUploaded(true);
        setFaceErr("");
        console.log("[Upload] ✅ Ảnh khuôn mặt đã upload");

        // Dừng camera sau khi upload thành công
        try {
          streamRef.current?.getTracks()?.forEach((t) => t.stop());
        } catch {}
        clearInterval(guideIntervalRef.current);
      } else {
        setFaceErr("Không thể upload ảnh");
      }
    } catch (e) {
      const errorMsg = e?.response?.data?.message || "Lỗi upload";
      setFaceErr(errorMsg);
    }
  };

  // Verify thẻ sinh viên (gửi blob từ localStorage)
  const verifyCard = async () => {
    if (!cardUploaded || !submissionId || !cardBlobRef.current) return;
    setIsVerifyingCard(true);
    setOcrProgress(0);
    setCardVerifyLog("⏳ Đang xác minh thẻ sinh viên...");

    // Fake progress
    const progressInterval = setInterval(() => {
      setOcrProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 300);

    try {
      // Upload tạm để verify OCR
      const form = new FormData();
      form.append("student_card_image", cardBlobRef.current);
      const uploadRes = await axiosClient.post(
        `/submissions/${submissionId}/upload-images`,
        form
      );

      if (!uploadRes?.data?.ok) {
        throw new Error("Không thể upload ảnh để verify");
      }

      // Gọi API verify
      const res = await axiosClient.post(
        `/submissions/${submissionId}/verify-card`
      );
      clearInterval(progressInterval);
      setOcrProgress(100);

      if (res?.data?.ok && res.data.valid) {
        setCardVerified(true);
        setCardOk(true);
        setCardErr("");

        // Debug: Log toàn bộ response
        console.log("[Card Verify] Full Response:", res.data);

        const details = res.data.details || {};
        const cccd = details.cccd || ""; // CCCD riêng (12 số)
        const studentId = details.student_id || ""; // MSSV riêng (9-11 số)
        const primaryId = res.data.mssv || details.mssv || ""; // Mã định danh chính
        const fields = details.fields_matched || [];
        const fieldsText = fields.map((f) => `  • ${f}`).join("\n");

        console.log("[Card Verify] CCCD:", cccd);
        console.log("[Card Verify] Student ID:", studentId);
        console.log("[Card Verify] Primary ID:", primaryId);

        // Xây dựng text hiển thị
        let displayText = `✅ Thẻ SV hợp lệ!`;

        // Ưu tiên hiển thị CCCD nếu có (12 số)
        if (cccd) {
          displayText += `\n\nCCCD: ${cccd}`;
          console.log("[Card Verify] ✅ Hiển thị CCCD:", cccd);
        }

        // Hiển thị MSSV nếu có (9-11 số) và khác với CCCD
        if (studentId && studentId !== cccd) {
          displayText += `\n\nMSSV: ${studentId}`;
          console.log("[Card Verify] ✅ Hiển thị MSSV:", studentId);
        }

        displayText += `\n\nTrường phát hiện:\n${fieldsText}`;

        setCardVerifyLog(displayText);
        console.log("[Card Verify] Fields matched:", fields);
      } else {
        setCardVerified(false);
        setCardOk(false);
        const reasons =
          res?.data?.details?.reasons?.join("\\n") ||
          res?.data?.message ||
          "Không rõ lý do";
        setCardErr(reasons);
        setCardVerifyLog(`❌ Thẻ SV không hợp lệ:\\n${reasons}`);
        console.error("[Card Verify] ❌", reasons);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setOcrProgress(0);
      setCardVerified(false);
      setCardOk(false);

      // Bắt lỗi chi tiết hơn
      let errorMsg = "Lỗi xác minh thẻ SV";
      let errorDetails = "";
      let errorType = "UNKNOWN";

      if (err?.response?.data?.message) {
        errorMsg = err.response.data.message;
        errorType = "BACKEND_ERROR";
      } else if (err?.message) {
        errorMsg = err.message;
        errorType = "CLIENT_ERROR";
      } else if (err?.code === "ECONNABORTED") {
        errorMsg = "⏱️ Timeout: Xác minh quá lâu (>30s)";
      } else if (err?.code === "ERR_NETWORK") {
        errorMsg = "🌐 Lỗi kết nối mạng";
      }

      if (err?.response?.status) {
        errorDetails = `\\nHTTP ${err.response.status}: ${
          err.response.statusText || "Error"
        }`;
      }
      if (err?.response?.data?.error) {
        errorDetails += `\\nBackend: ${err.response.data.error}`;
      }

      setCardErr(errorMsg);
      setCardVerifyLog(
        `❌ Lỗi: ${errorMsg}${errorDetails}\\n\\n🔍 Debug: ${
          err?.code || "Unknown error"
        }`
      );
      console.error("[Card Verify] ❌ Full Error:", {
        message: err?.message,
        code: err?.code,
        status: err?.response?.status,
        data: err?.response?.data,
        stack: err?.stack,
      });
    } finally {
      setIsVerifyingCard(false);
      setTimeout(() => setOcrProgress(0), 2000);
    }
  };

  // Verify khuôn mặt (gửi blob từ localStorage để verify liveness)
  const verifyFace = async () => {
    if (!facePreviewBlobRef.current || !submissionId) return;
    setIsVerifyingFace(true);
    setFaceVerifyLog("⏳ Đang kiểm tra liveness...");

    try {
      // Upload tạm để verify liveness
      const form = new FormData();
      form.append("face_image", facePreviewBlobRef.current, "face.jpg");
      const uploadRes = await axiosClient.post(
        `/submissions/${submissionId}/upload-images`,
        form
      );

      if (!uploadRes?.data?.ok || !uploadRes.data.face_uploaded) {
        throw new Error("Không thể upload ảnh để verify");
      }

      // Gọi API verify liveness
      const res = await axiosClient.post(
        `/submissions/${submissionId}/verify-face`
      );

      if (res?.data?.ok && res.data.valid) {
        setFaceVerified(true);
        setFaceUploaded(true); // Đánh dấu đã upload tạm
        const confidence = res.data.liveness?.confidence?.toFixed(1) || "N/A";
        const blur = res.data.liveness?.blur_score?.toFixed(1) || "N/A";
        const contrast = res.data.liveness?.contrast_score?.toFixed(1) || "N/A";
        setFaceVerifyLog(
          `✅ KHUÔN MẶT HỢP LỆ!\n` +
            `══════════════════════\n` +
            `Liveness: ${confidence}%\n` +
            `Blur: ${blur} (≥20 OK)\n` +
            `Contrast: ${contrast} (≥8 OK)`
        );
        console.log("[Face Verify] ✅", res.data.liveness);
      } else {
        setFaceVerified(false);
        setFaceUploaded(false);
        const reasons =
          res?.data?.liveness?.reasons?.join(", ") ||
          res?.data?.message ||
          "Không rõ lý do";
        const blur = res?.data?.liveness?.blur_score?.toFixed(1) || "N/A";
        const contrast =
          res?.data?.liveness?.contrast_score?.toFixed(1) || "N/A";
        setFaceErr(`❌ LỖI ẢNH KHUÔN MẶT: ${reasons}`);
        setFaceVerifyLog(
          `❌ LỖI ẢNH KHUÔN MẶT\n` +
            `══════════════════════\n` +
            `Lý do: ${reasons}\n\n` +
            `📊 Chi tiết kỹ thuật:\n` +
            `- Blur score: ${blur} (cần ≥20)\n` +
            `- Contrast: ${contrast} (cần ≥8)\n\n` +
            `💡 Đề xuất:\n` +
            `- Chụp rõ nét hơn (không mờ)\n` +
            `- Đủ ánh sáng\n` +
            `- Giữ máy chắc tay\n` +
            `- Đảm bảo khuôn mặt thật (không dùng ảnh in)`
        );
        console.error("[Face Verify] ❌ Lỗi ảnh khuôn mặt:", {
          reasons,
          blur,
          contrast,
        });
      }
    } catch (err) {
      setFaceVerified(false);
      setFaceUploaded(false);

      let errorMsg = "Lỗi xác minh khuôn mặt";
      let errorType = "UNKNOWN";
      let errorDetails = "";

      if (err?.response?.data?.message) {
        errorMsg = err.response.data.message;
        errorType = "BACKEND_ERROR";
      } else if (err?.message) {
        errorMsg = err.message;
        errorType = "CLIENT_ERROR";
      } else if (err?.code === "ECONNABORTED") {
        errorMsg = "⏱️ Timeout: Xác minh quá lâu";
        errorType = "TIMEOUT";
      } else if (err?.code === "ERR_NETWORK") {
        errorMsg = "🌐 Lỗi kết nối mạng";
        errorType = "NETWORK_ERROR";
      }

      if (err?.response?.status) {
        errorDetails = `\nHTTP ${err.response.status}: ${
          err.response.statusText || "Error"
        }`;
      }
      if (err?.response?.data?.error) {
        errorDetails += `\nBackend: ${err.response.data.error}`;
      }

      setFaceErr(`❌ LỖI KHUÔN MẶT: ${errorMsg}`);
      setFaceVerifyLog(
        `❌ LỖI XÁC MINH KHUÔN MẶT\n` +
          `════════════════════\n` +
          `Loại lỗi: ${errorType}\n` +
          `Chi tiết: ${errorMsg}${errorDetails}\n\n` +
          `🔍 Debug Info:\n` +
          `- Code: ${err?.code || "N/A"}\n` +
          `- Status: ${err?.response?.status || "N/A"}\n` +
          `- Response: ${JSON.stringify(err?.response?.data || {}).substring(
            0,
            200
          )}\n\n` +
          `💡 Hướng giải quyết:\n` +
          `- Kiểm tra kết nối mạng\n` +
          `- Chụp lại ảnh khuôn mặt\n` +
          `- Đảm bảo đủ ánh sáng\n` +
          `- Đảm bảo backend đang chạy`
      );
      console.error("[Face Verify] ❌ Full Error:", {
        type: errorType,
        message: err?.message,
        code: err?.code,
        status: err?.response?.status,
        data: err?.response?.data,
        stack: err?.stack,
      });
    } finally {
      setIsVerifyingFace(false);
    }
  };

  // So sánh 2 khuôn mặt và CHỈ LƯU VÀO DB NẾU PASS
  const compareFacesAndSave = async () => {
    if (
      !faceVerified ||
      !cardVerified ||
      !faceUploaded ||
      !cardUploaded ||
      !submissionId
    ) {
      console.error("[Compare] Thiếu điều kiện:", {
        faceVerified,
        cardVerified,
        faceUploaded,
        cardUploaded,
      });
      return;
    }

    setIsComparing(true);
    setCompareLog("⏳ Đang so sánh khuôn mặt từ localStorage...");

    try {
      // Gọi API so sánh (2 ảnh đã upload tạm để verify)
      const res = await axiosClient.post(
        `/submissions/${submissionId}/compare-faces`,
        {
          tolerance: 0.35,
        }
      );

      if (res?.data?.ok && res.data.match) {
        const confidence = res.data.confidence?.toFixed(1) || "N/A";
        const threshold = 50;

        setCompareLog(
          `✅ So sánh pass (${confidence}%, yêu cầu ≥${threshold}%)!\n` +
            `⏳ Đang lưu ảnh đã xác minh vào database...`
        );

        try {
          // Lấy blob từ localStorage và upload chính thức vào DB
          const cardBlob = cardBlobRef.current;
          const faceBlob = facePreviewBlobRef.current;

          if (!cardBlob || !faceBlob) {
            throw new Error("Thiếu ảnh trong bộ nhớ tạm");
          }

          const form = new FormData();
          form.append("student_card_image", cardBlob);
          form.append("face_image", faceBlob);

          await axiosClient.post(
            `/submissions/${submissionId}/upload-images`,
            form
          );

          // Xóa localStorage sau khi lưu thành công
          localStorage.removeItem(`exam_${submissionId}_card`);
          localStorage.removeItem(`exam_${submissionId}_face`);

          setFacesCompared(true);
          setFaceOk(true);
          setCompareLog(`Độ tương đồng giữa 2 khuôn mặt: ${confidence}% > 50%`);
          console.log(
            "[Compare] ✅ Pass - Đã lưu ảnh xác minh vào DB",
            res.data
          );
        } catch (saveErr) {
          throw new Error(
            "Lỗi lưu ảnh vào DB: " + (saveErr.message || "Unknown")
          );
        }
      } else {
        setFacesCompared(false);
        setFaceOk(false);

        const confidence = res?.data?.confidence?.toFixed(1) || "N/A";
        const details = res?.data?.details || {};

        // Kiểm tra xem ảnh nào không detect được face
        const cardFaceNotDetected =
          details.error?.includes("thẻ") || details.error?.includes("card");
        const selfieFaceNotDetected =
          details.error?.includes("selfie") ||
          details.error?.includes("khuôn mặt");

        let resetMessage = "";

        if (cardFaceNotDetected) {
          // Reset thẻ SV
          setCardVerified(false);
          setCardUploaded(false);
          setCardOk(false);
          setCardPreviewUrl("");
          cardBlobRef.current = null;
          resetMessage = "Vui lòng chụp lại ảnh thẻ sinh viên";
        } else if (selfieFaceNotDetected) {
          // Không reset preview khuôn mặt, chỉ reset trạng thái xác minh
          setFaceVerified(false);
          setFaceUploaded(false);
          // Giữ lại preview và blob
          resetMessage = "Vui lòng chụp lại ảnh khuôn mặt";
        } else {
          // Độ tương đồng thấp - chỉ reset trạng thái xác minh, giữ lại preview
          setCardVerified(false);
          setCardUploaded(false);
          setCardOk(false);
          // Giữ lại preview và blob
          setFaceVerified(false);
          setFaceUploaded(false);
          // Giữ lại preview và blob
          resetMessage = "Vui lòng chụp lại ảnh thẻ sinh viên và ảnh khuôn mặt";
        }

        setFaceErr(`Độ tương đồng giữa 2 khuôn mặt: ${confidence}% > 50%`);
        setCompareLog(
          `Khuôn mặt không khớp (độ tương đồng: ${confidence}%, yêu cầu ≥${threshold}%). ${resetMessage}`
        );
        console.error("[Compare] ❌ Fail", { confidence, resetMessage });
      }
    } catch (err) {
      // LỖI - KHÔNG LƯU VÀO DB, chỉ reset trạng thái xác minh, giữ lại preview
      setFacesCompared(false);
      setFaceOk(false);
      setCardVerified(false);
      setCardUploaded(false);
      setCardOk(false);
      setFaceVerified(false);
      setFaceUploaded(false);
      // Giữ lại preview và blob
      const errorMsg =
        err?.response?.data?.message || err?.message || "Lỗi so sánh khuôn mặt";
      setFaceErr(errorMsg);
      setCompareLog(`${errorMsg}. Vui lòng thử lại`);
      console.error("[Compare] ❌ Error:", errorMsg);
    } finally {
      setIsComparing(false);
    }
  };

  useEffect(() => {
    return () => {
      try {
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}
      clearInterval(guideIntervalRef.current);
    };
  }, []);

  const canStart = useMemo(() => {
    return (
      (!reqs.face || faceOk) &&
      (!reqs.card || cardOk) &&
      (!reqs.monitor || monitorOk)
    );
  }, [reqs, faceOk, cardOk, monitorOk]);

  const allowCard = useMemo(() => reqs.card, [reqs]);

  const allowFace = useMemo(() => {
    if (!reqs.face) return false;
    if (!reqs.card) return true; 
    return cardOk || faceUploaded || faceVerified;
  }, [reqs, cardOk, faceUploaded, faceVerified]);

  const allowMonitor = useMemo(() => {
    if (!reqs.monitor) return false;

    // Kiểm tra bước 1: Thẻ SV
    if (reqs.card && !cardOk) return false;

    // Kiểm tra bước 2: Khuôn mặt - phải hoàn thành TẤT CẢ: verify + compare + upload
    if (reqs.face && (!faceOk || !uploadSuccessMsg)) return false;

    return true;
  }, [reqs, faceOk, cardOk, uploadSuccessMsg]);

  const shellBg =
    theme === "dark"
      ? "bg-[radial-gradient(1200px_600px_at_15%_-10%,#1b2a52_0,transparent_60%),radial-gradient(1200px_800px_at_120%_10%,#1a1e3b_0,transparent_55%),linear-gradient(180deg,#070b14_0%,#0b1220_100%)]"
      : "bg-gradient-to-b from-white to-slate-100";

  const cardCls =
    theme === "dark"
      ? "bg-[linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03))] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,.35),_inset_0_1px_0_rgba(255,255,255,.05)]"
      : "bg-white border border-slate-200 shadow-md";

  const headerGrad =
    "bg-[linear-gradient(90deg,rgba(106,163,255,.15),rgba(34,225,255,.12),rgba(138,126,255,.15))] backdrop-saturate-150 backdrop-blur-md";

  const chip = (cls, text) => (
    <span className={`px-2 py-1 text-xs rounded border ${cls}`}>{text}</span>
  );

  return (
    <div className={`min-h-screen ${shellBg}`}>
      {/* Header */}
      <header
        className={`sticky top-0 z-40 border-b ${
          theme === "dark" ? "border-white/10" : "border-slate-200"
        } ${headerGrad}`}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Logo.png" alt="Logo" className="h-9 w-auto rounded-md" />
            <h1
              className={`text-sm font-semibold tracking-tight ${
                theme === "dark" ? "text-slate-100" : "text-slate-800"
              }`}
            >
              {examInfo?.title || `Bài thi #${examId}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`px-3 py-2 rounded-lg font-mono text-sm font-bold ${
                theme === "dark"
                  ? "bg-white/10 text-slate-100 border border-white/10"
                  : "bg-indigo-50 text-slate-800 border border-slate-200"
              }`}
            >
              ⏱ {duration}′
            </div>
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className={`px-3 py-2 rounded-lg border transition ${
                theme === "dark"
                  ? "bg-white/10 border-white/20 text-slate-100 hover:ring-2 hover:ring-indigo-300/40"
                  : "bg-white border-slate-200 text-slate-800 hover:border-blue-300"
              }`}
              title="Đổi giao diện Sáng/Tối"
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-7xl mx-auto p-4">
        {/* Banner info */}
        <section className={`rounded-2xl p-5 mb-7 transition ${cardCls}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className={`${
                  theme === "dark" ? "text-slate-100" : "text-slate-600"
                } text-xl`}
              >
                Giảng viên:{" "}
                <span className="font-medium">
                  {examInfo?.instructor_name || "—"}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {reqs.face &&
                  chip(
                    "bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-900/30 font-bold",
                    "Yêu cầu khuôn mặt"
                  )}
                {reqs.card &&
                  chip(
                    "bg-amber-500/10 text-amber-800 border-amber-300 font-bold",
                    "Yêu cầu thẻ SV"
                  )}
                {reqs.monitor &&
                  chip(
                    "bg-blue-500/10 text-blue-400 border-blue-500/30 font-bold",
                    "Yêu cầu toàn màn hình"
                  )}
              </div>
            </div>
            <div className="text-right">
              <p
                className={`${
                  theme === "dark" ? "text-slate-300" : "text-slate-600"
                } text-sm`}
              >
                Thời lượng
              </p>
              <p
                className={`${
                  theme === "dark" ? "text-slate-100" : "text-slate-800"
                } text-xl font-semibold`}
              >
                {duration} phút
              </p>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Student card - Bước 1 */}
          {reqs.card && (
            <div className={`relative rounded-2xl p-4 transition ${cardCls}`}>
              <div className="flex items-center justify-between mb-2">
                <p
                  className={`${
                    theme === "dark" ? "text-slate-100" : "text-slate-800"
                  } font-semibold`}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 mr-2 rounded-full bg-blue-600 text-white text-xs font-bold">
                    1
                  </span>
                  Xác minh thẻ sinh viên
                </p>
                <span
                  className={`text-xs ${
                    cardOk
                      ? "text-emerald-400"
                      : cardErr
                      ? "text-red-500"
                      : theme === "dark"
                      ? "text-slate-400"
                      : "text-slate-500"
                  }`}
                >
                  {cardOk
                    ? "✅ Đã xác minh"
                    : cardErr
                    ? "❌ Lỗi"
                    : "⏳ Chưa xác minh"}
                </span>
              </div>

              {/* Upload button */}
              {!cardUploaded && (
                <label
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition
                  ${
                    theme === "dark"
                      ? "bg-white/5 border-white/10 text-slate-100 hover:border-blue-300/40"
                      : "bg-white border-slate-200 text-slate-800 hover:border-blue-300"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => allowCard && handleUpload(e, "card")}
                    disabled={!allowCard}
                  />
                  <span>📤 Tải ảnh thẻ SV</span>
                </label>
              )}

              {/* Preview ảnh */}
              {cardPreviewUrl && (
                <div className="mt-3">
                  <img
                    src={cardPreviewUrl}
                    alt="Thẻ SV"
                    className="w-full max-w-xs rounded-lg border border-white/10"
                  />
                </div>
              )}

              {/* Verify button */}
              {cardUploaded && !cardVerified && (
                <div className="mt-3">
                  <button
                    onClick={verifyCard}
                    disabled={isVerifyingCard}
                    className="px-3 py-2 rounded-lg text-white font-semibold shadow transition hover:brightness-105 disabled:opacity-60 w-full"
                    style={{
                      background: "linear-gradient(180deg,#6aa3ff,#5b82ff)",
                    }}
                  >
                    {isVerifyingCard
                      ? "⏳ Đang xác minh..."
                      : "🔍 Bắt đầu xác minh"}
                  </button>

                  {/* Progress bar */}
                  {isVerifyingCard && ocrProgress > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span
                          className={
                            theme === "dark"
                              ? "text-slate-400"
                              : "text-slate-600"
                          }
                        >
                          OCR Progress:
                        </span>
                        <span
                          className={
                            theme === "dark"
                              ? "text-slate-300"
                              : "text-slate-700"
                          }
                        >
                          {Math.round(ocrProgress)}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${ocrProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Verification log */}
              {cardVerifyLog && (
                <div
                  className={`mt-2 p-2 rounded text-xs font-mono whitespace-pre-wrap ${
                    cardOk
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {cardVerifyLog}
                </div>
              )}

              {/* Nút upload lại nếu fail */}
              {cardUploaded && !cardOk && cardVerifyLog && (
                <div className="mt-3">
                  <label
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        setCardUploaded(false);
                        setCardVerified(false);
                        setCardOk(false);
                        setCardVerifyLog("");
                        setCardErr("");
                        handleUpload(e, "card");
                      }}
                    />
                    <span>🔄 Upload lại ảnh thẻ SV</span>
                  </label>
                </div>
              )}

              {!cardUploaded && !cardErr && (
                <p
                  className={`${
                    theme === "dark" ? "text-slate-400" : "text-slate-500"
                  } text-xs mt-2`}
                >
                  Yêu cầu: "Thẻ sinh viên", "Đại học", domain .edu.vn, MSSV 8-11
                  số
                </p>
              )}
            </div>
          )}

          {/* Face verify - Bước 2 */}
          {reqs.face && (
            <div
              className={`relative rounded-2xl p-4 transition ${cardCls} md:col-span-2`}
            >
              {/* Overlay khóa nếu chưa hoàn thành bước 1 */}
              {!allowFace && (
                <div className="absolute inset-0 rounded-2xl bg-black/50 backdrop-blur-sm z-10 grid place-items-center">
                  <div className="text-center p-4">
                    <div className="text-4xl mb-2">🔒</div>
                    <p className="text-white font-semibold mb-1">
                      Bước 2 đã bị khóa
                    </p>
                    <p className="text-slate-300 text-sm">
                      Hoàn tất Bước 1 (Xác minh thẻ SV) để mở khóa
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <p
                  className={`${
                    theme === "dark" ? "text-slate-100" : "text-slate-800"
                  } font-semibold`}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 mr-2 rounded-full bg-blue-600 text-white text-xs font-bold">
                    2
                  </span>
                  Xác minh khuôn mặt
                </p>
                <span
                  className={`text-xs ${
                    faceOk && uploadSuccessMsg
                      ? "text-emerald-400"
                      : faceErr
                      ? "text-red-500"
                      : theme === "dark"
                      ? "text-slate-400"
                      : "text-slate-500"
                  }`}
                >
                  {faceOk && uploadSuccessMsg
                    ? "✅ Đã hoàn thành"
                    : faceErr
                    ? "❌ Lỗi"
                    : "⏳ Chưa hoàn thành"}
                </span>
              </div>

              {/* Camera preview */}
              {!faceUploaded && (
                <>
                  <div
                    className={`relative rounded-xl overflow-hidden border ${
                      theme === "dark" ? "border-white/10" : "border-slate-200"
                    } bg-black/20`}
                  >
                    <div
                      className="bg-black/20"
                      style={{ aspectRatio: "4 / 3" }}
                    >
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 pointer-events-none grid place-items-center">
                      {/* Vòng tròn hướng dẫn cố định (nền) */}
                      <div
                        className="absolute rounded-full border-4 border-dashed transition-all"
                        style={{
                          width: "60%",
                          height: "75%",
                          borderColor: "rgba(255, 255, 255, 0.3)",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                      {/* Vòng tròn phát hiện khuôn mặt (thay đổi màu) */}
                      <div
                        className={`rounded-full border-4 transition-all duration-300`}
                        style={{
                          width: "60%",
                          height: "75%",
                          borderColor: faceGuideOk
                            ? "rgba(16, 185, 129, 0.8)"
                            : "rgba(239, 68, 68, 0.7)",
                          boxShadow: faceGuideOk
                            ? "0 0 20px rgba(16, 185, 129, 0.5)"
                            : "none",
                        }}
                      />
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-3 text-xs font-medium px-3 py-1.5 rounded-lg bg-black/60 text-white backdrop-blur-sm">
                      {faceGuideMsg}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="px-3 py-2 rounded-lg text-white font-medium shadow transition hover:brightness-105 disabled:opacity-60"
                      style={{
                        background: "linear-gradient(180deg,#6aa3ff,#5b82ff)",
                      }}
                      onClick={startCamera}
                      disabled={!allowFace}
                    >
                      📷 Bật camera
                    </button>
                  </div>
                </>
              )}

              {/* Preview ảnh đã chụp - hiện khi có preview nhưng chưa upload */}
              {facePreviewUrl && !faceUploaded && (
                <div className="mt-3">
                  <img
                    src={facePreviewUrl}
                    alt="preview"
                    className="w-full max-w-md rounded-lg border border-white/10"
                  />
                </div>
              )}

              {/* Verify button - Hiện khi đã có ảnh chụp */}
              {facePreviewUrl && !faceVerified && (
                <button
                  onClick={verifyFace}
                  disabled={isVerifyingFace || !facePreviewBlobRef.current}
                  className="mt-3 px-3 py-2 rounded-lg text-white font-semibold shadow transition hover:brightness-105 disabled:opacity-60"
                  style={{
                    background: "linear-gradient(180deg,#6aa3ff,#5b82ff)",
                  }}
                >
                  {isVerifyingFace
                    ? "⏳ Đang xác minh..."
                    : "🔍 Xác minh khuôn mặt"}
                </button>
              )}

              {/* Liveness log */}
              {faceVerifyLog && (
                <div
                  className={`mt-2 p-2 rounded text-xs font-mono whitespace-pre-wrap ${
                    faceVerified
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {faceVerifyLog}
                </div>
              )}

              {/* Preview ảnh đã upload và verify */}
              {facePreviewUrl && faceUploaded && (
                <div className="mt-3">
                  <img
                    src={facePreviewUrl}
                    alt="preview"
                    className="w-full max-w-md rounded-lg border border-white/10"
                  />
                </div>
              )}

              {/* Nút so sánh - Hiện sau khi verify pass */}
              {faceVerified &&
                faceUploaded &&
                cardVerified &&
                cardUploaded &&
                !facesCompared && (
                  <button
                    onClick={compareFacesAndSave}
                    disabled={isComparing}
                    className="mt-3 px-3 py-2 rounded-lg text-white font-semibold shadow transition hover:brightness-105 disabled:opacity-60"
                    style={{
                      background: "linear-gradient(180deg,#ff6b6b,#ee5a52)",
                    }}
                  >
                    {isComparing
                      ? "⏳ Đang so sánh..."
                      : "⚖️ So sánh khuôn mặt"}
                  </button>
                )}

              {/* Compare log */}
              {compareLog && (
                <div
                  className={`mt-2 p-2 rounded text-xs font-mono whitespace-pre-wrap ${
                    faceOk
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {compareLog}
                </div>
              )}

              {/* Nút chụp lại nếu compare fail */}
              {!faceOk && compareLog && !isComparing && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setFaceUploaded(false);
                      setFaceVerified(false);
                      setFacesCompared(false);
                      setFaceOk(false);
                      setFaceVerifyLog("");
                      setCompareLog("");
                      setFaceErr("");
                      setFacePreviewUrl("");
                      facePreviewBlobRef.current = null;
                      // Reset guidance
                      setFaceGuideMsg(
                        "Hãy căn khuôn mặt vào khung và nhìn thẳng"
                      );
                      setFaceGuideOk(false);
                      stableOkCountRef.current = 0;
                      // Restart camera và tự động chụp
                      startCamera();
                    }}
                    className="px-3 py-2 rounded-lg text-white font-semibold shadow transition hover:brightness-105 bg-amber-500 hover:bg-amber-600"
                  >
                    🔄 Chụp lại ảnh khuôn mặt
                  </button>
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow transition">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        setCardUploaded(false);
                        setCardVerified(false);
                        setCardOk(false);
                        setCardVerifyLog("");
                        setFacesCompared(false);
                        setCompareLog("");
                        handleUpload(e, "card");
                      }}
                    />
                    <span>🔄 Upload lại thẻ SV</span>
                  </label>
                </div>
              )}

              {/* Nút upload ảnh đã xác minh cuối cùng */}
              {facesCompared && faceOk && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30">
                  <p className="text-emerald-400 font-semibold mb-2">
                    ✔️ Xác minh hoàn tất!
                  </p>
                  <p className="text-xs text-slate-100 font-semibold mb-3 text-yellow-400">
                    Cả 2 khuôn mặt khớp nhau. Bạn có thể tải lên ảnh đã xác minh
                    để hoàn thành bước cuối cùng.
                  </p>

                  {/* Success message */}
                  {uploadSuccessMsg && (
                    <div className="mb-3 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40">
                      <p className="text-emerald-300 font-semibold text-sm">
                        ✔️ {uploadSuccessMsg}
                      </p>
                    </div>
                  )}

                  <button
                    className="px-4 py-2 rounded-lg text-white font-bold shadow-lg transition hover:brightness-110 disabled:opacity-60"
                    style={{
                      background: "linear-gradient(180deg,#00cf7f,#17a55c)",
                    }}
                    disabled={!!uploadSuccessMsg}
                    onClick={async () => {
                      try {
                        setUploadSuccessMsg("");
                        // Gọi API upload ảnh đã xác minh lên server
                        const form = new FormData();
                        if (facePreviewBlobRef.current) {
                          form.append(
                            "verified_face",
                            facePreviewBlobRef.current,
                            "verified_face.jpg"
                          );
                        }
                        if (cardBlobRef.current) {
                          form.append(
                            "verified_card",
                            cardBlobRef.current,
                            "verified_card.jpg"
                          );
                        }
                        const res = await axiosClient.post(
                          `/submissions/${submissionId}/upload-verified-images`,
                          form
                        );
                        if (res?.data?.ok) {
                          setUploadSuccessMsg(
                            "Đã tải lên ảnh đã xác minh thành công!"
                          );
                        }
                      } catch (e) {
                        console.error("[Upload Verified] ❌", e);
                        setUploadSuccessMsg("");
                        const errorMsg =
                          e?.response?.data?.message ||
                          "Lỗi khi tải lên ảnh đã xác minh";
                        setFaceErr(errorMsg);
                      }
                    }}
                  >
                    Xác minh khuôn mặt và tải lên
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Monitor - Bước 3 */}
          {reqs.monitor && (
            <div className={`relative rounded-2xl p-4 transition ${cardCls}`}>
              {/* Overlay khóa nếu chưa hoàn thành bước 1 VÀ 2 */}
              {!allowMonitor && (
                <div className="absolute inset-0 rounded-2xl bg-black/50 backdrop-blur-sm z-10 grid place-items-center">
                  <div className="text-center p-4">
                    <div className="text-4xl mb-2">🔒</div>
                    <p className="text-white font-semibold mb-1">
                      Bước 3 đã bị khóa
                    </p>
                    <p className="text-slate-300 text-sm">
                      {reqs.card && !cardOk && "Hoàn tất Bước 1 (Thẻ SV) và "}
                      {reqs.face &&
                        (!faceOk || !uploadSuccessMsg) &&
                        "Hoàn tất Bước 2 (Khuôn mặt + Upload thẻ sinh viên)"}
                      {reqs.card &&
                      !cardOk &&
                      reqs.face &&
                      (!faceOk || !uploadSuccessMsg)
                        ? ""
                        : " để mở khóa"}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <p
                  className={`${
                    theme === "dark" ? "text-slate-100" : "text-slate-800"
                  } font-semibold`}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 mr-2 rounded-full bg-blue-600 text-white text-xs font-bold">
                    3
                  </span>
                  Bật giám sát
                </p>
                <span
                  className={`text-xs ${
                    monitorOk
                      ? "text-emerald-400"
                      : theme === "dark"
                      ? "text-slate-400"
                      : "text-slate-500"
                  }`}
                >
                  {monitorOk ? "✅ Đã bật" : "⏳ Chưa bật"}
                </span>
              </div>
              <p
                className={`${
                  theme === "dark" ? "text-slate-300" : "text-slate-600"
                } text-sm`}
              >
                Yêu cầu bật toàn màn hình. Hệ thống sẽ ghi nhận rời tab/thoát
                fullscreen.
              </p>

              {/* Cảnh báo */}
              {monitorWarning && (
                <div
                  className={`mt-3 p-4 rounded-xl border-2 shadow-lg ${
                    multiScreenDetected
                      ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-500"
                      : "bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-500"
                  }`}
                >
                  <p
                    className={`text-sm font-bold ${
                      multiScreenDetected
                        ? "text-red-700 dark:text-red-300"
                        : "text-yellow-700 dark:text-yellow-300"
                    }`}
                  >
                    {monitorWarning}
                  </p>

                  {multiScreenDetected && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                      <p className="font-bold">📌 Hướng dẫn:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>
                          Ngắt kết nối màn hình phụ (rút dây HDMI/DisplayPort)
                        </li>
                        <li>
                          Hoặc vào Settings → Display → chọn "Show only on 1"
                        </li>
                        <li>Sau đó nhấn lại nút "Bật toàn màn hình"</li>
                      </ul>
                      <p className="mt-2 font-semibold">
                        🖥️ Số màn hình phát hiện:{" "}
                        <span className="text-red-700 dark:text-red-300">
                          {screenCount}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
              {monitorOk && !multiScreenDetected && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-500">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 font-semibold mb-2">
                    ✅ <strong>Chế độ fullscreen đã khóa</strong>
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
                    Hệ thống sẽ tự động khôi phục fullscreen nếu bạn cố thoát.
                    Giảng viên sẽ nhận được thông báo về mọi vi phạm.
                  </p>
                  <details className="text-xs text-emerald-600 dark:text-emerald-400">
                    <summary className="cursor-pointer font-semibold hover:text-emerald-700 dark:hover:text-emerald-300">
                      🔒 Các phím/hành động bị chặn (click để xem)
                    </summary>
                    <ul className="mt-2 ml-4 space-y-1 list-disc">
                      <li>
                        <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                          Esc
                        </kbd>{" "}
                        - Thoát fullscreen
                      </li>
                      <li>
                        <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                          F11
                        </kbd>{" "}
                        - Toggle fullscreen
                      </li>
                      <li>
                        <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                          F5
                        </kbd>{" "}
                        - Refresh trang
                      </li>
                      <li>
                        <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                          F3
                        </kbd>{" "}
                        - Tìm kiếm
                      </li>
                      <li>
                        <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                          F12
                        </kbd>{" "}
                        - DevTools
                      </li>
                      <li>
                        <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                          Alt+Tab
                        </kbd>{" "}
                        - Chuyển cửa sổ
                      </li>
                      <li>
                        <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                          Alt+F4
                        </kbd>{" "}
                        - Đóng cửa sổ
                      </li>
                      <li>
                        <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                          Ctrl+W
                        </kbd>{" "}
                        - Đóng tab
                      </li>
                      <li>
                        <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                          Ctrl+R
                        </kbd>{" "}
                        - Refresh
                      </li>
                      <li>
                        <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                          Ctrl+Shift+I/J/C
                        </kbd>{" "}
                        - DevTools
                      </li>
                      <li>
                        <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                          Ctrl+U
                        </kbd>{" "}
                        - View source
                      </li>
                      <li>
                        🖱️ <strong>Chuột phải</strong> - Menu context
                      </li>
                      <li>
                        🖨️ <strong>Print Screen</strong> - In màn hình
                      </li>
                    </ul>
                  </details>
                </div>
              )}

              <button
                className={`mt-3 px-3 py-2 rounded-lg text-white font-semibold shadow transition hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed
                ${
                  monitorOk
                    ? "bg-emerald-600"
                    : multiScreenDetected
                    ? "bg-red-600"
                    : "bg-blue-600"
                }`}
                onClick={enableMonitor}
                disabled={!allowMonitor}
              >
                {monitorOk
                  ? "✔️ Đã bật giám sát"
                  : multiScreenDetected
                  ? "🔄 Kiểm tra lại màn hình"
                  : "Bật toàn màn hình"}
              </button>
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />

        {/* Actions */}
        <section className="flex items-center justify-between">
          <div
            className={`${
              theme === "dark" ? "text-slate-400" : "text-slate-600"
            } text-sm`}
          >
            Vui lòng hoàn tất các bước yêu cầu trước khi bắt đầu làm bài.
          </div>
          <button
            disabled={!submissionId || !canStart}
            onClick={() =>
              navigate(`/exam/${examId}/take?submission_id=${submissionId}`)
            }
            className="px-5 py-3 rounded-xl text-white font-bold shadow-[0_8px_20px_rgba(24,201,100,.28),_inset_0_-2px_0_rgba(0,0,0,.2)] disabled:opacity-60 transition hover:brightness-105"
            style={{ background: "linear-gradient(180deg,#00cf7f,#17a55c)" }}
            title={
              !canStart ? "Hoàn tất xác minh để bắt đầu" : "Bắt đầu vào thi"
            }
          >
            Bắt đầu vào thi
          </button>
        </section>
      </main>

      {/* 🆕 MODAL CẢNH BÁO NHIỀU MÀN HÌNH */}
      {showMultiScreenModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-md sm:max-w-lg md:max-w-xl transform transition-all animate-slideUp ${
              theme === "dark"
                ? "bg-gradient-to-br from-slate-800 to-slate-900 border-red-500/50"
                : "bg-white"
            } rounded-2xl shadow-2xl border-2 border-red-500`}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <span className="text-3xl">🚫</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    HỆ THỐNG PHÁT HIỆN {screenCount} MÀN HÌNH!
                  </h3>
                  <p className="text-red-100 text-sm">
                    Cảnh báo vi phạm quy định thi
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Main message */}
              <div
                className={`p-4 rounded-xl border-2 ${
                  theme === "dark"
                    ? "bg-red-900/20 border-red-500/30"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <p
                  className={`text-base font-semibold ${
                    theme === "dark" ? "text-red-200" : "text-red-800"
                  }`}
                >
                  ⚠️ Để đảm bảo tính công bằng, bạn chỉ được phép sử dụng{" "}
                  <span className="underline">1 màn hình chính</span>.
                </p>
              </div>

              {/* Screen count display */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🖥️</span>
                  </div>
                  <div>
                    <p
                      className={`text-sm ${
                        theme === "dark" ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      Số màn hình phát hiện
                    </p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {screenCount}
                    </p>
                  </div>
                </div>
                <div className="text-4xl animate-pulse">⚠️</div>
              </div>

              {/* Instructions */}
              <div
                className={`p-4 rounded-xl ${
                  theme === "dark"
                    ? "bg-slate-700/50 border border-slate-600"
                    : "bg-blue-50 border border-blue-200"
                }`}
              >
                <p
                  className={`font-bold mb-3 flex items-center gap-2 ${
                    theme === "dark" ? "text-blue-300" : "text-blue-800"
                  }`}
                >
                  <span className="text-xl">📌</span> Vui lòng thực hiện:
                </p>
                <ol
                  className={`space-y-2 ${
                    theme === "dark" ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      1
                    </span>
                    <span className="flex-1">
                      Ngắt kết nối màn hình phụ (rút dây HDMI/DisplayPort)
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      2
                    </span>
                    <span className="flex-1">
                      Hoặc tắt chế độ mở rộng màn hình:
                      <br />
                      <code
                        className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                          theme === "dark"
                            ? "bg-slate-800 text-emerald-300"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        Settings → Display → "Show only on 1"
                      </code>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      3
                    </span>
                    <span className="flex-1">
                      Sau đó nhấn lại nút <strong>"Bật toàn màn hình"</strong>
                    </span>
                  </li>
                </ol>
              </div>

              {/* Warning note */}
              <div
                className={`p-3 rounded-lg border-l-4 border-yellow-500 ${
                  theme === "dark" ? "bg-yellow-900/20" : "bg-yellow-50"
                }`}
              >
                <p
                  className={`text-sm ${
                    theme === "dark" ? "text-yellow-200" : "text-yellow-800"
                  }`}
                >
                  <strong>⚡ Lưu ý:</strong> Việc sử dụng nhiều màn hình trong
                  khi thi có thể bị coi là gian lận và dẫn đến hủy bỏ kết quả
                  thi.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setShowMultiScreenModal(false)}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-105 active:scale-95"
              >
                ✅ Tôi đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
