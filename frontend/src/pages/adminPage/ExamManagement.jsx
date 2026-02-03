import React, { useState, useEffect } from 'react';
import {
    Search, Edit2, Trash2, Eye, Clock, BookOpen,
    ChevronLeft, ChevronRight, X, Save, Check, AlertTriangle, Users
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axiosClient from '../../api/axiosClient';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { useLanguage } from '../../context/LanguageContext';

const ExamManagement = () => {
    const { t } = useLanguage();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [selectedExam, setSelectedExam] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showEditTimeModal, setShowEditTimeModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [newTimeClose, setNewTimeClose] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Fetch exams
    const fetchExams = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page,
                limit,
                ...(statusFilter !== 'all' && { status: statusFilter }),
                ...(searchTerm && { search: searchTerm })
            });

            const response = await axiosClient.get(`/admin/exams?${params}`);

            if (response.data.success) {
                setExams(response.data.exams);
                setTotal(response.data.total);
            }
        } catch (error) {
            console.error('Error fetching exams:', error);
            setMessage({ type: 'error', text: 'Lỗi khi tải danh sách bài thi' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExams();
    }, [page, statusFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm !== '') {
                setPage(1);
                fetchExams();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // View exam details
    const handleView = async (examId) => {
        try {
            const response = await axiosClient.get(`/admin/exams/${examId}`);
            if (response.data.success) {
                setSelectedExam({ ...response.data.exam, questions: response.data.questions });
                setShowViewModal(true);
            }
        } catch (error) {
            console.error('Error fetching exam:', error);
        }
    };

    // Edit time
    const handleEditTime = (exam) => {
        setSelectedExam(exam);
        // Format datetime for input
        const timeClose = exam.time_close ? new Date(exam.time_close).toISOString().slice(0, 16) : '';
        setNewTimeClose(timeClose);
        setShowEditTimeModal(true);
    };

    const handleSaveTime = async () => {
        try {
            setSaving(true);
            const response = await axiosClient.put(`/admin/exams/${selectedExam.id}/time`, {
                time_close: newTimeClose
            });

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Cập nhật thời gian thành công!' });
                setShowEditTimeModal(false);
                fetchExams();
            }
        } catch (error) {
            console.error('Error updating exam time:', error);
            setMessage({ type: 'error', text: error.response?.data?.message || 'Lỗi khi cập nhật' });
        } finally {
            setSaving(false);
        }
    };

    // Delete exam
    const handleDelete = (exam) => {
        setSelectedExam(exam);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            setSaving(true);
            const response = await axiosClient.delete(`/admin/exams/${selectedExam.id}`);

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Xóa bài thi thành công!' });
                setShowDeleteModal(false);
                fetchExams();
            }
        } catch (error) {
            console.error('Error deleting exam:', error);
            setMessage({ type: 'error', text: error.response?.data?.message || 'Lỗi khi xóa' });
        } finally {
            setSaving(false);
        }
    };

    // Clear message after 3 seconds
    useEffect(() => {
        if (message.text) {
            const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const totalPages = Math.ceil(total / limit);

    const getStatusBadge = (exam) => {
        const now = new Date();
        const timeOpen = exam.time_open ? new Date(exam.time_open) : null;
        const timeClose = exam.time_close ? new Date(exam.time_close) : null;

        if (timeOpen && timeClose && now >= timeOpen && now <= timeClose) {
            return { label: t('ongoing'), class: 'bg-green-600/20 text-green-400 border border-green-600/30' };
        } else if (timeOpen && now < timeOpen) {
            return { label: t('upcoming'), class: 'bg-blue-600/20 text-blue-400 border border-blue-600/30' };
        } else if (timeClose && now > timeClose) {
            return { label: t('ended'), class: 'bg-gray-600/20 text-gray-300 border border-gray-600/30' };
        } else if (exam.status === 'draft') {
            return { label: t('draft'), class: 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' };
        } else {
            return { label: exam.status, class: 'bg-gray-600/20 text-gray-300 border border-gray-600/30' };
        }
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'Chưa đặt';
        return new Date(dateStr).toLocaleString('vi-VN');
    };

    return (
        <div className="flex min-h-screen bg-gray-900">
            <AdminSidebar activeTab="exams" />

            <main className="flex-1 p-8 overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-semibold text-white">{t('examManagement')}</h1>
                        <p className="text-gray-300 mt-1">{t('examManagement')}</p>
                    </div>
                </div>

                {/* Message Toast */}
                {message.text && (
                    <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                        } text-white flex items-center gap-2`}>
                        {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                        {message.text}
                    </div>
                )}

                {/* Filters */}
                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                        <input
                            type="text"
                            placeholder={t('searchExam')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="all">{t('allStatus')}</option>
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>

                {/* Exams Table */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t('exam')}</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t('instructor')}</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t('status')}</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t('time')}</th>
                                <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">{t('questions')}</th>
                                <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">{t('candidates')}</th>
                                <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-300">
                                        {t('loading')}
                                    </td>
                                </tr>
                            ) : exams.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-300">
                                        {t('noData')}
                                    </td>
                                </tr>
                            ) : (
                                exams.map((exam) => {
                                    const status = getStatusBadge(exam);
                                    const canDelete = exam.can_delete;

                                    return (
                                        <tr key={exam.id} className="hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                                                        <BookOpen className="text-blue-400" size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-medium">{exam.title}</p>
                                                        <p className="text-gray-300 text-xs">{exam.exam_room_code || 'Không có mã phòng'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-300">{exam.instructor_name || 'N/A'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.class}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs">
                                                    <p className="text-gray-300">Mở: {formatDateTime(exam.time_open)}</p>
                                                    <p className="text-gray-300">Đóng: {formatDateTime(exam.time_close)}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm text-gray-300">{exam.total_questions || 0}</td>
                                            <td className="px-6 py-4 text-center text-sm text-gray-300">{exam.total_submissions || 0}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleView(exam.id)}
                                                        className="p-2 text-gray-300 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditTime(exam)}
                                                        className="p-2 text-gray-300 hover:text-yellow-400 hover:bg-yellow-600/10 rounded-lg transition-colors"
                                                        title="Sửa thời gian"
                                                    >
                                                        <Clock size={16} />
                                                    </button>
                                                    {canDelete ? (
                                                        <button
                                                            onClick={() => handleDelete(exam)}
                                                            className="p-2 text-gray-300 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors"
                                                            title="Xóa"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            disabled
                                                            className="p-2 text-gray-600 cursor-not-allowed"
                                                            title="Không thể xóa bài thi đang diễn ra"
                                                        >
                                                            <Trash2 size={16} />
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

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
                            <span className="text-sm text-gray-300">
                                Hiển thị {(page - 1) * limit + 1} - {Math.min(page * limit, total)} trong tổng số {total} bài thi
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <span className="text-white">Trang {page} / {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* View Modal */}
                {showViewModal && selectedExam && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto py-8">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl mx-4">
                            <div className="flex justify-between items-center p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                                <h2 className="text-xl font-semibold text-white">Chi tiết bài thi</h2>
                                <button onClick={() => setShowViewModal(false)} className="text-gray-300 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-2">{selectedExam.title}</h3>
                                    <p className="text-gray-300">Giảng viên: {selectedExam.instructor_name || 'N/A'}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-700/50 p-4 rounded-lg">
                                        <p className="text-xs text-gray-300 uppercase mb-1">Thời gian mở</p>
                                        <p className="text-white">{formatDateTime(selectedExam.time_open)}</p>
                                    </div>
                                    <div className="bg-gray-700/50 p-4 rounded-lg">
                                        <p className="text-xs text-gray-300 uppercase mb-1">Thời gian đóng</p>
                                        <p className="text-white">{formatDateTime(selectedExam.time_close)}</p>
                                    </div>
                                    <div className="bg-gray-700/50 p-4 rounded-lg">
                                        <p className="text-xs text-gray-300 uppercase mb-1">Thời lượng</p>
                                        <p className="text-white">{selectedExam.duration_minutes || 0} phút</p>
                                    </div>
                                    <div className="bg-gray-700/50 p-4 rounded-lg">
                                        <p className="text-xs text-gray-300 uppercase mb-1">Điểm tối đa</p>
                                        <p className="text-white">{selectedExam.max_points || 100}</p>
                                    </div>
                                </div>

                                {selectedExam.questions && selectedExam.questions.length > 0 && (
                                    <div>
                                        <h4 className="text-white font-medium mb-3">Danh sách câu hỏi ({selectedExam.questions.length})</h4>
                                        <div className="space-y-3 max-h-60 overflow-y-auto">
                                            {selectedExam.questions.map((q, idx) => (
                                                <div key={q.id} className="bg-gray-700/30 p-3 rounded-lg">
                                                    <p className="text-sm text-gray-300">
                                                        <span className="text-blue-400 font-medium">Q{idx + 1}:</span> {q.question_text?.slice(0, 100)}...
                                                    </p>
                                                    <span className="text-xs text-gray-300">{q.type} • {q.points || 1} điểm</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Time Modal */}
                {showEditTimeModal && selectedExam && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4">
                            <div className="flex justify-between items-center p-6 border-b border-gray-700">
                                <h2 className="text-xl font-semibold text-white">Cập nhật thời gian kết thúc</h2>
                                <button onClick={() => setShowEditTimeModal(false)} className="text-gray-300 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-gray-300">Bài thi: <span className="text-white font-medium">{selectedExam.title}</span></p>
                                <div>
                                    <label className="block text-sm text-gray-300 mb-2">Thời gian kết thúc mới</label>
                                    <DatePicker
                                        selected={newTimeClose ? new Date(newTimeClose) : null}
                                        onChange={(date) => {
                                            if (date) {
                                                // Format as local datetime string for MySQL (YYYY-MM-DD HH:mm:ss)
                                                const year = date.getFullYear();
                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                const day = String(date.getDate()).padStart(2, '0');
                                                const hours = String(date.getHours()).padStart(2, '0');
                                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                                const formatted = `${year}-${month}-${day} ${hours}:${minutes}:00`;
                                                setNewTimeClose(formatted);
                                            } else {
                                                setNewTimeClose('');
                                            }
                                        }}
                                        showTimeSelect
                                        timeFormat="HH:mm"
                                        timeIntervals={15}
                                        dateFormat="dd/MM/yyyy HH:mm"
                                        minDate={new Date()}
                                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                        calendarClassName="bg-gray-800 border-gray-700"
                                        placeholderText="Chọn thời gian..."
                                    />
                                </div>
                                <p className="text-xs text-gray-300">
                                    * Thời gian kết thúc phải sau thời điểm hiện tại
                                </p>
                            </div>
                            <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
                                <button
                                    onClick={() => setShowEditTimeModal(false)}
                                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSaveTime}
                                    disabled={saving || !newTimeClose}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    {saving ? 'Đang lưu...' : 'Lưu'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteModal && selectedExam && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="text-red-400" size={32} />
                                </div>
                                <h2 className="text-xl font-semibold text-white mb-2">Xác nhận xóa</h2>
                                <p className="text-gray-300 mb-6">
                                    Bạn có chắc chắn muốn xóa bài thi <span className="text-white font-medium">"{selectedExam.title}"</span>?
                                    Tất cả câu hỏi và kết quả thi cũng sẽ bị xóa.
                                </p>
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

export default ExamManagement;


