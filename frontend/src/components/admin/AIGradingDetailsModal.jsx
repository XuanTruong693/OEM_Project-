import React, { useState, useEffect } from "react";
import { X, RefreshCw, AlertCircle, CheckCircle, Clock, FileText, ChevronDown, ChevronUp, Bot } from "lucide-react";
import axiosClient from '../../api/axiosClient';

const AIGradingDetailsModal = ({ submissionId, onClose, onRetrySuccess }) => {
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
              setExpandedQuestions({[res.data.answers[0].question_id]: true});
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
      alert(error.response?.data?.message || "Lỗi khi chấm lại!");
      setRetrying(false);
    }
  };

  const toggleQuestion = (id) => {
    setExpandedQuestions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
        <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg h-[300px] flex items-center justify-center border border-gray-700">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw size={36} className="animate-spin text-blue-500" />
            <p className="text-gray-300 font-medium">Đang tải biểu mẫu phân tích...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-700">
          <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Lỗi Tải Dữ Liệu</h3>
          <p className="text-gray-400 mb-6">Không thể lấy thông tin chi tiết hoặc bài nộp này không tồn tại.</p>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-600 font-medium w-full transition-colors border border-gray-600">Đóng Lại</button>
        </div>
      </div>
    );
  }

  const { submission, answers } = data;

  const StatusIcon = () => {
    if (submission.status === 'completed') return <CheckCircle size={24} className="text-green-500" />;
    if (submission.status === 'failed') return <AlertCircle size={24} className="text-red-500" />;
    if (submission.status === 'in_progress') return <RefreshCw size={24} className="text-blue-500 animate-spin" />;
    return <Clock size={24} className="text-yellow-500" />;
  };

  const StatusLabel = () => {
    const labels = {
        completed: 'Hoàn Thành (OK)',
        failed: 'Bị Lỗi (Failed)',
        in_progress: 'Đang Chấm (Processing)',
        pending: 'Chờ Chấm (Pending)',
        not_required: 'Không Cần Chấm'
    };
    const styles = {
        completed: 'bg-green-500/20 text-green-400 border-green-500/30',
        failed: 'bg-red-500/20 text-red-400 border-red-500/30',
        in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        not_required: 'bg-gray-700 text-gray-400 border-gray-600'
    };
    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded border ${styles[submission.status]}`}>
            {labels[submission.status] || submission.status.toUpperCase()}
        </span>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 md:p-6 lg:p-8">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-800/80 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gray-800 rounded-xl border border-gray-700">
              <StatusIcon />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Log Chấm Điểm AI <span className="px-2 py-0.5 bg-gray-700 text-gray-300 border border-gray-600 rounded text-sm font-mono font-medium">#{submission.submission_id}</span>
              </h2>
              <p className="text-sm text-gray-400 font-medium">{submission.exam_title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors group">
            <X size={24} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-gray-900">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: General Info & Actions */}
            <div className="col-span-1 lg:col-span-4 space-y-6">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-sm">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-5 pb-3 border-b border-gray-700">Hồ sơ bài thi</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">Thí sinh</p>
                    <p className="font-bold text-white">{submission.student_name}</p>
                    <p className="text-sm text-gray-400">{submission.student_email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">Trạng thái Model</p>
                    <StatusLabel />
                  </div>
                  
                  {submission.error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mt-4">
                      <p className="text-xs text-red-400 font-bold mb-1 flex items-center gap-1"><AlertCircle size={14}/> Stack/Trace Lỗi:</p>
                      <p className="text-sm text-red-500/90 break-words font-mono leading-relaxed">{submission.error}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-700">
                     <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
                         <p className="text-xs text-blue-400 font-medium mb-1">Điểm Tự Luận AI</p>
                         <p className="text-2xl font-bold text-blue-500">{submission.ai_score ?? <span className="text-lg opacity-50">N/A</span>}</p>
                     </div>
                     <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20">
                         <p className="text-xs text-green-400 font-medium mb-1">T.Điểm (Tạm Tính)</p>
                         <p className="text-2xl font-bold text-green-500">{submission.suggested_total_score ?? <span className="text-lg opacity-50">N/A</span>}</p>
                     </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-gray-700">
                  <button
                    onClick={handleRetry}
                    disabled={retrying || submission.status === 'in_progress'}
                    className="w-full py-3 px-4 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 shadow-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all focus:ring-4 focus:ring-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                  >
                    <RefreshCw size={18} className={retrying ? "animate-spin" : ""} />
                    {retrying ? 'Đang gửi Request...' : 'Trigger Chấm Lại'}
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-3 font-medium">Bấm để đưa bài này vào Queue của AI Classifier.</p>
                </div>
              </div>
            </div>

            {/* Right: Tracing Logic & Submissions */}
            <div className="col-span-1 lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText size={20} className="text-blue-500" />
                    Tracing Model Output ({answers.length} câu)
                 </h3>
              </div>
              
              {answers.length === 0 ? (
                <div className="bg-gray-800 p-10 rounded-2xl border border-gray-700 text-center text-gray-500 shadow-sm flex flex-col items-center">
                  <Bot size={48} className="text-gray-600 mb-4" />
                  <p className="font-medium text-lg text-gray-300">Bài thi không có tự luận</p>
                  <p className="text-sm mt-1 text-gray-500">AI Service chỉ khả dụng với các câu hỏi loại Tự luận (Essay).</p>
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
                    <div key={ans.question_id} className={`bg-gray-800 rounded-2xl border ${isExpanded ? 'border-blue-500/30 shadow-md ring-1 ring-blue-500/30' : 'border-gray-700 shadow-sm'} overflow-hidden transition-all duration-300`}>
                      
                      {/* Question Header (Toggle) */}
                      <div 
                        className="p-4 cursor-pointer hover:bg-gray-750 flex items-start justify-between gap-4 select-none"
                        onClick={() => toggleQuestion(ans.question_id)}
                      >
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2.5 py-1 bg-gray-700 border border-gray-600 text-gray-200 text-xs font-bold rounded-md shadow-sm">Q{idx + 1}</span>
                            <span className="text-xs font-bold text-gray-500">{ans.max_points} PTS</span>
                            
                            {ans.ai_feedback?.score !== undefined && (
                              <span className={`px-2 py-0.5 text-xs font-bold rounded border ${scoreColor} shadow-sm`}>
                                Điểm: {ans.ai_feedback.score}/{ans.max_points}
                              </span>
                            )}
                            
                            {hasError && (
                              <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-xs font-bold rounded border border-red-500/20 flex items-center gap-1 shadow-sm">
                               Trống / Bỏ qua
                              </span>
                            )}
                          </div>
                          <p className={`text-gray-200 font-medium ${isExpanded ? '' : 'line-clamp-2'}`}>{ans.question_text}</p>
                        </div>
                        <div className={`p-1.5 rounded-full mt-1 transition-colors ${isExpanded ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>

                      {/* Expanded Analysis */}
                      {isExpanded && (
                        <div className="p-5 pt-0 mt-2 border-t border-gray-700">
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Raw Input (Sinh viên)</h4>
                              <div className="p-4 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-300 whitespace-pre-wrap min-h-[120px] font-medium leading-relaxed">
                                {isEmpty ? <span className="text-gray-500 italic font-normal">Không có input.</span> : studentAnswer}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Ground Truth (Mẫu)</h4>
                              <div className="p-4 bg-green-900/10 border border-green-500/20 rounded-xl text-sm text-gray-300 whitespace-pre-wrap min-h-[120px] leading-relaxed">
                                {ans.model_answer || <span className="text-gray-600 italic">N/A</span>}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 bg-gray-800/80 border border-blue-500/20 rounded-xl overflow-hidden shadow-inner">
                             <div className="px-4 py-2 border-b border-blue-500/20 flex items-center gap-2 bg-blue-500/10">
                                <Bot size={16} className="text-blue-400" />
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Model Inference Log</h4>
                             </div>
                             <div className="p-4">
                                {ans.ai_feedback ? (
                                  <div className="space-y-4">
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      {ans.ai_feedback.type && (
                                          <div className="flex flex-col bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700 shadow-sm">
                                              <span className="text-gray-500 font-medium mb-0.5">Pipeline Mode</span>
                                              <span className="text-gray-300 font-bold">{ans.ai_feedback.type}</span>
                                          </div>
                                      )}
                                      <div className="flex flex-col bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700 shadow-sm">
                                          <span className="text-gray-500 font-medium mb-0.5">Confidence</span>
                                          <span className="text-gray-300 font-bold">{ans.ai_feedback.confidence ? (ans.ai_feedback.confidence * 100).toFixed(1) + '%' : '100%'}</span>
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Reasoning (Chain of Thought):</span>
                                      <div className="text-gray-300 font-medium bg-gray-900 p-3.5 rounded-xl border border-gray-700 shadow-inner leading-relaxed whitespace-pre-wrap">
                                          {ans.ai_feedback.explanation || 'Empty reasoning.'}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="py-6 flex flex-col items-center justify-center text-center">
                                    {submission.status === 'in_progress' ? (
                                      <><RefreshCw className="animate-spin text-blue-500 mb-2" size={24} /><p className="text-sm font-medium text-blue-400">Model đang xử lý pipeline...</p></>
                                    ) : (
                                      <><AlertCircle size={24} className="text-gray-600 mb-2" /><p className="text-sm font-medium text-gray-500">Trace log not found. Error or skipped.</p></>
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
              <h2 className="text-xl font-bold text-white mb-2">Xác nhận chấm lại</h2>
              <p className="text-gray-300 mb-6">
                Bạn có chắc muốn ép hệ thống chấm lại bài này? Mọi log cũ sẽ bị xóa và bài thi sẽ được ghép vào hàng đợi AI.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={confirmRetry}
                  className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold rounded-xl transition-colors"
                >
                  Xác nhận
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
