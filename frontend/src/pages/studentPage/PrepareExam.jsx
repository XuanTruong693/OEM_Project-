import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";

export default function PrepareExam() {
  const { examId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(() => localStorage.getItem("examTheme") || "dark");
  const [faceOk, setFaceOk] = useState(false);
  const [cardOk, setCardOk] = useState(false);
  const [monitorOk, setMonitorOk] = useState(false);
  const [reqs, setReqs] = useState({ face: false, card: false, monitor: false });
  const [examInfo, setExamInfo] = useState(null);
  const [faceErr, setFaceErr] = useState("");
  const [cardErr, setCardErr] = useState("");
  // Live guide + preview states
  const [faceGuideOk, setFaceGuideOk] = useState(false);
  const [faceGuideMsg, setFaceGuideMsg] = useState("Hãy căn khuôn mặt vào khung và nhìn thẳng");
  const [facePreviewUrl, setFacePreviewUrl] = useState("");

  const submissionId = search.get("submission_id");
  const duration = Number(sessionStorage.getItem("pending_exam_duration") || "60");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceApiRef = useRef({ loaded: false, loading: false });
  const guideIntervalRef = useRef(null);
  const offCanvasRef = useRef(null);
  const facePreviewBlobRef = useRef(null);
  const stableOkCountRef = useRef(0);
  const isVerifyingRef = useRef(false); // Tránh verify nhiều lần
  
  const loadFaceApi = async () => {
    if (faceApiRef.current.loaded) return true;
    if (faceApiRef.current.loading) {
      // wait until loaded
      return new Promise((resolve) => {
        const i = setInterval(() => {
          if (faceApiRef.current.loaded) { clearInterval(i); resolve(true); }
        }, 100);
      });
    }
    faceApiRef.current.loading = true;
    const scriptUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js';
    const modelBase = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = scriptUrl;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    if (!window.faceapi) { faceApiRef.current.loading = false; return false; }
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
    try { localStorage.setItem("examTheme", theme); } catch {}
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
        if (error?.response?.status === 403 && error?.response?.data?.needVerifyRoom) {
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
      if (!roomToken) { navigate("/verify-room"); return; }
      (async () => {
        try {
          const res = await axiosClient.post("/exams/join", { room_token: roomToken });
          const sid = res.data?.submission_id;
          try { sessionStorage.setItem("exam_flags", JSON.stringify(res.data?.flags || {})); } catch {}
          if (sid) {
            navigate(`/exam/${res.data.exam_id}/prepare?submission_id=${sid}`, { replace: true });
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

        // Load submission verification status
        const subRes = await axiosClient.get(`/submissions/${submissionId}/status`);
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
      } catch (error) {
      }
    })();
  }, [examId, submissionId]);

  // Keyboard & focus monitoring
  useEffect(() => {
    const onKey = (e) => {
      const blockKeys = ["Escape", "F11"];
      if (blockKeys.includes(e.key)) {
        e.preventDefault(); e.stopPropagation();
      }
    };
    const onBlur = () => { axiosClient.post(`/submissions/${submissionId}/proctor-event`, { event_type: "window_blur" }); };
    const onHidden = () => { if (document.hidden) axiosClient.post(`/submissions/${submissionId}/proctor-event`, { event_type: "visibility_hidden" }); };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [submissionId]);

  // Upload helpers
  const handleUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file || !submissionId) return;
    const form = new FormData();
    if (type === "face") form.append("face_image", file);
    if (type === "card") form.append("student_card_image", file);
    try {
      const res = await axiosClient.post(`/submissions/${submissionId}/verify`, form);
      if (type === "face") {
        if (res?.data?.face) { setFaceOk(true); setFaceErr(""); }
        else { setFaceOk(false); setFaceErr("Ảnh khuôn mặt không hợp lệ. Vui lòng chụp lại."); }
      }
      if (type === "card") {
        if (res?.data?.card) { setCardOk(true); setCardErr(""); }
        else { setCardOk(false); setCardErr("Ảnh thẻ sinh viên không hợp lệ. Vui lòng tải lại."); }
      }
    } catch (err) {
      if (type === 'face') setFaceErr('Không thể tải ảnh khuôn mặt lên máy chủ. Vui lòng thử lại.');
      if (type === 'card') setCardErr('Không thể tải ảnh thẻ SV lên máy chủ. Vui lòng thử lại.');
    }
  };

  // Monitor (fullscreen)
  const enableMonitor = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      await axiosClient.post(`/submissions/${submissionId}/proctor-event`, {
        event_type: "monitor_start",
        details: { ua: navigator.userAgent },
      });
      setMonitorOk(true);
    } catch {
      setMonitorOk(false);
    }
  };

  // Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // Warmup face detection for live guide
      if (!('FaceDetector' in window)) {
        await loadFaceApi();
      }
      // Prepare offscreen canvas for faster detection
      if (!offCanvasRef.current) {
        const c = document.createElement('canvas');
        c.width = 480; c.height = 360; // small size for speed
        offCanvasRef.current = c;
      }
      // Start live guidance loop
      clearInterval(guideIntervalRef.current);
      guideIntervalRef.current = setInterval(async () => {
        try {
          const v = videoRef.current;
          const c = offCanvasRef.current;
          if (!v || !c) return;
          c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
      const g = c.getContext('2d');
      g.drawImage(v, 0, 0, c.width, c.height);

          let ok = false; let msg = '';
          const center = { x: c.width/2, y: c.height/2 };
          const needCenterTol = 0.18; // chỉ cần ở giữa khung (18%)
          const needSizeMin = 0.12;   // khuôn mặt tối thiểu (~12% khung)

          if ('FaceDetector' in window) {
            const detector = new window.FaceDetector({ fastMode: true });
            const faces = await detector.detect(c);
            if (faces && faces.length === 1) {
              const box = faces[0].boundingBox;
              const cx = box.x + box.width/2; const cy = box.y + box.height/2;
              const dx = Math.abs(cx - center.x) / c.width;
              const dy = Math.abs(cy - center.y) / c.height;
              const sizeRatio = Math.max(box.width/c.width, box.height/c.height);
              ok = (dx <= needCenterTol && dy <= needCenterTol && sizeRatio >= needSizeMin);
              msg = ok ? 'Giữ nguyên 1 giây để hệ thống chụp' : 'Di chuyển khuôn mặt vào giữa, tiến gần hơn';
            } else {
              ok = false; msg = 'Không nhìn thấy rõ khuôn mặt';
            }
          } else if (window.faceapi && faceApiRef.current.loaded) {
            const detections = await window.faceapi
              .detectAllFaces(c, new window.faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
              .withFaceLandmarks();
            if (detections && detections.length === 1) {
              const det = detections[0];
              const box = det.detection.box;
              const cx = box.x + box.width/2; const cy = box.y + box.height/2;
              const dx = Math.abs(cx - center.x) / c.width;
              const dy = Math.abs(cy - center.y) / c.height;
              const sizeRatio = Math.max(box.width/c.width, box.height/c.height);

              ok = dx <= needCenterTol && dy <= needCenterTol && sizeRatio >= needSizeMin;
              msg = ok ? 'Giữ nguyên 1 giây để hệ thống chụp' : 'Căn giữa, tiến gần hơn';
            } else {
              ok = false; msg = 'Không nhìn thấy rõ khuôn mặt';
            }
          }
          setFaceGuideOk(ok);
          setFaceGuideMsg(msg || (ok ? 'Sẵn sàng chụp' : 'Căn giữa, nhìn thẳng vào camera'));
          // Auto capture when stable and no preview yet
          if (ok && !facePreviewUrl) {
            stableOkCountRef.current += 1;
            if (stableOkCountRef.current >= 3) {
              const snap = document.createElement('canvas');
              snap.width = v.videoWidth || 640;
              snap.height = v.videoHeight || 480;
              const sctx = snap.getContext('2d');
              sctx.drawImage(v, 0, 0, snap.width, snap.height);
              snap.toBlob((blob) => {
                if (!blob) return;
                facePreviewBlobRef.current = blob;
                const url = URL.createObjectURL(blob);
                setFacePreviewUrl(url);
              }, 'image/jpeg', 0.9);
              stableOkCountRef.current = 0;
            }
          } else if (!ok) {
            stableOkCountRef.current = 0;
          }
        } catch {}
      }, 450);
    } catch {
      alert("Không thể bật camera. Vui lòng cấp quyền hoặc thử lại.");
    }
  };
  const captureFace = async () => {
    if (!videoRef.current) return;
    const snap = document.createElement('canvas');
    snap.width = videoRef.current.videoWidth || 640;
    snap.height = videoRef.current.videoHeight || 480;
    const sctx = snap.getContext('2d');
    sctx.drawImage(videoRef.current, 0, 0, snap.width, snap.height);
    snap.toBlob((blob) => {
      if (!blob) return;
      facePreviewBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setFacePreviewUrl(url);
    }, 'image/jpeg', 0.9);
  };

  const uploadFacePreview = async () => {
    if (!facePreviewBlobRef.current || !submissionId) return;
    try {
      const form = new FormData();
      form.append('face_image', facePreviewBlobRef.current, 'face.jpg');
      const res = await axiosClient.post(`/submissions/${submissionId}/verify`, form);
      if (res?.data?.face) {
        setFaceOk(true);
        setFaceErr("");
        try { streamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch {}
        clearInterval(guideIntervalRef.current);
      } else {
        setFaceOk(false);
        setFaceErr('Máy chủ từ chối ảnh khuôn mặt. Vui lòng chụp lại.');
      }
    } catch (e) {
      setFaceOk(false);
      setFaceErr('Không thể tải ảnh lên máy chủ. Vui lòng thử lại.');
    }
  };

  useEffect(() => {
    return () => {
      try { streamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch {}
      clearInterval(guideIntervalRef.current);
    };
  }, []);

  const canStart = useMemo(() => {
    return (!reqs.face || faceOk) && (!reqs.card || cardOk) && (!reqs.monitor || monitorOk);
  }, [reqs, faceOk, cardOk, monitorOk]);

  // Gating từng bước: chỉ cho phép bước sau khi hoàn tất bước trước
  const allowCard = useMemo(() => (!reqs.face || faceOk) && reqs.card, [reqs, faceOk]);
  const allowMonitor = useMemo(
    () => (!reqs.face || faceOk) && (!reqs.card || cardOk) && reqs.monitor,
    [reqs, faceOk, cardOk]
  );

  // Shared styles like TakeExam
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
      <header className={`sticky top-0 z-40 border-b ${theme==="dark" ? "border-white/10" : "border-slate-200"} ${headerGrad}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Logo.png" alt="Logo" className="h-9 w-auto rounded-md" />
            <h1 className={`text-sm font-semibold tracking-tight ${theme==="dark"?"text-slate-100":"text-slate-800"}`}>
              {examInfo?.title || `Bài thi #${examId}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-2 rounded-lg font-mono text-sm font-bold ${theme==="dark" ? "bg-white/10 text-slate-100 border border-white/10" : "bg-indigo-50 text-slate-800 border border-slate-200"}`}>
              ⏱ {duration}′
            </div>
            <button
              onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
              className={`px-3 py-2 rounded-lg border transition ${theme==="dark" ? "bg-white/10 border-white/20 text-slate-100 hover:ring-2 hover:ring-indigo-300/40" : "bg-white border-slate-200 text-slate-800 hover:border-blue-300"}`}
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
              <p className={`${theme==="dark"?"text-slate-100":"text-slate-600"} text-xl`}>
                Giảng viên: <span className="font-medium">{examInfo?.instructor_name || "—"}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {reqs.face   && chip("bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-900/30 font-bold","Yêu cầu khuôn mặt")}
                {reqs.card   && chip("bg-amber-500/10 text-amber-800 border-amber-300 font-bold","Yêu cầu thẻ SV")}
                {reqs.monitor&& chip("bg-blue-500/10 text-blue-400 border-blue-500/30 font-bold","Yêu cầu toàn màn hình")}
              </div>
            </div>
            <div className="text-right">
              <p className={`${theme==="dark"?"text-slate-300":"text-slate-600"} text-sm`}>Thời lượng</p>
              <p className={`${theme==="dark"?"text-slate-100":"text-slate-800"} text-xl font-semibold`}>{duration} phút</p>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Face verify */}
          {reqs.face && (
            <div className={`rounded-2xl p-4 transition ${cardCls} md:col-span-2`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`${theme==="dark"?"text-slate-100":"text-slate-800"} font-semibold`}>
                  <span className="inline-flex items-center justify-center w-6 h-6 mr-2 rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
                  Xác minh khuôn mặt
                </p>
                <span className={`text-xs ${faceOk ? "text-emerald-400" : faceErr ? "text-red-500" : theme==="dark"?"text-slate-400":"text-slate-500"}`}>{faceOk ? "Đã xác minh" : faceErr ? faceErr : "Chưa xác minh"}</span>
              </div>
              <div className={`relative rounded-xl overflow-hidden border ${theme==="dark"?"border-white/10":"border-slate-200"} bg-black/20`}>
                <div className="bg-black/20" style={{ aspectRatio: '4 / 3' }}>
                  <video ref={videoRef} className="w-full h-full object-cover" />
                </div>
                {/* Oval guide overlay */}
                <div className="absolute inset-0 pointer-events-none grid place-items-center">
                  <div className={`w-[88%] h-[80%] rounded-full border-4 transition-all ${faceGuideOk ? 'border-emerald-500/80' : 'border-red-500/70'}`} />
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-3 text-xs font-medium px-2 py-1 rounded bg-black/40 text-white">
                  {faceGuideMsg}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <button
                  className="px-3 py-2 rounded-lg text-white font-medium shadow transition hover:brightness-105"
                  style={{ background: "linear-gradient(180deg,#6aa3ff,#5b82ff)" }}
                  onClick={startCamera}
                >
                  Bật camera
                </button>
                <button
                  className="px-3 py-2 rounded-lg text-white font-semibold shadow transition hover:brightness-105 disabled:opacity-60"
                  style={{ background: "linear-gradient(180deg,#6aa3ff,#5b82ff)" }}
                  onClick={captureFace}
                  disabled={!submissionId}
                >
                  Chụp lại (thủ công)
                </button>
                <button
                  className="px-3 py-2 rounded-lg text-white font-semibold shadow transition hover:brightness-105 disabled:opacity-60"
                  style={{ background: "linear-gradient(180deg,#00cf7f,#17a55c)" }}
                  onClick={uploadFacePreview}
                  disabled={!submissionId || !facePreviewUrl}
                >
                  Tải lên ảnh đã chụp
                </button>
                {facePreviewUrl && (
                  <span className="text-xs text-emerald-500">Đã chụp ảnh xem trước</span>
                )}
              </div>
              {facePreviewUrl && (
                <div className="mt-3">
                  <p className={`${theme==="dark"?"text-slate-300":"text-slate-700"} text-sm mb-1`}>Ảnh xem trước:</p>
                  <img src={facePreviewUrl} alt="preview" className="w-full max-w-md rounded-lg border border-white/10" />
                </div>
              )}
              {/* <div className="mt-3">
                <label
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition
                    ${theme==="dark" ? "bg-white/5 border-white/10 text-slate-100 hover:border-blue-300/40" : "bg-white border-slate-200 text-slate-800 hover:border-blue-300"}`}
                >
                  <input type="file" accept="image/*" className="hidden" onChange={(e)=>handleUpload(e,"face")} />
                  <span>Hoặc tải ảnh khuôn mặt</span>
                </label>
              </div> */}
            </div>
          )}

          {/* Student card */}
          {reqs.card && (
            <div className={`relative rounded-2xl p-4 transition ${cardCls}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`${theme==="dark"?"text-slate-100":"text-slate-800"} font-semibold`}>
                  <span className="inline-flex items-center justify-center w-6 h-6 mr-2 rounded-full bg-blue-600 text-white text-xs font-bold">2</span>
                  Xác minh thẻ sinh viên
                </p>
                <span className={`text-xs ${cardOk ? "text-emerald-400" : theme==="dark"?"text-slate-400":"text-slate-500"}`}>{cardOk ? "Đã xác minh" : "Chưa xác minh"}</span>
              </div>
              <label
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition
                ${theme==="dark" ? "bg-white/5 border-white/10 text-slate-100 hover:border-blue-300/40" : "bg-white border-slate-200 text-slate-800 hover:border-blue-300"}`}
              >
                <input type="file" accept="image/*" className="hidden" onChange={(e)=> allowCard && handleUpload(e,"card")} disabled={!allowCard} />
                <span>Tải ảnh thẻ SV (mặt trước)</span>
              </label>
              <p className={`${cardOk ? "text-emerald-500" : theme==="dark"?"text-slate-400":"text-slate-500"} text-sm mt-2`}>
                {cardOk ? "Đã xác minh" : "Chưa xác minh"}
              </p>
              {!allowCard && (
                <div className="absolute inset-0 rounded-2xl bg-black/30 grid place-items-center text-white text-sm font-medium">
                  Hoàn tất bước 1 (khuôn mặt) để mở khóa bước 2
                </div>
              )}
            </div>
          )}

          {/* Monitor */}
          {reqs.monitor && (
            <div className={`relative rounded-2xl p-4 transition ${cardCls}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`${theme==="dark"?"text-slate-100":"text-slate-800"} font-semibold`}>
                  <span className="inline-flex items-center justify-center w-6 h-6 mr-2 rounded-full bg-blue-600 text-white text-xs font-bold">3</span>
                  Bật giám sát
                </p>
                <span className={`text-xs ${monitorOk ? "text-emerald-400" : theme==="dark"?"text-slate-400":"text-slate-500"}`}>{monitorOk ? "Đã bật" : "Chưa bật"}</span>
              </div>
              <p className={`${theme==="dark"?"text-slate-300":"text-slate-600"} text-sm`}>
                Yêu cầu bật toàn màn hình. Hệ thống sẽ ghi nhận rời tab/thoát fullscreen.
              </p>
              <button
                className={`mt-3 px-3 py-2 rounded-lg text-white font-semibold shadow transition hover:brightness-105
                ${monitorOk ? "bg-emerald-600" : "bg-blue-600"}`}
                onClick={enableMonitor}
                disabled={!allowMonitor}
              >
                {monitorOk ? "Đã bật giám sát" : "Bật toàn màn hình"}
              </button>
              {!allowMonitor && (
                <div className="absolute inset-0 rounded-2xl bg-black/30 grid place-items-center text-white text-sm font-medium">
                  Hoàn tất bước trước để mở khóa bước này
                </div>
              )}
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />

        {/* Actions */}
        <section className="flex items-center justify-between">
          <div className={`${theme==="dark"?"text-slate-400":"text-slate-600"} text-sm`}>
            Vui lòng hoàn tất các bước yêu cầu trước khi bắt đầu làm bài.
          </div>
          <button
            disabled={!submissionId || !canStart}
            onClick={() => navigate(`/exam/${examId}/take?submission_id=${submissionId}`)}
            className="px-5 py-3 rounded-xl text-white font-bold shadow-[0_8px_20px_rgba(24,201,100,.28),_inset_0_-2px_0_rgba(0,0,0,.2)] disabled:opacity-60 transition hover:brightness-105"
            style={{ background: "linear-gradient(180deg,#00cf7f,#17a55c)" }}
            title={!canStart ? "Hoàn tất xác minh để bắt đầu" : "Bắt đầu vào thi"}
          >
            Bắt đầu vào thi
          </button>
        </section>
      </main>
    </div>
  );
}
