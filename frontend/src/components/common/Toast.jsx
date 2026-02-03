import React, { useEffect, useState } from 'react';

/**
 * Toast - Component thông báo nhỏ xuất hiện tạm thời
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại toast: 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - Thời gian hiển thị (ms), mặc định 3000
 * @param {function} onClose - Callback khi đóng toast
 */
export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            if (onClose) setTimeout(onClose, 300); // Wait for fade out
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const typeStyles = {
        success: {
            bg: 'bg-emerald-500',
            icon: '✔️',
        },
        error: {
            bg: 'bg-red-500',
            icon: '❌',
        },
        warning: {
            bg: 'bg-orange-500',
            icon: '⚠️',
        },
        info: {
            bg: 'bg-blue-500',
            icon: 'ℹ️',
        },
    };

    const style = typeStyles[type] || typeStyles.info;

    return (
        <div
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white ${style.bg} transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                }`}
        >
            <span className="text-lg">{style.icon}</span>
            <span className="font-medium">{message}</span>
            <button
                onClick={() => {
                    setVisible(false);
                    if (onClose) setTimeout(onClose, 300);
                }}
                className="ml-2 text-white/70 hover:text-white"
            >
                ✕
            </button>
        </div>
    );
}
