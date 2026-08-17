import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit3,
  Trash2,
  Barcode,
  AlertCircle,
  X,
  Layers,
  Sparkles,
  Download,
  Upload
} from 'lucide-react';
import { Product, Category } from '../types';

export const ProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Opening Stock Modal
  const [isOpeningStockOpen, setIsOpeningStockOpen] = useState(false);
  const [selectedProdForStock, setSelectedProdForStock] = useState<Product | null>(null);
  const [openingQty, setOpeningQty] = useState(10);
  const [openingNotes, setOpeningNotes] = useState('إدخال المخزون الأولي للمحل');

  // Form Fields
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    description: '',
    categoryId: 1,
    purchasePrice: 0,
    salePrice: 0,
    wholesalePrice: 0,
    quantity: 0,
    minQuantity: 5,
    unit: 'قطع',
    expiryDate: ''
  });

  const [formError, setFormError] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `/api/products?search=${encodeURIComponent(search)}`;
      if (selectedCategory) url += `&categoryId=${selectedCategory}`;
      if (showLowStockOnly) url += `&lowStock=true`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [search, selectedCategory, showLowStockOnly]);

  const handleOpenModal = (prod: Product | null = null) => {
    setFormError('');
    if (prod) {
      setEditingProduct(prod);
      setFormData({
        barcode: prod.Barcode,
        name: prod.Name,
        description: prod.Description || '',
        categoryId: prod.CategoryId,
        purchasePrice: prod.PurchasePrice,
        salePrice: prod.SalePrice,
        wholesalePrice: prod.WholesalePrice,
        quantity: prod.Quantity,
        minQuantity: prod.MinQuantity,
        unit: prod.Unit || 'قطع',
        expiryDate: prod.ExpiryDate || ''
      });
    } else {
      setEditingProduct(null);
      const autoBarcode = '613' + Date.now().toString().substring(4, 13);
      setFormData({
        barcode: autoBarcode,
        name: '',
        description: '',
        categoryId: categories[0]?.Id || 1,
        purchasePrice: 0,
        salePrice: 0,
        wholesalePrice: 0,
        quantity: 0, // Default 0 for clean opening stock
        minQuantity: 5,
        unit: 'قطع',
        expiryDate: ''
      });
    }
    setIsModalOpen(true);
  };

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatus, setImportStatus] = useState('');

  const handleExport = () => {
    window.open('/api/products/export', '_blank');
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportStatus('');

    try {
      const parsed = JSON.parse(importJsonText);
      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: parsed })
      });

      const data = await res.json();
      if (res.ok) {
        setIsImportModalOpen(false);
        setImportJsonText('');
        fetchProducts();
        alert(data.message || 'تم الاستيراد بنجاح');
      } else {
        setImportStatus(data.error || 'فشل الاستيراد');
      }
    } catch (err: any) {
      setImportStatus('صيغة JSON غير صحيحة: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.barcode.trim() || !formData.name.trim()) {
      setFormError('يرجى ملء جميع الحقول المطلوبة (الباركود والاسم)');
      return;
    }

    if (formData.purchasePrice < 0 || formData.salePrice < 0 || formData.wholesalePrice < 0) {
      setFormError('لا يمكن إدخال أسعار بالسالب');
      return;
    }

    if (formData.quantity < 0 || formData.minQuantity < 0) {
      setFormError('لا يمكن إدخال كميات بالسالب');
      return;
    }

    try {
      const method = editingProduct ? 'PUT' : 'POST';
      const url = editingProduct ? `/api/products/${editingProduct.Id}` : '/api/products';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        setIsModalOpen(false);
        fetchProducts();
      } else {
        setFormError(data.error || 'حدث خطأ أثناء الحفظ');
      }
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleSaveOpeningStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProdForStock) return;

    try {
      const res = await fetch('/api/products/opening-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProdForStock.Id,
          openingQuantity: Number(openingQty),
          notes: openingNotes
        })
      });

      if (res.ok) {
        setIsOpeningStockOpen(false);
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت تأكد من نقل هذا المنتج إلى محذوفات النظام؟')) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const profitMargin = formData.salePrice - formData.purchasePrice;
  const profitMarginPercent = formData.purchasePrice > 0 
    ? ((profitMargin / formData.purchasePrice) * 100).toFixed(1) 
    : '0';

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-33px)] bg-slate-950 text-slate-100 dir-rtl" dir="rtl">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            <span>إدارة المنتجات والمخزون الحقيقي</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            إضافة منتجات المحل الحقيقية وإدخال كميات المخزون الأولي
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl font-bold text-xs border border-slate-700 transition-colors"
            title="تصدير قائمة المنتجات ملف JSON"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تصدير</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl font-bold text-xs border border-slate-700 transition-colors"
            title="استيراد منتجات من ملف JSON"
          >
            <Upload className="w-4 h-4 text-blue-400" />
            <span>استيراد</span>
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منتج جديد</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="البحث بالاسم أو الباركود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">جميع التصنيفات</option>
          {categories.map((c) => (
            <option key={c.Id} value={c.Id}>{c.Name}</option>
          ))}
        </select>

        {/* Low Stock Filter */}
        <button
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
            showLowStockOnly
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>المنتجات المنخفضة فقط</span>
        </button>
      </div>

      {/* Products Data Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-xs font-bold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="p-4">الباركود</th>
                <th className="p-4">اسم المنتج</th>
                <th className="p-4">التصنيف</th>
                <th className="p-4">سعر الشراء</th>
                <th className="p-4">سعر البيع</th>
                <th className="p-4">هامش الربح</th>
                <th className="p-4">الكمية بالمخزون</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {products.length > 0 ? (
                products.map((p) => {
                  const margin = p.SalePrice - p.PurchasePrice;
                  const isLow = p.Quantity <= p.MinQuantity;

                  return (
                    <tr key={p.Id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono text-xs font-bold text-emerald-400">
                        {p.Barcode}
                      </td>
                      <td className="p-4 font-bold text-white">
                        {p.Name}
                        {p.Description && <p className="text-[11px] text-slate-500 font-normal">{p.Description}</p>}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs border border-slate-700">
                          {p.CategoryName || 'عام'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300 font-mono">
                        {p.PurchasePrice.toLocaleString('ar-DZ')} دج
                      </td>
                      <td className="p-4 font-bold text-white font-mono">
                        {p.SalePrice.toLocaleString('ar-DZ')} دج
                      </td>
                      <td className="p-4 text-emerald-400 font-mono font-bold text-xs">
                        +{margin.toLocaleString('ar-DZ')} دج
                      </td>
                      <td className="p-4">
                        <span className={`font-black font-mono ${isLow ? 'text-red-400' : 'text-white'}`}>
                          {p.Quantity} {p.Unit}
                        </span>
                      </td>
                      <td className="p-4">
                        {isLow ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 text-[10px] font-bold">
                            ⚠️ تنبيه نقص
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 text-[10px] font-bold">
                            متاح
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedProdForStock(p);
                              setOpeningQty(p.Quantity);
                              setIsOpeningStockOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                            title="إدخال / تعديل المخزون الأولي"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>المخزون</span>
                          </button>

                          <button
                            onClick={() => handleOpenModal(p)}
                            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
                            title="تعديل المنتج"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(p.Id)}
                            className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                            title="حذف المنتج"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-400 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center mx-auto border border-slate-800 text-slate-500">
                      <Package className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-base text-white">لا توجد منتجات مسجلة في قاعدة البيانات حتى الآن</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      ابدأ الآن بإضافة منتجات محلك الحقيقية أو إدخال المخزون الأولي للبدء بعمليات البيع
                    </p>
                    <button
                      onClick={() => handleOpenModal()}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                    >
                      + إضافة أول منتج للمحل
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Opening Stock Entry Modal (إدخال المخزون الأولي) */}
      {isOpeningStockOpen && selectedProdForStock && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span>إدخال المخزون الأولي — {selectedProdForStock.Name}</span>
              </h3>
              <button
                onClick={() => setIsOpeningStockOpen(false)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOpeningStock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  الكمية الحالية المتوفرة بالمحل (المخزون الأولي) *
                </label>
                <input
                  type="number"
                  value={openingQty}
                  onChange={(e) => setOpeningQty(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-lg font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  ملاحظة: سيتم تسجيل حركية المخزون برمز <strong className="text-emerald-400">OpeningStock</strong> ولن يُعتبر عملية شراء جديدة.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات حركية المخزون</label>
                <input
                  type="text"
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpeningStockOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  تسجيل المخزون الأولي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <span>{editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد للمحل'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-950/60 border border-red-800 text-red-300 p-3 rounded-xl text-xs font-semibold">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Barcode */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الباركود (رمز المنتج) *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                      required
                    />
                    <Barcode className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">اسم المنتج الحقيقي *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: زيت سفينة 5 لتر"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">التصنيف *</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {categories.map((c) => (
                      <option key={c.Id} value={c.Id}>{c.Name}</option>
                    ))}
                  </select>
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">وحدة القياس</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="قطع">قطعة (قطع)</option>
                    <option value="كيس">كيس</option>
                    <option value="علبة">علبة</option>
                    <option value="قارورة">قارورة</option>
                    <option value="كغ">كيلوغرام (كغ)</option>
                    <option value="لتر">لتر (L)</option>
                  </select>
                </div>

                {/* Purchase Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">سعر الشراء (دج) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                {/* Sale Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">سعر البيع للزبون (دج) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                {/* Initial Quantity / Opening Stock */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المخزون الأولي المتاح حالياً</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Min Quantity */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">حد التنبيه بنفاد الكمية</label>
                  <input
                    type="number"
                    value={formData.minQuantity}
                    onChange={(e) => setFormData({ ...formData, minQuantity: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Profit Margin Info Box */}
              <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-300">
                <span>هامش الربح لكل قطعة:</span>
                <span className="text-sm font-mono">{profitMargin.toFixed(2)} دج ({profitMarginPercent}%)</span>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50"
                >
                  {editingProduct ? 'تحديث المنتج' : 'حفظ المنتج في قاعدة البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import JSON Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                <span>استيراد المنتجات (JSON Format)</span>
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {importStatus && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 p-3 rounded-xl text-xs font-bold">
                ⚠️ {importStatus}
              </div>
            )}

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  الصق نص المنتجات بصيغة JSON
                </label>
                <textarea
                  rows={8}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder={`[
  {
    "barcode": "613000000001",
    "name": "زيت زيتون 1 لتر",
    "purchasePrice": 800,
    "salePrice": 950,
    "quantity": 20,
    "unit": "قارورة"
  }
]`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                >
                  بدء الاستيراد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
