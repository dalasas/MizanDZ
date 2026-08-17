import React, { useState, useEffect } from 'react';
import { Users, Plus, Phone, Wallet, DollarSign, History, X, CheckCircle2, UserPlus } from 'lucide-react';
import { Customer } from '../types';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // New Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custDebtLimit, setCustDebtLimit] = useState(50000);
  const [addError, setAddError] = useState('');

  // Payment Modal (تسديد الدين)
  const [selectedCustForPayment, setSelectedCustForPayment] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNotes, setPayNotes] = useState('سداد دين من العميل');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payError, setPayError] = useState('');

  // Payment History Modal
  const [selectedCustForHistory, setSelectedCustForHistory] = useState<Customer | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!custName.trim()) {
      setAddError('اسم الزبون مطلوب');
      return;
    }

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: custName,
          phone: custPhone,
          address: custAddress,
          debtLimit: custDebtLimit
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIsAddModalOpen(false);
        setCustName('');
        setCustPhone('');
        setCustAddress('');
        fetchCustomers();
      } else {
        setAddError(data.error || 'فشلت إضافة الزبون');
      }
    } catch (err: any) {
      setAddError(err.message);
    }
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustForPayment) return;
    setPayError('');

    if (payAmount <= 0) {
      setPayError('أدخل مبلغ تسديد أكبر من 0');
      return;
    }

    try {
      const res = await fetch(`/api/customers/${selectedCustForPayment.Id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(payAmount),
          paymentMethod: payMethod,
          notes: payNotes,
          userId: 'usr-admin'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedCustForPayment(null);
        fetchCustomers();
        alert('✅ تم تسديد المبلغ وتحديث رصيد الزبون بنجاح');
      } else {
        setPayError(data.error || 'فشلت عملية تسديد الدين');
      }
    } catch (err: any) {
      setPayError(err.message);
    }
  };

  const handleViewHistory = async (cust: Customer) => {
    setSelectedCustForHistory(cust);
    try {
      const res = await fetch(`/api/customers/${cust.Id}/payments`);
      if (res.ok) {
        setPaymentHistory(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalDebts = customers.reduce((sum, c) => sum + c.Balance, 0);

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-33px)] bg-slate-950 text-slate-100 dir-rtl" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>إدارة حسابات الزبائن والديون</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            متابعة الديون المؤجلة، كشف الحساب، وتأكيد التسديدات المالية النقدية
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-amber-950/60 border border-amber-800/80 px-4 py-2 rounded-xl text-left">
            <span className="text-[11px] text-amber-400 font-bold block">إجمالي ديون الزبائن المستحقة:</span>
            <span className="text-xl font-black text-amber-400 font-mono">{totalDebts.toLocaleString('ar-DZ')} دج</span>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all hover:scale-105"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة زبون جديد</span>
          </button>
        </div>
      </div>

      {/* Customers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((cust) => (
          <div key={cust.Id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3 relative hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-emerald-400">
                  {cust.Name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{cust.Name}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{cust.Phone || 'لا يوجد هاتف'}</span>
                  </p>
                </div>
              </div>

              {cust.Balance > 0 ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60 text-xs font-black font-mono">
                  عليه {cust.Balance.toLocaleString('ar-DZ')} دج
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 text-xs font-bold">
                  لا يوجد دين
                </span>
              )}
            </div>

            <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs text-slate-400">
              <span>حد الدين المسموح:</span>
              <span className="font-mono text-slate-200">{cust.DebtLimit.toLocaleString('ar-DZ')} دج</span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <button
                disabled={cust.Balance <= 0}
                onClick={() => {
                  setSelectedCustForPayment(cust);
                  setPayAmount(cust.Balance);
                }}
                className="py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-800/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>تسديد دين</span>
              </button>

              <button
                onClick={() => handleViewHistory(cust)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                <span>سجل التسديدات</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>إضافة زبون جديد</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 p-2.5 rounded-xl text-xs font-bold">
                ⚠️ {addError}
              </div>
            )}

            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم الزبون الكامل *</label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="مثال: أحمد بن علي"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="0550 00 00 00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">حد الدين المسموح (دج)</label>
                <input
                  type="number"
                  value={custDebtLimit}
                  onChange={(e) => setCustDebtLimit(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  حفظ العميل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Debt Repayment Modal */}
      {selectedCustForPayment && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>تسديد دين — {selectedCustForPayment.Name}</span>
              </h3>
              <button onClick={() => setSelectedCustForPayment(null)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {payError && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 p-2.5 rounded-xl text-xs font-bold">
                ⚠️ {payError}
              </div>
            )}

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-xs text-slate-400 font-semibold">الدين الحالي المسجل على العميل:</span>
              <div className="text-2xl font-black text-amber-400 font-mono mt-0.5">
                {selectedCustForPayment.Balance.toLocaleString('ar-DZ')} دج
              </div>
            </div>

            <form onSubmit={handleExecutePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ المسدّد الآن كاش (دج) *</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-lg font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات تسديد الحساب</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedCustForPayment(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50"
                >
                  تأكيد تسديد المبلغ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {selectedCustForHistory && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <span>سجل تسديدات الزبون: {selectedCustForHistory.Name}</span>
              </h3>
              <button onClick={() => setSelectedCustForHistory(null)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {paymentHistory.length > 0 ? (
                paymentHistory.map((ph: any) => (
                  <div key={ph.Id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-emerald-400 font-mono text-sm">+{ph.Amount.toLocaleString('ar-DZ')} دج</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{ph.Notes || 'تسديد كاش'}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{ph.CreatedAt.substring(0, 10)}</span>
                  </div>
                ))
              ) : (
                <p className="text-center py-8 text-slate-500 text-xs">لا توجد عملية تسديد مسجلة لهذا العميل حتى الآن</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
