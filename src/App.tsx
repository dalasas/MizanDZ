import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { PosView } from './components/PosView';
import { ProductsView } from './components/ProductsView';
import { CategoriesView } from './components/CategoriesView';
import { CustomersView } from './components/CustomersView';
import { InvoicesView } from './components/InvoicesView';
import { ExpensesView } from './components/ExpensesView';
import { InventoryView } from './components/InventoryView';
import { SuppliersView } from './components/SuppliersView';
import { PurchasesView } from './components/PurchasesView';
import { ReportsView } from './components/ReportsView';
import { AiAssistantView } from './components/AiAssistantView';
import { SettingsView } from './components/SettingsView';
import { BackupModal } from './components/BackupModal';
import { FirstTimeSetup } from './components/FirstTimeSetup';
import { User } from './types';
import { LogIn, UserPlus, RefreshCw, AlertCircle, Shield, User as UserIcon } from 'lucide-react';

export default function App() {
  const [isSetupChecking, setIsSetupChecking] = useState(true);
  const [isSetupCompleted, setIsSetupCompleted] = useState<boolean | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [lang, setLang] = useState<'ar' | 'fr'>('ar');
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  // Auth screen states (Login & Register)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form states
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<'Admin' | 'Cashier' | 'StockManager' | 'Accountant'>('Cashier');

  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const checkSetupStatus = async () => {
    setIsSetupChecking(true);
    try {
      const res = await fetch('/api/setup/status');
      if (res.ok) {
        const data = await res.json();
        setIsSetupCompleted(data.isSetupCompleted);
        if (data.language) setLang(data.language);

        // Auto-initialize operator session if setup was completed or skipped
        if (data.isSetupCompleted || data.onboardingSkipped) {
          setCurrentUser((prev) => prev || {
            id: 'usr-admin',
            username: data.hasAdmin ? 'admin' : 'operator',
            fullName: data.hasAdmin ? 'مدير المحل (Admin)' : 'مُشغّل النظام (وضع التخطي)',
            role: 'Admin'
          });
        }
      } else {
        setIsSetupCompleted(false);
      }
    } catch (err) {
      console.error('Failed to check setup status:', err);
      setIsSetupCompleted(false);
    } finally {
      setIsSetupChecking(false);
    }
  };

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
      } else {
        setAuthError(data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch (err) {
      console.error(err);
      setAuthError('تعذر الاتصال بقاعدة بيانات النظام المحلية');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (regPassword !== regConfirmPassword) {
      setAuthError('كلمتا المرور غير متطابقتين');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          fullName: regFullName,
          password: regPassword,
          role: regRole
        })
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
      } else {
        setAuthError(data.error || 'فشل إنشاء الحساب الجديد');
      }
    } catch (err) {
      console.error(err);
      setAuthError('حدث خطأ أثناء الاتصال بقاعدة البيانات المحلية');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Loading Screen while checking SQLite status
  if (isSetupChecking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans dir-rtl" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-3xl shadow-xl animate-bounce mb-4">
          مـ
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          <span>جاري فحص قاعدة بيانات Mizan DZ (SQLite Offline)...</span>
        </div>
      </div>
    );
  }

  // First-Time Onboarding Setup Flow if not completed
  if (isSetupCompleted === false) {
    return (
      <FirstTimeSetup
        onSetupCompleted={(adminUser) => {
          setIsSetupCompleted(true);
          if (adminUser) setCurrentUser(adminUser);
        }}
      />
    );
  }

  // Login / Register Screen if user logged out
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans dir-rtl" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 text-right">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-3xl mx-auto shadow-xl">
              مـ
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Mizan DZ — ميزان</h1>
            <p className="text-xs text-slate-400">نظام إدارة المحلات والمبيعات التجاري (Offline First)</p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'login'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>تسجيل الدخول</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'register'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>إنشاء حساب جديد</span>
            </button>
          </div>

          {authError && (
            <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2 font-bold animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المستخدم (Username)</label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور (Password)</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>تسجيل الدخول</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل (الاسم واللقب)</label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="مثال: محمد علي"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المستخدم للدخول (Username)</label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="مثال: mohammed"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">تأكيد كلمة المرور</label>
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الصلاحيات / الدور (Role)</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Admin">مدير المحل (Admin - جميع الصلاحيات)</option>
                  <option value="Cashier">بائع / أمين صندوق (Cashier - POS والمبيعات)</option>
                  <option value="StockManager">مسؤول المخزن (StockManager)</option>
                  <option value="Accountant">محاسب (Accountant - الميزانية والديون)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>إنشاء حساب جديد والدخول</span>
              </button>
            </form>
          )}

          <div className="text-center text-[11px] text-slate-500 pt-2 border-t border-slate-800">
            Mizan DZ v1.0.0 — الجزائر (Offline SQLite)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden select-none ${lang === 'ar' ? 'dir-rtl' : 'dir-ltr'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Windows Desktop TitleBar */}
      <TitleBar
        currentUser={currentUser}
        onOpenBackup={() => setIsBackupOpen(true)}
        lang={lang}
        setLang={setLang}
      />

      {/* Main App Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Right Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Dynamic View Panel */}
        <main className="flex-1 overflow-hidden bg-slate-950">
          {activeTab === 'dashboard' && <DashboardView setActiveTab={setActiveTab} />}
          {activeTab === 'pos' && <PosView />}
          {activeTab === 'invoices' && <InvoicesView />}
          {activeTab === 'products' && <ProductsView />}
          {activeTab === 'categories' && <CategoriesView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'customers' && <CustomersView />}
          {activeTab === 'debts' && <CustomersView />}
          {activeTab === 'suppliers' && <SuppliersView />}
          {activeTab === 'purchases' && <PurchasesView />}
          {activeTab === 'expenses' && <ExpensesView />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'ai' && <AiAssistantView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Backup Modal */}
      <BackupModal isOpen={isBackupOpen} onClose={() => setIsBackupOpen(false)} />
    </div>
  );
}
