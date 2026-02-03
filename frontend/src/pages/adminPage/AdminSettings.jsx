import React, { useState, useEffect } from 'react';
import {
    Save, Download, RefreshCw, Database, Clock, Target,
    Check, AlertTriangle, Sun, Moon, HardDrive, RotateCcw, X
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axiosClient from '../../api/axiosClient';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { useLanguage } from '../../context/LanguageContext';

const AdminSettings = () => {
    const { t, language, setLanguage } = useLanguage();
    const [settings, setSettings] = useState({
        user_growth_target_yearly: 1000,
        backup_schedule: { enabled: true, time: '01:00', retention_days: 30 },
        suspicious_thresholds: { mass_delete: 10, failed_login: 5, restore_frequency: 3 }
    });
    const [preferences, setPreferences] = useState({
        theme: localStorage.getItem('admin_theme') || 'dark',
        language: localStorage.getItem('admin_language') || 'vi'
    });
    const [backupHistory, setBackupHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [backing, setBacking] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState(null);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Apply theme on mount and when changed
    useEffect(() => {
        const savedTheme = localStorage.getItem('admin_theme') || 'dark';
        document.body.classList.toggle('light-theme', savedTheme === 'light');
        setPreferences(prev => ({ ...prev, theme: savedTheme }));
    }, []);

    // Fetch settings
    const fetchSettings = async () => {
        try {
            setLoading(true);

            const [settingsRes, prefsRes, backupRes] = await Promise.all([
                axiosClient.get('/admin/settings'),
                axiosClient.get('/admin/preferences'),
                axiosClient.get('/admin/backup/history?limit=5')
            ]);

            if (settingsRes.data.success && settingsRes.data.settings) {
                const s = settingsRes.data.settings;
                setSettings({
                    user_growth_target_yearly: parseInt(s.user_growth_target_yearly) || 1000,
                    backup_schedule: typeof s.backup_schedule === 'object' ? s.backup_schedule : JSON.parse(s.backup_schedule || '{}'),
                    suspicious_thresholds: typeof s.suspicious_thresholds === 'object' ? s.suspicious_thresholds : JSON.parse(s.suspicious_thresholds || '{}')
                });
            }

            if (prefsRes.data.success && prefsRes.data.preferences) {
                const apiPrefs = prefsRes.data.preferences;
                // Merge with local storage preferences (local takes priority for theme)
                setPreferences(prev => ({
                    ...prev,
                    theme: localStorage.getItem('admin_theme') || apiPrefs.theme || 'dark',
                    language: apiPrefs.language || localStorage.getItem('admin_language') || 'vi'
                }));
            }

            if (backupRes.data.success && backupRes.data.backups) {
                setBackupHistory(backupRes.data.backups);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            setMessage({ type: 'error', text: 'Lỗi khi tải cài đặt' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    // Save settings
    const handleSaveSettings = async () => {
        try {
            setSaving(true);
            const response = await axiosClient.put('/admin/settings', {
                settings: {
                    user_growth_target_yearly: settings.user_growth_target_yearly.toString(),
                    backup_schedule: settings.backup_schedule,
                    suspicious_thresholds: settings.suspicious_thresholds
                }
            });

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Lưu cài đặt thành công!' });
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage({ type: 'error', text: 'Lỗi khi lưu cài đặt' });
        } finally {
            setSaving(false);
        }
    };

    // Update preferences (theme, language)
    const handleUpdatePreferences = async (updates) => {
        try {
            const newPrefs = { ...preferences, ...updates };
            setPreferences(newPrefs);

            await axiosClient.put('/admin/preferences', updates);

            // Apply theme immediately and save to localStorage
            if (updates.theme) {
                document.body.classList.toggle('light-theme', updates.theme === 'light');
                localStorage.setItem('admin_theme', updates.theme);
            }

            // Save language to localStorage
            if (updates.language) {
                localStorage.setItem('admin_language', updates.language);
                // Trigger a re-render across the app by dispatching a custom event
                window.dispatchEvent(new CustomEvent('languageChange', { detail: updates.language }));
            }

            setMessage({ type: 'success', text: 'Cập nhật thành công!' });
        } catch (error) {
            console.error('Error updating preferences:', error);
            setMessage({ type: 'error', text: 'Lỗi khi cập nhật' });
        }
    };

    // Create backup
    const handleBackup = async () => {
        try {
            setBacking(true);
            setMessage({ type: '', text: '' });

            const response = await axiosClient.post('/admin/backup');

            if (response.data.success) {
                setMessage({ type: 'success', text: `Backup thành công! File: ${response.data.backup.fileName}` });
                fetchSettings(); // Refresh backup history
            }
        } catch (error) {
            console.error('Error creating backup:', error);
            setMessage({ type: 'error', text: error.response?.data?.message || 'Lỗi khi tạo backup' });
        } finally {
            setBacking(false);
        }
    };

    // Clear message after 5 seconds
    useEffect(() => {
        if (message.text) {
            const timer = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const formatFileSize = (bytes) => {
        if (!bytes) return 'N/A';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // Restore backup
    const handleRestore = async () => {
        if (!selectedBackup) return;

        try {
            setRestoring(true);
            setMessage({ type: '', text: '' });

            const response = await axiosClient.post('/admin/restore', {
                backup_id: selectedBackup.id
            });

            if (response.data.success) {
                setMessage({
                    type: 'success',
                    text: `Restore thành công từ backup: ${selectedBackup.file_name}`
                });
                setShowRestoreModal(false);
                setSelectedBackup(null);
                fetchSettings(); // Refresh data
            }
        } catch (error) {
            console.error('Error restoring backup:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Lỗi khi restore backup'
            });
        } finally {
            setRestoring(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <AdminSidebar activeTab="settings" />
                <main className="flex-1 p-8 flex items-center justify-center">
                    <div className="text-gray-300">{t('loading')}</div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-900">
            <AdminSidebar activeTab="settings" />

            <main className="flex-1 p-8 overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-semibold text-white">{t('settingsTitle')}</h1>
                        <p className="text-gray-300 mt-1">{t('settingsDesc')}</p>
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Theme & Appearance */}
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <Sun size={20} className="text-yellow-400" />
                            {t('appearance')}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-300 mb-3">{t('theme')}</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => handleUpdatePreferences({ theme: 'dark' })}
                                        className={`flex-1 flex items-center justify-center gap-3 px-4 py-4 rounded-lg border-2 transition-all ${preferences.theme === 'dark'
                                            ? 'border-blue-500 bg-blue-600/20'
                                            : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                                            }`}
                                    >
                                        <Moon className={preferences.theme === 'dark' ? 'text-blue-400' : 'text-gray-300'} size={24} />
                                        <span className={preferences.theme === 'dark' ? 'text-white' : 'text-gray-300'}>Dark Mode</span>
                                    </button>
                                    <button
                                        onClick={() => handleUpdatePreferences({ theme: 'light' })}
                                        className={`flex-1 flex items-center justify-center gap-3 px-4 py-4 rounded-lg border-2 transition-all ${preferences.theme === 'light'
                                            ? 'border-blue-500 bg-blue-600/20'
                                            : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                                            }`}
                                    >
                                        <Sun className={preferences.theme === 'light' ? 'text-yellow-400' : 'text-gray-300'} size={24} />
                                        <span className={preferences.theme === 'light' ? 'text-white' : 'text-gray-300'}>Light Mode</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-300 mb-2">{t('language')}</label>
                                <select
                                    value={language}
                                    onChange={(e) => {
                                        setLanguage(e.target.value);
                                        handleUpdatePreferences({ language: e.target.value });
                                    }}
                                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                >
                                    <option value="vi">{t('vietnamese')}</option>
                                    <option value="en">{t('english')}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* User Growth Target */}
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <Target size={20} className="text-green-400" />
                            {t('growthTarget')}
                        </h2>

                        <div>
                            <label className="block text-sm text-gray-300 mb-2">{t('yearlyUserTarget')}</label>
                            <input
                                type="number"
                                value={settings.user_growth_target_yearly}
                                onChange={(e) => setSettings({ ...settings, user_growth_target_yearly: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-xl font-bold focus:outline-none focus:border-blue-500"
                            />
                            <p className="text-xs text-gray-300 mt-2">{t('yearlyUserTargetDesc')}</p>
                        </div>
                    </div>

                    {/* Backup Settings */}
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <HardDrive size={20} className="text-purple-400" />
                            {t('backupConfig')}
                        </h2>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-300">{t('autoBackup')}</span>
                                <button
                                    onClick={() => setSettings({
                                        ...settings,
                                        backup_schedule: { ...settings.backup_schedule, enabled: !settings.backup_schedule.enabled }
                                    })}
                                    className={`w-12 h-6 rounded-full transition-colors ${settings.backup_schedule.enabled ? 'bg-blue-600' : 'bg-gray-600'
                                        }`}
                                >
                                    <span className={`block w-5 h-5 rounded-full bg-white shadow transform transition-transform ${settings.backup_schedule.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                        }`} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-300 mb-2">{t('backupTime')}</label>
                                    <DatePicker
                                        selected={(() => {
                                            const [h, m] = (settings.backup_schedule.time || '01:00').split(':');
                                            const d = new Date();
                                            d.setHours(parseInt(h), parseInt(m), 0);
                                            return d;
                                        })()}
                                        onChange={(date) => {
                                            if (date) {
                                                const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                                                setSettings({
                                                    ...settings,
                                                    backup_schedule: { ...settings.backup_schedule, time }
                                                });
                                            }
                                        }}
                                        showTimeSelect
                                        showTimeSelectOnly
                                        timeIntervals={15}
                                        timeFormat="HH:mm"
                                        dateFormat="HH:mm"
                                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-300 mb-2">{t('retentionDays')}</label>
                                    <input
                                        type="number"
                                        value={settings.backup_schedule.retention_days || 30}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            backup_schedule: { ...settings.backup_schedule, retention_days: parseInt(e.target.value) || 30 }
                                        })}
                                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleBackup}
                                disabled={backing}
                                className="w-full mt-4 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {backing ? (
                                    <><RefreshCw className="animate-spin" size={18} /> {t('creatingBackup')}</>
                                ) : (
                                    <><Download size={18} /> {t('createBackupNow')}</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Suspicious Thresholds */}
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <AlertTriangle size={20} className="text-red-400" />
                            {t('suspiciousThresholds')}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-300 mb-2">{t('massDelete')}</label>
                                <input
                                    type="number"
                                    value={settings.suspicious_thresholds.mass_delete || 10}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        suspicious_thresholds: { ...settings.suspicious_thresholds, mass_delete: parseInt(e.target.value) || 10 }
                                    })}
                                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-300 mb-2">{t('failedLogin')}</label>
                                <input
                                    type="number"
                                    value={settings.suspicious_thresholds.failed_login || 5}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        suspicious_thresholds: { ...settings.suspicious_thresholds, failed_login: parseInt(e.target.value) || 5 }
                                    })}
                                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-300 mb-2">{t('restoreFrequency')}</label>
                                <input
                                    type="number"
                                    value={settings.suspicious_thresholds.restore_frequency || 3}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        suspicious_thresholds: { ...settings.suspicious_thresholds, restore_frequency: parseInt(e.target.value) || 3 }
                                    })}
                                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Backup History */}
                <div className="mt-8 bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <Database size={20} className="text-blue-400" />
                        {t('recentBackups')}
                    </h2>

                    {backupHistory.length === 0 ? (
                        <p className="text-gray-300 text-center py-4">{t('noBackups')}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-300 uppercase">{t('time')}</th>
                                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-300 uppercase">{t('backupType')}</th>
                                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-300 uppercase">{t('fileName')}</th>
                                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-300 uppercase">{t('fileSize')}</th>
                                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-300 uppercase">{t('status')}</th>
                                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-300 uppercase">{t('performedBy')}</th>
                                        <th className="text-center py-2 px-4 text-xs font-medium text-gray-300 uppercase">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {backupHistory.map((backup) => (
                                        <tr key={backup.id} className="border-b border-gray-700/50">
                                            <td className="py-3 px-4 text-sm text-gray-300">
                                                {new Date(backup.started_at).toLocaleString('vi-VN')}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded text-xs ${backup.backup_type === 'manual' ? 'bg-blue-600/20 text-blue-400' :
                                                    backup.backup_type === 'scheduled' ? 'bg-purple-600/20 text-purple-400' :
                                                        'bg-orange-600/20 text-orange-400'
                                                    }`}>
                                                    {backup.backup_type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-300 font-mono">{backup.file_name}</td>
                                            <td className="py-3 px-4 text-sm text-gray-300">{formatFileSize(backup.file_size)}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded text-xs ${backup.status === 'completed' ? 'bg-green-600/20 text-green-400' :
                                                    backup.status === 'failed' ? 'bg-red-600/20 text-red-400' :
                                                        'bg-yellow-600/20 text-yellow-400'
                                                    }`}>
                                                    {backup.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-300">{backup.performed_by_email || 'System'}</td>
                                            <td className="py-3 px-4 text-center">
                                                {backup.status === 'completed' && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedBackup(backup);
                                                            setShowRestoreModal(true);
                                                        }}
                                                        className="p-1.5 text-orange-400 hover:text-orange-300 hover:bg-orange-600/20 rounded-lg transition-colors"
                                                        title="Restore từ backup này"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Save Button */}
                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? (
                            <><RefreshCw className="animate-spin" size={18} /> {t('savingSettings')}</>
                        ) : (
                            <><Save size={18} /> {t('saveSettings')}</>
                        )}
                    </button>
                </div>
            </main>

            {/* Restore Confirmation Modal */}
            {showRestoreModal && selectedBackup && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
                        <div className="flex justify-between items-center p-5 border-b border-gray-700">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-600/20 rounded-lg">
                                    <AlertTriangle className="text-orange-400" size={20} />
                                </div>
                                <h2 className="text-lg font-semibold text-white">Xác nhận Restore</h2>
                            </div>
                            <button
                                onClick={() => setShowRestoreModal(false)}
                                className="text-gray-300 hover:text-white p-1 hover:bg-gray-700 rounded"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-orange-600/10 border border-orange-600/30 rounded-lg p-4">
                                <p className="text-orange-300 text-sm">
                                    <strong>⚠️ Cảnh báo:</strong> Hành động này sẽ khôi phục database về trạng thái của backup đã chọn.
                                    Dữ liệu hiện tại sẽ được backup tự động trước khi restore.
                                </p>
                            </div>
                            <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-300">File backup:</span>
                                    <span className="text-white font-mono text-xs">{selectedBackup.file_name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-300">Thời gian tạo:</span>
                                    <span className="text-white">{new Date(selectedBackup.started_at).toLocaleString('vi-VN')}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-300">Kích thước:</span>
                                    <span className="text-white">{formatFileSize(selectedBackup.file_size)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
                            <button
                                onClick={() => setShowRestoreModal(false)}
                                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleRestore}
                                disabled={restoring}
                                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {restoring ? (
                                    <><RefreshCw className="animate-spin" size={16} /> Đang restore...</>
                                ) : (
                                    <><RotateCcw size={16} /> Restore ngay</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSettings;


