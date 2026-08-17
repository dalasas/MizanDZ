import React, { useState, useEffect } from 'react';
import { Boxes, Search, AlertCircle, RefreshCw, Layers, PlusCircle, ArrowUpDown, FileText, CheckCircle2 } from 'lucide-react';
import { Product } from '../types';

export const InventoryView: React.FC = () => {
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [newQty, setNewQty] = useState<number>(0);
  const [reason, setReason] = useState<string>('جرد سنوي / تصحيح خطأ');
  const [notes, setNotes] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string>('');

  const fetchMovements = async () => {
    setLoading(true);
    try {
      let url = `/api/stock-movements?search=${encodeURIComponent(search)}`;
      if (movementTypeFilter) url += `&movementType=${movementTypeFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        setMovements(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        if (data.length > 0) setSelectedProductId(data[0].Id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMovements();
    fetchProducts();
  }, [search, movementTypeFilter]);

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError('');

    if (!selectedProductId) {
      setAdjustError('يرجى اختيار المنتج المراد تعديل مخزونه');
      return;
    }

    if (newQty < 0) {
      setAdjustError('لا يمكن إدخال كمية مخزون بالسالب');
      return;
    }

    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          newQuantity: Number(newQty),
          reason,
          notes,
          userId: 'usr-admin'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIsAdjustModalOpen(false);
        fetchMovements();
        fetchProducts();
        alert('✅ تم تعديل كمية المخزون وتسجيل الحركة بنجاح');
      } else {
        setAdjustError(data.error || 'فشلت عملية تعديل المخزون');
      }
    } catch (err: any) {
      setAdjustError(err.message);
    }
  };

  const getMovementBadge = (type: string, qty: number) => {
    switch (type) {
      case 'Sale':
        return <span className="px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800/60 font-bold text-[10px]">بيع (-{Math.abs(qty)})</span>;
      case 'Purchase':
      case 'OpeningStock':
        return <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-bold text-[10px]">إدخال (+{qty})</span>;
      case 'StockAdjustment':
        return <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 font-bold text-[10px]">تعديل جرد ({qty >= 0 ? `+${qty}` : qty})</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">{type}</span>;
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-33px)] bg-slate-950 text-slate-100 dir-rtl" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-emerald-400" />
            <span>الجرد وحركية المخزون (Stock Movements Audit)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            متابعة جميع عمليات دخول وخروج السلع وتصحيح الفروقات بالتفاصيل والسبب
          </p>
        </div>

        <button
          onClick={() => {
            const p = products[0];
            if (p) {
              setSelectedProductId(p.Id);
              setNewQty(p.Quantity);
            }
            setIsAdjustModalOpen(true);
          }}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-amber-950/50 transition-all hover:scale-105"
        >
          <Layers className="w-4 h-4" />
          <span>تعديل مخزون / تسجيل جرد</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="البحث باسم المنتج أو الباركود أو الملاحظات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={movementTypeFilter}
          onChange={(e) => setMovementTypeFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">جميع أنواع حركية المخزون</option>
          <option value="Sale">مبيعات (Sale)</option>
          <option value="OpeningStock">مخزون أولي (OpeningStock)</option>
          <option value="StockAdjustment">تعديل جرد (StockAdjustment)</option>
          <option value="Purchase">مشتريات جديدة (Purchase)</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-xs font-bold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="p-4">التاريخ والوقت</th>
                <th className="p-4">اسم المنتج</th>
                <th className="p-4">نوع الحركة</th>
                <th className="p-4">الكمية السابقة</th>
                <th className="p-4">الكمية المعدلة</th>
                <th className="p-4">الكمية الجديدة النهائي</th>
                <th className="p-4">الملاحظات والسبب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {movements.length > 0 ? (
                movements.map((m) => (
                  <tr key={m.Id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 text-xs font-mono text-slate-400">
                      {m.Date ? m.Date.substring(0, 19).replace('T', ' ') : '-'}
                    </td>
                    <td className="p-4 font-bold text-white">
                      {m.ProductName}
                      <span className="text-[10px] block font-mono text-emerald-400">{m.Barcode}</span>
                    </td>
                    <td className="p-4">{getMovementBadge(m.MovementType, m.Quantity)}</td>
                    <td className="p-4 font-mono text-slate-400">{m.PreviousQuantity} {m.Unit || 'قطعة'}</td>
                    <td className="p-4 font-mono font-bold text-white">
                      {m.Quantity > 0 ? `+${m.Quantity}` : m.Quantity}
                    </td>
                    <td className="p-4 font-mono font-bold text-emerald-400">{m.NewQuantity}</td>
                    <td className="p-4 text-xs text-slate-300 max-w-xs truncate">{m.Notes || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    لا توجد سجلات حركية مخزون مسجلة طابق هذا الفلتر
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>تعديل مخزون منتج وتفريغ الفروقات</span>
              </h3>
            </div>

            {adjustError && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 p-2.5 rounded-xl text-xs font-bold">
                ⚠️ {adjustError}
              </div>
            )}

            <form onSubmit={handleExecuteAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اختر المنتج *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedProductId(id);
                    const found = products.find((p) => p.Id === id);
                    if (found) setNewQty(found.Quantity);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {products.map((p) => (
                    <option key={p.Id} value={p.Id}>
                      {p.Name} (المخزون الحالي: {p.Quantity} {p.Unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الكمية الفعلية الجديدة الحقيقية (الناتجة عن الجرد) *</label>
                <input
                  type="number"
                  value={newQty}
                  onChange={(e) => setNewQty(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-lg font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">سبب تعديل المخزون *</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="جرد سنوي / دوري">جرد سنوي / دوري للمحل</option>
                  <option value="سلعة تالفة / مكسورة">سلعة تالفة / مكسورة (Damage)</option>
                  <option value="سلعة منتهية الصلاحية">سلعة منتهية الصلاحية (Expired)</option>
                  <option value="سلعة مفقودة / ضائعة">سلعة مفقودة / ضائعة (Lost)</option>
                  <option value="تصحيح خطأ إدخال">تصحيح خطأ إدخال قديم</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">تفاصيل إضافية / ملاحظات</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات توضيحية لسبب التغيير"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
                >
                  حفظ تعديل الجرد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
