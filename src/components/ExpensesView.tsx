import React, { useState, useEffect } from 'react';
import { Receipt, Plus, DollarSign, Calendar, Trash2, Tag, Filter, CheckCircle2, X } from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Add Expense Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().substring(0, 10));
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      let url = `/api/expenses?1=1`;
      if (selectedCategory) url += `&categoryId=${selectedCategory}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const [expRes, catRes] = await Promise.all([
        fetch(url),
        fetch('/api/expenses/categories')
      ]);

      if (expRes.ok) setExpenses(await expRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedCategory, startDate, endDate]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim() || !amount || !categoryId) {
      setFormError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          categoryId: Number(categoryId),
          amount: Number(amount),
          expenseDate,
          notes
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setTitle('');
        setAmount('');
        setNotes('');
        setCategoryId('');
        fetchExpenses();
      } else {
        setFormError(data.error || 'فشلت إضافة المصروف');
      }
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) fetchExpenses();
    } catch (err) {
      console.error(err);
    }
  };

  const totalExpensesAmount = expenses.reduce((sum, e) => sum + (e.Amount || 0), 0);

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-33px)] bg-slate-950 text-slate-100 dir-rtl" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-400" />
            <span>إدارة المصاريف والنفقات (Expenses)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            تسجيل المصاريف التشغيلية (كراء، كهرباء، رواتب، نقل) وتخصيمها من صافي أرباح المحل
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-red-950/60 border border-red-800/80 px-4 py-2 rounded-xl text-left">
            <span className="text-[11px] text-red-400 font-bold block">إجمالي المصاريف المحددة:</span>
            <span className="text-xl font-black text-red-400 font-mono">{totalExpensesAmount.toLocaleString('ar-DZ')} دج</span>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مصروف جديد</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-emerald-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">كل الفئات</option>
            {categories.map((c) => (
              <option key={c.Id} value={c.Id}>{c.Name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">من:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>سجل المصاريف والنفقات</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">العدد: {expenses.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">بيان المصروف</th>
                <th className="p-3">الفئة</th>
                <th className="p-3">المبلغ</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">الملاحظات</th>
                <th className="p-3 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {expenses.length > 0 ? (
                expenses.map((e) => (
                  <tr key={e.Id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-bold text-white">{e.Title}</td>
                    <td className="p-3 text-slate-300">
                      <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] text-emerald-400 font-bold">
                        {e.CategoryName || 'عام'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-red-400 text-sm">{e.Amount.toLocaleString('ar-DZ')} دج</td>
                    <td className="p-3 font-mono text-slate-400">{e.ExpenseDate}</td>
                    <td className="p-3 text-slate-400">{e.Notes || '-'}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteExpense(e.Id)}
                        className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-slate-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500 text-xs">
                    لا توجد مصاريف مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span>تسجيل مصروف جديد</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 p-2.5 rounded-xl text-xs font-bold">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">بيان / عنوان المصروف *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: فاتورة كهرباء سونلغاز"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">فئة المصروف *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">-- اختر الفئة --</option>
                  {categories.map((c) => (
                    <option key={c.Id} value={c.Id}>{c.Name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ (دج) *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="مثال: 4500"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">تاريخ المصروف</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات إضافية</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="رقم وصل الدفع أو تفاصيل..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  تسجيل المصروف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
