import React, { useEffect, useRef, useState } from "react";
import { Camera } from "@mediapipe/camera_utils";
import { FaceMesh } from "@mediapipe/face_mesh";
import { AlertCircle, CheckCircle, RefreshCcw } from "lucide-react";

const LivenessVerification = ({ onVerified, onCancel }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [status, setStatus] = useState("initializing"); // initializing, ready, detecting, success, failed
    const [blinkCount, setBlinkCount] = useState(0);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState("");

    useEffect(() => {
        const faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        faceMesh.onResults(onResults);

        let camera = null;
        if (videoRef.current) {
            camera = new Camera(videoRef.current, {
                onFrame: async () => {
                    await faceMesh.send({ image: videoRef.current });
                },
                width: 640,
                height: 480,
            });
            camera.start();
        }

        return () => {
            if (camera) camera.stop();
            faceMesh.close();
        };
    }, []);

    const calculateEAR = (landmarks) => {
        // EAR (Eye Aspect Ratio) calculation logic
        // Indices for eyes: 
        // Left: 362, 385, 387, 263, 373, 380
        // Right: 33, 160, 158, 133, 153, 144
        
        const getDist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

        const ear = (eye) => {
            const v1 = getDist(landmarks[eye[1]], landmarks[eye[5]]);
            const v2 = getDist(landmarks[eye[2]], landmarks[eye[4]]);
            const h = getDist(landmarks[eye[0]], landmarks[eye[3]]);
            return (v1 + v2) / (2.0 * h);
        };

        const leftEAR = ear([362, 385, 387, 263, 373, 380]);
        const rightEAR = ear([33, 160, 158, 133, 153, 144]);

        return (leftEAR + rightEAR) / 2.0;
    };

    let isClosed = false;
    let closedStartTime = 0;

    const onResults = (results) => {
        if (status === "success") return;
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            if (status === "initializing") setStatus("ready");
            
            const landmarks = results.multiFaceLandmarks[0];
            const ear = calculateEAR(landmarks);

            // EAR threshold for blink (typically around 0.2)
            if (ear < 0.2) {
                if (!isClosed) {
                    isClosed = true;
                    closedStartTime = Date.now();
                } else {
                    const duration = Date.now() - closedStartTime;
                    const p = Math.min(100, (duration / 3000) * 100);
                    setProgress(p);

                    if (duration >= 3000) {
                        handleSuccess();
                    }
                }
            } else {
                isClosed = false;
                setProgress(0);
            }
        } else {
            setStatus("initializing");
        }
    };

    const handleSuccess = () => {
        setStatus("success");
        // Capture photo
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        const photoData = canvas.toDataURL("image/jpeg");
        
        setTimeout(() => {
            onVerified(photoData);
        }, 1000);
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-2xl w-full text-center shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-2">Xác thực Liveness</h2>
                <p className="text-slate-400 mb-6">Nháy mắt và giữ trong 3 giây để xác minh bạn là người thật</p>

                <div className="relative aspect-video bg-black rounded-2xl overflow-hidden mb-6 border-2 border-slate-700">
                    <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* UI Overlays */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-80 border-2 border-dashed border-white/30 rounded-[100%] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                    </div>

                    {status === "success" && (
                        <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle className="w-20 h-20 text-emerald-500 animate-bounce" />
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    
                    <p className="text-lg font-bold text-blue-400">
                        {progress > 0 ? `Đang giữ mắt đóng... ${Math.round(progress)}%` : "Vui lòng nháy mắt 3 giây"}
                    </p>

                    <div className="flex gap-4">
                        <button 
                            onClick={onCancel}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition"
                        >
                            Hủy bỏ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LivenessVerification;
