import React, { useState } from 'react';
import { Database, Download, Upload, AlertTriangle, CheckCircle2, X, RefreshCw } from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    const link = document.createElement('a');
    link.href = '/api/backup/download';
    link.download = `MizanBackup_${new Date().toISOString().substring(0, 10)}.sqlite`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setStatus('✅ تم تحميل ملف قاعدة البيانات (MizanBackup.sqlite) بنجاح.');
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('هل أنت متأكد من استعادة هذه النسخة؟ سيتم استبدال قاعدة البيانات الحالية بهذه النسخة!')) {
      return;
    }

    setLoading(true);
    setStatus('جاري استعادة البيانات...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result as string;
        const base64Data = result.split(',')[1] || result;

        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64Data })
        });

        const data = await res.json();
        if (res.ok) {
          setStatus('✅ تم استعادة قاعدة البيانات بنجاح! جاري إعادة تحميل التطبيق...');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setStatus('❌ فشلت الاستعادة: ' + (data.error || 'ملف غير صالح'));
        }
      } catch (err: any) {
        setStatus('❌ حدث خطأ أثناء قراءة الملف: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 dir-rtl" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-400" />
            <span>النسخ الاحتياطي واستعادة البيانات (SQLite)</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {status && (
          <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 p-3 rounded-xl text-xs font-semibold">
            {status}
          </div>
        )}

        <div className="space-y-4 text-xs text-slate-300">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-white text-sm">حفظ نسخة احتياطية فورية (Backup)</h4>
            <p className="text-slate-400">
              قم بتنزيل ملف قاعدة البيانات الكلية (SQLite) الذي يشمل جميع الفواتير، المنتجات، المبيعات، المصاريف، وديون الزبائن.
            </p>
            <button
              onClick={handleDownloadBackup}
              disabled={loading}
              className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تنزيل نسخة احتياطية الان (MizanBackup.sqlite)</span>
            </button>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-white text-sm">استعادة نسخة سابقة (Restore)</h4>
            <div className="flex items-center gap-2 text-amber-400 font-bold bg-amber-950/40 p-2.5 rounded-xl border border-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>تنبيه: استعادة النسخة سيقوم باستبدال قاعدة البيانات الحالية!</span>
            </div>

            <label className="w-full mt-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer border border-slate-700">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> : <Upload className="w-4 h-4 text-amber-400" />}
              <span>اختر ملف النسخة الاحتياطية (.sqlite)</span>
              <input
                type="file"
                accept=".sqlite,.db"
                onChange={handleRestoreBackup}
                disabled={loading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
