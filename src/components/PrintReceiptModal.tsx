import React, { useState, useEffect } from 'react';
import { Printer, X, Download, Check, FileText } from 'lucide-react';
import { SaleInvoice } from '../types';

interface PrintReceiptModalProps {
  invoice: SaleInvoice | any;
  onClose: () => void;
  shopSettings?: {
    shopName?: string;
    shopAddress?: string;
    shopPhone?: string;
  };
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  invoice,
  onClose,
  shopSettings
}) => {
  const [format, setFormat] = useState<'80mm' | '58mm' | 'A4'>('80mm');
  const [isPrinted, setIsPrinted] = useState(false);
  const [loadedSettings, setLoadedSettings] = useState<{ shopName: string; shopAddress: string; shopPhone: string }>({
    shopName: shopSettings?.shopName || 'محل ميزان التجاري',
    shopAddress: shopSettings?.shopAddress || 'الجزائر العاصمة',
    shopPhone: shopSettings?.shopPhone || '0550 00 00 00'
  });

  useEffect(() => {
    if (!shopSettings?.shopName) {
      fetch('/api/settings')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const map: Record<string, string> = {};
            data.forEach((s: any) => { map[s.Key] = s.Value; });
            setLoadedSettings({
              shopName: map['ShopName'] || 'محل ميزان التجاري',
              shopAddress: map['ShopAddress'] || 'الجزائر العاصمة',
              shopPhone: map['ShopPhone'] || '0550 00 00 00'
            });
          }
        })
        .catch(() => {});
    }
  }, [shopSettings]);

  const shopName = shopSettings?.shopName || loadedSettings.shopName;
  const shopAddress = shopSettings?.shopAddress || loadedSettings.shopAddress;
  const shopPhone = shopSettings?.shopPhone || loadedSettings.shopPhone;

  const handlePrint = () => {
    window.print();
    setIsPrinted(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">معاينة وطباعة الفاتورة #{invoice.InvoiceNumber}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Format Selector */}
        <div className="flex items-center justify-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setFormat('80mm')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              format === '80mm' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            حراري 80مم (Thermal)
          </button>
          <button
            onClick={() => setFormat('58mm')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              format === '58mm' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            حراري 58مم (Thermal)
          </button>
          <button
            onClick={() => setFormat('A4')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              format === 'A4' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            قياس A4
          </button>
        </div>

        {/* Printable Area */}
        <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-center">
          <div
            id="printable-receipt"
            className={`bg-white text-black p-4 font-sans text-right ${
              format === '58mm' ? 'w-[200px] text-[10px]' : format === '80mm' ? 'w-[280px] text-xs' : 'w-full text-sm'
            }`}
            style={{ direction: 'rtl' }}
          >
            {/* Receipt Content */}
            <div className="text-center border-b border-black/20 pb-2 mb-2">
              <h2 className="font-bold text-base">{shopName}</h2>
              {shopAddress && <p className="text-[10px] text-gray-600">{shopAddress}</p>}
              {shopPhone && <p className="text-[10px] text-gray-600">الهاتف: {shopPhone}</p>}
            </div>

            <div className="text-[10px] space-y-1 border-b border-black/20 pb-2 mb-2">
              <div className="flex justify-between items-center">
                <span>رقم الفاتورة:</span>
                <span className="font-mono font-bold">{invoice.InvoiceNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>التاريخ:</span>
                <span className="font-mono">{invoice.CreatedAt ? invoice.CreatedAt.substring(0, 19).replace('T', ' ') : ''}</span>
              </div>
              <div className="flex justify-between items-start gap-1">
                <span className="shrink-0">الزبون:</span>
                <span className="font-bold text-left break-words max-w-[70%]">{invoice.CustomerName || 'زبون عادي'}</span>
              </div>
              {invoice.CustomerPhone && invoice.CustomerPhone !== '0000000000' && (
                <div className="flex justify-between items-center">
                  <span>هاتف الزبون:</span>
                  <span className="font-mono font-bold">{invoice.CustomerPhone}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <table className="w-full text-right border-b border-black/20 pb-2 mb-2">
              <thead>
                <tr className="border-b border-black/10 text-[10px] font-bold">
                  <th className="py-1">السلعة</th>
                  <th className="py-1 text-center">الكمية</th>
                  <th className="py-1 text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(invoice.items || invoice.Items || []).map((it: any, idx: number) => (
                  <tr key={idx} className="text-[11px]">
                    <td className="py-1 break-words max-w-[120px]">{it.ProductName || it.name}</td>
                    <td className="py-1 text-center font-mono">{it.Quantity || it.quantity}</td>
                    <td className="py-1 text-left font-mono">{((it.UnitPrice || it.salePrice) * (it.Quantity || it.quantity)).toLocaleString('ar-DZ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="space-y-1 text-xs border-b border-black/20 pb-2 mb-2 font-bold">
              <div className="flex justify-between">
                <span>المجموع:</span>
                <span className="font-mono">{(invoice.SubTotal || invoice.GrandTotal).toLocaleString('ar-DZ')} دج</span>
              </div>
              {invoice.Discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>الخصم:</span>
                  <span className="font-mono">-{invoice.Discount.toLocaleString('ar-DZ')} دج</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-black/20 pt-1 font-black">
                <span>الصافي للإدفاع:</span>
                <span className="font-mono">{invoice.GrandTotal.toLocaleString('ar-DZ')} دج</span>
              </div>
              <div className="flex justify-between text-[11px] font-normal pt-0.5">
                <span>المدفوع:</span>
                <span className="font-mono">{(invoice.PaidAmount !== undefined ? invoice.PaidAmount : invoice.GrandTotal).toLocaleString('ar-DZ')} دج</span>
              </div>
              {(invoice.RemainingAmount > 0) && (
                <div className="flex justify-between text-[11px] text-red-700 font-bold">
                  <span>المتبقي (دين):</span>
                  <span className="font-mono">{invoice.RemainingAmount.toLocaleString('ar-DZ')} دج</span>
                </div>
              )}
            </div>

            <div className="text-center text-[10px] text-gray-500 pt-1 font-bold">
              شكرًا لزيارتكم! نرجو لكم يوماً سعيداً.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
          >
            إغلاق
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الفاتورة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
