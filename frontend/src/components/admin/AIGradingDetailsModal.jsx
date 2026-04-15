import React, { useState, useEffect } from "react";
import { X, RefreshCw, AlertCircle, CheckCircle, Clock, FileText, ChevronDown, ChevronUp, Bot } from "lucide-react";
import axiosClient from '../../api/axiosClient';
import { useLanguage } from "../../context/LanguageContext";

const AIGradingDetailsModal = ({ submissionId, onClose, onRetrySuccess }) => {
  const { t, language } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axiosClient.get(`/admin/ai-grading-logs/${submissionId}`);
        if (res.data.success) {
          setData(res.data);
          // Auto expand first question
          if (res.data.answers?.length > 0) {
            setExpandedQuestions({ [res.data.answers[0].question_id]: true });
          }
        }
      } catch (error) {
        console.error("Error fetching AI grading details", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [submissionId]);

  const handleRetry = () => {
    setShowConfirmModal(true);
  };

  const confirmRetry = async () => {
    setShowConfirmModal(false);
    setRetrying(true);
    try {
      await axiosClient.post(`/admin/ai-grading-logs/${submissionId}/retry`);
      if (onRetrySuccess) onRetrySuccess();
      onClose();
    } catch (error) {
      console.error("Error retrying AI grading", error);
      alert(error.response?.data?.message || t('error'));
      setRetrying(false);
    }
  };

  const toggleQuestion = (id) => {
    setExpandedQuestions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 [.light-theme_&]:bg-gray-500/50 backdrop-blur-sm p-4">
        <div className="bg-gray-800 [.light-theme_&]:bg-white rounded-2xl shadow-xl w-full max-w-lg h-[300px] flex items-center justify-center border border-gray-700 [.light-theme_&]:border-gray-200 transition-colors">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw size={36} className="animate-spin text-blue-500" />
            <p className="text-gray-300 [.light-theme_&]:text-gray-600 font-medium">{t('loadingAnalysis')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 [.light-theme_&]:bg-gray-500/50 backdrop-blur-sm p-4">
        <div className="bg-gray-800 [.light-theme_&]:bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-700 [.light-theme_&]:border-gray-200 transition-colors">
          <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-white [.light-theme_&]:text-gray-900 mb-2">{t('dataLoadingError')}</h3>
          <p className="text-gray-400 [.light-theme_&]:text-gray-600 mb-6">{t('dataLoadingErrorDesc')}</p>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-700 [.light-theme_&]:bg-gray-100 text-white [.light-theme_&]:text-gray-700 rounded-xl hover:bg-gray-600 [.light-theme_&]:hover:bg-gray-200 font-medium w-full transition-colors border border-gray-600 [.light-theme_&]:border-gray-200">{t('cancel')}</button>
        </div>
      </div>
    );
  }

  const { submission, answers } = data;

  const StatusIcon = () => {
    const status = submission.status || 'missed';
    if (status === 'completed') return <CheckCircle size={24} className="text-green-500" />;
    if (status === 'failed') return <AlertCircle size={24} className="text-red-500" />;
    if (status === 'in_progress') return <RefreshCw size={24} className="text-blue-500 animate-spin" />;
    return <Clock size={24} className="text-yellow-500" />;
  };

  const StatusLabel = () => {
    const status = submission.status || 'missed';
    const config = {
      completed: {
        label: t('completedStatus'),
        color: "bg-green-500/10 text-green-500 border-green-500/20 [.light-theme_&]:bg-green-50 [.light-theme_&]:text-green-600 [.light-theme_&]:border-green-200"
      },
      failed: {
        label: t('failedStatus'),
        color: "bg-red-500/10 text-red-500 border-red-500/20 [.light-theme_&]:bg-red-50 [.light-theme_&]:text-red-600 [.light-theme_&]:border-red-200"
      },
      in_progress: {
        label: 'IN PROGRESS',
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20 [.light-theme_&]:bg-blue-50 [.light-theme_&]:text-blue-600 [.light-theme_&]:border-blue-200"
      },
      pending: {
        label: t('pendingStatus'),
        color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 [.light-theme_&]:bg-yellow-50 [.light-theme_&]:text-yellow-600 [.light-theme_&]:border-yellow-200"
      },
      missed: {
        label: t('missedStatus'),
        color: "bg-orange-500/10 text-orange-500 border-orange-500/20 [.light-theme_&]:bg-orange-50 [.light-theme_&]:text-orange-600 [.light-theme_&]:border-orange-200"
      },
      not_required: {
        label: 'NOT REQUIRED',
        color: "bg-gray-500/10 text-gray-400 border-gray-500/20 [.light-theme_&]:bg-gray-50 [.light-theme_&]:text-gray-600 [.light-theme_&]:border-gray-200"
      }
    };

    const { label, color } = config[status] || config.missed;

    return (
      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border whitespace-nowrap shadow-sm transition-all duration-200 ${color}`}>
        {label}
      </span>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 [.light-theme_&]:bg-gray-500/50 backdrop-blur-sm p-4 md:p-6 lg:p-8">
      <div className="bg-gray-900 [.light-theme_&]:bg-gray-50 border border-gray-700 [.light-theme_&]:border-gray-200 rounded-2xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up transition-colors">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-800 [.light-theme_&]:border-gray-200 flex items-center justify-between bg-gray-800/80 [.light-theme_&]:bg-white shadow-sm z-10 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gray-800 [.light-theme_&]:bg-gray-100 rounded-xl border border-gray-700 [.light-theme_&]:border-gray-200 transition-colors">
              <StatusIcon />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white [.light-theme_&]:text-gray-900 flex items-center gap-2">
                {t('aiGradingLog')} <span className="px-2 py-0.5 bg-gray-700 [.light-theme_&]:bg-gray-100 text-gray-300 [.light-theme_&]:text-gray-600 border border-gray-600 [.light-theme_&]:border-gray-200 rounded text-sm font-mono font-medium">#{submission.submission_id}</span>
              </h2>
              <p className="text-sm text-gray-400 [.light-theme_&]:text-gray-500 font-medium">{submission.exam_title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors group">
            <X size={24} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-gray-900 [.light-theme_&]:bg-gray-50 transition-colors">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left: General Info & Actions */}
            <div className="col-span-1 lg:col-span-4 space-y-6">
              <div className="bg-gray-800 [.light-theme_&]:bg-white p-6 rounded-2xl border border-gray-700 [.light-theme_&]:border-gray-200 shadow-sm transition-colors">
                <h3 className="text-sm font-bold text-gray-400 [.light-theme_&]:text-gray-500 uppercase tracking-wider mb-5 pb-3 border-b border-gray-700 [.light-theme_&]:border-gray-100">{t('examProfile')}</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">{t('candidate')}</p>
                    <p className="font-bold text-white [.light-theme_&]:text-gray-900">{submission.student_name}</p>
                    <p className="text-sm text-gray-400 [.light-theme_&]:text-gray-500">{submission.student_email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">{t('modelStatus')}</p>
                    <StatusLabel />
                  </div>

                  {submission.error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mt-4">
                      <p className="text-xs text-red-400 font-bold mb-1 flex items-center gap-1"><AlertCircle size={14} /> {t('errorStack')}</p>
                      <p className="text-sm text-red-500/90 break-words font-mono leading-relaxed">{submission.error}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-700 [.light-theme_&]:border-gray-100">
                    <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20 [.light-theme_&]:bg-purple-50 [.light-theme_&]:border-purple-100 transition-colors">
                      <p className="text-xs text-purple-400 [.light-theme_&]:text-purple-500 font-medium mb-1">Trắc Nghiệm</p>
                      <p className="text-2xl font-bold text-purple-500">{submission.total_score ?? <span className="text-lg opacity-50">N/A</span>}</p>
                    </div>
                    <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 [.light-theme_&]:bg-blue-50 [.light-theme_&]:border-blue-100 transition-colors">
                      <p className="text-xs text-blue-400 [.light-theme_&]:text-blue-500 font-medium mb-1">{t('aiEssayScore')}</p>
                      <p className="text-2xl font-bold text-blue-500">{submission.ai_score ?? <span className="text-lg opacity-50">N/A</span>}</p>
                    </div>
                    <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20 [.light-theme_&]:bg-green-50 [.light-theme_&]:border-green-100 transition-colors">
                      <p className="text-xs text-green-400 [.light-theme_&]:text-green-500 font-medium mb-1">{t('suggestedTotalScore')}</p>
                      <p className="text-2xl font-bold text-green-500">{submission.suggested_total_score || ((Number(submission.total_score) || 0) + (Number(submission.ai_score) || 0)) || <span className="text-lg opacity-50">N/A</span>}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-gray-700 [.light-theme_&]:border-gray-100">
                  <button
                    onClick={handleRetry}
                    disabled={retrying || submission.status === 'in_progress'}
                    className="w-full py-3 px-4 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 shadow-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all focus:ring-4 focus:ring-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                  >
                    <RefreshCw size={18} className={retrying ? "animate-spin" : ""} />
                    {retrying ? t('loading') : t('triggerRegrade')}
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-3 font-medium">{t('triggerRegradeDesc')}</p>
                </div>
              </div>
            </div>

            {/* Right: Tracing Logic & Submissions */}
            <div className="col-span-1 lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-white [.light-theme_&]:text-gray-900 flex items-center gap-2">
                  <FileText size={20} className="text-blue-500" />
                  {t('tracingModelOutput')} ({answers.length} {t('questions').toLowerCase()})
                </h3>
              </div>

              {answers.length === 0 ? (
                <div className="bg-gray-800 [.light-theme_&]:bg-white p-10 rounded-2xl border border-gray-700 [.light-theme_&]:border-gray-200 text-center text-gray-500 shadow-sm flex flex-col items-center transition-colors">
                  <Bot size={48} className="text-gray-600 [.light-theme_&]:text-gray-300 mb-4" />
                  <p className="font-medium text-lg text-gray-300 [.light-theme_&]:text-gray-600">{t('noEssayFound')}</p>
                  <p className="text-sm mt-1 text-gray-500">{t('aiServiceNote')}</p>
                </div>
              ) : (
                answers.map((ans, idx) => {
                  const isExpanded = expandedQuestions[ans.question_id] || false;
                  // BUG FIX: change ans.answer_text to ans.student_answer based on backend output structure for AI grading logs. 
                  const studentAnswer = ans.student_answer || ans.answer_text;
                  const isEmpty = !studentAnswer || studentAnswer.trim() === "";
                  const hasError = !ans.ai_feedback && submission.status !== 'pending' && (!studentAnswer || studentAnswer.trim() === "");
                  const scoreColor = ans.ai_feedback?.score === ans.max_points ? "text-green-400 bg-green-500/10 border-green-500/20" :
                    ans.ai_feedback?.score === 0 ? "text-red-400 bg-red-500/10 border-red-500/20" :
                      "text-blue-400 bg-blue-500/10 border-blue-500/20";

                  return (
                    <div key={ans.question_id} className={`bg-gray-800 [.light-theme_&]:bg-white rounded-2xl border ${isExpanded ? 'border-blue-500/30 [.light-theme_&]:border-blue-500/50 shadow-md ring-1 ring-blue-500/30' : 'border-gray-700 [.light-theme_&]:border-gray-200 shadow-sm'} overflow-hidden transition-all duration-300`}>

                      {/* Question Header (Toggle) */}
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-750 [.light-theme_&]:hover:bg-gray-50 flex items-start justify-between gap-4 select-none transition-colors"
                        onClick={() => toggleQuestion(ans.question_id)}
                      >
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-gray-700 [.light-theme_&]:bg-gray-100 border border-gray-600 [.light-theme_&]:border-gray-200 text-gray-200 [.light-theme_&]:text-gray-700 text-[10px] font-bold rounded shadow-sm">Q{idx + 1}</span>
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-gray-600/20 text-[10px] font-bold text-gray-500 border border-gray-700 rounded transition-colors uppercase">{ans.max_points} PTS</span>

                            {ans.ai_feedback?.score !== undefined && (
                              <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded-full border shadow-sm transition-colors ${scoreColor}`}>
                                {t('scoreLabel')} {ans.ai_feedback.score}/{ans.max_points}
                              </span>
                            )}

                            {ans.instructor_info?.is_modified && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 bg-amber-500/10 [.light-theme_&]:bg-amber-50 text-amber-500 text-[10px] font-bold rounded-full border border-amber-500/20 [.light-theme_&]:border-amber-100 gap-1 shadow-sm transition-colors animate-pulse">
                                <AlertCircle size={10} /> {t('instructorModified')}
                              </span>
                            )}

                            {hasError && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 bg-red-500/10 [.light-theme_&]:bg-red-50 text-red-500 text-[10px] font-bold rounded-full border border-red-500/20 [.light-theme_&]:border-red-100 gap-1 shadow-sm transition-colors">
                                {t('emptySkipped')}
                              </span>
                            )}
                          </div>
                          <p className={`text-gray-200 [.light-theme_&]:text-gray-800 font-medium ${isExpanded ? '' : 'line-clamp-2'}`}>{ans.question_text}</p>
                        </div>
                        <div className={`p-1.5 rounded-full mt-1 transition-colors ${isExpanded ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 [.light-theme_&]:bg-gray-100 text-gray-400 [.light-theme_&]:text-gray-500'}`}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>

                      {/* Expanded Analysis */}
                      {isExpanded && (
                        <div className="p-5 pt-0 mt-2 border-t border-gray-700 [.light-theme_&]:border-gray-100">

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">{t('rawInputStudent')}</h4>
                              <div className="p-4 bg-gray-900 [.light-theme_&]:bg-gray-50 border border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl text-sm text-gray-300 [.light-theme_&]:text-gray-700 whitespace-pre-wrap min-h-[120px] font-medium leading-relaxed transition-colors">
                                {isEmpty ? <span className="text-gray-500 italic font-normal">{language === 'vi' ? 'Không có input.' : 'No input.'}</span> : studentAnswer}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">{t('groundTruthReference')}</h4>
                              <div className="p-4 bg-green-900/10 [.light-theme_&]:bg-green-50 border border-green-500/20 [.light-theme_&]:border-green-100 rounded-xl text-sm text-gray-300 [.light-theme_&]:text-gray-700 whitespace-pre-wrap min-h-[120px] leading-relaxed transition-colors">
                                {ans.model_answer || <span className="text-gray-600 italic">N/A</span>}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 bg-gray-800/80 [.light-theme_&]:bg-blue-50/30 border border-blue-500/20 [.light-theme_&]:border-blue-200 rounded-xl overflow-hidden shadow-inner transition-colors">
                            <div className="px-4 py-2 border-b border-blue-500/20 [.light-theme_&]:border-blue-100 flex items-center gap-2 bg-blue-500/10 [.light-theme_&]:bg-blue-50 transition-colors">
                              <Bot size={16} className="text-blue-400 [.light-theme_&]:text-blue-600" />
                              <h4 className="text-xs font-bold text-blue-400 [.light-theme_&]:text-blue-600 uppercase tracking-widest">{t('modelInferenceLog')}</h4>
                            </div>
                            <div className="p-4">
                              {ans.ai_feedback ? (
                                <div className="space-y-4">
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    {ans.ai_feedback.type && (
                                      <div className="flex flex-col bg-gray-900 [.light-theme_&]:bg-white px-3 py-1.5 rounded-lg border border-gray-700 [.light-theme_&]:border-gray-200 shadow-sm transition-colors">
                                        <span className="text-gray-500 font-medium mb-0.5">{t('pipelineMode')}</span>
                                        <span className="text-gray-300 [.light-theme_&]:text-gray-800 font-bold">{ans.ai_feedback.type}</span>
                                      </div>
                                    )}
                                    <div className="flex flex-col bg-gray-900 [.light-theme_&]:bg-white px-3 py-1.5 rounded-lg border border-gray-700 [.light-theme_&]:border-gray-200 shadow-sm transition-colors">
                                      <span className="text-gray-500 font-medium mb-0.5">{t('confidence')}</span>
                                      <span className="text-gray-300 [.light-theme_&]:text-gray-800 font-bold">{ans.ai_feedback.confidence ? (ans.ai_feedback.confidence * 100).toFixed(1) + '%' : '100%'}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">{t('reasoningChain')}</span>
                                    <div className="text-gray-300 [.light-theme_&]:text-gray-700 font-medium bg-gray-900 [.light-theme_&]:bg-white p-3.5 rounded-xl border border-gray-700 [.light-theme_&]:border-gray-200 shadow-inner leading-relaxed whitespace-pre-wrap transition-colors">
                                      {ans.ai_feedback.explanation || (language === 'vi' ? 'Lý giải rỗng.' : 'Empty reasoning.')}
                                    </div>
                                  </div>

                                  {(ans.instructor_info?.is_modified || ans.instructor_info?.feedback) && (
                                    <div className="mt-4 pt-4 border-t border-blue-500/10 [.light-theme_&]:border-blue-100 space-y-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                                          <AlertCircle size={14} className="text-amber-500" />
                                        </div>
                                        <span className="text-xs font-bold text-amber-500 uppercase tracking-wider font-montserrat">{t('instructorModified')}</span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3 mb-2">
                                        <div className="bg-gray-900 [.light-theme_&]:bg-white p-2.5 rounded-xl border border-gray-700 [.light-theme_&]:border-gray-200 shadow-sm transition-colors">
                                          <p className="text-[10px] text-gray-500 font-medium mb-0.5 uppercase tracking-tighter">{t('originalAIScore')}</p>
                                          <p className="text-lg font-bold text-gray-400">{ans.instructor_info.ai_original_score ?? 'N/A'}</p>
                                        </div>
                                        <div className="bg-amber-500/10 [.light-theme_&]:bg-amber-50 p-2.5 rounded-xl border border-amber-500/20 [.light-theme_&]:border-amber-200 shadow-sm transition-colors">
                                          <p className="text-[10px] text-amber-500 font-medium mb-0.5 uppercase tracking-tighter">{t('finalScore')}</p>
                                          <p className="text-lg font-bold text-amber-600 [.light-theme_&]:text-amber-700">{ans.instructor_info.final_score ?? 'N/A'}</p>
                                        </div>
                                      </div>

                                      {ans.instructor_info.feedback && (
                                        <div className="space-y-1.5">
                                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block px-1">{t('instructorFeedback')}</span>
                                          <div className="text-sm text-gray-300 [.light-theme_&]:text-gray-800 font-medium bg-amber-500/5 [.light-theme_&]:bg-amber-100/30 p-4 rounded-2xl border border-amber-500/10 [.light-theme_&]:border-amber-200 shadow-inner leading-relaxed transition-colors italic">
                                            "{ans.instructor_info.feedback}"
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="py-6 flex flex-col items-center justify-center text-center">
                                  {submission.status === 'in_progress' ? (
                                    <><RefreshCw className="animate-spin text-blue-500 mb-2" size={24} /><p className="text-sm font-medium text-blue-400">{t('modelProcessing')}</p></>
                                  ) : (
                                    <><AlertCircle size={24} className="text-gray-600 mb-2" /><p className="text-sm font-medium text-gray-500">{t('traceLogNotFound')}</p></>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-md mx-4 animate-fade-in-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-yellow-500" size={32} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{t('confirmRegrade')}</h2>
              <p className="text-gray-300 mb-6">
                {t('confirmRegradeDesc')}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={confirmRetry}
                  className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold rounded-xl transition-colors"
                >
                  {t('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIGradingDetailsModal;
