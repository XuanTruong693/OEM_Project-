import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Search, Camera, X, Check, AlertTriangle,
    Trash2, Upload, User, ImageOff, ChevronLeft, ChevronRight
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import AdminSidebar from '../../components/admin/AdminSidebar';

const UpdateStudentCardPhotos = () => {
    const navigate = useNavigate();

    // --- Danh sách SV chưa có ảnh ---
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const LIMIT = 15;

    // --- Camera ---
    const [showCamera, setShowCamera] = useState(false);
    const [captureTarget, setCaptureTarget] = useState(null); // { student_code, student_name }
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // --- Ảnh tạm đã chụp ---
    const [capturedPhotos, setCapturedPhotos] = useState({}); // { student_code: { blob, previewUrl, student_name } }

    // --- Submit ---
    const [submitting, setSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState(null);

    // --- Toast ---
    const [message, setMessage] = useState({ type: '', text: '' });

    const debounceRef = useRef(null);

    // Toast helper
    const showToast = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    };

    // Fetch danh sách SV chưa có ảnh
    const fetchStudents = useCallback(async (page = 1, search = '') => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ page, limit: LIMIT, ...(search && { search }) });
            const res = await axiosClient.get(`/admin/student-cards/no-image?${params}`);
            if (res.data.success) {
                setStudents(res.data.data);
                setTotalItems(res.data.totalItems);
                setTotalPages(res.data.totalPages);
                setCurrentPage(res.data.currentPage);
            }
        } catch (err) {
            console.error('Lỗi tải danh sách SV:', err);
            showToast('error', 'Lỗi khi tải danh sách sinh viên chưa có ảnh.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStudents(currentPage, searchTerm);
    }, [currentPage, fetchStudents]);

    // Debounce tìm kiếm
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setCurrentPage(1);
            fetchStudents(1, searchTerm);
        }, 500);
        return () => clearTimeout(debounceRef.current);
    }, [searchTerm, fetchStudents]);

    // ============ CAMERA ============

    const openCamera = async (student) => {
        setCaptureTarget(student);
        setShowCamera(true);

        // Delay nhỏ để DOM render xong video element
        setTimeout(async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: 640, height: 480 }
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error('Lỗi truy cập camera:', err);
                showToast('error', 'Không thể truy cập camera. Vui lòng cấp quyền camera.');
                closeCamera();
            }
        }, 200);
    };

    const closeCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setShowCamera(false);
        setCaptureTarget(null);
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current || !captureTarget) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        const ctx = canvas.getContext('2d');

        // Nếu ảnh dọc (portrait) → xoay 90° sang ngang (landscape)
        if (vh > vw) {
            canvas.width = vh;
            canvas.height = vw;
            ctx.translate(vh, 0);
            ctx.rotate(Math.PI / 2); // Xoay 90° theo chiều kim đồng hồ
            ctx.drawImage(video, 0, 0);
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        } else {
            canvas.width = vw;
            canvas.height = vh;
            ctx.drawImage(video, 0, 0);
        }

        canvas.toBlob((blob) => {
            if (!blob) {
                showToast('error', 'Lỗi khi chụp ảnh.');
                return;
            }

            const previewUrl = URL.createObjectURL(blob);

            setCapturedPhotos(prev => ({
                ...prev,
                [captureTarget.student_code]: {
                    blob,
                    previewUrl,
                    student_name: captureTarget.student_name,
                    student_code: captureTarget.student_code,
                },
            }));

            showToast('success', `Đã chụp ảnh cho ${captureTarget.student_name}`);
            closeCamera();
        }, 'image/jpeg', 0.85);
    };

    // Xóa ảnh tạm
    const removeCapturedPhoto = (studentCode) => {
        setCapturedPhotos(prev => {
            const updated = { ...prev };
            if (updated[studentCode]?.previewUrl) {
                URL.revokeObjectURL(updated[studentCode].previewUrl);
            }
            delete updated[studentCode];
            return updated;
        });
    };

    // ============ SUBMIT ============

    const handleSubmitAll = async () => {
        const entries = Object.entries(capturedPhotos);
        if (entries.length === 0) {
            showToast('error', 'Chưa có ảnh nào để cập nhật.');
            return;
        }

        try {
            setSubmitting(true);
            const fd = new FormData();
            for (const [studentCode, data] of entries) {
                fd.append(studentCode, data.blob, `${studentCode}.jpg`);
            }

            const res = await axiosClient.post('/admin/student-cards/batch-update-images', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (res.data.success) {
                setSubmitResult(res.data);
                showToast('success', `Đã cập nhật ${res.data.successCount} ảnh thẻ thành công!`);

                // Xóa tất cả ảnh tạm
                Object.values(capturedPhotos).forEach(p => {
                    if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
                });
                setCapturedPhotos({});

                // Reload danh sách
                fetchStudents(1, searchTerm);
                setCurrentPage(1);
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Lỗi khi cập nhật ảnh thẻ.';
            showToast('error', errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    // Cleanup khi unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            Object.values(capturedPhotos).forEach(p => {
                if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
            });
        };
    }, []);

    const capturedCount = Object.keys(capturedPhotos).length;

    // ============ RENDER ============

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-gray-900">
            <AdminSidebar activeTab="student-cards" />

            <main className="flex-1 p-4 pt-20 md:p-8 overflow-y-auto">

                {/* Toast */}
                {message.text && (
                    <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[100] text-white flex items-center gap-2 transition-all
                        ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                        {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                        {message.text}
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 mb-8">
                    <div>
                        <button
                            onClick={() => navigate('/admin/student-cards')}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-3"
                        >
                            <ArrowLeft size={18} />
                            <span className="text-sm">Quay lại Quản lý Thẻ SV</span>
                        </button>
                        <h1 className="text-3xl font-semibold text-white flex items-center gap-3">
                            <Camera size={30} className="text-amber-400" />
                            Cập nhật Ảnh thẻ Sinh viên
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Chụp và cập nhật ảnh thẻ cho các sinh viên chưa có ảnh trong hệ thống
                        </p>
                    </div>
                    {capturedCount > 0 && (
                        <button
                            onClick={handleSubmitAll}
                            disabled={submitting}
                            className="flex items-center justify-center gap-2 px-6 py-3 w-full md:w-auto bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium text-lg disabled:opacity-50"
                        >
                            <Upload size={20} />
                            {submitting ? 'Đang cập nhật...' : `Cập nhật ${capturedCount} ảnh thẻ`}
                        </button>
                    )}
                </div>

                {/* Kết quả submit */}
                {submitResult && (
                    <div className="mb-6 p-4 bg-green-600/10 border border-green-600/30 rounded-xl">
                        <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                            <Check size={18} />
                            Kết quả cập nhật
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-gray-800 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-white">{submitResult.total}</div>
                                <div className="text-xs text-gray-400">Tổng</div>
                            </div>
                            <div className="bg-green-600/20 border border-green-600/30 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-green-400">{submitResult.successCount}</div>
                                <div className="text-xs text-green-400">Thành công</div>
                            </div>
                            <div className="bg-red-600/20 border border-red-600/30 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-red-400">{submitResult.errorCount}</div>
                                <div className="text-xs text-red-400">Lỗi</div>
                            </div>
                        </div>
                        <button
                            onClick={() => setSubmitResult(null)}
                            className="mt-3 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Ẩn kết quả
                        </button>
                    </div>
                )}

                {/* ===== KHU VỰC ẢNH ĐÃ CHỤP (STAGING) ===== */}
                {capturedCount > 0 && (
                    <div className="mb-6 p-5 bg-amber-600/10 border border-amber-600/30 rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
                                <Camera size={20} />
                                Ảnh đã chụp ({capturedCount} sinh viên)
                            </h2>
                            <span className="text-xs text-gray-400">
                                Nhấn "Cập nhật ảnh thẻ" ở góc trên phải để lưu vào hệ thống
                            </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {Object.entries(capturedPhotos).map(([code, data]) => (
                                <div
                                    key={code}
                                    className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden group relative"
                                >
                                    <img
                                        src={data.previewUrl}
                                        alt={data.student_name}
                                        className="w-full h-32 object-cover"
                                    />
                                    <div className="p-2">
                                        <p className="text-white text-sm font-medium truncate">{data.student_name}</p>
                                        <p className="text-xs text-blue-400">{code}</p>
                                    </div>
                                    <button
                                        onClick={() => removeCapturedPhoto(code)}
                                        className="absolute top-1 right-1 p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Xóa ảnh"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===== DANH SÁCH SV CHƯA CÓ ẢNH ===== */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <ImageOff size={20} className="text-gray-400" />
                            Sinh viên chưa có ảnh thẻ
                            <span className="text-sm font-normal text-gray-400">({totalItems} sinh viên)</span>
                        </h2>
                    </div>

                    {/* Thanh tìm kiếm */}
                    <div className="mb-4">
                        <div className="relative flex-1 w-full md:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo Tên hoặc MSSV..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Bảng danh sách */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px]">
                                <thead className="bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">#</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">MSSV</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tên Sinh Viên</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Trạng thái</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                                Đang tải...
                                            </div>
                                        </td>
                                    </tr>
                                ) : students.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center">
                                            <Check size={40} className="mx-auto text-green-500 mb-3" />
                                            <p className="text-gray-400">Tất cả sinh viên đều đã có ảnh thẻ! 🎉</p>
                                        </td>
                                    </tr>
                                ) : (
                                    students.map((student, index) => {
                                        const isCaptured = !!capturedPhotos[student.student_code];
                                        return (
                                            <tr key={student.id} className={`transition-colors ${isCaptured ? 'bg-amber-600/5' : 'hover:bg-gray-700/30'}`}>
                                                <td className="px-6 py-4 text-sm text-gray-400">
                                                    {(currentPage - 1) * LIMIT + index + 1}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-600/30">
                                                        {student.student_code}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-white font-medium flex items-center gap-2">
                                                    <User size={16} className="text-gray-500" />
                                                    {student.student_name}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isCaptured ? (
                                                        <span className="flex items-center gap-1.5 text-amber-400 text-sm">
                                                            <Check size={14} />
                                                            Đã chụp
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-gray-500 text-sm">
                                                            <ImageOff size={14} />
                                                            Chưa có ảnh
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        {isCaptured ? (
                                                            <>
                                                                <button
                                                                    onClick={() => openCamera({
                                                                        student_code: student.student_code,
                                                                        student_name: student.student_name,
                                                                    })}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                                                                >
                                                                    <Camera size={14} />
                                                                    Chụp lại
                                                                </button>
                                                                <button
                                                                    onClick={() => removeCapturedPhoto(student.student_code)}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                    Xóa
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => openCamera({
                                                                    student_code: student.student_code,
                                                                    student_name: student.student_name,
                                                                })}
                                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
                                                            >
                                                                <Camera size={14} />
                                                                Chụp ảnh
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                                </tbody>
                            </table>
                        </div>

                        {/* Phân trang */}
                        {totalPages > 1 && (
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-700">
                                <span className="text-sm text-gray-400 text-center md:text-left">
                                    Đang xem {(currentPage - 1) * LIMIT + 1} - {Math.min(currentPage * LIMIT, totalItems)} trong {totalItems} sinh viên
                                </span>
                                <div className="flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <span className="text-white text-sm">Trang {currentPage} / {totalPages}</span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ===== MODAL CAMERA ===== */}
                {showCamera && captureTarget && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-xl">
                            <div className="flex justify-between items-center p-5 border-b border-gray-700">
                                <div>
                                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <Camera size={20} className="text-amber-400" />
                                        Chụp ảnh thẻ
                                    </h2>
                                    <p className="text-sm text-gray-400 mt-1">
                                        Sinh viên: <span className="text-white font-medium">{captureTarget.student_name}</span>
                                        <span className="text-blue-400 ml-2">({captureTarget.student_code})</span>
                                    </p>
                                </div>
                                <button onClick={closeCamera} className="text-gray-400 hover:text-white transition-colors">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="p-5">
                                {/* Video preview */}
                                <div className="relative rounded-xl overflow-hidden bg-black border border-gray-600 mb-4">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-auto max-h-[400px] object-contain"
                                    />
                                    {/* Overlay hướng dẫn */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute inset-4 border-2 border-amber-400/30 rounded-lg" />
                                        <div className="absolute bottom-2 left-0 right-0 text-center">
                                            <span className="bg-black/60 text-amber-400 text-xs px-3 py-1 rounded-full">
                                                Đặt ảnh thẻ vào khung hình rồi nhấn Chụp
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Canvas ẩn để capture */}
                                <canvas ref={canvasRef} style={{ display: 'none' }} />

                                {/* Nút chụp */}
                                <div className="flex justify-center gap-4">
                                    <button
                                        onClick={closeCamera}
                                        className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={capturePhoto}
                                        className="flex items-center gap-2 px-8 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium text-lg"
                                    >
                                        <Camera size={20} />
                                        Chụp
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default UpdateStudentCardPhotos;
