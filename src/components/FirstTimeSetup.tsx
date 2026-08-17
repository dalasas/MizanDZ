import React, { useState } from 'react';
import {
  Store,
  MapPin,
  Phone,
  Image,
  DollarSign,
  Globe,
  UserCheck,
  Printer,
  Database,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Lock,
  Key,
  Palette,
  Moon,
  Sun,
  Contrast
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface FirstTimeSetupProps {
  onSetupCompleted: (user: any) => void;
}

export const FirstTimeSetup: React.FC<FirstTimeSetupProps> = ({ onSetupCompleted }) => {
  const { theme, setTheme } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopLogo, setShopLogo] = useState('');
  const [currency] = useState('DZD (دج)');
  const [language, setLanguage] = useState<'ar' | 'fr'>('ar');
  
  // Admin Credentials
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Hardware & Storage
  const [printerType, setPrinterType] = useState('Thermal 80mm');
  const [autoBackup, setAutoBackup] = useState(true);

  // Success Screen State
  const [isDone, setIsDone] = useState(false);
  const [createdAdminUser, setCreatedAdminUser] = useState<any>(null);

  const steps = [
    { id: 1, title: 'اسم المحل', icon: Store },
    { id: 2, title: 'العنوان', icon: MapPin },
    { id: 3, title: 'الهاتف', icon: Phone },
    { id: 4, title: 'الشعار', icon: Image },
    { id: 5, title: 'العملة', icon: DollarSign },
    { id: 6, title: 'اللغة', icon: Globe },
    { id: 7, title: 'حساب المدير', icon: UserCheck },
    { id: 8, title: 'الطابعة', icon: Printer },
    { id: 9, title: 'النسخ الاحتياطي', icon: Database }
  ];

  const handleSkipForNow = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/setup/skip', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.user) {
        onSetupCompleted(data.user);
      } else {
        setErrorMessage(data.error || 'فشل التخطي');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ بالاتصال');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    setErrorMessage('');
    
    if (currentStep === 7) {
      if (!adminUsername || !adminUsername.trim()) {
        setErrorMessage('يرجى إدخال اسم المستخدم للمدير');
        return;
      }
      if (!adminPassword || adminPassword.length < 8) {
        setErrorMessage('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل');
        return;
      }
      if (adminPassword !== confirmPassword) {
        setErrorMessage('كلمتا المرور غير متطابقتين');
        return;
      }
    }

    if (currentStep < 9) {
      setCurrentStep((prev) => prev + 1);
    } else {
      submitSetup();
    }
  };

  const handlePrevStep = () => {
    setErrorMessage('');
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const submitSetup = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName,
          shopAddress,
          shopPhone,
          shopLogo,
          currency: 'DZD',
          language,
          adminUsername,
          adminPassword,
          printerType,
          autoBackup
        })
      });

      const data = await res.json();

      if (res.ok) {
        setCreatedAdminUser(data.user);
        setIsDone(true);
      } else {
        setErrorMessage(data.error || 'فشل إكمال معالج الإعداد');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع بالاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans select-none dir-rtl" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col min-h-[580px]">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-2xl shadow-xl">
              مـ
            </div>
            <div>
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                <span>ميزان Mizan DZ</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  First-Time Setup
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                معالج الإعداد الأول للنظام التجاري المحترِف — قاعدة بيانات فارغة ومجهزة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isDone && (
              <button
                type="button"
                onClick={handleSkipForNow}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 hover:text-emerald-300 font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>تخطي الآن</span>
                <span className="text-[10px] text-slate-400 font-normal">(Skip for now)</span>
              </button>
            )}

            <div className="text-left font-mono text-xs text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
              الخطوة <span className="text-emerald-400 font-bold">{isDone ? 9 : currentStep}</span> من 9
            </div>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        {!isDone && (
          <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 overflow-x-auto flex items-center gap-2 text-xs">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isPassed = step.id < currentStep;
              return (
                <div
                  key={step.id}
                  onClick={() => { if (isPassed) setCurrentStep(step.id); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md'
                      : isPassed
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{step.id}. {step.title}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-red-950/80 border-b border-red-800 text-red-300 text-xs px-6 py-3 font-bold flex items-center justify-between animate-pulse">
            <span>⚠️ {errorMessage}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-8 flex-1 flex flex-col justify-between">
          {!isDone ? (
            <div className="space-y-6">
              {/* Step 1: Shop Name */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <Store className="w-8 h-8 text-emerald-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">الخطوة 1: اسم المحل التجاري</h2>
                      <p className="text-xs text-slate-400">اسم المطبوع بالفواتير وعلى ترويسة التطبيق</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">اسم المحل أو السوبرماركت *</label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="مثال: سوبرماركت البركة / Mizan Supermarket"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base text-white font-bold placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Shop Address */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <MapPin className="w-8 h-8 text-emerald-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">الخطوة 2: عنوان المحل</h2>
                      <p className="text-xs text-slate-400">العنوان الرسمي للمحل يظهر بالسطر الثاني من الفاتورة</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">عنوان المحل كاملاً *</label>
                    <input
                      type="text"
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                      placeholder="مثال: شارع فلسطين، وسط المدينة، الجزائر العاصمة"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base text-white font-bold placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Phone Number */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <Phone className="w-8 h-8 text-emerald-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">الخطوة 3: رقم الهاتف</h2>
                      <p className="text-xs text-slate-400">رقم الاتصال الخاص بالمحل لطباعته للزبائن</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">رقم الهاتف *</label>
                    <input
                      type="text"
                      value={shopPhone}
                      onChange={(e) => setShopPhone(e.target.value)}
                      placeholder="مثال: 0550 12 34 56 / 023 44 55 66"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base text-white font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Shop Logo */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <Image className="w-8 h-8 text-emerald-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">الخطوة 4: شعار المحل (اختياري)</h2>
                      <p className="text-xs text-slate-400">يمكنك تخطي هذه الخطوة أو إدخال رابط/رمز للشعار</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">رابط صورة الشعار أو رمز اختصاري</label>
                    <input
                      type="text"
                      value={shopLogo}
                      onChange={(e) => setShopLogo(e.target.value)}
                      placeholder="اختياري — اترك فارغاً للشعار الافتراضي"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Step 5: Currency */}
              {currentStep === 5 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <DollarSign className="w-8 h-8 text-emerald-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">الخطوة 5: العملة المعتمدة</h2>
                      <p className="text-xs text-slate-400">العملة الرسمية لجميع العمليات المالية والحسابات</p>
                    </div>
                  </div>
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between bg-emerald-950/80 p-4 rounded-xl border border-emerald-800 text-emerald-300">
                      <span className="font-bold">العملة الأساسية للنظام:</span>
                      <span className="font-mono font-black text-xl">DZD (دج — دينار جزائري)</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      سيتم حساب المبيعات، الأرباح، المخزون والديون بالدينار الجزائري تلقائياً.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 6: Language */}
              {currentStep === 6 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <Globe className="w-8 h-8 text-emerald-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">الخطوة 6: اختيار لغة الواجهة</h2>
                      <p className="text-xs text-slate-400">اللغة الرئيسية لعرض الأزرار والقوائم</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setLanguage('ar')}
                      className={`p-5 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                        language === 'ar'
                          ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-lg'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="text-2xl mb-2">🇩🇿</span>
                      <span className="font-extrabold text-base">العربية (Arabic)</span>
                      <span className="text-xs opacity-75 mt-1">الواجهة بالكامل باللغة العربية مع دعم الاتجاه من اليمين لليسار</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLanguage('fr')}
                      className={`p-5 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                        language === 'fr'
                          ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-lg'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="text-2xl mb-2">🇫🇷</span>
                      <span className="font-extrabold text-base">Français (الفرنسية)</span>
                      <span className="text-xs opacity-75 mt-1">Interface en français pour la gestion du magasin</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 7: Create Admin Account */}
              {currentStep === 7 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <UserCheck className="w-8 h-8 text-emerald-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">الخطوة 7: إنشاء حساب المدير الرئيسي</h2>
                      <p className="text-xs text-slate-400">حساب الصلاحية المطلقة لإدارة النظام وتعيين المستخدمين</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">اسم المستخدم (Username) *</label>
                      <input
                        type="text"
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                        placeholder="admin"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور (Password) *</label>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="••••••••"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">تأكيد كلمة المرور *</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 8: Printer Setup */}
              {currentStep === 8 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <Printer className="w-8 h-8 text-emerald-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">الخطوة 8: إعداد طابعة الفواتير (اختياري)</h2>
                      <p className="text-xs text-slate-400">يمكن تعديل نوع الطابعة لاحقاً من إعدادات النظام</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'Thermal 80mm', title: 'حرارية 80mm', desc: 'الأكثر شيوعاً للمحلات' },
                      { id: 'Thermal 58mm', title: 'حرارية 58mm', desc: 'طابعة صغيرة مدمجة' },
                      { id: 'A4 Paper', title: 'ورق عادي A4', desc: 'فواتير رسمية كبيرة' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPrinterType(p.id)}
                        className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                          printerType === p.id
                            ? 'bg-emerald-950/80 border-emerald-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Printer className="w-5 h-5 mb-2 text-emerald-400" />
                        <span className="font-bold text-sm text-white">{p.title}</span>
                        <span className="text-[10px] text-slate-400 mt-1">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 9: Backup Setup */}
              {currentStep === 9 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <Database className="w-8 h-8 text-emerald-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">الخطوة 9: إعداد النسخ الاحتياطي التلقائي</h2>
                      <p className="text-xs text-slate-400">حماية قاعدة بيانات المحل وحفظ التغييرات تلقائياً</p>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">تفعيل حفظ النسخ الاحتياطي التلقائي</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          تحديث ملف mizan_dz.sqlite فورياً بعد كل فاتورة بيع أو تعديل مخزون
                        </p>
                      </div>

                      <input
                        type="checkbox"
                        checked={autoBackup}
                        onChange={(e) => setAutoBackup(e.target.checked)}
                        className="w-5 h-5 accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 font-bold">
                      🛡️ قاعدة بيانات ميزان تعمل بصيغة (Offline First) - جميع بياناتك مخزنة محلياً بكتلة SQLite مشفرة ولا تحتاج لإنترنت.
                    </div>

                    {/* Theme Preference Selection */}
                    <div className="pt-2 border-t border-slate-800">
                      <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                        <Palette className="w-4 h-4 text-emerald-400" />
                        <span>مظهر الواجهة والتطبيق (اختياري)</span>
                      </label>

                      <div className="grid grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setTheme('default')}
                          className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                            theme === 'default'
                              ? 'bg-emerald-950/80 border-emerald-500 text-white font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className="text-xs">🌓 افتراضي</span>
                          <Contrast className="w-4 h-4 text-emerald-400" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setTheme('dark')}
                          className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                            theme === 'dark'
                              ? 'bg-emerald-950/80 border-emerald-500 text-white font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className="text-xs">🌙 ليلي</span>
                          <Moon className="w-4 h-4 text-blue-400" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setTheme('light')}
                          className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                            theme === 'light'
                              ? 'bg-emerald-950/80 border-emerald-500 text-white font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className="text-xs">☀️ ساطع</span>
                          <Sun className="w-4 h-4 text-amber-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Final Success Screen */
            <div className="space-y-6 text-center py-6 animate-fadeIn">
              <div className="w-20 h-20 bg-emerald-950/80 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-950">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white">تم إعداد Mizan DZ بنجاح 🎉</h2>
                <p className="text-sm text-slate-300 max-w-md mx-auto">
                  المحل: <strong className="text-emerald-400">{shopName}</strong> | العنوان: {shopAddress}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-400 max-w-md mx-auto space-y-2 text-right">
                <div className="font-bold text-white border-b border-slate-800 pb-2 text-center">
                  ✨ قاعدة بيانات إنتاجية جديدة ونظيفة 100%
                </div>
                <div className="flex justify-between">
                  <span>المنتجات الافتراضية:</span>
                  <span className="font-mono text-emerald-400 font-bold">0 منتج (نظيفة)</span>
                </div>
                <div className="flex justify-between">
                  <span>فواتير البيع:</span>
                  <span className="font-mono text-emerald-400 font-bold">0 فاتورة (نظيفة)</span>
                </div>
                <div className="flex justify-between">
                  <span>العملاء والموردون:</span>
                  <span className="font-mono text-emerald-400 font-bold">جاهز للإدخال الحقيقي</span>
                </div>
                <div className="flex justify-between">
                  <span>حساب المدير:</span>
                  <span className="font-mono text-white font-bold">{adminUsername}</span>
                </div>
              </div>

              <button
                onClick={() => onSetupCompleted(createdAdminUser)}
                className="px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base shadow-xl shadow-emerald-950 transition-all hover:scale-102 flex items-center justify-center gap-2 mx-auto"
              >
                <span>الدخول إلى لوحة التحكم (Dashboard)</span>
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Wizard Footer Buttons */}
          {!isDone && (
            <div className="flex items-center justify-between border-t border-slate-800 pt-6 mt-6">
              <button
                type="button"
                disabled={currentStep === 1 || loading}
                onClick={handlePrevStep}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-bold text-xs flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleNextStep}
                className="px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-black text-sm shadow-lg shadow-emerald-950 flex items-center gap-2"
              >
                {loading ? (
                  <span>جاري حفظ الإعدادات...</span>
                ) : (
                  <>
                    <span>{currentStep === 9 ? 'حفظ وإنشاء النظام النظيف' : 'التالي'}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
