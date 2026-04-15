import React, { useState, useEffect } from 'react';
import {
    Search, Eye, ChevronLeft, ChevronRight, BookOpen,
    Clock, Users, FileText, CheckCircle
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { useLanguage } from '../../context/LanguageContext';

const ExamOverview = () => {
    const { t, language } = useLanguage();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(12);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedExam, setSelectedExam] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    // Fetch exams
    const fetchExams = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page,
                limit,
                ...(searchTerm && { search: searchTerm })
            });

            const response = await axiosClient.get(`/admin/exams?${params}`);

            if (response.data.success) {
                setExams(response.data.exams);
                setTotal(response.data.total);
            }
        } catch (error) {
            console.error('Error fetching exams:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExams();
    }, [page]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm !== '') {
                setPage(1);
                fetchExams();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // View exam details with questions
    const handleViewDetails = async (exam) => {
        setSelectedExam(exam);
        setShowDetailModal(true);
        setLoadingQuestions(true);

        try {
            const response = await axiosClient.get(`/admin/exams/${exam.id}`);
            if (response.data.success) {
                setQuestions(response.data.questions || []);
            }
        } catch (error) {
            console.error('Error fetching questions:', error);
        } finally {
            setLoadingQuestions(false);
        }
    };

    const totalPages = Math.ceil(total / limit);

    const getStatusBadge = (exam) => {
        const now = new Date();
        const timeOpen = exam.time_open ? new Date(exam.time_open) : null;
        const timeClose = exam.time_close ? new Date(exam.time_close) : null;

        let config = { label: exam.status, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20 [.light-theme_&]:bg-gray-50 [.light-theme_&]:text-gray-600 [.light-theme_&]:border-gray-200' };

        if (timeOpen && timeClose && now >= timeOpen && now <= timeClose) {
            config = { label: t('ongoing'), color: 'bg-green-500/10 text-green-500 border-green-500/20 [.light-theme_&]:bg-green-50 [.light-theme_&]:text-green-600 [.light-theme_&]:border-green-200' };
        } else if (timeOpen && now < timeOpen) {
            config = { label: t('upcoming'), color: 'bg-blue-500/10 text-blue-500 border-blue-500/20 [.light-theme_&]:bg-blue-50 [.light-theme_&]:text-blue-600 [.light-theme_&]:border-blue-200' };
        } else if (timeClose && now > timeClose) {
            config = { label: t('ended'), color: 'bg-gray-500/10 text-gray-400 border-gray-500/20 [.light-theme_&]:bg-gray-50 [.light-theme_&]:text-gray-600 [.light-theme_&]:border-gray-200' };
        } else if (exam.status === 'draft') {
            config = { label: t('draft'), color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 [.light-theme_&]:bg-yellow-50 [.light-theme_&]:text-yellow-600 [.light-theme_&]:border-yellow-200' };
        }

        return (
            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold border whitespace-nowrap shadow-sm transition-all duration-200 ${config.color}`}>
                {config.label}
            </span>
        );
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return t('notUpdated') || 'N/A';
        return new Date(dateStr).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US');
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-gray-900 [.light-theme_&]:bg-gray-50 transition-colors">
            <AdminSidebar activeTab="exam-overview" />

            <main className="flex-1 p-4 pt-20 md:p-8 overflow-y-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 mb-8">
                    <div>
                        <h1 className="text-3xl font-semibold text-white [.light-theme_&]:text-gray-900 transition-colors">{t('examOverviewTitle')}</h1>
                        <p className="text-gray-300 [.light-theme_&]:text-gray-600 mt-1 transition-colors">{t('examOverviewDesc')}</p>
                    </div>
                </div>

                {/* Search */}
                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 [.light-theme_&]:text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder={t('searchExam')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg text-white [.light-theme_&]:text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-sm transition-colors"
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg p-4 shadow-sm transition-colors">
                        <div className="flex items-center gap-3">
                            <BookOpen className="text-blue-400 [.light-theme_&]:text-blue-600" size={24} />
                            <div>
                                <p className="text-gray-300 [.light-theme_&]:text-gray-500 text-sm font-medium">{t('totalExamsCount')}</p>
                                <p className="text-2xl font-bold text-white [.light-theme_&]:text-gray-900">{total}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg p-4 shadow-sm transition-colors">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="text-green-400 [.light-theme_&]:text-green-600" size={24} />
                            <div>
                                <p className="text-gray-300 [.light-theme_&]:text-gray-500 text-sm font-medium">{t('ongoingCount')}</p>
                                <p className="text-2xl font-bold text-green-400 [.light-theme_&]:text-green-600">
                                    {exams.filter(e => {
                                        const now = new Date();
                                        const open = e.time_open ? new Date(e.time_open) : null;
                                        const close = e.time_close ? new Date(e.time_close) : null;
                                        return open && close && now >= open && now <= close;
                                    }).length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg p-4 shadow-sm transition-colors">
                        <div className="flex items-center gap-3">
                            <Clock className="text-yellow-400 [.light-theme_&]:text-yellow-600" size={24} />
                            <div>
                                <p className="text-gray-300 [.light-theme_&]:text-gray-500 text-sm font-medium">{t('upcoming')}</p>
                                <p className="text-2xl font-bold text-yellow-400 [.light-theme_&]:text-yellow-600">
                                    {exams.filter(e => {
                                        const now = new Date();
                                        const open = e.time_open ? new Date(e.time_open) : null;
                                        return open && now < open;
                                    }).length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg p-4 shadow-sm transition-colors">
                        <div className="flex items-center gap-3">
                            <FileText className="text-purple-400 [.light-theme_&]:text-purple-600" size={24} />
                            <div>
                                <p className="text-gray-300 [.light-theme_&]:text-gray-500 text-sm font-medium">{t('totalQuestionsCount')}</p>
                                <p className="text-2xl font-bold text-purple-400 [.light-theme_&]:text-purple-600">
                                    {exams.reduce((acc, e) => acc + (e.total_questions || 0), 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exams Grid */}
                {loading ? (
                    <div className="text-center py-12 text-gray-300 [.light-theme_&]:text-gray-500">{t('loading')}</div>
                ) : exams.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 [.light-theme_&]:text-gray-500">{t('noData')}</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {exams.map((exam) => {
                            const status = getStatusBadge(exam);
                            return (
                                <div
                                    key={exam.id}
                                    className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg p-6 hover:border-blue-500/50 shadow-sm transition-all hover:shadow-md"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-medium text-white [.light-theme_&]:text-gray-900 truncate flex-1 pr-2">{exam.title}</h3>
                                        {getStatusBadge(exam)}
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-300 [.light-theme_&]:text-gray-600">
                                            <Users size={14} />
                                            <span>{t('instructor')}: {exam.instructor_name || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-300 [.light-theme_&]:text-gray-600">
                                            <FileText size={14} />
                                            <span>{exam.total_questions || 0} {t('questions')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-300 [.light-theme_&]:text-gray-600">
                                            <Clock size={14} />
                                            <span>{exam.duration_minutes || 0} {t('minutes')}</span>
                                        </div>
                                    </div>

                                    <div className="text-xs text-gray-300 [.light-theme_&]:text-gray-500 mb-4 transition-colors">
                                        <p><span className="font-medium">{t('timeOpen')}:</span> {formatDateTime(exam.time_open)}</p>
                                        <p><span className="font-medium">{t('timeClose')}:</span> {formatDateTime(exam.time_close)}</p>
                                    </div>

                                    <button
                                        onClick={() => handleViewDetails(exam)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                    >
                                        <Eye size={16} />
                                        {t('viewDetails')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-8 transition-colors">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 text-gray-300 [.light-theme_&]:text-gray-600 hover:text-white [.light-theme_&]:hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-white [.light-theme_&]:text-gray-900 font-medium">{t('page')} {page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 text-gray-300 [.light-theme_&]:text-gray-600 hover:text-white [.light-theme_&]:hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                )}

                {/* Detail Modal */}
                {showDetailModal && selectedExam && (
                    <div className="fixed inset-0 bg-black/60 [.light-theme_&]:bg-gray-500/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto py-8 transition-all">
                        <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-up transition-colors">
                            <div className="flex justify-between items-center p-6 border-b border-gray-700 [.light-theme_&]:border-gray-100 sticky top-0 bg-gray-800 [.light-theme_&]:bg-white z-10 transition-colors">
                                <div>
                                    <h2 className="text-xl font-semibold text-white [.light-theme_&]:text-gray-900">{selectedExam.title}</h2>
                                    <p className="text-gray-300 [.light-theme_&]:text-gray-600 text-sm mt-1">{t('instructor')}: {selectedExam.instructor_name || 'N/A'}</p>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-gray-300 [.light-theme_&]:text-gray-500 hover:text-white [.light-theme_&]:hover:text-red-500 text-2xl p-2 transition-colors"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1 bg-gray-900 [.light-theme_&]:bg-gray-50 transition-colors">
                                {/* Exam Info */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-gray-800/50 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 p-4 rounded-lg shadow-sm transition-colors">
                                        <p className="text-xs text-gray-400 [.light-theme_&]:text-gray-500 uppercase font-bold mb-1">{t('timeOpen')}</p>
                                        <p className="text-white [.light-theme_&]:text-gray-900 text-sm font-medium">{formatDateTime(selectedExam.time_open)}</p>
                                    </div>
                                    <div className="bg-gray-800/50 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 p-4 rounded-lg shadow-sm transition-colors">
                                        <p className="text-xs text-gray-400 [.light-theme_&]:text-gray-500 uppercase font-bold mb-1">{t('timeClose')}</p>
                                        <p className="text-white [.light-theme_&]:text-gray-900 text-sm font-medium">{formatDateTime(selectedExam.time_close)}</p>
                                    </div>
                                    <div className="bg-gray-800/50 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 p-4 rounded-lg shadow-sm transition-colors">
                                        <p className="text-xs text-gray-400 [.light-theme_&]:text-gray-500 uppercase font-bold mb-1">{t('duration')}</p>
                                        <p className="text-white [.light-theme_&]:text-gray-900 text-sm font-medium">{selectedExam.duration_minutes || 0} {t('minutes')}</p>
                                    </div>
                                    <div className="bg-gray-800/50 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 p-4 rounded-lg shadow-sm transition-colors">
                                        <p className="text-xs text-gray-400 [.light-theme_&]:text-gray-500 uppercase font-bold mb-1">{t('questions')}</p>
                                        <p className="text-white [.light-theme_&]:text-gray-900 text-sm font-medium">{questions.length}</p>
                                    </div>
                                </div>

                                {/* Questions List */}
                                <h3 className="text-white [.light-theme_&]:text-gray-900 font-bold mb-4 flex items-center gap-2 transition-colors">
                                    <FileText size={18} className="text-blue-500" />
                                    {t('questionList')}
                                </h3>

                                {loadingQuestions ? (
                                    <div className="text-center py-12 text-gray-300 [.light-theme_&]:text-gray-500">{t('loading')}</div>
                                ) : (
                                    <div className="space-y-6">
                                        {questions.map((q, qIdx) => (
                                            <div key={q.id} className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl p-5 shadow-sm transition-colors">
                                                <div className="flex gap-4">
                                                    <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 [.light-theme_&]:bg-blue-50 [.light-theme_&]:text-blue-600 flex items-center justify-center font-bold text-lg transition-colors">
                                                        {qIdx + 1}
                                                    </span>
                                                    <div className="flex-1">
                                                        <p className="text-white [.light-theme_&]:text-gray-900 font-bold text-lg mb-4 leading-relaxed transition-colors">{q.question_text}</p>
                                                        
                                                        <div className="space-y-4">
                                                            {/* Model Answer (Đáp án mẫu) */}
                                                            <div className="bg-blue-500/5 [.light-theme_&]:bg-blue-50/50 border border-blue-500/20 [.light-theme_&]:border-blue-100 p-4 rounded-xl shadow-inner transition-colors">
                                                                <p className="text-[10px] uppercase font-bold text-blue-400 [.light-theme_&]:text-blue-500 tracking-wider mb-2">Đáp án mẫu / Tham chiếu</p>
                                                                <div className="text-sm text-gray-300 [.light-theme_&]:text-gray-700 font-medium whitespace-pre-wrap leading-relaxed">
                                                                    {(() => {
                                                                        if (q.model_answer) return q.model_answer;
                                                                        if (q.correct_answer) return q.correct_answer;
                                                                        
                                                                        // Fallback for MCQ: find correct option text
                                                                        if ((q.type === 'MCQ' || q.question_type === 'mcq') && q.options) {
                                                                            const correctOpt = q.options.find(opt => 
                                                                                (typeof opt === 'object' && opt.is_correct) || 
                                                                                (typeof opt === 'string' && opt === q.correct_answer)
                                                                            );
                                                                            if (correctOpt) return typeof correctOpt === 'object' ? (correctOpt.text || correctOpt.option_text) : correctOpt;
                                                                        }
                                                                        
                                                                        return language === 'vi' ? 'Chưa cập nhật đáp án mẫu.' : 'No sample answer yet.';
                                                                    })()}
                                                                </div>
                                                            </div>

                                                            {q.question_type === 'mcq' && q.options && (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    {q.options.map((opt, optIdx) => {
                                                                        const isObject = typeof opt === 'object' && opt !== null;
                                                                        const optText = isObject ? (opt.text || opt.option_text || '') : opt;
                                                                        const isCorrect = isObject ? opt.is_correct : (opt === q.correct_answer);

                                                                        return (
                                                                            <div
                                                                                key={optIdx}
                                                                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all border shadow-sm ${isCorrect
                                                                                    ? 'bg-green-600/10 [.light-theme_&]:bg-green-50 text-green-400 [.light-theme_&]:text-green-600 border-green-600/30 [.light-theme_&]:border-green-200'
                                                                                    : 'bg-gray-700/30 [.light-theme_&]:bg-gray-50 text-gray-300 [.light-theme_&]:text-gray-700 border-gray-600 [.light-theme_&]:border-gray-100'
                                                                                    }`}
                                                                            >
                                                                                <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${isCorrect ? 'border-green-500/50 bg-green-500/10' : 'border-gray-500/50 bg-gray-500/10'}`}>
                                                                                    {String.fromCharCode(65 + optIdx)}
                                                                                </span>
                                                                                <span className="font-medium">{optText}</span>
                                                                                {isCorrect && (
                                                                                    <CheckCircle className="ml-auto text-green-500" size={16} />
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ExamOverview;
