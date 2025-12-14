import React from 'react';
import { Terminal } from 'lucide-react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import ServerLogsPanel from '../../components/admin/ServerLogsPanel';
import { useLanguage } from '../../context/LanguageContext';

const SystemLogs = () => {
    const { t } = useLanguage();

    return (
        <div className="flex min-h-screen bg-gray-900">
            <AdminSidebar />

            <main className="flex-1 p-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white">{t('systemLogs')}</h1>
                    <p className="text-gray-400 mt-1">{t('systemLogs')}</p>
                </div>

                {/* Activity Logs Label */}
                <div className="mb-4 flex items-center gap-2">
                    <Terminal size={20} className="text-blue-400" />
                    <span className="text-lg font-medium text-white">{t('activityLogs')}</span>
                </div>

                {/* Server Logs Panel - Full Width */}
                <div className="w-full">
                    <ServerLogsPanel fullWidth={true} />
                </div>
            </main>
        </div>
    );
};

export default SystemLogs;
