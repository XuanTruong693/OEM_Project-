import React, { useState, useEffect } from "react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import { Search, Bot, AlertCircle, CheckCircle, Clock, RefreshCw, Filter, Calendar, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import AIGradingDetailsModal from "../../components/admin/AIGradingDetailsModal";
import BatchRegradeModal from "../../components/admin/BatchRegradeModal";
import axiosClient from '../../api/axiosClient';
import { useLanguage } from "../../context/LanguageContext";

const AIGradingMonitor = () => {
  const { t, language } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0, missed: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [confirmRetryId, setConfirmRetryId] = useState(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const endpoint = filterStatus === 'missed' ? "/admin/ai-grading-logs/missed" : "/admin/ai-grading-logs";
      const response = await axiosClient.get(endpoint, {
        params: { page, limit: 10, status: filterStatus, search: searchTerm }
      });
      if (response.data.success) {
        setLogs(response.data.logs);
        if (filterStatus !== 'missed') {
          setSummary(response.data.summary);
        } else {
          const statsResp = await axiosClient.get("/admin/ai-grading-logs", { params: { limit: 1 } });
          if (statsResp.data.success) setSummary(statsResp.data.summary);
        }
        setTotalPages(response.data.totalPages);
      }
    } catch (error) {
      console.error("Error fetching AI logs", error);
    } finally {
      setLoading(false);
    }
  };

  const isProcessing = summary.pending > 0 || summary.in_progress > 0;

  useEffect(() => {
    fetchLogs();
    
    // Auto refresh frequency: 5s if processing, 15s otherwise
    const intervalTime = isProcessing ? 5000 : 15000;
    const interval = setInterval(fetchLogs, intervalTime);
    
    return () => clearInterval(interval);
  }, [page, filterStatus, searchTerm, isProcessing]);

  const handleRetryClick = (submissionId) => {
    setConfirmRetryId(submissionId);
    setShowConfirmModal(true);
  };

  const confirmRetry = async () => {
    if (!confirmRetryId) return;
    setShowConfirmModal(false);
    try {
      await axiosClient.post(`/admin/ai-grading-logs/${confirmRetryId}/retry`);
      fetchLogs(); // Refresh after retry
    } catch (error) {
      console.error("Error retrying AI grading", error);
      alert(error.response?.data?.message || t('error'));
    } finally {
      setConfirmRetryId(null);
    }
  };

  const StatusBadge = ({ status }) => {
    const { t } = useLanguage();
    const config = {
      pending: {
        color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 [.light-theme_&]:bg-yellow-50 [.light-theme_&]:text-yellow-600 [.light-theme_&]:border-yellow-200",
        icon: <Clock size={12} />,
        label: t('pendingStatus')
      },
      in_progress: {
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20 [.light-theme_&]:bg-blue-50 [.light-theme_&]:text-blue-600 [.light-theme_&]:border-blue-200",
        icon: <RefreshCw size={12} className="animate-spin" />,
        label: "IN PROGRESS"
      },
      completed: {
        color: "bg-green-500/10 text-green-500 border-green-500/20 [.light-theme_&]:bg-green-50 [.light-theme_&]:text-green-600 [.light-theme_&]:border-green-200",
        icon: <CheckCircle size={12} />,
        label: t('completedStatus')
      },
      failed: {
        color: "bg-red-500/10 text-red-500 border-red-500/20 [.light-theme_&]:bg-red-50 [.light-theme_&]:text-red-600 [.light-theme_&]:border-red-200",
        icon: <AlertCircle size={12} />,
        label: t('failedStatus')
      },
      missed: {
        color: "bg-orange-500/10 text-orange-500 border-orange-500/20 [.light-theme_&]:bg-orange-50 [.light-theme_&]:text-orange-600 [.light-theme_&]:border-orange-200",
        icon: <AlertCircle size={12} />,
        label: t('missedStatus')
      },
      not_required: {
        color: "bg-gray-500/10 text-gray-400 border-gray-500/20 [.light-theme_&]:bg-gray-50 [.light-theme_&]:text-gray-600 [.light-theme_&]:border-gray-200",
        icon: <CheckCircle size={12} />,
        label: "NOT REQUIRED"
      }
    };

    const { color, icon, label } = config[status] || config.missed;

    return (
      <span className={`inline-flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border whitespace-nowrap shadow-sm transition-all duration-200 ${color}`}>
        {icon}
        {label}
      </span>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 [.light-theme_&]:bg-gray-50 overflow-hidden">
      <AdminSidebar activeTab="ai-grading" />
      <div className="flex-1 flex flex-col p-4 pt-20 md:p-8 overflow-y-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-white [.light-theme_&]:text-gray-900 flex items-center gap-2">
              {t('aiGradingMonitorTitle')}
            </h1>
            <p className="text-gray-300 [.light-theme_&]:text-gray-600 mt-1">{t('aiGradingMonitorDesc')}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            >
              {t('aiBatchRegradeTool')}
            </button>
          </div>
        </div>

        <main className="">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="glow-card p-5 rounded-xl border border-gray-700 [.light-theme_&]:border-gray-200 [.light-theme_&]:bg-white transition hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-600/20 text-blue-400 [.light-theme_&]:bg-blue-100 [.light-theme_&]:text-blue-600 transition-colors"><Bot size={28} /></div>
                <div><p className="text-sm text-gray-400 [.light-theme_&]:text-gray-500 font-medium">{t('totalSubmissions')}</p><h3 className="text-2xl font-bold text-white [.light-theme_&]:text-gray-900">{summary.total}</h3></div>
              </div>
            </div>
            <div className="glow-card glow-card-yellow p-5 rounded-xl border border-gray-700 [.light-theme_&]:border-gray-200 [.light-theme_&]:bg-white transition hover:shadow-[0_0_20px_rgba(234,179,8,0.4)]">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-600/20 text-yellow-400 [.light-theme_&]:bg-yellow-100 [.light-theme_&]:text-yellow-600 transition-colors"><Clock size={28} /></div>
                <div><p className="text-sm text-gray-400 [.light-theme_&]:text-gray-500 font-medium">{t('pendingStatus')}</p><h3 className="text-2xl font-bold text-white [.light-theme_&]:text-gray-900">{summary.pending}</h3></div>
              </div>
            </div>
            <div className="glow-card glow-card-orange p-5 rounded-xl border border-gray-700 [.light-theme_&]:border-gray-200 [.light-theme_&]:bg-white transition hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-600/20 text-orange-400 [.light-theme_&]:bg-orange-100 [.light-theme_&]:text-orange-600 transition-colors"><AlertCircle size={28} /></div>
                <div><p className="text-sm text-gray-400 [.light-theme_&]:text-gray-500 font-medium">{t('missedStatus')}</p><h3 className="text-2xl font-bold text-white [.light-theme_&]:text-gray-900">{summary.missed}</h3></div>
              </div>
            </div>
            <div className="glow-card glow-card-red p-5 rounded-xl border border-gray-700 [.light-theme_&]:border-gray-200 [.light-theme_&]:bg-white transition hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-600/20 text-red-400 [.light-theme_&]:bg-red-100 [.light-theme_&]:text-red-600 transition-colors"><AlertCircle size={28} /></div>
                <div><p className="text-sm text-gray-400 [.light-theme_&]:text-gray-500 font-medium">{t('failedStatus')}</p><h3 className="text-2xl font-bold text-white [.light-theme_&]:text-gray-900">{summary.failed}</h3></div>
              </div>
            </div>
            <div className="glow-card glow-card-green p-5 rounded-xl border border-gray-700 [.light-theme_&]:border-gray-200 [.light-theme_&]:bg-white transition hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-600/20 text-green-400 [.light-theme_&]:bg-green-100 [.light-theme_&]:text-green-600 transition-colors"><CheckCircle size={28} /></div>
                <div><p className="text-sm text-gray-400 [.light-theme_&]:text-gray-500 font-medium">{t('completedStatus')}</p><h3 className="text-2xl font-bold text-white [.light-theme_&]:text-gray-900">{summary.completed}</h3></div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg overflow-hidden shadow-sm transition-colors">
            <div className="p-5 border-b border-gray-700 [.light-theme_&]:border-gray-200 flex flex-col sm:flex-row gap-4 justify-between bg-gray-800 [.light-theme_&]:bg-white transition-colors">
              <div className="relative flex-1 w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input
                  type="text"
                  placeholder={t('searchPlaceholderAI')}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                />
              </div>
              <div className="flex gap-4">
                {/* Custom Status Filter Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className="flex items-center justify-between gap-2 w-full sm:w-48 px-4 py-2.5 bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-lg text-white [.light-theme_&]:text-gray-900 focus:outline-none focus:border-blue-500 shadow-sm transition-all overflow-hidden"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {filterStatus === 'all' ? (
                        <Filter size={16} className="text-gray-400" />
                      ) : (
                        (() => {
                          const iconStyle = "shrink-0";
                          const config = {
                            pending: <Clock size={16} className={`${iconStyle} text-yellow-500`} />,
                            in_progress: <RefreshCw size={16} className={`${iconStyle} text-blue-500`} />,
                            completed: <CheckCircle size={16} className={`${iconStyle} text-green-500`} />,
                            failed: <AlertCircle size={16} className={`${iconStyle} text-red-500`} />,
                            missed: <AlertCircle size={16} className={`${iconStyle} text-orange-500`} />,
                            instructor_modified: <Bot size={16} className={`${iconStyle} text-yellow-500`} />
                          };
                          return config[filterStatus];
                        })()
                      )}
                      <span className="truncate text-sm font-medium">
                        {filterStatus === 'all' ? t('allStatus') :
                          filterStatus === 'pending' ? t('pendingStatus') :
                            filterStatus === 'in_progress' ? 'In Progress' :
                              filterStatus === 'completed' ? t('completedStatus') :
                                filterStatus === 'failed' ? t('failedStatus') :
                                  filterStatus === 'instructor_modified' ? t('instructorModifiedStatus') : t('missedStatus')}
                      </span>
                    </div>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showFilterDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowFilterDropdown(false)}
                      ></div>
                      <div className="absolute top-full right-0 mt-2 bg-gray-800 [.light-theme_&]:bg-white border border-gray-700 [.light-theme_&]:border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden py-1 min-w-[200px] animate-fade-in-down origin-top-right">
                        <button
                          onClick={() => { setFilterStatus('all'); setPage(1); setShowFilterDropdown(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${filterStatus === 'all' ? 'bg-blue-600 text-white' : 'text-gray-300 [.light-theme_&]:text-gray-700 hover:bg-gray-700 [.light-theme_&]:hover:bg-gray-100'}`}
                        >
                          <Filter size={16} className={filterStatus === 'all' ? 'text-white' : 'text-gray-400'} />
                          <span className="font-medium">{t('allStatus')}</span>
                        </button>
                        <div className="h-px bg-gray-700 [.light-theme_&]:bg-gray-100 mx-2 my-1" />
                        {[
                          { id: 'pending', label: t('pendingStatus'), icon: <Clock size={16} className="text-yellow-500" /> },
                          { id: 'in_progress', label: 'In Progress', icon: <RefreshCw size={16} className="text-blue-500" /> },
                          { id: 'completed', label: t('completedStatus'), icon: <CheckCircle size={16} className="text-green-500" /> },
                          { id: 'failed', label: t('failedStatus'), icon: <AlertCircle size={16} className="text-red-500" /> },
                          { id: 'missed', label: t('missedStatus'), icon: <AlertCircle size={16} className="text-orange-500" /> },
                          { id: 'instructor_modified', label: t('instructorModifiedStatus'), icon: <Bot size={16} className="text-yellow-500" /> }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => { setFilterStatus(opt.id); setPage(1); setShowFilterDropdown(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${filterStatus === opt.id ? 'bg-blue-600 text-white' : 'text-gray-300 [.light-theme_&]:text-gray-700 hover:bg-gray-700 [.light-theme_&]:hover:bg-gray-100'}`}
                          >
                            <span className={filterStatus === opt.id ? 'text-white' : ''}>{opt.icon}</span>
                            <span className="font-medium">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={fetchLogs}
                  className="px-4 py-2.5 bg-gray-700 [.light-theme_&]:bg-gray-100 hover:bg-gray-600 [.light-theme_&]:hover:bg-gray-200 text-white [.light-theme_&]:text-gray-700 rounded-lg flex items-center gap-2 border border-gray-600 [.light-theme_&]:border-gray-200 transition-colors shadow-sm font-medium group"
                >
                  <RefreshCw size={18} className={(loading || isProcessing) ? "animate-spin" : "group-active:animate-spin"} />
                  <span className="hidden sm:inline">{t('refresh')}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-gray-700/50 [.light-theme_&]:bg-gray-50 transition-colors">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('id')}</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('studentName')}</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('examTitle')}</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('submittedDateTime')}</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 [.light-theme_&]:text-gray-500 uppercase tracking-wider min-w-[150px]">{t('modelStatus')}</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 [.light-theme_&]:text-gray-500 uppercase tracking-wider">{t('action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700 [.light-theme_&]:divide-gray-100 transition-colors">
                  {loading && logs.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-300">{t('loading')}</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-300">{t('noData')}</td></tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.submission_id} className="hover:bg-gray-700/30 [.light-theme_&]:hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-300 [.light-theme_&]:text-gray-600">#{log.submission_id}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-white [.light-theme_&]:text-gray-900">{log.student_name}</p>
                          <p className="text-xs text-gray-400 [.light-theme_&]:text-gray-500">{log.student_email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-300 [.light-theme_&]:text-gray-600">{log.exam_title}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300 [.light-theme_&]:text-gray-600">
                          {new Date(log.submitted_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <StatusBadge status={log.status} />
                             {!!log.is_instructor_modified && (
                               <div className="relative flex h-2 w-2" title={t('instructorModified')}>
                                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                 <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"></span>
                               </div>
                             )}
                          </div>
                          {log.error && (
                            <p className="text-xs text-red-400 mt-2 truncate max-w-[200px] border-l border-red-500/50 pl-2" title={log.error}>
                              {t('error')}: {log.error}
                            </p>
                          )}
                          {log.retry_count > 0 && <p className="text-xs text-yellow-500 mt-1">Đã thử lại: {log.retry_count} lần</p>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedSubmissionId(log.submission_id)}
                              className="px-3 py-1.5 bg-gray-700 border border-gray-600 text-blue-400 hover:bg-gray-600 rounded-md text-sm font-medium transition-colors shadow-sm"
                            >
                              {t('viewDetailsAction')} ↳
                            </button>
                            {(log.status === 'failed' || log.status === 'pending' || log.status === 'missed') && (
                              <button
                                onClick={() => handleRetryClick(log.submission_id)}
                                className="px-3 py-1.5 bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 border border-yellow-600/30 rounded-md text-sm font-medium transition-colors flex items-center gap-1 shadow-sm"
                              >
                                <RefreshCw size={14} /> {log.status === 'missed' ? t('regradeMissed') : t('triggerRegrade')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-700 [.light-theme_&]:border-gray-200 flex justify-between items-center bg-gray-800 [.light-theme_&]:bg-gray-50 transition-colors">
                <span className="text-sm text-gray-300 [.light-theme_&]:text-gray-600">
                  {t('showing')} <span className="font-bold text-white [.light-theme_&]:text-gray-900">{page}</span> {t('of')} <span className="font-bold text-white [.light-theme_&]:text-gray-900">{totalPages}</span>
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-4 py-2 bg-gray-700 [.light-theme_&]:bg-white border border-gray-600 [.light-theme_&]:border-gray-200 rounded-lg hover:bg-gray-600 [.light-theme_&]:hover:bg-gray-100 text-white [.light-theme_&]:text-gray-700 disabled:opacity-50 text-sm font-medium transition-all shadow-sm flex items-center gap-1"
                  >
                    <ChevronLeft size={16} /> {t('page')} {page - 1}
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-4 py-2 bg-gray-700 [.light-theme_&]:bg-white border border-gray-600 [.light-theme_&]:border-gray-200 rounded-lg hover:bg-gray-600 [.light-theme_&]:hover:bg-gray-100 text-white [.light-theme_&]:text-gray-700 disabled:opacity-50 text-sm font-medium transition-all shadow-sm flex items-center gap-1"
                  >
                    {t('page')} {page + 1} <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedSubmissionId && (
        <AIGradingDetailsModal
          submissionId={selectedSubmissionId}
          onClose={() => setSelectedSubmissionId(null)}
          onRetrySuccess={() => {
            fetchLogs();
          }}
        />
      )}

      {showBatchModal && (
        <BatchRegradeModal
          onClose={() => setShowBatchModal(false)}
          onSuccess={() => {
            setShowBatchModal(false);
            fetchLogs();
          }}
        />
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-md mx-4 animate-fade-in-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-yellow-500" size={32} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{t('confirmRegrade')}</h2>
              <p className="text-gray-300 mb-6">
                {t('confirmRegradeDesc')} (ID #{confirmRetryId})
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => { setShowConfirmModal(false); setConfirmRetryId(null); }}
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

export default AIGradingMonitor;
