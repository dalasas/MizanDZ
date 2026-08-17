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

export interface Category {
  Id: number;
  Name: string;
  Description?: string;
  Icon?: string;
  IsActive: number;
  CreatedAt: string;
  ProductCount?: number;
}

export interface Product {
  Id: number;
  Barcode: string;
  Name: string;
  Description?: string;
  CategoryId: number;
  CategoryName?: string;
  BrandId?: number;
  SupplierId?: number;
  PurchasePrice: number;
  SalePrice: number;
  WholesalePrice: number;
  Quantity: number;
  MinQuantity: number;
  Unit: string;
  Tax: number;
  ExpiryDate?: string;
  IsActive: number;
  IsDeleted: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface Customer {
  Id: number;
  Name: string;
  Phone?: string;
  Address?: string;
  DebtLimit: number;
  Balance: number;
  Notes?: string;
  CreatedAt: string;
}

export interface Supplier {
  Id: number;
  Name: string;
  Phone?: string;
  Address?: string;
  Balance: number;
  Notes?: string;
  CreatedAt: string;
}

export interface SaleItem {
  id: number;
  barcode: string;
  name: string;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  totalPrice: number;
  unit: string;
}

export interface SaleInvoice {
  Id: number;
  InvoiceNumber: string;
  CustomerId?: number;
  CustomerName?: string;
  CustomerPhone?: string;
  CustomerAddress?: string;
  UserId: string;
  SubTotal: number;
  Discount: number;
  GrandTotal: number;
  PaidAmount: number;
  RemainingAmount: number;
  PaymentMethod: string;
  Status: string;
  Notes?: string;
  CreatedAt: string;
  Items?: SaleItem[];
  items?: SaleItem[];
}

export interface DashboardStats {
  todaySales: number;
  todayInvoiceCount: number;
  todayGrossProfit: number;
  todayExpenses: number;
  todayNetProfit: number;
  totalStockValue: number;
  totalProductsCount: number;
  totalCustomerDebts: number;
  lowStockProducts: Product[];
  recentSales: SaleInvoice[];
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'Admin' | 'Cashier' | 'Warehouse' | 'Accountant';
}
