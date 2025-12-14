import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Home, Users, BookOpen, FileText, Award,
    Database, Settings, LogOut, Shield
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const AdminSidebar = ({ activeTab, onTabChange }) => {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const navItems = [
        { icon: Home, labelKey: 'dashboard', path: '/admin-dashboard', tab: 'dashboard' },
        { icon: Users, labelKey: 'userManagement', path: '/admin/users', tab: 'users' },
        { icon: BookOpen, labelKey: 'examManagement', path: '/admin/exams', tab: 'exams' },
        { icon: FileText, labelKey: 'examOverview', path: '/admin/exam-overview', tab: 'exam-overview' },
        { icon: Award, labelKey: 'results', path: '/admin/results', tab: 'results' },
        { icon: Database, labelKey: 'systemLogs', path: '/admin/logs', tab: 'logs' },
        { icon: Settings, labelKey: 'settings', path: '/admin/settings', tab: 'settings' }
    ];

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        navigate('/login');
    };

    return (
        <aside className="w-64 bg-gray-800 border-r border-gray-700 min-h-screen flex flex-col">
            {/* Logo */}
            <div className="p-6 pb-4">
                <img
                    src="/Logo2.png"
                    alt="OEM Logo"
                    className="h-14 md:h-16 w-auto cursor-pointer"
                    onClick={() => navigate("/")}
                />
                <div className="flex items-center gap-2 mt-3 text-blue-400">
                    <Shield size={16} />
                    <span className="text-sm font-medium">{t('adminPanel')}</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col">
                {navItems.map((item, index) => {
                    const isActive = activeTab === item.tab;
                    return (
                        <button
                            key={index}
                            onClick={() => {
                                if (onTabChange) onTabChange(item.tab);
                                navigate(item.path);
                            }}
                            className={`flex items-center gap-3 px-6 py-4 text-sm transition-all text-left ${isActive
                                ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                                : 'text-gray-300 hover:bg-gray-700 hover:text-white border-l-4 border-transparent'
                                }`}
                        >
                            <item.icon size={18} />
                            <span>{t(item.labelKey)}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-gray-700">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-red-600/20 hover:text-red-400 rounded-lg transition-all w-full"
                >
                    <LogOut size={18} />
                    <span>{t('logout')}</span>
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
