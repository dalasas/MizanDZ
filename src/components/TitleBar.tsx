import React, { useState, useRef, useEffect } from 'react';
import { Minus, Square, X, Database, WifiOff, ShieldCheck, Moon, Sun, Contrast } from 'lucide-react';
import { User } from '../types';
import { useTheme, ThemeMode } from '../context/ThemeContext';

interface TitleBarProps {
  currentUser: User | null;
  onOpenBackup: () => void;
  lang: 'ar' | 'fr';
  setLang: (l: 'ar' | 'fr') => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ currentUser, onOpenBackup, lang, setLang }) => {
  const { theme, setTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getThemeIcon = (t: ThemeMode) => {
    if (t === 'light') return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    if (t === 'dark') return <Moon className="w-3.5 h-3.5 text-blue-400" />;
    return <Contrast className="w-3.5 h-3.5 text-emerald-400" />;
  };

  const getThemeLabel = (t: ThemeMode) => {
    if (t === 'light') return 'سطوع';
    if (t === 'dark') return 'ليلي';
    return 'افتراضي';
  };

  return (
    <div className="bg-slate-900 text-slate-200 text-xs select-none flex items-center justify-between px-3 py-1.5 border-b border-slate-800 shadow-sm z-50">
      {/* App Branding & Offline Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-bold tracking-wide text-emerald-400">
          <div className="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center text-white font-black text-xs shadow-inner">
            مـ
          </div>
          <span className="text-sm font-black text-white">Mizan DZ</span>
          <span className="text-slate-400 text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">ميزان v1.0</span>
        </div>

        <div className="h-4 w-px bg-slate-700 mx-1"></div>

        <div className="flex items-center gap-1.5 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60 text-[11px]">
          <WifiOff className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>يعمل Offline بدون إنترنت (SQLite)</span>
        </div>

        {currentUser && (
          <div className="flex items-center gap-1 text-slate-300 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
            <ShieldCheck className="w-3 h-3 text-blue-400" />
            <span>المستخدم: <strong className="text-white">{currentUser.fullName}</strong> ({currentUser.role})</span>
          </div>
        )}
      </div>

      {/* Utilities & Controls */}
      <div className="flex items-center gap-2">
        {/* Quick Theme Switcher */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded border border-slate-700 transition-colors font-medium cursor-pointer"
            title="تغيير المظهر (Theme)"
          >
            {getThemeIcon(theme)}
            <span>{getThemeLabel(theme)}</span>
          </button>

          {showThemeMenu && (
            <div className="absolute left-0 mt-1.5 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-50 animate-fadeIn space-y-0.5">
              <button
                onClick={() => { setTheme('light'); setShowThemeMenu(false); }}
                className={`w-full text-right px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                  theme === 'light' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>☀️ ساطع</span>
              </button>
              <button
                onClick={() => { setTheme('dark'); setShowThemeMenu(false); }}
                className={`w-full text-right px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                  theme === 'dark' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-blue-400" />
                <span>🌙 ليلي</span>
              </button>
              <button
                onClick={() => { setTheme('default'); setShowThemeMenu(false); }}
                className={`w-full text-right px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                  theme === 'default' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Contrast className="w-3.5 h-3.5 text-emerald-400" />
                <span>◐ افتراضي</span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onOpenBackup}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded border border-slate-700 transition-colors"
          title="النسخ الاحتياطي لقاعدة البيانات SQLite"
        >
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span>النسخ الاحتياطي</span>
        </button>

        <button
          onClick={() => setLang(lang === 'ar' ? 'fr' : 'ar')}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 font-bold transition-colors"
        >
          {lang === 'ar' ? 'FR' : 'عربي'}
        </button>

        {/* Windows Control Buttons */}
        <div className="flex items-center gap-1 mr-2 text-slate-400">
          <button className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 hover:text-white rounded transition-colors">
            <Minus className="w-3 h-3" />
          </button>
          <button className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 hover:text-white rounded transition-colors">
            <Square className="w-2.5 h-2.5" />
          </button>
          <button className="w-6 h-6 flex items-center justify-center hover:bg-red-600 hover:text-white rounded transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
