import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Server, ShieldAlert } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Mizan DZ:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans dir-rtl select-none"
          dir="rtl"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 text-right">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
              <div className="w-14 h-14 rounded-2xl bg-red-950/80 border border-red-800/80 flex items-center justify-center text-red-400 shrink-0 shadow-lg">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white">حدث خطأ في تشغيل النظام</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Mizan DZ — تعذر تحميل واجهة النظام أو الاتصال بقاعدة البيانات
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 text-xs font-mono space-y-2 overflow-auto max-h-48 text-red-300">
              <div className="flex items-center gap-2 text-slate-400 font-bold border-b border-slate-800/80 pb-2 mb-2 font-sans">
                <Server className="w-4 h-4 text-emerald-400" />
                <span>تفاصيل الخطأ التقنية (Technical Error Info):</span>
              </div>
              <p className="font-bold break-all">{this.state.error?.toString() || 'خطأ غير معروف في واجهة المكونات'}</p>
              {this.state.errorInfo && (
                <pre className="text-[10px] text-slate-500 whitespace-pre-wrap leading-relaxed mt-2">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة المحاولة (Retry)</span>
              </button>

              <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                <span>جميع بيانات SQLite محفوظة بأمان في %APPDATA%/MizanDZ/</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
