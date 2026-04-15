import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

const TranslationBar = ({ inline = false }) => {
    const [visible, setVisible] = useState(false);
    const { language: currentLang, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const dropdownRef = useRef(null);

    useEffect(() => {
        // Strict Visibility: Only show the selector on the landing page ('/')
        // Hide it on all other pages (after login or other sections)
        const isLanding = location.pathname === '/';
        setVisible(isLanding);
    }, [location.pathname]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectLanguage = (lang) => {
        if (lang === currentLang) {
            setIsOpen(false);
            return;
        }

        setIsOpen(false);
        // Change language globally and reload to apply to all UI components
        setLanguage(lang, true);
    };

    if (!visible && !inline) return null;

    const languages = [
        { code: 'vi', label: 'Tiếng Việt', flag: '/icons/VIE.png' },
        { code: 'en', label: 'English', flag: '/icons/ENG.png' }
    ];

    const currentLangObj = languages.find(l => l.code === currentLang) || languages[0];

    return (
        <div
            ref={dropdownRef}
            className={`${inline ? 'relative ml-1' : 'fixed top-6 right-6 z-[9999]'} animate-fade-in`}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center gap-2 w-full min-w-[140px] px-3 sm:px-4 py-1.5 sm:py-2 border border-[#0077b6] rounded-lg !bg-transparent text-[#0077b6] font-bold text-sm sm:text-base transition-all duration-300 active:scale-95 group"
                title="Chọn ngôn ngữ"
            >
                <img src={currentLangObj.flag} alt="" className="h-4 w-auto object-contain" />
                <span className="uppercase tracking-wide">
                    {currentLangObj.code}
                </span>
                <svg
                    className={`w-3.5 h-3.5 text-[#0077b6] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] overflow-hidden z-[10000] animate-slide-up">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleSelectLanguage(lang.code)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors ${currentLang === lang.code
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                <img src={lang.flag} alt="" className="h-3.5 w-auto object-contain" />
                                <span>{lang.label}</span>
                            </span>
                            {currentLang === lang.code && (
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes slide-up {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}} />
        </div>
    );
};

export default TranslationBar;
