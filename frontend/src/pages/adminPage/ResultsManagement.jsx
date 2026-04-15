import React, { useState, useEffect } from 'react';
import {
    Search, Edit2, Trash2, ChevronLeft, ChevronRight,
    X, Save, Check, AlertTriangle, Award, BookOpen
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { useLanguage } from '../../context/LanguageContext';

const ResultsManagement = () => {
    const { t, language } = useLanguage();
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
    const [newMcqScore, setNewMcqScore] = useState('');
    const [newEssayScore, setNewEssayScore] = useState('');
    const [newTotalScore, setNewTotalScore] = useState('');
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
        // Set initial values for all score fields
        setNewMcqScore(result.total_score?.toString() || '0');
        setNewEssayScore(result.ai_score?.toString() || '0');
        const total = result.suggested_total_score ?? (parseFloat(result.total_score || 0) + parseFloat(result.ai_score || 0));
        setNewTotalScore(total.toFixed(1));
        setShowEditModal(true);
    };

    // Auto-calculate total when MCQ or Essay changes
    const handleMcqChange = (val) => {
        setNewMcqScore(val);
        const mcq = parseFloat(val) || 0;
        const essay = parseFloat(newEssayScore) || 0;
        setNewTotalScore((mcq + essay).toFixed(1));
    };

    const handleEssayChange = (val) => {
        setNewEssayScore(val);
        const mcq = parseFloat(newMcqScore) || 0;
        const essay = parseFloat(val) || 0;
        setNewTotalScore((mcq + essay).toFixed(1));
    };

    const handleSaveScore = async () => {
        try {
            setSaving(true);
            const response = await axiosClient.put(`/admin/results/${selectedResult.submission_id}`, {
                mcq_score: parseFloat(newMcqScore) || 0,
                essay_score: parseFloat(newEssayScore) || 0,
                total_score: parseFloat(newTotalScore) || 0
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
        const config = {
            confirmed: { 
                label: t('confirmed'), 
                color: "bg-green-500/10 text-green-500 border-green-500/20 [.light-theme_&]:bg-green-50 [.light-theme_&]:text-green-600 [.light-theme_&]:border-green-200" 
            },
            graded: { 
                label: t('confirmed'), 
                color: "bg-blue-500/10 text-blue-500 border-blue-500/20 [.light-theme_&]:bg-blue-50 [.light-theme_&]:text-blue-600 [.light-theme_&]:border-blue-200" 
            },
            pending: { 
                label: t('pending'), 
                color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 [.light-theme_&]:bg-yellow-50 [.light-theme_&]:text-yellow-600 [.light-theme_&]:border-yellow-200" 
            },
            submitted: { 
                label: t('pending'), 
                color: "bg-purple-500/10 text-purple-500 border-purple-500/20 [.light-theme_&]:bg-purple-50 [.light-theme_&]:text-purple-600 [.light-theme_&]:border-purple-200" 
            },
            default: { 
                label: status || 'N/A', 
                color: "bg-gray-500/10 text-gray-400 border-gray-500/20 [.light-theme_&]:bg-gray-50 [.light-theme_&]:text-gray-600 [.light-theme_&]:border-gray-200" 
            }
        };

        const { label, color } = config[status] || config.default;

        return (
            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border whitespace-nowrap shadow-sm transition-all duration-200 ${color}`}>
                {label}
            </span>
        );
    };

    const getScoreColor = (score) => {
        if (score === null || score === undefined) return 'text-gray-300';
        if (score >= 8) return 'text-green-400';
        if (score >= 5) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-gray-900 [.light-theme_&]:bg-gray-50 transition-colors">
            <AdminSidebar activeTab="results" />

            <main className="flex-1 p-4 pt-20 md:p-8 overflow-y-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 mb-8">
                    <div>
                        <h1 className="text-3xl font-semibold text-white [.light-theme_&]:text-gray-900 transition-colors">{t('resultsManagementTitle') || t('results')}</h1>
                        <p className="text-gray-300 [.light-theme_&]:text-gray-600 mt-1 transition-colors">{t('resultsManagementDesc') || t('results')}</p>
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
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative w-full md:max-w-md">
                        <select
                            value={examFilter}
                            onChange={(e) => { setExamFilter(e.target.value); setPage(1); }}
                            className="w-full px-4 py-2.5 bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg text-white [.light-theme_&]:text-gray-900 focus:outline-none focus:border-blue-500 shadow-sm transition-colors"
                        >
                            <option value="">{t('allExams')}</option>
                            {exams.map(exam => (
                                <option key={exam.id} value={exam.id}>{exam.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg p-5 shadow-sm transition-colors border-l-4 border-l-blue-500">
                        <p className="text-gray-400 [.light-theme_&]:text-gray-500 text-xs font-bold uppercase mb-1">{t('totalResults')}</p>
                        <p className="text-2xl font-bold text-white [.light-theme_&]:text-gray-900">{total}</p>
                    </div>
                    <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg p-5 shadow-sm transition-colors border-l-4 border-l-green-500">
                        <p className="text-gray-400 [.light-theme_&]:text-gray-500 text-xs font-bold uppercase mb-1">{t('confirmed')}</p>
                        <p className="text-2xl font-bold text-green-400 font-mono">
                            {results.filter(r => r.status === 'confirmed').length}
                        </p>
                    </div>
                    <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg p-5 shadow-sm transition-colors border-l-4 border-l-yellow-500">
                        <p className="text-gray-400 [.light-theme_&]:text-gray-500 text-xs font-bold uppercase mb-1">{t('pending')}</p>
                        <p className="text-2xl font-bold text-yellow-400 font-mono">
                            {results.filter(r => r.status === 'pending' || r.status === 'submitted').length}
                        </p>
                    </div>
                    <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg p-5 shadow-sm transition-colors border-l-4 border-l-purple-500">
                        <p className="text-gray-400 [.light-theme_&]:text-gray-500 text-xs font-bold uppercase mb-1">{t('avgScore')}</p>
                        <p className="text-2xl font-bold text-blue-400 font-mono">
                            {results.length > 0
                                ? (results.reduce((acc, r) => acc + (r.total_score || 0), 0) / results.length).toFixed(1)
                                : 'N/A'
                            }
                        </p>
                    </div>
                </div>

                {/* Results Table */}
                <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl overflow-hidden shadow-sm transition-colors">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead className="bg-gray-700/50 [.light-theme_&]:bg-gray-50 border-b border-gray-700 [.light-theme_&]:border-gray-200 transition-colors">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('student')}</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('exam')}</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('score')}</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('aiScore')}</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('status')}</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('submittedAt')}</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('action')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700 [.light-theme_&]:divide-gray-100 transition-colors">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-8 text-center text-gray-300">
                                            {t('loading')}
                                        </td>
                                    </tr>
                                ) : results.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-8 text-center text-gray-300">
                                            {t('noData')}
                                        </td>
                                    </tr>
                                ) : (
                                    results.map((result) => {
                                        const status = getStatusBadge(result.status);

                                        return (
                                            <tr key={result.submission_id} className="hover:bg-gray-700/30 [.light-theme_&]:hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="text-white [.light-theme_&]:text-gray-900 font-bold transition-colors">{result.student_name}</p>
                                                        <p className="text-gray-400 [.light-theme_&]:text-gray-500 text-xs transition-colors">{result.student_email}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <BookOpen className="text-blue-400 [.light-theme_&]:text-blue-600 shadow-sm" size={16} />
                                                        <span className="text-gray-300 [.light-theme_&]:text-gray-700 font-medium transition-colors">{result.exam_title}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-xl font-bold font-mono drop-shadow-sm ${getScoreColor(result.total_score)}`}>
                                                        {result.total_score?.toFixed(1) || '0.0'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-gray-300 [.light-theme_&]:text-gray-600 font-bold font-mono transition-colors">
                                                        {result.ai_score?.toFixed(1) || '0.0'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {getStatusBadge(result.status)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-400 [.light-theme_&]:text-gray-500 transition-colors">
                                                    {result.submitted_at
                                                        ? new Date(result.submitted_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')
                                                        : 'N/A'
                                                    }
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEdit(result)}
                                                            className="p-2 text-gray-300 hover:text-yellow-400 hover:bg-yellow-600/10 rounded-lg transition-colors"
                                                            title="Sửa điểm"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(result)}
                                                            className="p-2 text-gray-300 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors"
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
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-700 [.light-theme_&]:border-gray-100 transition-colors">
                            <span className="text-sm text-gray-400 [.light-theme_&]:text-gray-600 text-center md:text-left transition-colors">
                                {t('showing')} {(page - 1) * limit + 1} - {Math.min(page * limit, total)} {t('of')} {total} {t('results')}
                            </span>
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 text-gray-400 [.light-theme_&]:text-gray-500 hover:text-white [.light-theme_&]:hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <span className="text-white [.light-theme_&]:text-gray-900 font-medium">{t('page')} {page} / {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 text-gray-400 [.light-theme_&]:text-gray-500 hover:text-white [.light-theme_&]:hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Edit Score Modal */}
            {showEditModal && selectedResult && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4">
                        <div className="flex justify-between items-center p-6 border-b border-gray-700">
                            <h2 className="text-xl font-semibold text-white">{t('editScore')}</h2>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-300 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-gray-300 text-sm">{t('student')}</p>
                                <p className="text-white font-medium">{selectedResult.student_name}</p>
                            </div>
                            <div>
                                <p className="text-gray-300 text-sm">{t('exam')}</p>
                                <p className="text-white">{selectedResult.exam_title}</p>
                            </div>

                            {/* 3 Cột điểm có thể sửa: MCQ, Tự luận, Tổng */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-gray-700/50 p-3 rounded-lg">
                                    <p className="text-gray-300 text-xs mb-2 text-center">{t('mcqScore')}</p>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        step="0.1"
                                        value={newMcqScore}
                                        onChange={(e) => handleMcqChange(e.target.value)}
                                        className="w-full px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-blue-400 text-xl font-bold text-center focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="bg-gray-700/50 p-3 rounded-lg">
                                    <p className="text-gray-300 text-xs mb-2 text-center">{t('essayScore')}</p>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        step="0.1"
                                        value={newEssayScore}
                                        onChange={(e) => handleEssayChange(e.target.value)}
                                        className="w-full px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-purple-400 text-xl font-bold text-center focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div className="bg-gray-700/50 p-3 rounded-lg">
                                    <p className="text-gray-300 text-xs mb-2 text-center">{t('totalScore')}</p>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        step="0.1"
                                        value={newTotalScore}
                                        onChange={(e) => setNewTotalScore(e.target.value)}
                                        className="w-full px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-green-400 text-xl font-bold text-center focus:outline-none focus:border-green-500"
                                    />
                                </div>
                            </div>

                            {/* Cảnh báo */}
                            <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-lg p-3">
                                <p className="text-yellow-400 text-xs italic">
                                    ⚠️ <strong>{t('note')}:</strong> {t('scoreUpdateNote')}
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleSaveScore}
                                disabled={saving}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save size={16} />
                                {saving ? t('saving') : t('save')}
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
                            <h2 className="text-xl font-semibold text-white mb-2">{t('confirmDelete')}</h2>
                            <p className="text-gray-300 mb-6">
                                {t('deleteConfirmResultText')} <span className="text-white font-medium">{selectedResult.student_name}</span> {t('inExam')} "{selectedResult.exam_title}"?
                            </p>
                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={saving}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {saving ? t('deleting') : t('delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultsManagement;
