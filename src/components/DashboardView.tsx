import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  AlertTriangle,
  Receipt,
  Wallet,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Layers,
  Users
} from 'lucide-react';
import { DashboardStats, NavTab } from '../types';

interface DashboardViewProps {
  setActiveTab: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState<{ shopName?: string; shopAddress?: string; shopPhone?: string } | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [statsRes, setupRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/setup/status')
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      if (setupRes.ok) {
        const setupData = await setupRes.json();
        setShopInfo(setupData);
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const hasProducts = (stats?.totalProductsCount || 0) > 0;
  const hasSales = (stats?.todayInvoiceCount || 0) > 0 || (stats?.recentSales || []).length > 0;
  const isShopInfoIncomplete = !shopInfo?.shopAddress || !shopInfo?.shopPhone || shopInfo?.shopName === 'متجري (Mizan DZ)';

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-33px)] bg-slate-950 text-slate-100 dir-rtl" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            لوحة التحكم المباشرة — Mizan DZ
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            بيانات وتحليلات حقيقية مستخرجة مباشرة من قاعدة بيانات المحل (SQLite Offline)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl border border-slate-700 text-sm font-semibold transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>تحديث البيانات</span>
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>عملية بيع جديدة (POS)</span>
          </button>
        </div>
      </div>

      {/* Incomplete Shop Info Reminder Banner (Non-intrusive) */}
      {isShopInfoIncomplete && (
        <div className="bg-slate-900/90 border border-amber-800/60 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-950 text-amber-400 border border-amber-800 flex items-center justify-center font-bold shrink-0">
              💡
            </div>
            <div>
              <p className="font-extrabold text-amber-300">أكمل معلومات محلك للحصول على فواتير ووصل استلام احترافي للزبائن</p>
              <p className="text-slate-400 mt-0.5">يمكنك إضافة اسم المحل التجاري الكامل والعنوان ورقم الهاتف في أي وقت دون تعطيل عمليات البيع.</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs shrink-0 transition-all shadow-md"
          >
            تعديل معلومات المحل
          </button>
        </div>
      )}

      {/* Fresh Clean First Run Banner when system is empty */}
      {!hasProducts && !hasSales && (
        <div className="bg-slate-900 border border-emerald-800/60 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">مرحباً بك! النظام جاهز تماماً للبدء بالحسابات الحقيقية</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                قاعدة البيانات نظيفة وفارغة 100%. ابدأ بإضافة منتجاتك ومخزونك الأولي الآن لتفعّل الفواتير والتقارير.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              onClick={() => setActiveTab('products')}
              className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أول منتج</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all"
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>إدخال المخزون الأولي</span>
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>إضافة عميل جديد</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Sales */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">مبيعات اليوم</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div>
            {hasSales ? (
              <>
                <div className="text-2xl font-black text-white font-mono">
                  {stats?.todaySales.toLocaleString('ar-DZ')} <span className="text-xs text-emerald-400 font-bold">دج</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {stats?.todayInvoiceCount || 0} فاتورة منفذة اليوم
                </p>
              </>
            ) : (
              <div>
                <div className="text-lg font-bold text-slate-400">لا توجد مبيعات اليوم</div>
                <p className="text-xs text-slate-500 mt-0.5">ستبدأ الأرقام بالظهور فور تنفيذ أول فاتورة</p>
              </div>
            )}
          </div>
        </div>

        {/* Today Net Profit */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">صافي ربح اليوم</span>
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            {hasSales ? (
              <>
                <div className={`text-2xl font-black font-mono ${(stats?.todayNetProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stats?.todayNetProfit.toLocaleString('ar-DZ')} <span className="text-xs font-bold">دج</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  بعد خصم المصاريف ({stats?.todayExpenses.toLocaleString('ar-DZ')} دج)
                </p>
              </>
            ) : (
              <div>
                <div className="text-sm font-bold text-slate-400">لا توجد بيانات كافية لحساب الأرباح</div>
                <p className="text-xs text-slate-500 mt-0.5">تُحسب من مبيعات اليوم ومصاريفه الحقيقية</p>
              </div>
            )}
          </div>
        </div>

        {/* Stock Value */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">قيمة المخزون الكلية</span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div>
            {hasProducts ? (
              <>
                <div className="text-2xl font-black text-white font-mono">
                  {stats?.totalStockValue.toLocaleString('ar-DZ')} <span className="text-xs text-blue-400 font-bold">دج</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {stats?.totalProductsCount || 0} منتج مسجل في المحل
                </p>
              </>
            ) : (
              <div>
                <div className="text-lg font-bold text-slate-400">لا توجد منتجات بعد</div>
                <p className="text-xs text-slate-500 mt-0.5">انقر على إدخال المخزون الأولي للإضافة</p>
              </div>
            )}
          </div>
        </div>

        {/* Customer Debts */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">إجمالي ديون الزبائن</span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div>
            {(stats?.totalCustomerDebts || 0) > 0 ? (
              <>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {stats?.totalCustomerDebts.toLocaleString('ar-DZ')} <span className="text-xs font-bold">دج</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  مبالغ مؤجلة بحاجة إلى تحصيل
                </p>
              </>
            ) : (
              <div>
                <div className="text-lg font-bold text-slate-400">لا توجد ديون مستحقة</div>
                <p className="text-xs text-slate-500 mt-0.5">جميع الحسابات والعملاء مسددة بالكامل</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Section: Low Stock Alerts + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <AlertTriangle className="w-5 h-5" />
              <span>تنبيهات النقص في المخزون</span>
            </div>
            <button
              onClick={() => setActiveTab('products')}
              className="text-xs text-emerald-400 hover:underline font-semibold"
            >
              إدارة المنتجات
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats?.lowStockProducts && stats.lowStockProducts.length > 0 ? (
              stats.lowStockProducts.map((prod) => (
                <div key={prod.Id} className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">{prod.Name}</h4>
                    <p className="text-xs text-slate-400">الباركود: {prod.Barcode}</p>
                  </div>
                  <div className="text-left">
                    <span className="px-2.5 py-1 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 font-black text-xs font-mono">
                      {prod.Quantity} {prod.Unit} باقي
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                {!hasProducts ? 'لا توجد منتجات مسجلة في المحل حتى الآن' : '✅ جميع المنتجات متوفرة بكميات آمنة في المخزون'}
              </div>
            )}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-slate-200 font-bold">
              <Receipt className="w-5 h-5 text-emerald-400" />
              <span>آخر عمليات البيع المنفذة</span>
            </div>
            <button
              onClick={() => setActiveTab('invoices')}
              className="text-xs text-emerald-400 hover:underline font-semibold"
            >
              أرشيف الفواتير
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats?.recentSales && stats.recentSales.length > 0 ? (
              stats.recentSales.map((sale) => (
                <div key={sale.Id} className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="font-mono text-xs font-bold text-emerald-400">{sale.InvoiceNumber}</span>
                    <p className="text-xs text-slate-300 font-medium">{sale.CustomerName}</p>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-white text-sm font-mono">
                      {sale.GrandTotal.toLocaleString('ar-DZ')} دج
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {sale.PaymentMethod === 'Cash' ? 'نقدي' : sale.PaymentMethod === 'Debt' ? 'دين' : sale.PaymentMethod}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                لا توجد فواتير مبيعات مسجلة حتى الآن
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
