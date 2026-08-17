import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Calendar, FileText, CheckCircle2, AlertCircle, ShoppingBag, Trash2, ArrowUpRight } from 'lucide-react';
import { Supplier, Product } from '../types';

interface PurchaseCartItem {
  productId: number;
  productName: string;
  barcode: string;
  unitCost: number;
  quantity: number;
}

export const PurchasesView: React.FC = () => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // New Purchase Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
  const [cart, setCart] = useState<PurchaseCartItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Product Selection search inside modal
  const [productSearch, setProductSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [purRes, supRes, prodRes] = await Promise.all([
        fetch('/api/purchases'),
        fetch('/api/suppliers'),
        fetch('/api/products')
      ]);

      if (purRes.ok) setPurchases(await purRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch (err) {
      console.error('Error fetching purchases data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddToCart = (prod: Product) => {
    setCart(prev => {
      const exist = prev.find(item => item.productId === prod.Id);
      if (exist) {
        return prev.map(item =>
          item.productId === prod.Id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: prod.Id,
          productName: prod.Name,
          barcode: prod.Barcode,
          unitCost: prod.PurchasePrice,
          quantity: 1
        }
      ];
    });
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart(prev => prev.filter(it => it.productId !== productId));
  };

  const handleItemCostChange = (productId: number, newCost: number) => {
    setCart(prev => prev.map(it => it.productId === productId ? { ...it, unitCost: Math.max(0, newCost) } : it));
  };

  const handleItemQtyChange = (productId: number, newQty: number) => {
    setCart(prev => prev.map(it => it.productId === productId ? { ...it, quantity: Math.max(1, newQty) } : it));
  };

  const totalPurchaseAmount = cart.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);
  const paidVal = paidAmount === '' ? totalPurchaseAmount : Number(paidAmount);
  const remainingDebt = Math.max(0, totalPurchaseAmount - paidVal);

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (!selectedSupplierId) {
      setFormError('يرجى تحديد المورد');
      return;
    }
    if (cart.length === 0) {
      setFormError('سلة المشتريات فارغة');
      return;
    }

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: Number(selectedSupplierId),
          items: cart,
          paidAmount: paidVal,
          notes
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message || 'تم تسجيل الشراء بنجاح');
        setIsModalOpen(false);
        setCart([]);
        setSelectedSupplierId('');
        setPaidAmount('');
        setNotes('');
        fetchData();
      } else {
        setFormError(data.error || 'فشلت عملية إضافة المشتريات');
      }
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const filteredProducts = products.filter(p =>
    p.Name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.Barcode.includes(productSearch)
  );

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-33px)] bg-slate-950 text-slate-100 dir-rtl" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-400" />
            <span>إدارة المشتريات والتموين (Purchases)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            تسجيل فواتير الشراء وتغذية المخزون وتحديث ديون الموردين تلقائياً
          </p>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true);
            setFormError('');
            setSuccessMsg('');
          }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل فاتورة شراء جديدة</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Purchases List */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>سجل فواتير المشتريات</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">العدد: {purchases.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">رقم الفاتورة</th>
                <th className="p-3">المورد</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">إجمالي المبلغ</th>
                <th className="p-3">المدفوع</th>
                <th className="p-3">المتبقي (دين)</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {purchases.length > 0 ? (
                purchases.map((pur) => (
                  <tr key={pur.Id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-emerald-400">#{pur.InvoiceNumber}</td>
                    <td className="p-3 font-bold text-white">{pur.SupplierName}</td>
                    <td className="p-3 font-mono text-slate-400">{pur.CreatedAt ? pur.CreatedAt.substring(0, 10) : ''}</td>
                    <td className="p-3 font-mono font-bold text-white">{pur.TotalAmount.toLocaleString('ar-DZ')} دج</td>
                    <td className="p-3 font-mono text-emerald-400">{pur.PaidAmount.toLocaleString('ar-DZ')} دج</td>
                    <td className="p-3 font-mono text-amber-400">{pur.RemainingAmount.toLocaleString('ar-DZ')} دج</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        pur.RemainingAmount === 0
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {pur.RemainingAmount === 0 ? 'مدفوعة' : 'دين متبقي'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 text-xs">
                    لا توجد فواتير مشتريات مسجلة حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <span>تسجيل فاتورة شراء جديدة</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 p-2.5 rounded-xl text-xs font-bold shrink-0">
                ⚠️ {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto flex-1 p-1">
              {/* Product Picker */}
              <div className="md:col-span-1 bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3 flex flex-col">
                <h4 className="font-bold text-xs text-slate-300">اختيار المنتجات لتغذية المخزون</h4>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="بحث باسم المنتج أو الباركود..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5 overflow-y-auto max-h-60 flex-1">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.Id}
                      type="button"
                      onClick={() => handleAddToCart(p)}
                      className="w-full text-right p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-bold text-white">{p.Name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">سعر الشراء الحالي: {p.PurchasePrice} دج | المخزون: {p.Quantity}</div>
                      </div>
                      <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Purchase Details & Cart */}
              <div className="md:col-span-2 space-y-4 flex flex-col">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">المورد *</label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      required
                    >
                      <option value="">-- اختر المورد --</option>
                      {suppliers.map(s => (
                        <option key={s.Id} value={s.Id}>{s.Name} (الرصيد: {s.Balance || 0} دج)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ المدفوع للمورد (دج)</label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder={`تلقائي (${totalPurchaseAmount} دج)`}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Items Cart Table */}
                <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 flex-1 overflow-y-auto space-y-2">
                  <h4 className="font-bold text-xs text-slate-300">السلع المحددة بالفاتورة</h4>
                  {cart.length > 0 ? (
                    <div className="space-y-2">
                      {cart.map((item) => (
                        <div key={item.productId} className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs">
                          <div>
                            <div className="font-bold text-white">{item.productName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{item.barcode}</div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div>
                              <span className="text-[10px] text-slate-400 block">سعر التكلفة:</span>
                              <input
                                type="number"
                                value={item.unitCost}
                                onChange={(e) => handleItemCostChange(item.productId, Number(e.target.value))}
                                className="w-20 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white font-mono text-center"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-400 block">الكمية:</span>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleItemQtyChange(item.productId, Number(e.target.value))}
                                className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white font-mono text-center"
                              />
                            </div>

                            <div className="text-left font-mono font-bold text-emerald-400 w-24">
                              {(item.unitCost * item.quantity).toLocaleString('ar-DZ')} دج
                            </div>

                            <button
                              onClick={() => handleRemoveFromCart(item.productId)}
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      اختر المنتجات من القائمة الجانبية لإضافتها إلى الفاتورة
                    </div>
                  )}
                </div>

                {/* Purchase Summary */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400">إجمالي الفاتورة: </span>
                    <span className="font-mono font-bold text-white text-sm">{totalPurchaseAmount.toLocaleString('ar-DZ')} دج</span>
                  </div>
                  <div>
                    <span className="text-slate-400">الدين المتبقي للمورد: </span>
                    <span className="font-mono font-bold text-amber-400 text-sm">{remainingDebt.toLocaleString('ar-DZ')} دج</span>
                  </div>
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
                    type="button"
                    onClick={handleSubmitPurchase}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    حفظ الفاتورة وتحديث المخزون
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
