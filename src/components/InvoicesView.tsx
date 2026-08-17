import React, { useState, useEffect } from 'react';
import { FileText, Search, Printer, Calendar, RefreshCw, User, Phone, Eye } from 'lucide-react';
import { SaleInvoice } from '../types';
import { PrintReceiptModal } from './PrintReceiptModal';

export const InvoicesView: React.FC = () => {
  const [invoices, setInvoices] = useState<SaleInvoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const url = searchQuery.trim() 
        ? `/api/sales?search=${encodeURIComponent(searchQuery.trim())}` 
        : '/api/sales';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices();
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-33px)] bg-slate-950 text-slate-100 dir-rtl" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-400" />
            <span>سجل وأرشيف الفواتير</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            فواتير البيع المسجلة في النظام مع تفاصيل العميل، البحث، والمعاينة والطباعة الحرارية
          </p>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-80">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الفاتورة، اسم الزبون، أو الهاتف..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </form>

          <button
            onClick={fetchInvoices}
            title="تحديث البيانات"
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700 flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-xs font-bold border-b border-slate-800">
              <tr>
                <th className="p-4">رقم الفاتورة</th>
                <th className="p-4">الزبون / العميل</th>
                <th className="p-4">هاتف العميل</th>
                <th className="p-4">الإجمالي</th>
                <th className="p-4">المدفوع</th>
                <th className="p-4">المتبقي (دين)</th>
                <th className="p-4">طريقة الدفع</th>
                <th className="p-4">التاريخ والوقت</th>
                <th className="p-4 text-center">الطباعة والمعاينة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {invoices.map((inv) => (
                <tr key={inv.Id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-mono font-bold text-emerald-400">#{inv.InvoiceNumber}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-bold text-white">{inv.CustomerName || 'زبون عادي'}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-xs text-slate-400">
                    {inv.CustomerPhone && inv.CustomerPhone !== '0000000000' ? (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-500/70" />
                        <span>{inv.CustomerPhone}</span>
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="p-4 font-mono font-bold text-white">{inv.GrandTotal.toLocaleString('ar-DZ')} دج</td>
                  <td className="p-4 font-mono text-emerald-400 font-bold">{inv.PaidAmount.toLocaleString('ar-DZ')} دج</td>
                  <td className="p-4 font-mono">
                    {inv.RemainingAmount > 0 ? (
                      <span className="text-red-400 font-bold">{(inv.RemainingAmount).toLocaleString('ar-DZ')} دج</span>
                    ) : (
                      <span className="text-slate-500 text-xs">خالص (0)</span>
                    )}
                  </td>
                  <td className="p-4 text-xs font-bold">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      inv.PaymentMethod === 'Cash' 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                        : inv.PaymentMethod === 'Debt'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-blue-950 text-blue-400 border border-blue-800'
                    }`}>
                      {inv.PaymentMethod === 'Cash' ? 'نقدي' : inv.PaymentMethod === 'Debt' ? 'دين مؤجل' : 'بطاقة'}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-mono text-slate-400">
                    {inv.CreatedAt ? inv.CreatedAt.substring(0, 19).replace('T', ' ') : ''}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded-xl transition-colors border border-slate-700 flex items-center gap-1.5 mx-auto text-xs font-bold"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة / معاينة</span>
                    </button>
                  </td>
                </tr>
              ))}

              {invoices.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500 text-sm">
                    لا توجد فواتير مطابقة لعملية البحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedInvoice && (
        <PrintReceiptModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
};
