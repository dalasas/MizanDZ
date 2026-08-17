import React, { useState, useEffect } from 'react';
import { Tags, Plus, Edit3, Trash2, Check, X, Box, Coffee, ShoppingBag, Sparkles, Cookie, Milk } from 'lucide-react';
import { Category } from '../types';

export const CategoriesView: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Box');
  const [error, setError] = useState('');
  const [globalMessage, setGlobalMessage] = useState({ text: '', isError: false });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleDelete = async (cat: Category) => {
    if (!confirm(`هل تريد حذف التصنيف "${cat.Name}"؟`)) return;

    try {
      const res = await fetch(`/api/categories/${cat.Id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        setGlobalMessage({ text: 'تم حذف التصنيف بنجاح', isError: false });
        fetchCategories();
      } else {
        setGlobalMessage({ text: data.error || 'فشل حذف التصنيف', isError: true });
      }
      setTimeout(() => setGlobalMessage({ text: '', isError: false }), 4000);
    } catch (err: any) {
      setGlobalMessage({ text: err.message, isError: true });
      setTimeout(() => setGlobalMessage({ text: '', isError: false }), 4000);
    }
  };

  const handleOpenModal = (cat: Category | null = null) => {
    setError('');
    if (cat) {
      setEditingCategory(cat);
      setName(cat.Name);
      setDescription(cat.Description || '');
      setIcon(cat.Icon || 'Box');
    } else {
      setEditingCategory(null);
      setName('');
      setDescription('');
      setIcon('Box');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name) {
      setError('اسم التصنيف مطلوب');
      return;
    }

    try {
      const method = editingCategory ? 'PUT' : 'POST';
      const url = editingCategory ? `/api/categories/${editingCategory.Id}` : '/api/categories';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, icon })
      });

      const data = await res.json();

      if (res.ok) {
        setIsModalOpen(false);
        fetchCategories();
      } else {
        setError(data.error || 'حدث خطأ أثناء الحفظ');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Coffee': return <Coffee className="w-5 h-5 text-amber-400" />;
      case 'ShoppingBag': return <ShoppingBag className="w-5 h-5 text-emerald-400" />;
      case 'Sparkles': return <Sparkles className="w-5 h-5 text-blue-400" />;
      case 'Cookie': return <Cookie className="w-5 h-5 text-orange-400" />;
      case 'Milk': return <Milk className="w-5 h-5 text-sky-400" />;
      default: return <Box className="w-5 h-5 text-teal-400" />;
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-33px)] bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Tags className="w-6 h-6 text-emerald-400" />
            <span>تصنيفات المحل (Categories)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            تنظيم سلع ومنتجات المحل في فئات واضحة لتسهيل عملية البيع والجرد
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة تصنيف جديد</span>
        </button>
      </div>

      {globalMessage.text && (
        <div className={`p-4 rounded-xl text-xs font-bold border ${
          globalMessage.isError
            ? 'bg-red-950/80 border-red-800 text-red-300'
            : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
        }`}>
          {globalMessage.isError ? '⚠️ ' : '✅ '}
          {globalMessage.text}
        </div>
      )}

      {/* Categories Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div key={cat.Id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3 relative hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  {getCategoryIcon(cat.Icon)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{cat.Name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{cat.Description || 'لا يوجد وصف'}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenModal(cat)}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
                  title="تعديل"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  className="p-2 hover:bg-red-950/60 text-slate-400 hover:text-red-400 rounded-xl transition-colors"
                  title="حذف التصنيف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs text-slate-400">
              <span>عدد المنتجات المسجلة:</span>
              <span className="font-bold font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/40">
                {cat.ProductCount || 0} منتج
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                {editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-950/60 border border-red-800 text-red-300 p-2.5 rounded-xl text-xs font-semibold">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم التصنيف</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: عصائر ومشروبات"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الوصف</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف مختصر لمجموع المنتجات"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الأيقونة</label>
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Box">صندوق عادية (Box)</option>
                  <option value="ShoppingBag">حقيبة تسوق (ShoppingBag)</option>
                  <option value="Coffee">مشروبات (Coffee)</option>
                  <option value="Sparkles">منظفات (Sparkles)</option>
                  <option value="Cookie">حلويات (Cookie)</option>
                  <option value="Milk">ألبان (Milk)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm"
                >
                  حفظ التصنيف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
