import React from 'react';

const UiContext = React.createContext(null);

const defaultDict = {
  vi: {
    dashboard: 'Bảng điều khiển',
    resources: 'Tài nguyên',
    exam_bank: 'Ngân hàng đề',
    assign_exam: 'Assign Exam',
    result: 'Kết quả',
    setting: 'Cài đặt',
    open_room: 'Mở phòng thi',
    my_exams: 'Đề thi của tôi',
    view: 'Xem',
    open_exam_title: 'Mở phòng thi',
    preview_title: 'Preview – Xem trước',
    exam_settings: 'Cấu hình phòng thi',
    overview: 'Tổng quan',
    anti: 'Chống gian lận',
  },
  en: {
    dashboard: 'Dashboard',
    resources: 'Resources',
    exam_bank: 'Exam Bank',
    assign_exam: 'Assign Exam',
    result: 'Result',
    setting: 'Setting',
    open_room: 'Open Room',
    my_exams: 'My Exams',
    view: 'View',
    open_exam_title: 'Open Room',
    preview_title: 'Preview',
    exam_settings: 'Exam Settings',
    overview: 'Overview',
    anti: 'Anti-cheat',
  }
};

export function UiProvider({ children, dict = defaultDict }) {
  const [lang, setLang] = React.useState(() => localStorage.getItem('uiLang') || 'vi');

  React.useEffect(() => {
    try { localStorage.setItem('uiLang', lang); } catch {}
  }, [lang]);

  const t = React.useCallback((key, fallbackVi, fallbackEn) => {
    const table = dict[lang] || {};
    if (table[key]) return table[key];
    if (lang === 'vi' && fallbackVi) return fallbackVi;
    if (lang === 'en' && fallbackEn) return fallbackEn;
    return fallbackVi || fallbackEn || key;
  }, [lang, dict]);

  const value = React.useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = React.useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used within UiProvider');
  return ctx;
}
