import React, { useState, useEffect } from "react";
import { X, AlertTriangle, Calendar, Clock, Hash, Check, RefreshCw, User, Mail, FileText, Search } from "lucide-react";
import axiosClient from "../../api/axiosClient";
import { useLanguage } from "../../context/LanguageContext";


const BatchRegradeModal = ({ onClose, onSuccess }) => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [previewList, setPreviewList] = useState([]);
  const [mode, setMode] = useState("missed_only"); // missed_only, failed_only, all
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [limit, setLimit] = useState(100);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pinnedSubmissions, setPinnedSubmissions] = useState([]);

  const fetchPreview = async () => {
    setFetchingPreview(true);
    try {
      const response = await axiosClient.get("/admin/ai-grading-logs/batch-preview", {
        params: { 
          mode, 
          startDate, 
          endDate, 
          limit: parseInt(limit) || null,
          search: searchTerm || null
        }
      });
      if (response.data.success) {
        setPreviewList(response.data.preview || []);
      }
    } catch (err) {
      console.error("Error fetching preview", err);
    } finally {
      setFetchingPreview(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPreview();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [mode, startDate, endDate, limit, searchTerm]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (previewList.length === 0 && pinnedSubmissions.length === 0) {
      setError(t('noMatchingSubmissions'));
      return;
    }
    setShowConfirm(true);
  };

  const executeRegrade = async () => {
    setShowConfirm(false);
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        mode,
        startDate,
        endDate,
        limit: parseInt(limit) || null
      };

      if (pinnedSubmissions.length > 0) {
        payload.submissionIds = pinnedSubmissions.map(p => p.submission_id);
      }

      const response = await axiosClient.post("/admin/ai-grading-logs/batch-regrade", payload);

      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess && onSuccess();
        }, 2000);
      }
    } catch (err) {
      console.error("Batch regrade error:", err);
      setError(err.response?.data?.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status) => {
    const config = {
      missed: { 
        label: t('missedStatus'), 
        color: "bg-orange-500/10 text-orange-500 border-orange-500/20 [.light-theme_&]:bg-orange-50 [.light-theme_&]:text-orange-600 [.light-theme_&]:border-orange-200" 
      },
      failed: { 
        label: t('failedStatus'), 
        color: "bg-red-500/10 text-red-500 border-red-500/20 [.light-theme_&]:bg-red-50 [.light-theme_&]:text-red-600 [.light-theme_&]:border-red-200" 
      },
      default: { 
        label: (status || 'N/A').toUpperCase(), 
        color: "bg-gray-500/10 text-gray-400 border-gray-500/20 [.light-theme_&]:bg-gray-50 [.light-theme_&]:text-gray-600 [.light-theme_&]:border-gray-200" 
      }
    };

    const s = !status ? 'missed' : (status === 'failed' ? 'failed' : 'default');
    const { label, color } = config[s];

    return (
      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap shadow-sm transition-all duration-200 ${color}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 [.light-theme_&]:bg-gray-500/50 backdrop-blur-sm p-2 overflow-hidden transition-colors">
      <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-[2rem] shadow-2xl w-full max-w-[98vw] h-[96vh] mx-auto overflow-hidden animate-fade-in-up flex flex-col relative transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 [.light-theme_&]:border-gray-200 bg-gray-800 [.light-theme_&]:bg-white sticky top-0 z-10 transition-colors">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-white [.light-theme_&]:text-gray-900">{t('aiBatchRegradeTool')}</h2>
              <p className="text-sm text-gray-400 [.light-theme_&]:text-gray-600">{t('aiBatchRegradeDesc')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 [.light-theme_&]:hover:bg-gray-100 rounded-full text-gray-400 [.light-theme_&]:text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative bg-gray-900/40 [.light-theme_&]:bg-gray-50 transition-colors">
          {/* Left Panel: Settings */}
          <div className="w-full lg:w-1/5 p-8 border-r border-gray-700 [.light-theme_&]:border-gray-200 overflow-y-auto scrollbar-none bg-gray-900/40 [.light-theme_&]:bg-white transition-colors">
            <div className="space-y-6">
              {error && (
                <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-3">
                  <AlertTriangle size={18} className="shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white [.light-theme_&]:text-gray-700 mb-3">{t('regradeMode')}</label>
                <div className="flex flex-col gap-2">
                  {[
                    { id: 'missed_only', label: t('missedOnly'), desc: t('noAIStatus') },
                    { id: 'failed_only', label: t('failedOnly'), desc: t('failedStatusDesc') },
                    { id: 'all', label: t('allSubmissions'), desc: t('resetAllDesc') },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={`px-5 py-4 rounded-2xl border text-left transition-all duration-200 ${mode === m.id
                        ? "bg-blue-600 border-blue-400 text-white shadow-xl shadow-blue-900/40 transform scale-[1.02]"
                        : "bg-gray-700/30 [.light-theme_&]:bg-gray-100 border-gray-700 [.light-theme_&]:border-gray-200 text-gray-300 [.light-theme_&]:text-gray-700 hover:bg-gray-700 [.light-theme_&]:hover:bg-gray-200 hover:border-gray-500"
                        }`}
                    >
                      <div className="font-extrabold text-base mb-1">{m.label}</div>
                      <div className={`text-xs ${mode === m.id ? 'text-blue-100' : 'text-gray-400 [.light-theme_&]:text-gray-500'}`}>{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 [.light-theme_&]:text-gray-600 mb-2 flex items-center gap-2">
                    <Calendar size={16} /> {t('fromDate')}
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2.5 bg-gray-900 [.light-theme_&]:bg-gray-100 border border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl text-white [.light-theme_&]:text-gray-900 focus:outline-none focus:border-blue-500 transition-colors"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 [.light-theme_&]:text-gray-600 mb-2 flex items-center gap-2">
                    <Calendar size={16} /> {t('toDate')}
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2.5 bg-gray-900 [.light-theme_&]:bg-gray-100 border border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl text-white [.light-theme_&]:text-gray-900 focus:outline-none focus:border-blue-500 transition-colors"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 [.light-theme_&]:text-gray-600 mb-2 flex items-center gap-2">
                  <Hash size={16} /> {t('limitSubmissions')}
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-2.5 bg-gray-900 [.light-theme_&]:bg-gray-100 border border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl text-white [.light-theme_&]:text-gray-900 focus:outline-none focus:border-blue-500 transition-colors"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Right Panel: Preview Table */}
          <div className="flex-1 p-8 bg-gray-900/40 [.light-theme_&]:bg-gray-50 overflow-hidden flex flex-col transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-bold text-white [.light-theme_&]:text-gray-900 flex items-center gap-2">
                <FileText size={20} />
                {t('previewMatching')} ({fetchingPreview ? t('loading') : (pinnedSubmissions.length + previewList.filter(item => !pinnedSubmissions.some(p => p.submission_id === item.submission_id)).length)})
              </h3>
              
              {/* Premium Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Tìm kiếm sinh viên..."
                  className="w-full pl-9 pr-8 py-1.5 bg-gray-850 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {fetchingPreview && <RefreshCw size={18} className="animate-spin text-blue-400" />}
            </div>

            <div className="flex-1 overflow-auto border border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl bg-gray-800/50 [.light-theme_&]:bg-white scrollbar-thin transition-colors">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-700/50 [.light-theme_&]:bg-gray-50 sticky top-0 outline outline-1 outline-gray-700 [.light-theme_&]:outline-gray-200 transition-colors">
                  <tr>
                    <th className="px-4 py-3 text-gray-300 [.light-theme_&]:text-gray-500 font-medium w-12 text-center">Chọn</th>
                    <th className="px-4 py-3 text-gray-300 [.light-theme_&]:text-gray-500 font-medium">{t('id')}</th>
                    <th className="px-4 py-3 text-gray-300 [.light-theme_&]:text-gray-500 font-medium">{t('studentName')}</th>
                    <th className="px-4 py-3 text-gray-300 [.light-theme_&]:text-gray-500 font-medium">{t('examTitle')}</th>
                    <th className="px-4 py-3 text-gray-300 [.light-theme_&]:text-gray-500 font-medium">{t('status')}</th>
                    <th className="px-4 py-3 text-gray-300 [.light-theme_&]:text-gray-500 font-medium text-right">{t('submittedDateTime')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700 [.light-theme_&]:divide-gray-100 transition-colors">
                  {(() => {
                    const unpinned = previewList.filter(item => !pinnedSubmissions.some(p => p.submission_id === item.submission_id));
                    const displayed = [...pinnedSubmissions, ...unpinned];

                    if (displayed.length === 0) {
                      return (
                        <tr>
                          <td colSpan="6" className="px-4 py-10 text-center text-gray-400 italic">
                            {fetchingPreview ? "Đang đồng bộ dữ liệu..." : "Không tìm thấy bài thi nào thỏa mãn điều kiện."}
                          </td>
                        </tr>
                      );
                    }

                    return displayed.map((item) => {
                      const isPinned = pinnedSubmissions.some(p => p.submission_id === item.submission_id);
                      return (
                        <tr key={item.submission_id} className={`hover:bg-gray-700/30 [.light-theme_&]:hover:bg-gray-50 transition-colors ${isPinned ? 'bg-blue-950/20' : ''}`}>
                          <td className="px-4 py-4 text-center w-12">
                            <input
                              type="checkbox"
                              checked={isPinned}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPinnedSubmissions(prev => [...prev, item]);
                                } else {
                                  setPinnedSubmissions(prev => prev.filter(p => p.submission_id !== item.submission_id));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-900/40 cursor-pointer"
                            />
                          </td>
                          <td className="px-5 py-4 text-blue-400 font-mono font-bold text-sm">#{item.submission_id}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <User size={16} className="text-gray-500" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-white [.light-theme_&]:text-gray-900 font-bold text-sm">{item.student_name}</p>
                                  {isPinned && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                                      Đã chọn
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 font-medium truncate max-w-[180px]">{item.student_email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-300 [.light-theme_&]:text-gray-600 text-sm font-medium">
                            {item.exam_title}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center">{getStatusLabel(item.status)}</div>
                              {item.error && <p className="text-[10px] text-red-400/80 italic line-clamp-1 max-w-[120px]" title={item.error}>{item.error}</p>}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right text-xs text-gray-400 font-medium transition-colors">
                            {new Date(item.submitted_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-700 [.light-theme_&]:border-gray-200 flex justify-between items-center bg-gray-800 [.light-theme_&]:bg-white sticky bottom-0 transition-colors">
          <div className="flex items-center gap-4">
            {success && (
              <div className="flex items-center gap-2 text-green-400 font-bold animate-fade-in">
                <Check className="p-1 bg-green-400/20 rounded-full" size={24} />
                Đang xử lý chấm lại... bài sẽ sớm có điểm mới!
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-red-400 font-bold animate-fade-in">
                <AlertTriangle className="p-1 bg-red-400/20 rounded-full" size={24} />
                {error}
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-3 bg-gray-700 [.light-theme_&]:bg-gray-100 hover:bg-gray-600 [.light-theme_&]:hover:bg-gray-200 text-white [.light-theme_&]:text-gray-700 font-medium rounded-2xl transition-all active:scale-95 border [.light-theme_&]:border-gray-200"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || (previewList.length === 0 && pinnedSubmissions.length === 0) || success}
              className="px-12 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-900/40 flex items-center gap-2 whitespace-nowrap active:scale-95"
            >
              {loading && <RefreshCw size={20} className="animate-spin" />}
              {t('startRegrading')} ({pinnedSubmissions.length > 0 ? pinnedSubmissions.length : previewList.length})
            </button>
          </div>
        </div>

        {/* Custom Confirmation Overlay */}
        {showConfirm && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in transition-all">
            <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-3xl p-8 max-w-lg w-full shadow-2xl mx-4 text-center transform scale-110 transition-colors">
              <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="text-yellow-500" size={40} />
              </div>
              <h3 className="text-2xl font-black text-white [.light-theme_&]:text-gray-900 mb-4">{t('confirmRegrade')}</h3>
              <p className="text-gray-300 [.light-theme_&]:text-gray-600 mb-8 leading-relaxed">
                {t('confirmRegradeDesc').replace('?', ` cho ${pinnedSubmissions.length > 0 ? pinnedSubmissions.length : previewList.length} bài thi đã chọn?`)}
                <br />
                <span className="text-red-400 font-medium">⚠️ {t('scoreUpdateNote')}</span>
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-8 py-3 bg-gray-700 [.light-theme_&]:bg-gray-100 hover:bg-gray-600 [.light-theme_&]:hover:bg-gray-200 text-white [.light-theme_&]:text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={executeRegrade}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-900/40 active:scale-95"
                >
                  {t('confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchRegradeModal;
