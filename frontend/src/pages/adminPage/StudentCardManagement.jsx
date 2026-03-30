import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Upload, FileSpreadsheet, Eye, Edit2, Trash2,
    X, Save, Check, AlertTriangle, ChevronLeft, ChevronRight,
    CreditCard, Image, FileText, Camera
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import AdminSidebar from '../../components/admin/AdminSidebar';

// Utility: đọc file Excel bằng SheetJS (lazy import)
const readExcelFile = async (file) => {
    const XLSX = await import('xlsx');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                resolve(json);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// Component chính
const StudentCardManagement = () => {
    const navigate = useNavigate();
    // --- State: danh sách & phân trang ---
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const LIMIT = 15;

    // --- State: loading chi tiết ---
    const [detailLoading, setDetailLoading] = useState(false);

    // --- State: modals ---
    const [selectedCard, setSelectedCard] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [uploadMode, setUploadMode] = useState('create'); // 'create' | 'edit'

    // --- State: form upload thủ công ---
    const [form, setForm] = useState({ student_code: '', student_name: '' });
    const [formFile, setFormFile] = useState(null);
    const [formPreview, setFormPreview] = useState(null);
    const [saving, setSaving] = useState(false);

    // --- State: batch upload ---
    const [batchStep, setBatchStep] = useState(1);
    const [batchExcelFile, setBatchExcelFile] = useState(null);
    const [excelData, setExcelData] = useState([]);
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchResult, setBatchResult] = useState(null);

    // --- State: toast ---
    const [message, setMessage] = useState({ type: '', text: '' });

    const debounceRef = useRef(null);

    // Fetch danh sách
    const fetchCards = async (page = 1, search = '') => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ page, limit: LIMIT, ...(search && { search }) });
            const res = await axiosClient.get(`/admin/student-cards?${params}`);
            if (res.data.success) {
                setCards(res.data.data);
                setTotalItems(res.data.totalItems);
                setTotalPages(res.data.totalPages);
                setCurrentPage(res.data.currentPage);
            }
        } catch (err) {
            console.error('Lỗi tải danh sách thẻ SV:', err);
            showToast('error', 'Lỗi khi tải danh sách thẻ sinh viên.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCards(currentPage, searchTerm);
    }, [currentPage]);

    // Debounce tìm kiếm 500ms
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setCurrentPage(1);
            fetchCards(1, searchTerm);
        }, 500);
        return () => clearTimeout(debounceRef.current);
    }, [searchTerm]);

    // Toast
    const showToast = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    };

    // Xem chi tiết
    const handleView = async (id) => {
        try {
            setDetailLoading(true);
            const res = await axiosClient.get(`/admin/student-cards/${id}`);
            if (res.data.success) {
                setSelectedCard(res.data.data);
                setShowViewModal(true);
            }
        } catch (err) {
            showToast('error', 'Lỗi khi tải chi tiết thẻ.');
        } finally {
            setDetailLoading(false);
        }
    };

    // Mở modal Upload thủ công (Thêm mới)
    const handleOpenCreate = () => {
        setUploadMode('create');
        setForm({ student_code: '', student_name: '' });
        setFormFile(null);
        setFormPreview(null);
        setShowUploadModal(true);
    };

    // Mở modal Sửa
    const handleEdit = async (card) => {
        setUploadMode('edit');
        setSelectedCard(card);
        setForm({ student_code: card.student_code, student_name: card.student_name });
        setFormFile(null);
        setFormPreview(null);
        setShowUploadModal(true);
    };

    // Chọn file ảnh trong modal upload — tự xoay ảnh dọc sang ngang
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            // Nếu ảnh dọc (portrait) → xoay 90° sang ngang (landscape)
            if (img.height > img.width) {
                const canvas = document.createElement('canvas');
                canvas.width = img.height;
                canvas.height = img.width;
                const ctx = canvas.getContext('2d');
                ctx.translate(img.height, 0);
                ctx.rotate(Math.PI / 2);
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const rotatedFile = new File([blob], file.name, { type: 'image/jpeg' });
                        setFormFile(rotatedFile);
                        setFormPreview(URL.createObjectURL(blob));
                    }
                }, 'image/jpeg', 0.9);
            } else {
                setFormFile(file);
                setFormPreview(URL.createObjectURL(file));
            }
            URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
    };

    // Regex: chỉ cho phép chữ cái (bao gồm tiếng Việt) và khoảng trắng
    const VALID_NAME_REGEX = /^[\p{L}\s]+$/u;

    // Submit Upload thủ công (Thêm mới / Sửa)
    const handleSaveUpload = async () => {
        if (form.student_name && !VALID_NAME_REGEX.test(form.student_name.trim())) {
            showToast('error', 'Tên sinh viên chỉ được chứa chữ cái và khoảng trắng (không có số hoặc ký tự đặc biệt).');
            return;
        }
        try {
            setSaving(true);
            const fd = new FormData();
            fd.append('student_code', form.student_code);
            fd.append('student_name', form.student_name);
            // Chỉ đính kèm file nếu có chọn ảnh mới
            if (formFile) {
                fd.append('card_image', formFile);
            }

            if (uploadMode === 'create') {
                await axiosClient.post('/admin/student-cards', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showToast('success', 'Đã thêm thẻ sinh viên thành công!');
            } else {
                await axiosClient.put(`/admin/student-cards/${selectedCard.id}`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showToast('success', 'Đã cập nhật thẻ sinh viên thành công!');
            }

            setShowUploadModal(false);
            fetchCards(currentPage, searchTerm);
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Lỗi khi lưu thẻ sinh viên.';
            showToast('error', errMsg);
        } finally {
            setSaving(false);
        }
    };

    // Xóa
    const handleDeleteClick = (card) => {
        setSelectedCard(card);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            setSaving(true);
            await axiosClient.delete(`/admin/student-cards/${selectedCard.id}`);
            showToast('success', `Đã xóa thẻ SV ${selectedCard.student_name} thành công!`);
            setShowDeleteModal(false);
            fetchCards(currentPage, searchTerm);
        } catch (err) {
            showToast('error', 'Lỗi khi xóa thẻ sinh viên.');
        } finally {
            setSaving(false);
        }
    };

    // Batch Upload: Bước 1 - Đọc Excel
    const handleExcelChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            setBatchExcelFile(file);
            const rows = await readExcelFile(file);
            setExcelData(rows);
        } catch {
            showToast('error', 'Không đọc được file Excel. Vui lòng kiểm tra định dạng.');
        }
    };

    // Batch Upload: Xác nhận upload
    const handleBatchSubmit = async () => {
        if (!batchExcelFile) {
            showToast('error', 'Chưa chọn file Excel để upload.');
            return;
        }

        try {
            setBatchLoading(true);
            const fd = new FormData();
            fd.append('excel_file', batchExcelFile);

            const res = await axiosClient.post('/admin/student-cards/batch', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                setBatchResult(res.data);
                setBatchStep(2); // Hiển thị kết quả (Gộp thành 2 bước)
                fetchCards(1, '');
            }
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Lỗi khi giải mã file Excel hoặc lưu dữ liệu.');
        } finally {
            setBatchLoading(false);
        }
    };

    const closeBatchModal = () => {
        setShowBatchModal(false);
        setBatchStep(1);
        setExcelData([]);
        setBatchExcelFile(null);
        setBatchResult(null);
    };

    // Tải file Excel mẫu — giúp Admin biết đúng định dạng cần chuẩn bị
    const downloadSampleExcel = async () => {
        const XLSX = await import('xlsx');
        const sampleData = [
            { mssv: '21110000001', ten: 'Nguyễn Văn An', 'Ảnh': 'Dán thật gọn ảnh thẻ vào ô này' },
            { mssv: '21110000002', ten: 'Trần Thị Bình', 'Ảnh': 'Dán thật gọn ảnh thẻ vào ô này' },
        ];
        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        // Căn chỉnh độ rộng cột và chiều cao hàng
        worksheet['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 35 }];
        worksheet['!rows'] = [{ hpt: 30 }, { hpt: 90 }, { hpt: 90 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sach the SV');
        XLSX.writeFile(workbook, 'bang_mau_upload_the_sv.xlsx');
    };

    // Render
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
                        <h1 className="text-3xl font-semibold text-white flex items-center gap-3">
                            <CreditCard size={30} className="text-blue-400" />
                            Quản lý Thẻ Sinh Viên
                        </h1>
                        <p className="text-gray-400 mt-1">Quản lý kho ảnh thẻ sinh viên dùng để đối chiếu khi thi</p>
                    </div>
                    <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
                        <button
                            onClick={() => navigate('/admin/student-cards/update-photos')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
                        >
                            <Camera size={18} />
                            Cập nhật ảnh thẻ
                        </button>
                        <button
                            onClick={handleOpenCreate}
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                        >
                            <Upload size={18} />
                            Upload thủ công
                        </button>
                        <button
                            onClick={() => { setShowBatchModal(true); setBatchStep(1); }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-medium"
                        >
                            <FileSpreadsheet size={18} />
                            Upload Excel
                        </button>
                    </div>
                </div>

                {/* Tìm kiếm */}
                <div className="mb-6">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo Tên hoặc MSSV..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* Bảng danh sách */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead className="bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">#ID</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">MSSV</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tên Sinh Viên</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ngày tạo</th>
                                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                            Đang tải...
                                        </div>
                                    </td>
                                </tr>
                            ) : cards.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <CreditCard size={40} className="mx-auto text-gray-600 mb-3" />
                                        <p className="text-gray-400">Chưa có thẻ sinh viên nào. Hãy upload để bắt đầu!</p>
                                    </td>
                                </tr>
                            ) : (
                                cards.map(card => (
                                    <tr key={card.id} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-400">#{card.id}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-600/30">
                                                {card.student_code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-white font-medium">{card.student_name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-400">
                                            {card.createdAt
                                                ? new Date(card.createdAt).toLocaleDateString('vi-VN')
                                                : '—'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleView(card.id)}
                                                    disabled={detailLoading}
                                                    className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(card)}
                                                    className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-600/10 rounded-lg transition-colors"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(card)}
                                                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors"
                                                    title="Xóa"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </div>

                    {/* Phân trang */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
                            <span className="text-sm text-gray-400">
                                Đang xem {(currentPage - 1) * LIMIT + 1} - {Math.min(currentPage * LIMIT, totalItems)} trong {totalItems} sinh viên
                            </span>
                            <div className="flex items-center gap-2">
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

                {/* ==================== MODAL XEM CHI TIẾT ==================== */}
                {showViewModal && selectedCard && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md">
                            <div className="flex justify-between items-center p-6 border-b border-gray-700">
                                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <Eye size={20} className="text-blue-400" /> Chi tiết Thẻ Sinh Viên
                                </h2>
                                <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6">
                                {/* Ảnh thẻ */}
                                <div className="mb-5 rounded-xl overflow-hidden bg-gray-700 border border-gray-600 flex items-center justify-center min-h-[180px]">
                                    {selectedCard.card_image_base64 ? (
                                        <img
                                            src={selectedCard.card_image_base64}
                                            alt="Thẻ sinh viên"
                                            className="w-full object-contain max-h-64"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center text-gray-500 py-8">
                                            <Image size={40} />
                                            <p className="mt-2 text-sm">Không có ảnh thẻ</p>
                                        </div>
                                    )}
                                </div>
                                {/* Thông tin */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">MSSV</label>
                                        <p className="text-white mt-1 font-medium">{selectedCard.student_code}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">ID</label>
                                        <p className="text-white mt-1">#{selectedCard.id}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs text-gray-400 uppercase">Tên Sinh Viên</label>
                                        <p className="text-white mt-1 font-medium">{selectedCard.student_name}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">Ngày tạo</label>
                                        <p className="text-white mt-1 text-sm">
                                            {selectedCard.createdAt
                                                ? new Date(selectedCard.createdAt).toLocaleString('vi-VN')
                                                : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">Cập nhật lần cuối</label>
                                        <p className="text-white mt-1 text-sm">
                                            {selectedCard.updatedAt
                                                ? new Date(selectedCard.updatedAt).toLocaleString('vi-VN')
                                                : '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end p-6 border-t border-gray-700">
                                <button
                                    onClick={() => setShowViewModal(false)}
                                    className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== MODAL UPLOAD THỦ CÔNG / SỬA ==================== */}
                {showUploadModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg">
                            <div className="flex justify-between items-center p-6 border-b border-gray-700">
                                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <Upload size={20} className="text-blue-400" />
                                    {uploadMode === 'create' ? 'Thêm Thẻ Sinh Viên' : 'Sửa Thẻ Sinh Viên'}
                                </h2>
                                <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* MSSV */}
                                <div>
                                    <label className="block text-sm text-gray-300 mb-1">
                                        MSSV <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ví dụ: 21110001"
                                        value={form.student_code}
                                        onChange={e => setForm({ ...form, student_code: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                {/* Tên SV */}
                                <div>
                                    <label className="block text-sm text-gray-300 mb-1">
                                        Tên Sinh Viên <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ví dụ: Nguyễn Văn A"
                                        value={form.student_name}
                                        onChange={e => setForm({ ...form, student_name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                {/* File ảnh */}
                                <div>
                                    <label className="block text-sm text-gray-300 mb-1">
                                        File Ảnh Thẻ <span className="text-gray-500 text-xs"> (không bắt buộc, có thể bổ sung sau)</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white file:cursor-pointer"
                                    />
                                    {/* Preview ảnh */}
                                    {formPreview && (
                                        <div className="mt-3 rounded-lg overflow-hidden border border-gray-600 max-h-40">
                                            <img src={formPreview} alt="Preview" className="w-full object-contain max-h-40" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSaveUpload}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    {saving ? 'Đang lưu...' : 'Lưu'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== MODAL BATCH UPLOAD (EXCEL) ==================== */}
                {showBatchModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center p-6 border-b border-gray-700">
                                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <FileSpreadsheet size={20} className="text-teal-400" />
                                    Upload Hàng Loạt (Excel + Ảnh)
                                </h2>
                                <button onClick={closeBatchModal} className="text-gray-400 hover:text-white"><X size={20} /></button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Bước tiến trình */}
                                <div className="flex items-center gap-2 text-sm">
                                    {[
                                        { step: 1, label: 'Chọn Excel' },
                                        { step: 2, label: 'Kết quả' },
                                    ].map(({ step, label }) => (
                                        <React.Fragment key={step}>
                                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                                                ${(batchStep === 1 && step === 1) || (batchStep >= 2 && step === 2) ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                                <span>{step}</span>
                                                <span>{label}</span>
                                            </div>
                                            {step < 2 && <div className="flex-1 h-px bg-gray-700" />}
                                        </React.Fragment>
                                    ))}
                                </div>

                                {/* === BƯỚC 1: Chọn file Excel === */}
                                {batchStep === 1 && (
                                    <div>
                                        <div className="p-4 bg-gray-700/50 rounded-lg mb-4 border border-gray-600">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-gray-300 text-sm font-medium">📋 Yêu cầu file Excel:</p>
                                                <button
                                                    onClick={downloadSampleExcel}
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-teal-600/20 hover:bg-teal-600/40 text-teal-400 border border-teal-600/30 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                                                    title="Tải file Excel mẫu về máy"
                                                >
                                                    ⬇ Tải file mẫu
                                                </button>
                                            </div>
                                            <ul className="text-gray-400 text-xs space-y-1 list-disc list-inside">
                                                <li>Cột <code className="text-teal-400">mssv</code> — Mã số sinh viên</li>
                                                <li>Cột <code className="text-teal-400">ten</code> — Họ và tên sinh viên</li>
                                                <li>Cột <code className="text-teal-400">ten_file_anh</code> — Tên file ảnh (ví dụ: <code className="text-yellow-400">21110001.jpg</code>)</li>
                                            </ul>
                                            <p className="text-gray-500 text-xs mt-2">💡 Nhấn <span className="text-teal-400">"Tải file mẫu"</span> để download file Excel mẫu với 3 dòng ví dụ.</p>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".xlsx,.xls"
                                            onChange={handleExcelChange}
                                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 focus:outline-none focus:border-teal-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-teal-600 file:text-white file:cursor-pointer"
                                        />
                                        {/* Preview bảng */}
                                        {excelData.length > 0 && (
                                            <div className="mt-4">
                                                <p className="text-gray-300 text-sm mb-2">Preview ({excelData.length} dòng đọc được):</p>
                                                <div className="overflow-x-auto rounded-lg border border-gray-600">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-gray-700">
                                                            <tr>
                                                                {Object.keys(excelData[0]).map(key => (
                                                                    <th key={key} className="px-3 py-2 text-left text-gray-300">{key}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-700">
                                                            {excelData.slice(0, 8).map((row, i) => (
                                                                <tr key={i} className="hover:bg-gray-700/30">
                                                                    {Object.values(row).map((val, j) => (
                                                                        <td key={j} className="px-3 py-2 text-gray-300">{val}</td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <button
                                                    onClick={handleBatchSubmit}
                                                    disabled={batchLoading}
                                                    className="mt-4 w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
                                                >
                                                    {batchLoading ? 'Đang trích xuất ảnh và upload...' : 'Bắt đầu Upload →'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* === BƯỚC 2: Kết quả === */}
                                {batchStep >= 2 && batchResult && (
                                    <div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                                            <div className="bg-gray-700 rounded-lg p-4 text-center">
                                                <div className="text-2xl font-bold text-white">{batchResult.total}</div>
                                                <div className="text-xs text-gray-400 mt-1">Tổng</div>
                                            </div>
                                            <div className="bg-green-600/20 border border-green-600/30 rounded-lg p-4 text-center">
                                                <div className="text-2xl font-bold text-green-400">{batchResult.successCount}</div>
                                                <div className="text-xs text-green-400 mt-1">Thành công</div>
                                            </div>
                                            <div className="bg-red-600/20 border border-red-600/30 rounded-lg p-4 text-center">
                                                <div className="text-2xl font-bold text-red-400">{batchResult.errorCount}</div>
                                                <div className="text-xs text-red-400 mt-1">Lỗi</div>
                                            </div>
                                        </div>

                                        {batchResult.errorList && batchResult.errorList.length > 0 && (
                                            <div>
                                                <p className="text-red-400 text-sm font-medium mb-2">🚫 Các dòng bị lỗi:</p>
                                                <div className="overflow-x-auto rounded-lg border border-red-600/30 max-h-40 overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-red-600/20">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left text-red-400">MSSV</th>
                                                                <th className="px-3 py-2 text-left text-red-400">Tên</th>
                                                                <th className="px-3 py-2 text-left text-red-400">Lý do lỗi</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-red-600/20">
                                                            {batchResult.errorList.map((err, i) => (
                                                                <tr key={i}>
                                                                    <td className="px-3 py-2 text-gray-300">{err.mssv}</td>
                                                                    <td className="px-3 py-2 text-gray-300">{err.ten}</td>
                                                                    <td className="px-3 py-2 text-red-400">{err.ly_do}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={closeBatchModal}
                                            className="mt-5 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                        >
                                            Hoàn thành
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== MODAL XÁC NHẬN XÓA ==================== */}
                {showDeleteModal && selectedCard && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md">
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle size={32} className="text-red-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white mb-2">Xác nhận Xóa</h2>
                                <p className="text-gray-400 mb-2">
                                    Bạn có chắc chắn muốn xóa thẻ sinh viên:
                                </p>
                                <p className="text-white font-medium mb-1">{selectedCard.student_name}</p>
                                <p className="text-blue-400 font-mono text-sm mb-5">MSSV: {selectedCard.student_code}</p>
                                <p className="text-red-400 text-xs mb-6">⚠️ Hành động này không thể hoàn tác.</p>
                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        disabled={saving}
                                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Đang xóa...' : 'Xóa'}
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

export default StudentCardManagement;
