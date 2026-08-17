import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  User,
  UserPlus,
  CheckCircle2,
  Printer,
  X,
  CreditCard,
  Wallet,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Phone,
  RotateCcw
} from 'lucide-react';
import { Product, SaleItem, Customer } from '../types';
import { PrintReceiptModal } from './PrintReceiptModal';

interface PosViewProps {
  onSaleComplete?: () => void;
}

export const PosView: React.FC<PosViewProps> = ({ onSaleComplete }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(1); // 1 = default cash customer
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Debt'>('Cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);

  // Customer Modals & Search
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  // Modals & UI
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isSuspendedModalOpen, setIsSuspendedModalOpen] = useState(false);
  const [suspendedSales, setSuspendedSales] = useState<any[]>([]);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerSearchInputRef = useRef<HTMLInputElement>(null);

  // Load products & customers
  const loadData = async () => {
    try {
      const [prodRes, custRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/customers')
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSuspendedSales = async () => {
    try {
      const res = await fetch('/api/pos/suspended');
      if (res.ok) setSuspendedSales(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    fetchSuspendedSales();
  }, []);

  useEffect(() => {
    if (isCustomerModalOpen) {
      setTimeout(() => customerSearchInputRef.current?.focus(), 50);
    }
  }, [isCustomerModalOpen]);

  // Current selected customer object
  const activeCustomer = customers.find(c => c.Id === selectedCustomerId) || null;

  // Filtered customers list for selector
  const filteredCustomers = customers.filter(c => {
    if (!customerSearchQuery.trim()) return true;
    const q = customerSearchQuery.trim().toLowerCase();
    const nameMatch = (c.Name || '').toLowerCase().includes(q);
    const phoneMatch = (c.Phone || '').includes(q);
    return nameMatch || phoneMatch;
  });

  // Keyboard Shortcuts Listener (F2, F4, F6, F8, ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        const discStr = prompt('أدخل قيمة الخصم (دج):', discount.toString());
        if (discStr !== null) setDiscount(Number(discStr) || 0);
      } else if (e.key === 'F6') {
        e.preventDefault();
        fetchSuspendedSales();
        setIsSuspendedModalOpen(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) handleOpenCheckout();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isAddCustomerOpen) setIsAddCustomerOpen(false);
        else if (isCustomerModalOpen) setIsCustomerModalOpen(false);
        else if (isCheckoutOpen) setIsCheckoutOpen(false);
        else if (isSuspendedModalOpen) setIsSuspendedModalOpen(false);
        else if (cart.length > 0 && confirm('إلغاء السلة الحالية؟')) setCart([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCheckoutOpen, isSuspendedModalOpen, isCustomerModalOpen, isAddCustomerOpen, discount]);

  // Barcode HID Auto-scanner match
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const term = searchQuery.trim();
    const found = products.find(
      (p) => p.Barcode === term || p.Name.toLowerCase().includes(term.toLowerCase())
    );

    if (found) {
      addToCart(found);
      setSearchQuery('');
      setStatusMessage(`✅ تم مسح وحساب: ${found.Name}`);
      setTimeout(() => setStatusMessage(''), 2500);
    } else {
      setStatusMessage(`❌ لم يتم العثور على أي منتج بالباركود أو الاسم: "${term}"`);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const addToCart = (product: Product) => {
    if (product.Quantity <= 0) {
      setStatusMessage(`⚠️ تنبيه: المنتج "${product.Name}" نفد من المخزون بالكامل`);
      setTimeout(() => setStatusMessage(''), 3000);
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.Id);
      if (existing) {
        if (existing.quantity >= product.Quantity) {
          setStatusMessage(`⚠️ الكمية المطلوبة تتجاوز الكمية المتاحة في المخزون (${product.Quantity})`);
          setTimeout(() => setStatusMessage(''), 3000);
        }

        return prevCart.map((item) =>
          item.id === product.Id
            ? {
                ...item,
                quantity: item.quantity + 1,
                totalPrice: (item.quantity + 1) * item.salePrice
              }
            : item
        );
      } else {
        return [
          ...prevCart,
          {
            id: product.Id,
            barcode: product.Barcode,
            name: product.Name,
            purchasePrice: product.PurchasePrice,
            salePrice: product.SalePrice,
            quantity: 1,
            totalPrice: product.SalePrice,
            unit: product.Unit || 'قطعة'
          }
        ];
      }
    });
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) return;

    setIsSubmittingCustomer(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomerForm)
      });
      const data = await res.json();
      if (res.ok) {
        await loadData();
        if (data.customer?.Id) {
          setSelectedCustomerId(data.customer.Id);
        }
        setIsAddCustomerOpen(false);
        setIsCustomerModalOpen(false);
        setNewCustomerForm({ name: '', phone: '', address: '', notes: '' });
        setStatusMessage(`✅ تم تسجيل واختيار العميل: ${newCustomerForm.name}`);
        setTimeout(() => setStatusMessage(''), 3000);
      } else {
        alert(data.error || 'فشلت إضافة العميل');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleSuspendCurrentCart = async () => {
    if (cart.length === 0) return;

    try {
      const res = await fetch('/api/pos/suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId || 1,
          items: cart,
          userId: 'usr-admin'
        })
      });

      if (res.ok) {
        setCart([]);
        setDiscount(0);
        fetchSuspendedSales();
        setStatusMessage('⏸️ تم تعليق الفاتورة بنجاح. يمكنك استئنافها في أي وقت (F6)');
        setTimeout(() => setStatusMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResumeSuspended = async (suspendedSale: any) => {
    const formattedItems: SaleItem[] = (suspendedSale.items || []).map((it: any) => ({
      id: it.ProductId,
      barcode: '',
      name: it.ProductName,
      purchasePrice: it.CostPrice,
      salePrice: it.UnitPrice,
      quantity: it.Quantity,
      totalPrice: it.UnitPrice * it.Quantity,
      unit: 'قطعة'
    }));

    setCart(formattedItems);
    setSelectedCustomerId(suspendedSale.CustomerId || 1);

    try {
      await fetch(`/api/pos/suspended/${suspendedSale.Id}`, { method: 'DELETE' });
      fetchSuspendedSales();
      setIsSuspendedModalOpen(false);
      setStatusMessage('▶️ تم استرجاع الفاتورة المعلقة إلى السلة');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0
              ? { ...item, quantity: newQty, totalPrice: newQty * item.salePrice }
              : null;
          }
          return item;
        })
        .filter(Boolean) as SaleItem[]
    );
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // Calculations
  const subTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const grandTotal = Math.max(0, subTotal - discount);
  const changeAmount = Math.max(0, paidAmount - grandTotal);
  const remainingDebt = paymentMethod === 'Debt' ? grandTotal : Math.max(0, grandTotal - paidAmount);

  const handleOpenCheckout = () => {
    setPaidAmount(paymentMethod === 'Cash' ? grandTotal : 0);
    setIsCheckoutOpen(true);
  };

  const handleExecuteSale = async () => {
    if (isSubmittingSale) return;
    setIsSubmittingSale(true);

    try {
      const idempotencyKey = `pos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload = {
        customerId: selectedCustomerId || 1,
        items: cart,
        paymentMethod,
        paidAmount: paymentMethod === 'Debt' ? 0 : paidAmount,
        discount,
        userId: 'usr-admin',
        idempotencyKey
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        const custName = data.customerName || activeCustomer?.Name || 'زبون عادي (نقدي)';
        const custPhone = data.customerPhone || activeCustomer?.Phone || '';

        setLastInvoice({
          invoiceNumber: data.invoiceNumber,
          date: new Date().toISOString(),
          customerName: custName,
          customerPhone: custPhone,
          items: [...cart],
          subTotal,
          discount,
          grandTotal,
          paidAmount: payload.paidAmount,
          remaining: data.remaining,
          paymentMethod
        });

        setIsCheckoutOpen(false);
        setIsReceiptOpen(true);
        setCart([]);
        setDiscount(0);
        loadData();
        if (onSaleComplete) onSaleComplete();
      } else {
        alert(data.error || 'فشلت عملية البيع');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingSale(false);
    }
  };

  return (
    <div className="h-[calc(100vh-33px)] flex flex-col md:flex-row bg-slate-950 text-slate-100 overflow-hidden select-none" dir="rtl">
      {/* Left Area: Cart & Checkout Summary (Width 430px) */}
      <div className="w-full md:w-[430px] bg-slate-900 border-l border-slate-800 flex flex-col justify-between shrink-0 h-full">
        {/* Cart Header */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-white text-base">سلة الفاتورة</h3>
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full text-xs font-mono font-bold">
              {cart.length} عناصر
            </span>
          </div>

          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 hover:bg-red-950/30 rounded-lg transition-colors"
            >
              مسح السلة (ESC)
            </button>
          )}
        </div>

        {/* Customer Box Section */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <User className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold">الزبون:</span>
              <span className="font-black text-white px-2 py-0.5 bg-slate-900 rounded-md border border-slate-700 truncate max-w-[150px]">
                {activeCustomer ? activeCustomer.Name : 'زبون عادي (نقدي)'}
              </span>
              {activeCustomer && activeCustomer.Phone && activeCustomer.Phone !== '0000000000' && (
                <span className="text-[11px] font-mono text-slate-400 truncate max-w-[90px]">
                  {activeCustomer.Phone}
                </span>
              )}
            </div>

            {selectedCustomerId && selectedCustomerId !== 1 && (
              <button
                onClick={() => setSelectedCustomerId(1)}
                title="إعادة تعيين إلى زبون عادي"
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activeCustomer && activeCustomer.Balance > 0 && (
            <div className="text-[11px] bg-amber-950/60 border border-amber-800 text-amber-300 px-2.5 py-1 rounded-lg flex justify-between font-bold">
              <span>رصيد ديون الزبون السابقة:</span>
              <span className="font-mono">{activeCustomer.Balance.toLocaleString('ar-DZ')} دج</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCustomerSearchQuery(''); setIsCustomerModalOpen(true); }}
              className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              <span>{selectedCustomerId && selectedCustomerId !== 1 ? 'تغيير العميل' : 'اختيار عميل مسجل'}</span>
            </button>
            <button
              onClick={() => setIsAddCustomerOpen(true)}
              className="py-1.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 shadow transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>عميل جديد</span>
            </button>
          </div>
        </div>

        {/* Status Message Notification Banner */}
        {statusMessage && (
          <div className="bg-emerald-950/90 border-y border-emerald-800 text-emerald-300 text-xs px-3 py-2 font-bold animate-pulse">
            {statusMessage}
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length > 0 ? (
            cart.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all"
              >
                <div className="truncate pl-2">
                  <h4 className="font-bold text-white text-sm truncate">{item.name}</h4>
                  <p className="text-xs text-slate-400 font-mono">
                    {item.salePrice.toLocaleString('ar-DZ')} دج / {item.unit}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Quantity Controls */}
                  <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 p-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1 hover:bg-slate-800 text-slate-300 rounded"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-2 font-bold font-mono text-emerald-400 text-sm">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1 hover:bg-slate-800 text-slate-300 rounded"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Total Price */}
                  <div className="text-left w-20">
                    <div className="font-mono font-black text-white text-sm">
                      {item.totalPrice.toLocaleString('ar-DZ')}
                    </div>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
              <ShoppingCart className="w-12 h-12 stroke-1 text-slate-600" />
              <p className="text-sm font-semibold">السلة فارغة حالياً</p>
              <p className="text-xs text-slate-600">امسح الباركود أو اختر سلعاً من القائمة للإضافة</p>
            </div>
          )}
        </div>

        {/* Totals & Checkout Bottom Bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>المجموع الجزئي:</span>
              <span className="font-mono font-bold text-white">{subTotal.toLocaleString('ar-DZ')} دج</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-400 font-bold">
                <span>الخصم المطبق:</span>
                <span className="font-mono">-{discount.toLocaleString('ar-DZ')} دج</span>
              </div>
            )}
            <div className="flex justify-between items-center text-base font-black text-emerald-400 border-t border-slate-800 pt-1.5">
              <span>الصافي للإدفاع:</span>
              <span className="font-mono text-xl">{grandTotal.toLocaleString('ar-DZ')} دج</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSuspendCurrentCart}
              disabled={cart.length === 0}
              title="تعليق الفاتورة الحالية (F6)"
              className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-400 hover:bg-amber-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <PauseCircle className="w-5 h-5" />
            </button>

            <button
              onClick={handleOpenCheckout}
              disabled={cart.length === 0}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all"
            >
              <DollarSign className="w-5 h-5" />
              <span>إتمام البيع والدفع (F8)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Area: Products Search & Grid */}
      <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search & Top Action Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <form onSubmit={handleBarcodeSubmit} className="relative flex-1 w-full">
            <Barcode className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="امسح الباركود بجهاز المسح أو اكتب اسم المنتج للبحث السريع (F2)..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pr-11 pl-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
            />
          </form>

          {suspendedSales.length > 0 && (
            <button
              onClick={() => setIsSuspendedModalOpen(true)}
              className="px-4 py-3 rounded-2xl bg-amber-950/70 border border-amber-800 text-amber-400 hover:bg-amber-900/60 font-bold text-xs flex items-center gap-2 shrink-0 transition-colors shadow-sm"
            >
              <PauseCircle className="w-4 h-4" />
              <span>فواتير معلقة ({suspendedSales.length})</span>
            </button>
          )}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pr-1">
          {products
            .filter((p) => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.trim().toLowerCase();
              return (
                p.Name.toLowerCase().includes(q) ||
                (p.Barcode && p.Barcode.includes(q))
              );
            })
            .map((p) => (
              <button
                key={p.Id}
                onClick={() => addToCart(p)}
                className="bg-slate-900 hover:bg-slate-800 p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/50 text-right flex flex-col justify-between transition-all hover:scale-102 shadow-sm group"
              >
                <div>
                  <span className="text-[10px] font-mono text-emerald-400/80 font-bold tracking-wider">{p.Barcode}</span>
                  <h4 className="font-bold text-white text-sm line-clamp-2 mt-0.5 group-hover:text-emerald-300 transition-colors">
                    {p.Name}
                  </h4>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="font-black text-white font-mono text-base">
                    {p.SalePrice.toLocaleString('ar-DZ')} <span className="text-xs text-emerald-400">دج</span>
                  </span>
                  <span className={`text-[11px] font-mono font-bold ${p.Quantity <= p.MinQuantity ? 'text-red-400' : 'text-slate-400'}`}>
                    {p.Quantity} {p.Unit}
                  </span>
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Select Customer Search Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-lg">اختيار العميل للفاتورة</h3>
              </div>
              <button onClick={() => setIsCustomerModalOpen(false)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Search Box */}
            <div className="relative shrink-0">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
              <input
                ref={customerSearchInputRef}
                type="text"
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder="ابحث باسم العميل أو رقم الهاتف..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Fast Default Cash option */}
            <div className="shrink-0 flex gap-2">
              <button
                type="button"
                onClick={() => { setSelectedCustomerId(1); setIsCustomerModalOpen(false); }}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  selectedCustomerId === 1
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>👤 زبون عادي (نقدي افتراضي)</span>
              </button>
              <button
                type="button"
                onClick={() => { setIsCustomerModalOpen(false); setIsAddCustomerOpen(true); }}
                className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ عميل جديد</span>
              </button>
            </div>

            {/* Customers List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
              {filteredCustomers
                .filter(c => c.Id !== 1)
                .map((c) => (
                  <div
                    key={c.Id}
                    onClick={() => { setSelectedCustomerId(c.Id); setIsCustomerModalOpen(false); }}
                    className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all pt-2.5 ${
                      selectedCustomerId === c.Id
                        ? 'bg-emerald-950/60 border border-emerald-700/80 text-white'
                        : 'hover:bg-slate-800/60 text-slate-200'
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{c.Name}</span>
                        {selectedCustomerId === c.Id && (
                          <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.2 rounded-full font-bold">محدد</span>
                        )}
                      </h4>
                      {c.Phone && (
                        <p className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{c.Phone}</span>
                        </p>
                      )}
                    </div>

                    <div className="text-left">
                      {c.Balance > 0 ? (
                        <div className="text-xs font-bold text-amber-400">
                          دين: <span className="font-mono">{c.Balance.toLocaleString('ar-DZ')} دج</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-bold">خالص (0 دج)</span>
                      )}
                    </div>
                  </div>
                ))}
              {filteredCustomers.filter(c => c.Id !== 1).length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">
                  لم يتم العثور على أي عميل مطابق. يمكنك الضغط على "+ عميل جديد" لإضافته فوراً.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-lg">إضافة عميل جديد وربطه بالسلة</h3>
              </div>
              <button onClick={() => setIsAddCustomerOpen(false)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم العميل *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  placeholder="مثال: محمد بن علي"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  placeholder="0550 00 00 00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">العنوان / ملاحظات</label>
                <input
                  type="text"
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  placeholder="المدينة، الحي..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustomer}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow disabled:opacity-50"
                >
                  {isSubmittingCustomer ? 'جاري الحفظ...' : 'حفظ وتحديد العميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <span>دفع وإتمام الفاتورة</span>
              </h3>
              <button onClick={() => setIsCheckoutOpen(false)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Linked Customer Summary in checkout */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-400">الزبون المسجل:</span>
                  <span className="font-bold text-white">{activeCustomer ? activeCustomer.Name : 'زبون عادي (نقدي)'}</span>
                </div>
                {activeCustomer && activeCustomer.Phone && (
                  <span className="font-mono text-slate-400">{activeCustomer.Phone}</span>
                )}
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">طريقة الدفع</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('Cash'); setPaidAmount(grandTotal); }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                      paymentMethod === 'Cash'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    نقدي (Cash)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('Card'); setPaidAmount(grandTotal); }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                      paymentMethod === 'Card'
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    بطاقة بنكية
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('Debt'); setPaidAmount(0); }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                      paymentMethod === 'Debt'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    دين / مؤجل
                  </button>
                </div>
              </div>

              {/* Grand Total */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="text-xs text-slate-400 font-semibold">المبلغ الإجمالي للدفع:</span>
                <div className="text-3xl font-black text-emerald-400 font-mono mt-1">
                  {grandTotal.toLocaleString('ar-DZ')} دج
                </div>
              </div>

              {/* Paid Amount */}
              {paymentMethod !== 'Debt' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ المدفوع (دج)</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-lg text-white font-mono font-black focus:outline-none focus:border-emerald-500"
                  />
                  {changeAmount > 0 && (
                    <p className="text-xs text-emerald-400 font-bold mt-1">
                      المتبقي للإرجاع للزبون: {changeAmount.toLocaleString('ar-DZ')} دج
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === 'Debt' && (
                <div className="bg-amber-950/60 border border-amber-800 text-amber-300 p-3 rounded-xl text-xs font-semibold">
                  ⚠️ سيتم تسجيل كامل المبلغ ({grandTotal.toLocaleString('ar-DZ')} دج) كدين على حساب الزبون: <strong>{activeCustomer ? activeCustomer.Name : 'زبون عادي'}</strong>.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  onClick={() => setIsCheckoutOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold"
                >
                  إلغاء
                </button>
                <button
                  disabled={isSubmittingSale}
                  onClick={handleExecuteSale}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-950/60 disabled:opacity-50"
                >
                  {isSubmittingSale ? 'جاري الحفظ...' : 'حفظ وطباعة الفاتورة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {isReceiptOpen && lastInvoice && (
        <PrintReceiptModal
          invoice={{
            InvoiceNumber: lastInvoice.invoiceNumber || lastInvoice.InvoiceNumber,
            CreatedAt: lastInvoice.date || lastInvoice.CreatedAt,
            CustomerName: lastInvoice.customerName || lastInvoice.CustomerName,
            CustomerPhone: lastInvoice.customerPhone || lastInvoice.CustomerPhone,
            SubTotal: lastInvoice.grandTotal || lastInvoice.GrandTotal,
            GrandTotal: lastInvoice.grandTotal || lastInvoice.GrandTotal,
            PaidAmount: lastInvoice.paidAmount !== undefined ? lastInvoice.paidAmount : lastInvoice.PaidAmount,
            RemainingAmount: (lastInvoice.grandTotal || lastInvoice.GrandTotal) - (lastInvoice.paidAmount !== undefined ? lastInvoice.paidAmount : (lastInvoice.PaidAmount || 0)),
            Discount: lastInvoice.discount || 0,
            Items: (lastInvoice.items || []).map((it: any) => ({
              ProductName: it.name || it.ProductName,
              Quantity: it.quantity || it.Quantity,
              UnitPrice: it.salePrice || it.UnitPrice || (it.totalPrice / (it.quantity || 1))
            }))
          }}
          onClose={() => setIsReceiptOpen(false)}
        />
      )}

      {/* Suspended Sales Modal (F6) */}
      {isSuspendedModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-amber-400" />
                <span>الفواتير المعلقة (المثبتة)</span>
              </h3>
              <button onClick={() => setIsSuspendedModalOpen(false)} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {suspendedSales.length > 0 ? (
                suspendedSales.map((ss) => (
                  <div key={ss.Id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-400">#{ss.Id}</span>
                        <span className="text-xs text-slate-300 font-bold">{ss.CustomerName || 'زبون عابر'}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{ss.CreatedAt ? ss.CreatedAt.substring(0, 19).replace('T', ' ') : ''}</span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1 bg-slate-900 p-2 rounded-lg border border-slate-800">
                      {(ss.items || []).map((it: any) => (
                        <div key={it.Id} className="flex justify-between">
                          <span>{it.ProductName} x {it.Quantity}</span>
                          <span className="font-mono text-slate-200">{(it.UnitPrice * it.Quantity).toLocaleString('ar-DZ')} دج</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-xs font-bold text-white">
                        الإجمالي: <span className="text-emerald-400 font-mono">{ss.TotalAmount.toLocaleString('ar-DZ')} دج</span>
                      </div>
                      <button
                        onClick={() => handleResumeSuspended(ss)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>استئناف الفاتورة في السلة</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-500 text-xs">
                  لا توجد أي فواتير معلقة حالياً
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
