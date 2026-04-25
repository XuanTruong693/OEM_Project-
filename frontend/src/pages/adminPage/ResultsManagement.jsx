import React, { useState, useEffect } from 'react';
import {
    Search, Edit2, Trash2, ChevronLeft, ChevronRight,
    X, Save, Check, AlertTriangle, Award, BookOpen,
    FileText, CheckCircle, TrendingUp, GraduationCap, Clock,
    ChevronDown, ChevronUp
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
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [selectedResult, setSelectedResult] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [newMcqScore, setNewMcqScore] = useState('');
    const [newEssayScore, setNewEssayScore] = useState('');
    const [newTotalScore, setNewTotalScore] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Question breakdown states
    const [submissionQuestions, setSubmissionQuestions] = useState(null);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [expandedQuestions, setExpandedQuestions] = useState({}); // { questionId: boolean }

    // Fetch results
    const fetchResults = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page,
                limit,
                ...(examFilter && { exam_id: examFilter }),
                ...(searchTerm && { search: searchTerm })
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
    }, [page, examFilter, searchTerm]);

    // Edit score
    const handleEdit = async (result) => {
        setSelectedResult(result);
        // Set initial values for all score fields
        setNewMcqScore(result.total_score?.toString() || '0');
        setNewEssayScore(result.ai_score?.toString() || '0');
        const total = result.suggested_total_score ?? (parseFloat(result.total_score || 0) + parseFloat(result.ai_score || 0));
        setNewTotalScore(total.toFixed(1));
        setShowEditModal(true);

        // Fetch detailed questions
        try {
            setLoadingQuestions(true);
            setSubmissionQuestions(null);
            const response = await axiosClient.get(`/admin/submissions/${result.submission_id}/questions`);

            const questions = response.data?.questions || [];
            const answers = response.data?.answers || [];
            const options = response.data?.options || [];

            // Map answers to questions
            const answerMap = new Map(answers.map((a) => [a.question_id, a]));
            const optionsByQ = (options || []).reduce((acc, o) => {
                (acc[o.question_id] ||= []).push(o);
                return acc;
            }, {});

            const merged = questions.map((q) => {
                const answer = answerMap.get(q.question_id);
                return {
                    ...q,
                    options: q.type === 'MCQ' ? optionsByQ[q.question_id] || [] : [],
                    answer: answer || null,
                };
            });

            setSubmissionQuestions(merged);
        } catch (error) {
            console.error('Error fetching submission questions:', error);
            setSubmissionQuestions([]);
        } finally {
            setLoadingQuestions(false);
        }
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

                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative w-full md:max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder={t('searchStudentPlaceholder') || "Tìm tên hoặc email sinh viên..."}
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg text-white [.light-theme_&]:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                        />
                    </div>
                    <div className="relative w-full md:w-64">
                        <select
                            value={examFilter}
                            onChange={(e) => { setExamFilter(e.target.value); setPage(1); }}
                            className="w-full px-4 py-2.5 bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg text-white [.light-theme_&]:text-gray-900 focus:outline-none focus:border-blue-500 shadow-sm transition-colors cursor-pointer"
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

            {/* Edit Score Modal (Large Split View) */}
            {showEditModal && selectedResult && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-700 [.light-theme_&]:border-gray-200 bg-gray-800/50 [.light-theme_&]:bg-gray-50/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <Edit2 className="text-blue-400 [.light-theme_&]:text-blue-600" size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white [.light-theme_&]:text-gray-900">{t('reviewAndEditScore') || "Xem & Chỉnh sửa điểm"}</h2>
                                    <p className="text-gray-400 text-xs">{selectedResult.student_email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="p-2 text-gray-400 hover:text-white [.light-theme_&]:hover:text-gray-900 hover:bg-gray-700/50 [.light-theme_&]:hover:bg-gray-100 rounded-full transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body - Split View */}
                        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                            {/* Left Panel - Score Settings */}
                            <div className="w-full lg:w-[35%] p-6 bg-gray-800/30 [.light-theme_&]:bg-gray-50/30 border-r border-gray-700 [.light-theme_&]:border-gray-200 overflow-y-auto space-y-6">
                                {/* Student Info Card */}
                                <div className="bg-gray-800 [.light-theme_&]:bg-white p-4 rounded-xl border border-gray-700 [.light-theme_&]:border-gray-200 shadow-sm transition-colors">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-700 [.light-theme_&]:border-gray-100 pb-2">{t('studentInfo') || "Thông tin sinh viên"}</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                                                {selectedResult.student_name?.[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-white [.light-theme_&]:text-gray-900 font-bold">{selectedResult.student_name}</p>
                                                <p className="text-gray-400 text-xs">ID: {selectedResult.student_id}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-300 [.light-theme_&]:text-gray-600">
                                            <BookOpen size={14} className="text-blue-400" />
                                            <span className="truncate">{selectedResult.exam_title}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-300 [.light-theme_&]:text-gray-600">
                                            <Clock size={14} className="text-purple-400" />
                                            <span>
                                                {selectedResult.submitted_at
                                                    ? new Date(selectedResult.submitted_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')
                                                    : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Score Inputs */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-b border-gray-700 [.light-theme_&]:border-gray-100 pb-2">{t('gradingInputs') || "Nhập điểm thành phần"}</h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-gray-400">{t('mcqScore') || "Điểm Trắc nghiệm"}</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="10"
                                                    step="0.1"
                                                    value={newMcqScore}
                                                    onChange={(e) => handleMcqChange(e.target.value)}
                                                    className="w-full pl-4 pr-10 py-3 bg-gray-800 [.light-theme_&]:bg-white border-2 border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl text-blue-400 text-2xl font-bold focus:outline-none focus:border-blue-500 transition-all text-center"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">/10</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-gray-400">{t('essayScore') || "Điểm Tự luận"}</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="10"
                                                    step="0.1"
                                                    value={newEssayScore}
                                                    onChange={(e) => handleEssayChange(e.target.value)}
                                                    className="w-full pl-4 pr-10 py-3 bg-gray-800 [.light-theme_&]:bg-white border-2 border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl text-purple-400 text-2xl font-bold focus:outline-none focus:border-purple-500 transition-all text-center"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">/10</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Final Score Large Output */}
                                    <div className="bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10 p-6 rounded-2xl border-2 border-dashed border-blue-500/30 text-center space-y-2 group hover:border-blue-500/50 transition-all duration-300">
                                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{t('finalGrandTotal') || "TỔNG ĐIỂM CUỐI CÙNG"}</p>
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 drop-shadow-sm font-mono">
                                                {parseFloat(newTotalScore || 0).toFixed(1)}
                                            </span>
                                            <span className="text-2xl font-bold text-gray-500 mt-4">/10</span>
                                        </div>
                                        <div className="pt-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${parseFloat(newTotalScore) >= 5
                                                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                                                }`}>
                                                {parseFloat(newTotalScore) >= 5 ? (t('pass') || "ĐẠT") : (t('fail') || "KHÔNG ĐẠT")}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Warning Section */}
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex gap-3">
                                        <AlertTriangle className="text-yellow-500 shrink-0" size={18} />
                                        <p className="text-[11px] text-yellow-500/80 italic leading-relaxed">
                                            <strong>{t('note') || "Ghi chú"}:</strong> {t('adminScoreNote') || "Admin có thể sửa trực tiếp cả điểm trắc nghiệm và tự luận. Điểm sau khi lưu sẽ được hệ thống đồng bộ và gửi thông báo tới sinh viên."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel - Detailed Question Breakdown */}
                            <div className="w-full lg:w-[65%] flex flex-col bg-gray-900 [.light-theme_&]:bg-white transition-colors">
                                <div className="p-4 border-b border-gray-700 [.light-theme_&]:border-gray-200 flex justify-between items-center bg-gray-800/20 [.light-theme_&]:bg-gray-50/50 transition-colors">
                                    <h3 className="text-sm font-bold text-gray-300 [.light-theme_&]:text-gray-700 flex items-center gap-2">
                                        <FileText size={16} />
                                        {t('detailedSubmissionReview') || "Chi tiết bài làm & Đáp án"}
                                    </h3>
                                    {submissionQuestions && (
                                        <span className="text-xs bg-gray-700 [.light-theme_&]:bg-gray-200 text-gray-400 [.light-theme_&]:text-gray-600 px-2 py-1 rounded">
                                            {submissionQuestions.length} {t('questions') || "câu hỏi"}
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                                    {loadingQuestions ? (
                                        <div className="h-full flex flex-col items-center justify-center space-y-3 text-gray-500">
                                            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                                            <p className="text-sm font-medium">{t('loadingDetailedQuestions') || "Đang tải chi tiết bài làm..."}</p>
                                        </div>
                                    ) : !submissionQuestions || submissionQuestions.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center space-y-3 text-gray-500 opacity-50">
                                            <FileText size={48} strokeWidth={1} />
                                            <p className="text-sm">{t('noSubmissionDetailFound') || "Không tìm thấy dữ liệu chi tiết bài thi."}</p>
                                        </div>
                                    ) : (
                                        submissionQuestions.map((q, idx) => (
                                            <div key={q.id} className="bg-gray-800/40 [.light-theme_&]:bg-gray-50 border border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl overflow-hidden transition-all group">
                                                {/* Question Header */}
                                                <div
                                                    className="p-4 flex items-start gap-4 cursor-pointer hover:bg-gray-800/60 [.light-theme_&]:hover:bg-gray-100/50 transition-colors"
                                                    onClick={() => setExpandedQuestions(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                                                >
                                                    <div className="shrink-0 w-8 h-8 rounded-lg bg-gray-700 [.light-theme_&]:bg-white border border-gray-600 [.light-theme_&]:border-gray-200 flex items-center justify-center text-sm font-bold text-blue-400 [.light-theme_&]:text-blue-600 transition-colors">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${q.type === 'MCQ'
                                                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                                    : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                                }`}>
                                                                {q.type === 'MCQ' ? 'Trắc nghiệm' : 'Tự luận'}
                                                            </span>
                                                            <span className="text-[10px] text-gray-500 font-medium">
                                                                {q.points || 0} {t('points') || "điểm"}
                                                            </span>
                                                            {q.type === 'MCQ' && q.answer && (
                                                                <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold ${q.answer.score > 0
                                                                        ? 'bg-green-500/10 text-green-500'
                                                                        : 'bg-red-500/10 text-red-500'
                                                                    }`}>
                                                                    {q.answer.score > 0 ? (t('correct') || "ĐÚNG") : (t('incorrect') || "SAI")}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div
                                                            className="text-sm text-gray-200 [.light-theme_&]:text-gray-800 line-clamp-2 group-hover:line-clamp-none transition-all"
                                                            dangerouslySetInnerHTML={{ __html: q.question_text }}
                                                        />
                                                    </div>
                                                    <div className="shrink-0 text-gray-500">
                                                        {expandedQuestions[q.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                    </div>
                                                </div>

                                                {/* Expanded Content */}
                                                {expandedQuestions[q.id] && (
                                                    <div className="p-4 pt-0 border-t border-gray-700/50 [.light-theme_&]:border-gray-200/50 bg-gray-900/40 [.light-theme_&]:bg-white/50 space-y-4">
                                                        {/* MCQ Options */}
                                                        {q.type === 'MCQ' && (
                                                            <div className="grid grid-cols-1 gap-2 mt-4">
                                                                {q.options.map(opt => {
                                                                    const isSelected = q.answer?.selected_option_id === opt.id;
                                                                    const isCorrect = opt.is_correct;

                                                                    let statusClass = "border-gray-700 [.light-theme_&]:border-gray-200 opacity-60";
                                                                    if (isSelected && isCorrect) statusClass = "border-green-500/50 bg-green-500/5 bg-green-50 font-bold opacity-100 ring-1 ring-green-500/20";
                                                                    else if (isSelected && !isCorrect) statusClass = "border-red-500/50 bg-red-500/5 bg-red-50 font-bold opacity-100 ring-1 ring-red-500/20";
                                                                    else if (isCorrect) statusClass = "border-green-500/30 bg-green-500/5 bg-green-50 opacity-100 border-dashed";

                                                                    return (
                                                                        <div key={opt.id} className={`flex items-start gap-3 p-3 rounded-xl border text-xs transition-all ${statusClass}`}>
                                                                            <div className="shrink-0 mt-0.5">
                                                                                {isSelected ? (
                                                                                    isCorrect ? <CheckCircle className="text-green-500" size={14} /> : <X className="text-red-500" size={14} />
                                                                                ) : isCorrect ? (
                                                                                    <div className="w-3.5 h-3.5 border-2 border-green-500 rounded-full"></div>
                                                                                ) : (
                                                                                    <div className="w-3.5 h-3.5 border-2 border-gray-600 rounded-full"></div>
                                                                                )}
                                                                            </div>
                                                                            <span className="flex-1 text-gray-300 [.light-theme_&]:text-gray-700">{opt.option_text}</span>
                                                                            {isSelected && <span className="text-[9px] uppercase font-black text-gray-500">Student's Choice</span>}
                                                                            {isCorrect && !isSelected && <span className="text-[9px] uppercase font-black text-green-500/70">Correct Answer</span>}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Essay Content */}
                                                        {q.type === 'Essay' && (
                                                            <div className="space-y-4 mt-4">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                                                        <FileText size={10} />
                                                                        {t('studentAnswer') || "Bài làm của sinh viên"}
                                                                    </div>
                                                                    <div className="p-4 bg-gray-800 [.light-theme_&]:bg-gray-100 rounded-xl border border-gray-700 [.light-theme_&]:border-gray-200 text-sm text-gray-200 [.light-theme_&]:text-gray-700 whitespace-pre-wrap italic">
                                                                        {q.answer?.answer_text || "Không có nội dung trả lời."}
                                                                    </div>
                                                                </div>
                                                                {q.model_answer && (
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center gap-2 text-[10px] font-bold text-green-500 uppercase tracking-widest">
                                                                            <CheckCircle size={10} />
                                                                            {t('modelAnswer') || "Đáp án mẫu"}
                                                                        </div>
                                                                        <div className="p-4 bg-green-500/5 [.light-theme_&]:bg-green-50 rounded-xl border border-green-500/20 text-sm text-green-400 [.light-theme_&]:text-green-700 whitespace-pre-wrap font-medium">
                                                                            {q.model_answer}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-700 [.light-theme_&]:border-gray-200 flex justify-end gap-3 bg-gray-800/50 [.light-theme_&]:bg-gray-50/50 transition-colors">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="px-6 py-2.5 text-gray-400 hover:text-white [.light-theme_&]:hover:text-gray-900 font-semibold transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleSaveScore}
                                disabled={saving}
                                className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {saving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <Save size={20} />
                                )}
                                {saving ? t('saving') : t('saveAndConfirm') || "Lưu & Xác nhận"}
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
