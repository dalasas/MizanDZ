import React, { useState, useEffect } from 'react';
import { Settings, Store, Printer, Save, RefreshCw, Database, AlertTriangle, Sparkles, Palette, Moon, Sun, Contrast, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [commune, setCommune] = useState('');
  const [shopLogo, setShopLogo] = useState('');
  const [printerType, setPrinterType] = useState('Thermal 80mm');
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setShopName(data.ShopName || '');
        setShopAddress(data.ShopAddress || '');
        setShopPhone(data.ShopPhone || '');
        setWilaya(data.Wilaya || '');
        setCommune(data.Commune || '');
        setShopLogo(data.ShopLogo || '');
        setPrinterType(data.PrinterType || 'Thermal 80mm');
        setInvoicePrefix(data.InvoicePrefix || 'INV-');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ShopName: shopName || 'متجري (Mizan DZ)',
          ShopAddress: shopAddress,
          ShopPhone: shopPhone,
          Wilaya: wilaya,
          Commune: commune,
          ShopLogo: shopLogo,
          PrinterType: printerType,
          InvoicePrefix: invoicePrefix
        })
      });

      if (res.ok) {
        setSaveMessage('تم حفظ معلومات وإعدادات المحل بنجاح في قاعدة البيانات المحلية');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearData = async () => {
    if (!confirm('هل تريد حذف جميع البيانات والعمليات التجريبية والمنتجات الحالية والبدء بسجل نظيف؟ (سيتم الاحتفاظ بمعلومات المحل)')) {
      return;
    }

    try {
      const res = await fetch('/api/setup/clear-data', { method: 'POST' });
      if (res.ok) {
        alert('تم حذف جميع البيانات التجريبية بنجاح وتجهيز النظام بحالة نظيفة.');
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm('⚠️ تحذير: هل أنت متأكد من تفريغ قاعدة البيانات والعودة للنسخة النظيفة الأولى؟ سيتم حذف جميع المبيعات والمنتجات المسجلة وإعادة فتح معالج الإعداد!')) {
      return;
    }

    try {
      const res = await fetch('/api/setup/reset', { method: 'POST' });
      if (res.ok) {
        alert('تمت إزالة جميع البيانات وإعادة النظام إلى الوضع النظيف. سيتم إعادة تحميل التطبيق لإظهار معالج الإعداد.');
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSeedDemoData = async () => {
    if (!confirm('هل تريد شحن بيانات تجريبية (منتجات وموردين) لاختبار التطبيق؟')) {
      return;
    }

    try {
      const res = await fetch('/api/setup/seed-demo', { method: 'POST' });
      if (res.ok) {
        alert('تمت إضافة البيانات التجريبية بنجاح.');
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-33px)] bg-slate-950 text-slate-100 dir-rtl" dir="rtl">
      {/* Header Banner */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-400" />
            <span>إعدادات النظام والمحل — Mizan DZ</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">تخصيص معلومات الفاتورة، نوع الطابعة، والتحكم بقاعدة البيانات</p>
        </div>

        {saveMessage && (
          <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs px-4 py-2 rounded-xl font-bold animate-fadeIn">
            ✓ {saveMessage}
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Shop Information */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-base border-b border-slate-800 pb-2 flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-400" />
              <span>معلومات المحل التجاري</span>
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">اسم المحل في الفاتورة (مستحسن)</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="مثال: سوبرماركت البركة / Mizan DZ"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">عنوان المحل كاملاً</label>
              <input
                type="text"
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                placeholder="مثال: شارع فلسطين، وسط المدينة"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">الولاية (Wilaya)</label>
                <input
                  type="text"
                  value={wilaya}
                  onChange={(e) => setWilaya(e.target.value)}
                  placeholder="الجزائر العاصمة"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">البلدية (Commune)</label>
                <input
                  type="text"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  placeholder="سيدي امحمد"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">رقم الهاتف للاتصال والفاتورة</label>
              <input
                type="text"
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
                placeholder="0550 12 34 56"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">رابط صورة الشعار (Logo URL)</label>
              <input
                type="text"
                value={shopLogo}
                onChange={(e) => setShopLogo(e.target.value)}
                placeholder="اختياري — الشعار المطبوع في أعلى الفاتورة"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Printer & Invoices */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-base border-b border-slate-800 pb-2 flex items-center gap-2">
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>إعدادات الطابعة والورق</span>
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">نوع طابعة الفواتير</label>
              <select
                value={printerType}
                onChange={(e) => setPrinterType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Thermal 80mm">طابعة حرارية Thermal 80mm (الأكثر انتشاراً)</option>
                <option value="Thermal 58mm">طابعة حرارية صغيرة Thermal 58mm</option>
                <option value="A4 Paper">ورق طباعة عادي A4</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">نمط البادئة للرقم المرجعي للفاتورة</label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>حفظ إعدادات المحل</span>
          </button>
        </div>
      </form>

      {/* Theme System Selection */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-2 flex items-center gap-2">
          <Palette className="w-4 h-4 text-emerald-400" />
          <span>مظهر النظام والواجهة (Theme System)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Default Theme Card */}
          <button
            type="button"
            onClick={() => setTheme('default')}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between relative cursor-pointer ${
              theme === 'default'
                ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/20'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                <Contrast className="w-5 h-5" />
              </div>
              {theme === 'default' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-500/20" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                <span>🌓 افتراضي</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">الأصلي</span>
              </h4>
              <p className="text-xs text-slate-400">التصميم الأصلي والمظهر الأساسي الحالي لـ Mizan DZ</p>
            </div>
          </button>

          {/* Dark Theme Card */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between relative cursor-pointer ${
              theme === 'dark'
                ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/20'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-blue-400">
                <Moon className="w-5 h-5" />
              </div>
              {theme === 'dark' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-500/20" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-1">🌙 ليلي</h4>
              <p className="text-xs text-slate-400">مريح للعين ذو ألوان داكنة عميقة ومناسبة للاستخدام الطويل</p>
            </div>
          </button>

          {/* Light Theme Card */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between relative cursor-pointer ${
              theme === 'light'
                ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/20'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center text-amber-500">
                <Sun className="w-5 h-5" />
              </div>
              {theme === 'light' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-500/20" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-1">☀️ ساطع</h4>
              <p className="text-xs text-slate-400">واضح ونظيف ومناسب للمحلات والمكاتب ذات الإضاءة العالية</p>
            </div>
          </button>
        </div>
      </div>

      {/* Database & Developer Tools Section */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="font-bold text-white text-base border-b border-slate-800 pb-2 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>إدارة قاعدة البيانات والنظام النظيف</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-white text-sm flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span>حذف البيانات والعمليات التجريبية</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                يمسح كافة المنتجات، المبيعات، الفواتير، الديون والمصاريف التجريبية، مع الاحتفاظ ببيانات المحل وحساب المدير.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearData}
              className="mt-2 px-4 py-2 rounded-xl bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 text-xs font-bold transition-colors"
            >
              حذف البيانات التجريبية
            </button>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-white text-sm flex items-center gap-1.5 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>إعادة ضبط المصنع بالكامل</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                يعيد النظام إلى الحالة النظيفة الأولى تماماً من الصفر مع إعادة فتح معالج الإعداد الترحيبي الأول.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetDatabase}
              className="mt-2 px-4 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-bold transition-colors"
            >
              إعادة ضبط المصنع
            </button>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-white text-sm flex items-center gap-1.5 text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>شحن بيانات تجريبية (وضع التطوير)</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                مخصص لاختبار النظام بمنتجات وموردين وفواتير تجريبية للتطوير وتجربة الطباعة السريعة.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSeedDemoData}
              className="mt-2 px-4 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-xs font-bold transition-colors"
            >
              إضافة بيانات تجريبية
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
