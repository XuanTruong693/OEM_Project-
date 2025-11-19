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
              className={`px-3 py-2 text-sm ${
                lang === "vi"
                  ? "bg-blue-600 text-white"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              Tiếng Việt
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-2 text-sm ${
                lang === "en"
                  ? "bg-blue-600 text-white"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
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
