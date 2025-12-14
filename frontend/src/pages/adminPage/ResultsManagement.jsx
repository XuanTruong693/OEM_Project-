import React, { useState, useEffect } from 'react';
import {
    Search, Edit2, Trash2, ChevronLeft, ChevronRight,
    X, Save, Check, AlertTriangle, Award, BookOpen
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { useLanguage } from '../../context/LanguageContext';

const ResultsManagement = () => {
    const { t } = useLanguage();
    const [results, setResults] = useState([]);
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(15);
    const [examFilter, setExamFilter] = useState('');

    // Modal states
    const [selectedResult, setSelectedResult] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [newScore, setNewScore] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Fetch results
    const fetchResults = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page,
                limit,
                ...(examFilter && { exam_id: examFilter })
            });

            const response = await axiosClient.get(`/admin/results?${params}`);

            if (response.data.success) {
                setResults(response.data.results);
                setTotal(response.data.total);
                if (response.data.exams) {
                    setExams(response.data.exams);
                }
            }
        } catch (error) {
            console.error('Error fetching results:', error);
            setMessage({ type: 'error', text: 'Lỗi khi tải kết quả thi' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResults();
    }, [page, examFilter]);

    // Edit score
    const handleEdit = (result) => {
        setSelectedResult(result);
        // Điểm tổng tạm để admin xác nhận (suggested_total_score)
        setNewScore(result.suggested_total_score?.toString() || (parseFloat(result.total_score || 0) + parseFloat(result.ai_score || 0)).toFixed(1));
        setShowEditModal(true);
    };

    const handleSaveScore = async () => {
        try {
            setSaving(true);
            const response = await axiosClient.put(`/admin/results/${selectedResult.submission_id}`, {
                suggested_total_score: parseFloat(newScore)
            });

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Cập nhật điểm thành công!' });
                setShowEditModal(false);
                fetchResults();
            }
        } catch (error) {
            console.error('Error updating score:', error);
            setMessage({ type: 'error', text: error.response?.data?.message || 'Lỗi khi cập nhật' });
        } finally {
            setSaving(false);
        }
    };

    // Delete result
    const handleDelete = (result) => {
        setSelectedResult(result);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            setSaving(true);
            const response = await axiosClient.delete(`/admin/results/${selectedResult.submission_id}`);

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Xóa kết quả thành công!' });
                setShowDeleteModal(false);
                fetchResults();
            }
        } catch (error) {
            console.error('Error deleting result:', error);
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

    const getStatusBadge = (status) => {
        switch (status) {
            case 'confirmed': return { label: t('confirmed'), class: 'bg-green-600/20 text-green-400' };
            case 'graded': return { label: t('confirmed'), class: 'bg-blue-600/20 text-blue-400' };
            case 'pending': return { label: t('pending'), class: 'bg-yellow-600/20 text-yellow-400' };
            case 'submitted': return { label: t('pending'), class: 'bg-purple-600/20 text-purple-400' };
            default: return { label: status || 'N/A', class: 'bg-gray-600/20 text-gray-400' };
        }
    };

    const getScoreColor = (score) => {
        if (score === null || score === undefined) return 'text-gray-400';
        if (score >= 8) return 'text-green-400';
        if (score >= 5) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="flex min-h-screen bg-gray-900">
            <AdminSidebar activeTab="results" />

            <main className="flex-1 p-8 overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-semibold text-white">{t('results')}</h1>
                        <p className="text-gray-400 mt-1">{t('results')}</p>
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
                    <select
                        value={examFilter}
                        onChange={(e) => { setExamFilter(e.target.value); setPage(1); }}
                        className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 min-w-[300px]"
                    >
                        <option value="">{t('allExams')}</option>
                        {exams.map(exam => (
                            <option key={exam.id} value={exam.id}>{exam.title}</option>
                        ))}
                    </select>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">{t('totalResults')}</p>
                        <p className="text-2xl font-bold text-white">{total}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">{t('confirmed')}</p>
                        <p className="text-2xl font-bold text-green-400">
                            {results.filter(r => r.status === 'confirmed').length}
                        </p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">{t('pending')}</p>
                        <p className="text-2xl font-bold text-yellow-400">
                            {results.filter(r => r.status === 'pending' || r.status === 'submitted').length}
                        </p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">{t('avgScore')}</p>
                        <p className="text-2xl font-bold text-blue-400">
                            {results.length > 0
                                ? (results.reduce((acc, r) => acc + (r.total_score || 0), 0) / results.length).toFixed(1)
                                : 'N/A'
                            }
                        </p>
                    </div>
                </div>

                {/* Results Table */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('student')}</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('exam')}</th>
                                <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">{t('score')}</th>
                                <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">{t('aiScore')}</th>
                                <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">{t('status')}</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('submittedAt')}</th>
                                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                                        {t('loading')}
                                    </td>
                                </tr>
                            ) : results.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                                        {t('noData')}
                                    </td>
                                </tr>
                            ) : (
                                results.map((result) => {
                                    const status = getStatusBadge(result.status);

                                    return (
                                        <tr key={result.submission_id} className="hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="text-white font-medium">{result.student_name}</p>
                                                    <p className="text-gray-400 text-xs">{result.student_email}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="text-blue-400" size={16} />
                                                    <span className="text-gray-300">{result.exam_title}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`text-xl font-bold ${getScoreColor(result.total_score)}`}>
                                                    {result.total_score?.toFixed(1) || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-gray-400">
                                                    {result.ai_score?.toFixed(1) || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.class}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-400">
                                                {result.submitted_at
                                                    ? new Date(result.submitted_at).toLocaleString('vi-VN')
                                                    : 'N/A'
                                                }
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(result)}
                                                        className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-600/10 rounded-lg transition-colors"
                                                        title="Sửa điểm"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(result)}
                                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
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
                            <span className="text-sm text-gray-400">
                                Hiển thị {(page - 1) * limit + 1} - {Math.min(page * limit, total)} trong tổng số {total} kết quả
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <span className="text-white">Trang {page} / {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Edit Score Modal */}
                {showEditModal && selectedResult && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4">
                            <div className="flex justify-between items-center p-6 border-b border-gray-700">
                                <h2 className="text-xl font-semibold text-white">Sửa điểm</h2>
                                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <p className="text-gray-400 text-sm">Sinh viên</p>
                                    <p className="text-white font-medium">{selectedResult.student_name}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-sm">Bài thi</p>
                                    <p className="text-white">{selectedResult.exam_title}</p>
                                </div>

                                {/* 3 Cột điểm: MCQ, Tự luận, Tổng tạm */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-gray-700/50 p-3 rounded-lg text-center">
                                        <p className="text-gray-400 text-xs mb-1">MCQ</p>
                                        <p className="text-xl font-bold text-blue-400">
                                            {selectedResult.total_score != null ? selectedResult.total_score.toFixed(1) : '-'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-700/50 p-3 rounded-lg text-center">
                                        <p className="text-gray-400 text-xs mb-1">Tự luận</p>
                                        <p className="text-xl font-bold text-purple-400">
                                            {selectedResult.ai_score != null ? selectedResult.ai_score.toFixed(1) : '-'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-700/50 p-3 rounded-lg text-center">
                                        <p className="text-gray-400 text-xs mb-1">Tổng tạm</p>
                                        <p className="text-xl font-bold text-green-400">
                                            {selectedResult.suggested_total_score != null
                                                ? selectedResult.suggested_total_score.toFixed(1)
                                                : (parseFloat(selectedResult.total_score || 0) + parseFloat(selectedResult.ai_score || 0)).toFixed(1)}
                                        </p>
                                    </div>
                                </div>

                                {/* Input sửa điểm tổng tạm */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Điểm tổng tạm mới (xác nhận điểm cuối cùng)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        step="0.1"
                                        value={newScore}
                                        onChange={(e) => setNewScore(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-xl font-bold text-center focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSaveScore}
                                    disabled={saving}
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
                {showDeleteModal && selectedResult && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="text-red-400" size={32} />
                                </div>
                                <h2 className="text-xl font-semibold text-white mb-2">Xác nhận xóa</h2>
                                <p className="text-gray-400 mb-6">
                                    Bạn có chắc chắn muốn xóa kết quả thi của <span className="text-white font-medium">{selectedResult.student_name}</span> trong bài thi "{selectedResult.exam_title}"?
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

export default ResultsManagement;
