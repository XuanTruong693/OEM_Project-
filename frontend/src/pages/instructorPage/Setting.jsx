import React from "react";
import { useUi } from "../../context/UiContext.jsx";

export default function Setting() {
  const { lang, setLang } = useUi();

  const Toggle = ({ checked, onChange }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto mt-0 max-md:mt-10">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-slate-800">
          Cài đặt giao diện
        </h1>
        <p className="text-slate-600">
          Thiết lập theme và ngôn ngữ cho giao diện giảng viên
        </p>
      </header>

      {/* Theme section removed per user request; interface always uses light theme */}

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between max-md:flex-col max-md:items-start max-md:justify-start">
          <div>
            <div className="font-medium text-slate-800">Ngôn ngữ</div>
            <div className="text-sm text-slate-500">
              Chọn ngôn ngữ hiển thị cho giao diện giảng viên
            </div>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden mt-0 max-lg:mt-3">
            <button
              onClick={() => setLang("vi")}
              className={`px-3 py-2 text-sm flex items-center gap-2 ${
                lang === "vi"
                  ? "bg-blue-600 text-white"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              <svg className="w-5 h-4" viewBox="0 0 900 600" fill="currentColor">
                <rect width="900" height="600" fill="#da251d" />
                <polygon
                  points="450,80 510,240 680,240 540,340 600,500 450,380 300,500 360,340 220,240 390,240"
                  fill="#ffff00"
                />
              </svg>
              Tiếng Việt
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-2 text-sm flex items-center gap-2 ${
                lang === "en"
                  ? "bg-blue-600 text-white"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              <svg className="w-5 h-4" viewBox="0 0 60 30">
                <clipPath id="t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
                <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
                <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
                <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
                <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
                <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
              </svg>
              English
            </button>
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-500 mt-3">
        Gợi ý: Một số trang sẽ phản ứng ngay; phần còn lại sẽ được áp dụng dần.
      </p>
    </div>
  );
}
