import React, { useState, useEffect } from 'react';
import { Truck, Plus, Phone, MapPin, Wallet, UserPlus, X, CheckCircle2, DollarSign, FileText, Trash2, Edit3 } from 'lucide-react';
import { Supplier } from '../types';

export const SuppliersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit Supplier Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supNotes, setSupNotes] = useState('');
  const [addError, setAddError] = useState('');

  // Payment Modal
  const [selectedPaymentSup, setSelectedPaymentSup] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState('');

  // Statement Modal
  const [selectedStatementSup, setSelectedStatementSup] = useState<Supplier | null>(null);
  const [statementData, setStatementData] = useState<any>(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) {
        setSuppliers(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupPhone('');
    setSupAddress('');
    setSupNotes('');
    setAddError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupName(sup.Name);
    setSupPhone(sup.Phone || '');
    setSupAddress(sup.Address || '');
    setSupNotes(sup.Notes || '');
    setAddError('');
    setIsAddModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!supName.trim()) {
      setAddError('اسم المورد مطلوب');
      return;
    }

    try {
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.Id}` : '/api/suppliers';
      const method = editingSupplier ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: supName,
          phone: supPhone,
          address: supAddress,
          notes: supNotes
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIsAddModalOpen(false);
        fetchSuppliers();
      } else {
        setAddError(data.error || 'فشلت عملية الحفظ');
      }
    } catch (err: any) {
      setAddError(err.message);
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    if (!confirm('هل أنت تأكد من إرادة حذف هذا المورد؟')) return;
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSuppliers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenPayment = (sup: Supplier) => {
    setSelectedPaymentSup(sup);
    setPayAmount('');
    setPayNotes('');
    setPayError('');
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentSup) return;
    setPayError('');

    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      setPayError('يرجى إدخال مبلغ تسديد صالح أكبر من 0');
      return;
    }

    try {
      const res = await fetch(`/api/suppliers/${selectedPaymentSup.Id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, notes: payNotes })
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedPaymentSup(null);
        fetchSuppliers();
      } else {
        setPayError(data.error || 'فشلت عملية التسديد');
      }
    } catch (err: any) {
      setPayError(err.message);
    }
  };

  const handleOpenStatement = async (sup: Supplier) => {
    setSelectedStatementSup(sup);
    setStatementData(null);
    try {
      const res = await fetch(`/api/suppliers/${sup.Id}/statement`);
      if (res.ok) setStatementData(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const totalSupplierDebts = suppliers.reduce((sum, s) => sum + (s.Balance || 0), 0);

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-33px)] bg-slate-950 text-slate-100 dir-rtl" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-400" />
            <span>إدارة الموردين والشركات (Suppliers)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            تسجيل الموردين، تسديد الديون، وعرض كشوفات الحساب التاريخية
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-amber-950/60 border border-amber-800/80 px-4 py-2 rounded-xl text-left">
            <span className="text-[11px] text-amber-400 font-bold block">إجمالي ديون الموردين الملتزم بها:</span>
            <span className="text-xl font-black text-amber-400 font-mono">{totalSupplierDebts.toLocaleString('ar-DZ')} دج</span>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all hover:scale-105"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة مورد جديد</span>
          </button>
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((sup) => (
          <div key={sup.Id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3 relative hover:border-slate-700 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{sup.Name}</h3>
                    <p className="text-xs text-slate-400">{sup.Notes || 'مورد تجاري'}</p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                  (sup.Balance || 0) > 0 ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                }`}>
                  {sup.Balance || 0} دج
                </span>
              </div>

              <div className="border-t border-slate-800/80 pt-3 space-y-1 text-xs text-slate-400">
                <p className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>الهاتف: {sup.Phone || 'غير مسجل'}</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>العنوان: {sup.Address || 'غير مسجل'}</span>
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between gap-2">
              <button
                onClick={() => handleOpenPayment(sup)}
                className="flex-1 py-1.5 px-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>تسديد دين</span>
              </button>

              <button
                onClick={() => handleOpenStatement(sup)}
                className="flex-1 py-1.5 px-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>كشف حساب</span>
              </button>

              <button onClick={() => handleOpenEdit(sup)} className="p-1.5 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-lg">
                <Edit3 className="w-3.5 h-3.5" />
              </button>

              <button onClick={() => handleDeleteSupplier(sup.Id)} className="p-1.5 text-red-400 hover:text-red-300 bg-slate-950 border border-slate-800 rounded-lg">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <span>{editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد / موزّع جديد'}</span>
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

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المورد / الموزّع *</label>
                <input
                  type="text"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="مثال: شركة الموزع الوطني"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="021 00 00 00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">العنوان / المنطقة</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="المنطقة الصناعية، الجزائر"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات / وصف</label>
                <input
                  type="text"
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  placeholder="مورد معتمد للزيوت والمواد الغذائية"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
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
                  حفظ البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Payment Modal */}
      {selectedPaymentSup && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>تسديد دين المورد: {selectedPaymentSup.Name}</span>
              </h3>
              <button onClick={() => setSelectedPaymentSup(null)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">الرصيد المستحق حالياً:</span>
              <span className="font-mono font-bold text-amber-400 text-sm">{selectedPaymentSup.Balance || 0} دج</span>
            </div>

            {payError && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 p-2.5 rounded-xl text-xs font-bold">
                ⚠️ {payError}
              </div>
            )}

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ المراد تسديده (دج) *</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="مثال: 5000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات التسديد</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="دفعة من الحساب / شيك..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedPaymentSup(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  تأكيد تسديد المبلغ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Statement Modal */}
      {selectedStatementSup && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <span>كشف حساب المورد: {selectedStatementSup.Name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">سجل الحركات التاريخية المحسوبة تسلسلياً</p>
              </div>
              <button onClick={() => setSelectedStatementSup(null)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs shrink-0">
              <span className="text-slate-400">الرصيد المتبقي حالياً:</span>
              <span className="font-mono font-bold text-amber-400 text-base">{statementData?.currentBalance || 0} دج</span>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">البيان / الحركة</th>
                    <th className="p-2.5 text-amber-400">دين (+مشتريات)</th>
                    <th className="p-2.5 text-emerald-400">دائن (-تسديد)</th>
                    <th className="p-2.5">الرصيد المتراكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {statementData?.statement && statementData.statement.length > 0 ? (
                    statementData.statement.map((ev: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2.5 text-slate-400">{ev.Date ? ev.Date.substring(0, 10) : ''}</td>
                        <td className="p-2.5 font-sans font-bold text-white">{ev.Description}</td>
                        <td className="p-2.5 text-amber-400 font-bold">{ev.Debit > 0 ? `+${ev.Debit} دج` : '-'}</td>
                        <td className="p-2.5 text-emerald-400 font-bold">{ev.Credit > 0 ? `-${ev.Credit} دج` : '-'}</td>
                        <td className="p-2.5 text-white font-bold">{ev.Balance} دج</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500 font-sans text-xs">
                        لا توجد حركات سابقة لهذا المورد
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800 shrink-0">
              <button
                onClick={() => setSelectedStatementSup(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
