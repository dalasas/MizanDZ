import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, DollarSign, ArrowUpRight, TrendingUp, TrendingDown, FileSpreadsheet, Layers, Clock, ShieldCheck, Filter } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profit' | 'daily' | 'sales' | 'purchases'>('profit');

  // Unified Date Filter State
  const [dateRangePreset, setDateRangePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().substring(0, 10));

  // Profit & Loss State
  const [profitData, setProfitData] = useState({
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    invoicesCount: 0,
    totalDiscounts: 0
  });

  // Daily Closing State
  const [dailyData, setDailyData] = useState({
    date: new Date().toISOString().substring(0, 10),
    totalSales: 0,
    cashSales: 0,
    debtSales: 0,
    invoicesCount: 0,
    customerDebtCollected: 0,
    supplierDebtPaid: 0,
    expensesPaid: 0,
    totalCashInBox: 0,
    totalCashOut: 0,
    netBoxCash: 0
  });

  const [loading, setLoading] = useState(false);

  // Preset Date Helper
  const handlePresetChange = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => {
    setDateRangePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const yestStr = yest.toISOString().substring(0, 10);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      setStartDate(weekAgo.toISOString().substring(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(monthStart.toISOString().substring(0, 10));
      setEndDate(todayStr);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [profitRes, dailyRes] = await Promise.all([
        fetch(`/api/reports/profit?startDate=${startDate}&endDate=${endDate}`),
        fetch(`/api/reports/daily-closing?date=${startDate}`)
      ]);

      if (profitRes.ok) setProfitData(await profitRes.json());
      if (dailyRes.ok) setDailyData(await dailyRes.json());
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate]);

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" +
      "البيان,القيمة (دج)\n" +
      `إجمالي المبيعات (Revenue),${profitData.revenue}\n` +
      `تكلفة البضاعة المباعة (COGS),${profitData.cogs}\n` +
      `الربح الإجمالي (Gross Profit),${profitData.grossProfit}\n` +
      `إجمالي المصاريف (Expenses),${profitData.expenses}\n` +
      `صافي الربح الحقيقي (Net Profit),${profitData.netProfit}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `تقرير_مالي_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-33px)] bg-slate-950 text-slate-100 dir-rtl" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            <span>التقارير الحسابية والأرباح (Financial Reports)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            حساب الأرباح الإجمالية والصافية وإغلاق الصندوق اليومي من واقع قاعدة بيانات SQLite
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => handlePresetChange('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateRangePreset === 'today' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => handlePresetChange('yesterday')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateRangePreset === 'yesterday' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            أمس
          </button>
          <button
            onClick={() => handlePresetChange('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateRangePreset === 'week' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            هذا الأسبوع
          </button>
          <button
            onClick={() => handlePresetChange('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateRangePreset === 'month' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            هذا الشهر
          </button>
          <button
            onClick={() => handlePresetChange('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateRangePreset === 'custom' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            فترة مخصصة
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">من:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDateRangePreset('custom');
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDateRangePreset('custom');
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('profit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'profit' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>تقرير الأرباح والخسائر</span>
        </button>

        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'daily' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>إغلاق اليوم (Z-Report)</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'profit' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400">إجمالي رقم الأعمال (Revenue)</span>
              <div className="text-2xl font-black font-mono text-white">
                {profitData.revenue.toLocaleString('ar-DZ')} <span className="text-xs font-sans text-slate-400">دج</span>
              </div>
              <p className="text-[10px] text-slate-500">إجمالي قيمة الفواتير الصادرة</p>
            </div>

            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400">تكلفة البضاعة (COGS)</span>
              <div className="text-2xl font-black font-mono text-amber-400">
                {profitData.cogs.toLocaleString('ar-DZ')} <span className="text-xs font-sans text-slate-400">دج</span>
              </div>
              <p className="text-[10px] text-slate-500">سعر شراء السلع المباعة</p>
            </div>

            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400">الربح الإجمالي (Gross Profit)</span>
              <div className="text-2xl font-black font-mono text-emerald-400">
                {profitData.grossProfit.toLocaleString('ar-DZ')} <span className="text-xs font-sans text-slate-400">دج</span>
              </div>
              <p className="text-[10px] text-slate-500">Sales - COGS</p>
            </div>

            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400">صافي الربح الحقيقي (Net Profit)</span>
              <div className="text-2xl font-black font-mono text-teal-300">
                {profitData.netProfit.toLocaleString('ar-DZ')} <span className="text-xs font-sans text-slate-400">دج</span>
              </div>
              <p className="text-[10px] text-slate-500">Gross Profit - Expenses</p>
            </div>
          </div>

          {/* Breakdown Equation Card */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-sm">المعادلة الماليّة للربح</h3>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs font-mono">
              <div className="flex justify-between items-center text-slate-300">
                <span>1. إجمالي المبيعات (Revenue):</span>
                <span className="font-bold text-white">{profitData.revenue.toLocaleString('ar-DZ')} دج</span>
              </div>
              <div className="flex justify-between items-center text-amber-400">
                <span>- تكلفة شراء السلع (COGS):</span>
                <span className="font-bold">-{profitData.cogs.toLocaleString('ar-DZ')} دج</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-emerald-400 font-bold">
                <span>= الربح الإجمالي (Gross Profit):</span>
                <span>{profitData.grossProfit.toLocaleString('ar-DZ')} دج</span>
              </div>
              <div className="flex justify-between items-center text-red-400">
                <span>- إجمالي المصاريف الميدانية (Expenses):</span>
                <span className="font-bold">-{profitData.expenses.toLocaleString('ar-DZ')} دج</span>
              </div>
              <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-teal-300 font-black text-sm">
                <span>= صافي الربح الحقيقي للمحل (Net Profit):</span>
                <span>{profitData.netProfit.toLocaleString('ar-DZ')} دج</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Closing Z-Report */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">تقرير الكشفي اليومي للصندوق (Daily Z-Report)</h3>
                <p className="text-xs text-slate-400">تاريخ التقرير: {startDate}</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-bold">
                محسوب دقيقاً من SQLite
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400">مقبوضات المبيعات النقدية</span>
                <div className="text-xl font-black font-mono text-emerald-400">
                  {dailyData.cashSales.toLocaleString('ar-DZ')} دج
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400">ديون الزبائن المحصّلة</span>
                <div className="text-xl font-black font-mono text-teal-400">
                  +{dailyData.customerDebtCollected.toLocaleString('ar-DZ')} دج
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400">إجمالي النقد الداخل للصندوق</span>
                <div className="text-xl font-black font-mono text-white">
                  {dailyData.totalCashInBox.toLocaleString('ar-DZ')} دج
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400">تسديدات للموردين</span>
                <div className="text-xl font-black font-mono text-amber-400">
                  -{dailyData.supplierDebtPaid.toLocaleString('ar-DZ')} دج
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400">المصاريف المدفوعة</span>
                <div className="text-xl font-black font-mono text-red-400">
                  -{dailyData.expensesPaid.toLocaleString('ar-DZ')} دج
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400">صافي السيولة النقدية بالدرج</span>
                <div className="text-xl font-black font-mono text-emerald-300">
                  {dailyData.netBoxCash.toLocaleString('ar-DZ')} دج
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
