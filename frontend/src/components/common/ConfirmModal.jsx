import React from 'react';

/**
 * ConfirmModal - Modal xác nhận thay thế window.confirm
 * @param {boolean} isOpen - Hiển thị modal hay không
 * @param {string} title - Tiêu đề modal
 * @param {string} message - Nội dung cần xác nhận
 * @param {function} onConfirm - Callback khi nhấn Xác nhận
 * @param {function} onCancel - Callback khi nhấn Hủy
 * @param {string} confirmText - Text nút xác nhận (mặc định: "Xác nhận")
 * @param {string} cancelText - Text nút hủy (mặc định: "Hủy")
 * @param {string} type - Loại modal: 'danger' | 'warning' | 'info' (mặc định: 'warning')
 */
export default function ConfirmModal({
    isOpen,
    title = "Xác nhận",
    message,
    onConfirm,
    onCancel,
    confirmText = "Xác nhận",
    cancelText = "Hủy",
    type = "warning"
}) {
    if (!isOpen) return null;

    const typeStyles = {
        danger: {
            icon: "🗑️",
            iconBg: "bg-red-100",
            iconColor: "text-red-600",
            confirmBtn: "bg-red-600 hover:bg-red-700",
        },
        warning: {
            icon: "⚠️",
            iconBg: "bg-orange-100",
            iconColor: "text-orange-600",
            confirmBtn: "bg-orange-500 hover:bg-orange-600",
        },
        info: {
            icon: "ℹ️",
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
            confirmBtn: "bg-blue-600 hover:bg-blue-700",
        },
    };

    const style = typeStyles[type] || typeStyles.warning;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp">
                {/* Header */}
                <div className="p-6 text-center">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${style.iconBg} flex items-center justify-center`}>
                        <span className="text-3xl">{style.icon}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
                    <p className="text-slate-600">{message}</p>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 px-4 py-3 ${style.confirmBtn} text-white font-semibold rounded-xl transition`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
