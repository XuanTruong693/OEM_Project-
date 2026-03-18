import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Home, Users, BookOpen, FileText, Award,
    Database, Settings, LogOut, Shield, CreditCard, Menu, X, Bot
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const AdminSidebar = ({ activeTab, onTabChange }) => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navItems = [
        { icon: Home, labelKey: 'dashboard', path: '/admin-dashboard', tab: 'dashboard' },
        { icon: Users, labelKey: 'userManagement', path: '/admin/users', tab: 'users' },
        // ✅ [StudentCard] Menu mới - Quản lý Thẻ Sinh Viên
        { icon: CreditCard, labelKey: 'studentCards', path: '/admin/student-cards', tab: 'student-cards' },
        { icon: BookOpen, labelKey: 'examManagement', path: '/admin/exams', tab: 'exams' },
        { icon: FileText, labelKey: 'examOverview', path: '/admin/exam-overview', tab: 'exam-overview' },
        { icon: Award, labelKey: 'results', path: '/admin/results', tab: 'results' },
        { icon: Bot, labelKey: 'aiGrading', path: '/admin/ai-grading-monitor', tab: 'ai-grading' },
        { icon: Database, labelKey: 'systemLogs', path: '/admin/logs', tab: 'logs' },
        { icon: Settings, labelKey: 'settings', path: '/admin/settings', tab: 'settings' }
    ];

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        navigate('/login');
    };

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
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
            <nav className="flex-1 flex flex-col overflow-y-auto">
                {navItems.map((item, index) => {
                    const isActive = activeTab === item.tab;
                    return (
                        <button
                            key={index}
                            onClick={() => {
                                if (onTabChange) onTabChange(item.tab);
                                navigate(item.path);
                                setMobileOpen(false);
                            }}
                            className={`flex items-center gap-3 px-6 py-4 text-sm transition-all text-left ${isActive
                                ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                                : 'text-gray-300 hover:bg-gray-700 hover:text-white border-l-4 border-transparent'
                                }`}
                        >
                            <item.icon size={18} />
                            <span>{item.labelKey === 'aiGrading' ? 'AI Monitor' : t(item.labelKey)}</span>
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
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 flex-shrink-0 bg-gray-800 border-r border-gray-700 min-h-screen flex-col">
                <SidebarContent />
            </aside>

            {/* Mobile Header (Sticky Top) */}
            <div className="md:hidden flex items-center justify-between bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-30 w-full">
                <div className="flex items-center gap-2">
                    <Shield className="text-blue-400" size={20} />
                    <span className="text-white font-semibold">{t('adminPanel')}</span>
                </div>
                <button onClick={() => setMobileOpen(true)} className="text-gray-300 hover:text-white transition-colors">
                    <Menu size={24} />
                </button>
            </div>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                ></div>
            )}

            {/* Mobile Drawer */}
            <aside
                className={`fixed top-0 left-0 h-full w-64 bg-gray-800 border-r border-gray-700 z-50 flex flex-col transform transition-transform duration-300 md:hidden ${
                    mobileOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="absolute top-4 right-4 md:hidden">
                    <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <SidebarContent />
            </aside>
        </>
    );
};

export default AdminSidebar;
