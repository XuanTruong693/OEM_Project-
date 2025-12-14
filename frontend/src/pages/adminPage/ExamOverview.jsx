import React, { useState, useEffect } from 'react';
import {
    Search, Eye, ChevronLeft, ChevronRight, BookOpen,
    Clock, Users, FileText, CheckCircle
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { useLanguage } from '../../context/LanguageContext';

const ExamOverview = () => {
    const { t } = useLanguage();
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

        if (timeOpen && timeClose && now >= timeOpen && now <= timeClose) {
            return { label: t('ongoing'), class: 'bg-green-600 text-white' };
        } else if (timeOpen && now < timeOpen) {
            return { label: t('upcoming'), class: 'bg-blue-600 text-white' };
        } else if (timeClose && now > timeClose) {
            return { label: t('ended'), class: 'bg-gray-600 text-white' };
        } else if (exam.status === 'draft') {
            return { label: t('draft'), class: 'bg-yellow-600 text-white' };
        } else {
            return { label: exam.status, class: 'bg-gray-600 text-white' };
        }
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'Chưa đặt';
        return new Date(dateStr).toLocaleString('vi-VN');
    };

    return (
        <div className="flex min-h-screen bg-gray-900">
            <AdminSidebar activeTab="exam-overview" />

            <main className="flex-1 p-8 overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-semibold text-white">{t('examOverviewTitle')}</h1>
                        <p className="text-gray-400 mt-1">{t('examOverviewDesc')}</p>
                    </div>
                </div>

                {/* Search */}
                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm bài thi..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <BookOpen className="text-blue-400" size={24} />
                            <div>
                                <p className="text-gray-400 text-sm">{t('totalExamsCount')}</p>
                                <p className="text-2xl font-bold text-white">{total}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="text-green-400" size={24} />
                            <div>
                                <p className="text-gray-400 text-sm">{t('ongoingCount')}</p>
                                <p className="text-2xl font-bold text-green-400">
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
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <Clock className="text-yellow-400" size={24} />
                            <div>
                                <p className="text-gray-400 text-sm">Sắp diễn ra</p>
                                <p className="text-2xl font-bold text-yellow-400">
                                    {exams.filter(e => {
                                        const now = new Date();
                                        const open = e.time_open ? new Date(e.time_open) : null;
                                        return open && now < open;
                                    }).length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <FileText className="text-purple-400" size={24} />
                            <div>
                                <p className="text-gray-400 text-sm">Tổng câu hỏi</p>
                                <p className="text-2xl font-bold text-purple-400">
                                    {exams.reduce((acc, e) => acc + (e.total_questions || 0), 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exams Grid */}
                {loading ? (
                    <div className="text-center py-12 text-gray-400">Đang tải...</div>
                ) : exams.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">Không tìm thấy bài thi nào</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {exams.map((exam) => {
                            const status = getStatusBadge(exam);
                            return (
                                <div
                                    key={exam.id}
                                    className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500/50 transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-medium text-white truncate flex-1 pr-2">{exam.title}</h3>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${status.class}`}>
                                            {status.label}
                                        </span>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <Users size={14} />
                                            <span>GV: {exam.instructor_name || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <FileText size={14} />
                                            <span>{exam.total_questions || 0} câu hỏi</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <Clock size={14} />
                                            <span>{exam.duration_minutes || 0} phút</span>
                                        </div>
                                    </div>

                                    <div className="text-xs text-gray-500 mb-4">
                                        <p>Mở: {formatDateTime(exam.time_open)}</p>
                                        <p>Đóng: {formatDateTime(exam.time_close)}</p>
                                    </div>

                                    <button
                                        onClick={() => handleViewDetails(exam)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                    >
                                        <Eye size={16} />
                                        Xem chi tiết
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-8">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-white">Trang {page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                )}

                {/* Detail Modal */}
                {showDetailModal && selectedExam && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto py-8">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">{selectedExam.title}</h2>
                                    <p className="text-gray-400 text-sm mt-1">GV: {selectedExam.instructor_name || 'N/A'}</p>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-gray-400 hover:text-white text-2xl"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                {/* Exam Info */}
                                <div className="grid grid-cols-4 gap-4 mb-6">
                                    <div className="bg-gray-700/50 p-4 rounded-lg">
                                        <p className="text-xs text-gray-400 uppercase mb-1">Thời gian mở</p>
                                        <p className="text-white text-sm">{formatDateTime(selectedExam.time_open)}</p>
                                    </div>
                                    <div className="bg-gray-700/50 p-4 rounded-lg">
                                        <p className="text-xs text-gray-400 uppercase mb-1">Thời gian đóng</p>
                                        <p className="text-white text-sm">{formatDateTime(selectedExam.time_close)}</p>
                                    </div>
                                    <div className="bg-gray-700/50 p-4 rounded-lg">
                                        <p className="text-xs text-gray-400 uppercase mb-1">Thời lượng</p>
                                        <p className="text-white text-sm">{selectedExam.duration_minutes || 0} phút</p>
                                    </div>
                                    <div className="bg-gray-700/50 p-4 rounded-lg">
                                        <p className="text-xs text-gray-400 uppercase mb-1">Số câu hỏi</p>
                                        <p className="text-white text-sm">{questions.length}</p>
                                    </div>
                                </div>

                                {/* Questions List */}
                                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                                    <FileText size={18} />
                                    Danh sách câu hỏi
                                </h3>

                                {loadingQuestions ? (
                                    <div className="text-center py-8 text-gray-400">Đang tải câu hỏi...</div>
                                ) : questions.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">Không có câu hỏi nào</div>
                                ) : (
                                    <div className="space-y-4">
                                        {questions.map((q, idx) => (
                                            <div key={q.id} className="bg-gray-700/30 p-4 rounded-lg">
                                                <div className="flex items-start gap-3">
                                                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
                                                        {idx + 1}
                                                    </span>
                                                    <div className="flex-1">
                                                        <p className="text-white mb-2">{q.question_text}</p>
                                                        <div className="flex items-center gap-4 text-xs text-gray-400">
                                                            <span className="px-2 py-1 bg-gray-600 rounded">{q.type || 'MCQ'}</span>
                                                            <span>{q.points || 1} điểm</span>
                                                        </div>

                                                        {/* Options for MCQ */}
                                                        {q.options && (
                                                            <div className="mt-3 space-y-2">
                                                                {(typeof q.options === 'string' ? JSON.parse(q.options) : q.options).map((opt, optIdx) => {
                                                                    // Handle cả object {id, text, is_correct} và string
                                                                    const isObject = typeof opt === 'object' && opt !== null;
                                                                    const optText = isObject ? (opt.text || opt.option_text || '') : opt;
                                                                    const isCorrect = isObject ? opt.is_correct : (opt === q.correct_answer);

                                                                    return (
                                                                        <div
                                                                            key={optIdx}
                                                                            className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${isCorrect
                                                                                ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                                                                                : 'bg-gray-600/30 text-gray-300'
                                                                                }`}
                                                                        >
                                                                            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">
                                                                                {String.fromCharCode(65 + optIdx)}
                                                                            </span>
                                                                            {optText}
                                                                            {isCorrect && (
                                                                                <CheckCircle className="ml-auto text-green-400" size={14} />
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
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
