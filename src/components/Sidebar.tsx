import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  Tags,
  Boxes,
  Truck,
  Users,
  Building2,
  Receipt,
  Wallet,
  BarChart3,
  Bot,
  Settings,
  LogOut
} from 'lucide-react';
import { User } from '../types';

export type NavTab = 
  | 'dashboard' 
  | 'pos' 
  | 'invoices' 
  | 'products' 
  | 'categories' 
  | 'inventory' 
  | 'purchases' 
  | 'customers' 
  | 'suppliers' 
  | 'expenses' 
  | 'debts' 
  | 'reports' 
  | 'ai' 
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  currentUser: User | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, currentUser, onLogout }) => {
  const role = currentUser?.role || 'Admin';

  const navItems = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard, roles: ['Admin', 'Accountant'] },
    { id: 'pos', label: 'البيع (POS)', icon: ShoppingCart, roles: ['Admin', 'Cashier'], highlight: true },
    { id: 'invoices', label: 'الفواتير', icon: FileText, roles: ['Admin', 'Cashier', 'Accountant'] },
    { id: 'products', label: 'المنتجات', icon: Package, roles: ['Admin', 'Warehouse'] },
    { id: 'categories', label: 'التصنيفات', icon: Tags, roles: ['Admin', 'Warehouse'] },
    { id: 'inventory', label: 'المخزون والجرد', icon: Boxes, roles: ['Admin', 'Warehouse'] },
    { id: 'purchases', label: 'المشتريات', icon: Truck, roles: ['Admin', 'Warehouse'] },
    { id: 'customers', label: 'الزبائن', icon: Users, roles: ['Admin', 'Cashier', 'Accountant'] },
    { id: 'suppliers', label: 'الموردون', icon: Building2, roles: ['Admin', 'Warehouse', 'Accountant'] },
    { id: 'expenses', label: 'المصاريف', icon: Receipt, roles: ['Admin', 'Accountant'] },
    { id: 'debts', label: 'متابعة الديون', icon: Wallet, roles: ['Admin', 'Accountant'] },
    { id: 'reports', label: 'التقارير والأرباح', icon: BarChart3, roles: ['Admin', 'Accountant'] },
    { id: 'ai', label: 'المساعد الذكي 🤖', icon: Bot, roles: ['Admin', 'Cashier', 'Warehouse', 'Accountant'], badge: 'جديد' },
    { id: 'settings', label: 'الإعدادات', icon: Settings, roles: ['Admin'] },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-l border-slate-800 flex flex-col justify-between shrink-0 h-[calc(100vh-33px)] text-slate-300">
      {/* Top Header Logo in Sidebar */}
      <div>
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-950/50">
            مـ
          </div>
          <div>
            <h1 className="font-bold text-white text-base tracking-wide leading-tight">ميزان Mizan DZ</h1>
            <p className="text-[11px] text-emerald-400 font-medium">إدارة المحلات التجارية</p>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-160px)]">
          {navItems.map((item) => {
            const hasAccess = item.roles.includes(role);
            if (!hasAccess) return null;

            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as NavTab)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 font-bold'
                    : item.highlight
                    ? 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40 border border-emerald-800/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Footer & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between bg-slate-800/70 p-2 rounded-lg border border-slate-700/60">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-emerald-400 shrink-0 text-xs">
              {currentUser?.fullName.charAt(0) || 'أ'}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">{currentUser?.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser?.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-md transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
