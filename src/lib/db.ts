import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

let db: Database | null = null;

export interface AppDirectories {
  rootDir: string;
  databaseDir: string;
  backupsDir: string;
  logsDir: string;
  invoicesDir: string;
}

export function getAppDirectories(): AppDirectories {
  const userAppData = process.env.APPDATA || process.env.LOCALAPPDATA;
  const rootDir = userAppData 
    ? path.join(userAppData, 'MizanDZ')
    : path.join(process.cwd(), 'data');

  const databaseDir = path.join(rootDir, 'database');
  const backupsDir = path.join(rootDir, 'backups');
  const logsDir = path.join(rootDir, 'logs');
  const invoicesDir = path.join(rootDir, 'invoices');

  [rootDir, databaseDir, backupsDir, logsDir, invoicesDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return { rootDir, databaseDir, backupsDir, logsDir, invoicesDir };
}

export function getDbPath(): string {
  if (process.env.MIZAN_DB_PATH) {
    return process.env.MIZAN_DB_PATH;
  }

  const { databaseDir, rootDir } = getAppDirectories();
  const targetDbPath = path.join(databaseDir, 'mizan_dz.sqlite');

  // Automatic Migration if database file exists at legacy path
  if (!fs.existsSync(targetDbPath)) {
    const legacyAppDirDbPath = path.join(rootDir, 'mizan_dz.sqlite');
    const legacyCwdDbPath = path.join(process.cwd(), 'mizan_dz.sqlite');

    if (fs.existsSync(legacyAppDirDbPath)) {
      try {
        fs.copyFileSync(legacyAppDirDbPath, targetDbPath);
      } catch (err) {
        console.error('Failed to migrate database from legacy appDir:', err);
      }
    } else if (fs.existsSync(legacyCwdDbPath)) {
      try {
        fs.copyFileSync(legacyCwdDbPath, targetDbPath);
      } catch (err) {
        console.error('Failed to migrate database from cwd:', err);
      }
    }
  }

  return targetDbPath;
}

export function getBackupsDir(): string {
  return getAppDirectories().backupsDir;
}

export function getLogsDir(): string {
  return getAppDirectories().logsDir;
}

export function getInvoicesDir(): string {
  return getAppDirectories().invoicesDir;
}

export async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.env.MIZAN_RESOURCE_DIR || path.join(process.cwd(), 'node_modules', 'sql.js', 'dist'), file)
  });
  const DB_FILE = getDbPath();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
    // Ensure migration table exists and run pending migrations on existing database
    runMigrations(db);
  } else {
    db = new SQL.Database();
    initSchema(db);
    runMigrations(db);
    saveDb();
  }

  return db;
}

export function saveDb(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dbPath = getDbPath();
    const tmpPath = `${dbPath}.tmp`;

    // Atomic write pattern: Write to temporary file first, then atomically rename
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, dbPath);
  } catch (err) {
    console.error('Failed atomic saveDb, attempting fallback direct write:', err);
    try {
      const data = db.export();
      fs.writeFileSync(getDbPath(), Buffer.from(data));
    } catch (fallbackErr) {
      console.error('Critical: saveDb failed completely:', fallbackErr);
    }
  }
}

export async function reloadDbFromFile(buffer: Buffer): Promise<void> {
  // 1. Create a safety backup of current database BEFORE restoring
  if (db) {
    try {
      createBackupCopy();
    } catch (e) {
      console.warn('Safety backup before restore warning:', e);
    }
  }

  // 2. Validate the uploaded database buffer
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.env.MIZAN_RESOURCE_DIR || path.join(process.cwd(), 'node_modules', 'sql.js', 'dist'), file)
  });
  let testDb: Database | null = null;
  try {
    testDb = new SQL.Database(buffer);
    // Verify required core tables exist
    const res = testDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='AppMetadata'");
    if (!res || res.length === 0) {
      throw new Error('ملف قاعدة البيانات المسترجع غير صالح أو تنقصه الجداول الأساسية (AppMetadata missing)');
    }
  } catch (err: any) {
    if (testDb) testDb.close();
    throw new Error('الملف المحدد ليس قاعدة بيانات SQLite صالحة: ' + err.message);
  }

  // 3. Apply restored database
  db = testDb;
  runMigrations(db);
  saveDb();
}

export function createBackupCopy(): string {
  saveDb();
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return '';

  const backupsDir = getBackupsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFilename = `MizanDZ-${timestamp}.sqlite`;
  const backupFilePath = path.join(backupsDir, backupFilename);

  fs.copyFileSync(dbPath, backupFilePath);
  return backupFilename;
}

function runMigrations(database: Database): void {
  database.run(`PRAGMA foreign_keys = ON;`);

  database.run(`
    CREATE TABLE IF NOT EXISTS DatabaseMigrations (
      Version INTEGER PRIMARY KEY,
      Name TEXT NOT NULL,
      AppliedAt TEXT NOT NULL
    );
  `);

  const appliedVersionsRes = database.exec(`SELECT Version FROM DatabaseMigrations`);
  const appliedVersions = new Set<number>();
  if (appliedVersionsRes.length > 0) {
    appliedVersionsRes[0].values.forEach((row) => appliedVersions.add(Number(row[0])));
  }

  const now = new Date().toISOString();

  const migrations = [
    {
      version: 1,
      name: '001_initial_schema_indexes',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON Products(Barcode);
        CREATE INDEX IF NOT EXISTS idx_products_name ON Products(Name);
        CREATE INDEX IF NOT EXISTS idx_sales_invoice ON Sales(InvoiceNumber);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON StockMovements(ProductId);
      `
    },
    {
      version: 2,
      name: '002_rbac_permissions',
      sql: `
        INSERT OR IGNORE INTO Roles (Id, Name, Description) VALUES
        ('role-admin', 'Admin', 'مدير النظام بصلحيات كاملة'),
        ('role-cashier', 'Cashier', 'بائع كاشير للصندوق والمبيعات'),
        ('role-warehouse', 'Warehouse', 'أمين المخزن والمشتريات'),
        ('role-accountant', 'Accountant', 'محاسب التقارير والمصاريف');
      `
    },
    {
      version: 3,
      name: '003_audit_log_index',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON AuditLogs(UserId);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON AuditLogs(Timestamp);
      `
    },
    {
      version: 4,
      name: '004_customer_sales_indexes',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_sales_customer ON Sales(CustomerId);
        CREATE INDEX IF NOT EXISTS idx_customers_phone ON Customers(Phone);
      `
    }
  ];

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      try {
        database.run(migration.sql);
        database.run(
          `INSERT INTO DatabaseMigrations (Version, Name, AppliedAt) VALUES (?, ?, ?)`,
          [migration.version, migration.name, now]
        );
      } catch (err) {
        console.error(`Migration ${migration.version} (${migration.name}) failed:`, err);
      }
    }
  }
}

function initSchema(database: Database): void {
  database.run(`PRAGMA foreign_keys = ON;`);

  // 1. AppMetadata & Settings
  database.run(`
    CREATE TABLE IF NOT EXISTS AppMetadata (
      Key TEXT PRIMARY KEY,
      Value TEXT NOT NULL,
      UpdatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Settings (
      Key TEXT PRIMARY KEY,
      Value TEXT NOT NULL,
      Description TEXT
    );
  `);

  // 2. Users, Roles & Permissions
  database.run(`
    CREATE TABLE IF NOT EXISTS Roles (
      Id TEXT PRIMARY KEY,
      Name TEXT NOT NULL UNIQUE,
      Description TEXT
    );

    CREATE TABLE IF NOT EXISTS Permissions (
      Id TEXT PRIMARY KEY,
      RoleId TEXT NOT NULL,
      PermissionName TEXT NOT NULL,
      FOREIGN KEY(RoleId) REFERENCES Roles(Id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Users (
      Id TEXT PRIMARY KEY,
      Username TEXT NOT NULL UNIQUE,
      FullName TEXT NOT NULL,
      PasswordHash TEXT NOT NULL,
      Role TEXT NOT NULL,
      IsActive INTEGER NOT NULL DEFAULT 1,
      CreatedAt TEXT NOT NULL
    );
  `);

  // 3. Categories & Brands
  database.run(`
    CREATE TABLE IF NOT EXISTS Categories (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL UNIQUE,
      Description TEXT,
      Icon TEXT,
      IsActive INTEGER NOT NULL DEFAULT 1,
      CreatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Brands (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL UNIQUE
    );
  `);

  // 4. Customers & Suppliers
  database.run(`
    CREATE TABLE IF NOT EXISTS Customers (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL,
      Phone TEXT,
      Address TEXT,
      DebtLimit REAL DEFAULT 50000,
      Balance REAL DEFAULT 0,
      Notes TEXT,
      CreatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Suppliers (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL,
      Phone TEXT,
      Address TEXT,
      Balance REAL DEFAULT 0,
      Notes TEXT,
      CreatedAt TEXT NOT NULL
    );
  `);

  // 5. Products
  database.run(`
    CREATE TABLE IF NOT EXISTS Products (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Barcode TEXT NOT NULL UNIQUE,
      Name TEXT NOT NULL,
      Description TEXT,
      CategoryId INTEGER NOT NULL,
      BrandId INTEGER,
      SupplierId INTEGER,
      PurchasePrice REAL NOT NULL,
      SalePrice REAL NOT NULL,
      WholesalePrice REAL DEFAULT 0,
      Quantity INTEGER NOT NULL DEFAULT 0,
      MinQuantity INTEGER NOT NULL DEFAULT 5,
      Unit TEXT DEFAULT 'قطع',
      Tax REAL DEFAULT 0,
      ExpiryDate TEXT,
      IsActive INTEGER NOT NULL DEFAULT 1,
      IsDeleted INTEGER NOT NULL DEFAULT 0,
      CreatedAt TEXT NOT NULL,
      UpdatedAt TEXT NOT NULL,
      FOREIGN KEY(CategoryId) REFERENCES Categories(Id),
      FOREIGN KEY(BrandId) REFERENCES Brands(Id),
      FOREIGN KEY(SupplierId) REFERENCES Suppliers(Id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_barcode ON Products(Barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name ON Products(Name);
    CREATE INDEX IF NOT EXISTS idx_products_category ON Products(CategoryId);
  `);

  // 6. Stock Movements
  database.run(`
    CREATE TABLE IF NOT EXISTS StockMovements (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      ProductId INTEGER NOT NULL,
      MovementType TEXT NOT NULL, -- OpeningStock, Purchase, Sale, SaleReturn, PurchaseReturn, StockAdjustment, ManualAdjustment
      Quantity INTEGER NOT NULL,
      PreviousQuantity INTEGER NOT NULL,
      NewQuantity INTEGER NOT NULL,
      ReferenceType TEXT,
      ReferenceId INTEGER,
      UserId TEXT NOT NULL,
      Date TEXT NOT NULL,
      Notes TEXT,
      FOREIGN KEY(ProductId) REFERENCES Products(Id)
    );

    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON StockMovements(ProductId);
  `);

  // 7. Sales & SaleItems
  database.run(`
    CREATE TABLE IF NOT EXISTS Sales (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      InvoiceNumber TEXT NOT NULL UNIQUE,
      CustomerId INTEGER,
      UserId TEXT NOT NULL,
      SubTotal REAL NOT NULL,
      Discount REAL NOT NULL DEFAULT 0,
      TotalTax REAL NOT NULL DEFAULT 0,
      GrandTotal REAL NOT NULL,
      PaidAmount REAL NOT NULL,
      RemainingAmount REAL NOT NULL DEFAULT 0,
      PaymentMethod TEXT NOT NULL, -- Cash, Card, Debt, Mixed
      Status TEXT NOT NULL DEFAULT 'Completed',
      Notes TEXT,
      CreatedAt TEXT NOT NULL,
      FOREIGN KEY(CustomerId) REFERENCES Customers(Id)
    );

    CREATE TABLE IF NOT EXISTS SaleItems (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      SaleId INTEGER NOT NULL,
      ProductId INTEGER NOT NULL,
      ProductName TEXT NOT NULL,
      UnitPrice REAL NOT NULL,
      CostPrice REAL NOT NULL,
      Quantity INTEGER NOT NULL,
      Discount REAL DEFAULT 0,
      TotalPrice REAL NOT NULL,
      FOREIGN KEY(SaleId) REFERENCES Sales(Id) ON DELETE CASCADE,
      FOREIGN KEY(ProductId) REFERENCES Products(Id)
    );

    CREATE INDEX IF NOT EXISTS idx_sales_invoice ON Sales(InvoiceNumber);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON Sales(CustomerId);

    CREATE TABLE IF NOT EXISTS CustomerPayments (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      CustomerId INTEGER NOT NULL,
      Amount REAL NOT NULL,
      PaymentMethod TEXT DEFAULT 'Cash',
      UserId TEXT NOT NULL,
      Notes TEXT,
      CreatedAt TEXT NOT NULL,
      FOREIGN KEY(CustomerId) REFERENCES Customers(Id)
    );

    CREATE TABLE IF NOT EXISTS SuspendedSales (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      CustomerId INTEGER DEFAULT 1,
      UserId TEXT NOT NULL,
      Notes TEXT,
      CreatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS SuspendedSaleItems (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      SuspendedSaleId INTEGER NOT NULL,
      ProductId INTEGER NOT NULL,
      ProductName TEXT NOT NULL,
      UnitPrice REAL NOT NULL,
      CostPrice REAL NOT NULL,
      Quantity INTEGER NOT NULL,
      FOREIGN KEY(SuspendedSaleId) REFERENCES SuspendedSales(Id) ON DELETE CASCADE
    );
  `);

  // 8. Purchases & PurchaseItems
  database.run(`
    CREATE TABLE IF NOT EXISTS Purchases (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      InvoiceNumber TEXT NOT NULL UNIQUE,
      SupplierId INTEGER NOT NULL,
      UserId TEXT NOT NULL,
      TotalAmount REAL NOT NULL,
      PaidAmount REAL NOT NULL,
      RemainingAmount REAL NOT NULL DEFAULT 0,
      PaymentStatus TEXT NOT NULL DEFAULT 'Paid',
      Notes TEXT,
      CreatedAt TEXT NOT NULL,
      FOREIGN KEY(SupplierId) REFERENCES Suppliers(Id)
    );

    CREATE TABLE IF NOT EXISTS PurchaseItems (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      PurchaseId INTEGER NOT NULL,
      ProductId INTEGER NOT NULL,
      ProductName TEXT NOT NULL,
      UnitCost REAL NOT NULL,
      Quantity INTEGER NOT NULL,
      TotalCost REAL NOT NULL,
      FOREIGN KEY(PurchaseId) REFERENCES Purchases(Id) ON DELETE CASCADE,
      FOREIGN KEY(ProductId) REFERENCES Products(Id)
    );

    CREATE TABLE IF NOT EXISTS SupplierPayments (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      SupplierId INTEGER NOT NULL,
      Amount REAL NOT NULL,
      PaymentMethod TEXT DEFAULT 'Cash',
      UserId TEXT NOT NULL,
      Notes TEXT,
      CreatedAt TEXT NOT NULL,
      FOREIGN KEY(SupplierId) REFERENCES Suppliers(Id)
    );
  `);

  // 9. Expense Categories & Expenses
  database.run(`
    CREATE TABLE IF NOT EXISTS ExpenseCategories (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL UNIQUE,
      Description TEXT
    );

    CREATE TABLE IF NOT EXISTS Expenses (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      CategoryId INTEGER NOT NULL,
      Title TEXT NOT NULL,
      Amount REAL NOT NULL,
      UserId TEXT NOT NULL,
      ExpenseDate TEXT NOT NULL,
      Notes TEXT,
      FOREIGN KEY(CategoryId) REFERENCES ExpenseCategories(Id)
    );
  `);

  // 10. Audit Logs
  database.run(`
    CREATE TABLE IF NOT EXISTS AuditLogs (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      UserId TEXT NOT NULL,
      Action TEXT NOT NULL,
      EntityName TEXT NOT NULL,
      EntityId TEXT,
      Details TEXT,
      Timestamp TEXT NOT NULL
    );
  `);

  seedProductionCleanData(database);
}

/**
  CLEAN PRODUCTION DATABASE BASELINE:
  - NO demo products
  - NO demo sales
  - NO demo customers (except default cash customer if needed)
  - NO demo suppliers
  - NO demo expenses
  - NO fake statistics
  Only essential system metadata and default roles/categories.
*/
function seedProductionCleanData(database: Database): void {
  const now = new Date().toISOString();

  // App Metadata - Setup is incomplete until First-Time Setup wizard completes
  database.run(`
    INSERT INTO AppMetadata (Key, Value, UpdatedAt) VALUES
    ('AppName', 'Mizan DZ — ميزان', '${now}'),
    ('Version', '1.0.0', '${now}'),
    ('Currency', 'DZD', '${now}'),
    ('IsSetupCompleted', 'false', '${now}');
  `);

  // Default Settings placeholders
  database.run(`
    INSERT INTO Settings (Key, Value, Description) VALUES
    ('ShopName', '', 'اسم المحل'),
    ('ShopAddress', '', 'عنوان المحل'),
    ('ShopPhone', '', 'رقم الهاتف'),
    ('ShopLogo', '', 'شعار المحل'),
    ('InvoicePrefix', 'INV-', 'نمط رقم الفاتورة'),
    ('PrinterType', 'Thermal 80mm', 'نوع الطابعة'),
    ('LowStockThreshold', '5', 'حد التنبيه بنفاد الكمية'),
    ('AutoBackup', 'true', 'التسجيل التلقائي للنسخ الاحتياطي'),
    ('Language', 'ar', 'لغة التطبيق الأساسية');
  `);

  // System Roles
  database.run(`
    INSERT INTO Roles (Id, Name, Description) VALUES
    ('role-admin', 'Admin', 'مدير النظام بصلحيات كاملة'),
    ('role-cashier', 'Cashier', 'بائع كاشير للصندوق والمبيعات'),
    ('role-warehouse', 'Warehouse', 'أمين المخزن والمشتريات'),
    ('role-accountant', 'Accountant', 'محاسب التقارير والمصاريف');
  `);

  // Basic Standard Expense Categories
  database.run(`
    INSERT INTO ExpenseCategories (Name, Description) VALUES
    ('كراء المحل', 'مصاريف إيجار المحل التجاري'),
    ('كهرباء وماء', 'سونلغاز وشركة المياه'),
    ('نقل وشحن', 'مصاريف نقل السلع والمنتجات'),
    ('رواتب العمال', 'أجور العمال والباعة'),
    ('صيانة وإصلاح', 'صيانة العتاد والتجهيزات'),
    ('مصاريف أخرى', 'نثريات ومصاريف عامة');
  `);

  // Basic Standard Category Defaults for convenience
  database.run(`
    INSERT INTO Categories (Name, Description, Icon, IsActive, CreatedAt) VALUES
    ('عام', 'تصنيف عام للمنتجات', 'Box', 1, '${now}'),
    ('مواد غذائية', 'أغذية ومواد استهلاكية', 'ShoppingBag', 1, '${now}'),
    ('مشروبات', 'عصائر ومياه ومشروبات', 'Coffee', 1, '${now}'),
    ('منظفات', 'مستحضرات تنظيف وعناية', 'Sparkles', 1, '${now}');
  `);

  // Default Cash Customer (زبون عادي)
  database.run(`
    INSERT INTO Customers (Name, Phone, Address, DebtLimit, Balance, Notes, CreatedAt) VALUES
    ('زبون عادي (نقدي)', '0000000000', '', 0, 0, 'الزبون الافتراضي للمبيعات النقدية', '${now}');
  `);

  // Audit Log
  database.run(`
    INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp) VALUES
    ('system', 'SYSTEM_INSTALLED', 'Database', 'mizan_dz.sqlite', 'تم تثبيت قاعدة بيانات نظام ميزان النظيفة في انتظار الإعداد الأول', '${now}');
  `);
}

/**
  Development Optional Demo Seeder:
  Can be triggered explicitly via /api/setup/seed-demo for testing purposes.
*/
export function seedDemoDataForDev(database: Database): void {
  const now = new Date().toISOString();

  database.run(`
    INSERT INTO Suppliers (Name, Phone, Address, Balance, Notes, CreatedAt) VALUES
    ('شركة الموزع الوطني الجزائر', '021 44 55 66', 'الرويبة، الجزائر', 0, 'مورد معتمد للزيوت والمواد الغذائية', '${now}'),
    ('مؤسسة ملبنة العاصمة', '023 88 99 00', 'بئر توتة، الجزائر', 0, 'مورد الألبان والحليب', '${now}');

    INSERT INTO Customers (Name, Phone, Address, DebtLimit, Balance, Notes, CreatedAt) VALUES
    ('محمد بن علي', '0661 12 34 56', 'حي السلام، الجزائر', 20000, 12500, 'زبون وفير — عليه دين 12,500 دج', '${now}'),
    ('كريم بلحسن', '0770 98 76 54', 'شارع الحرية', 15000, 4200, 'دين سابق 4,200 دج', '${now}');

    INSERT INTO Products 
    (Barcode, Name, Description, CategoryId, BrandId, SupplierId, PurchasePrice, SalePrice, WholesalePrice, Quantity, MinQuantity, Unit, Tax, ExpiryDate, IsActive, IsDeleted, CreatedAt, UpdatedAt) VALUES
    ('613000000001', 'حليب الملبنة 1 لتر', 'حليب مبستر 1L', 3, NULL, 2, 22.0, 25.0, 24.0, 45, 10, 'كيس', 0, '2026-08-20', 1, 0, '${now}', '${now}'),
    ('613000000002', 'زيت سفينة 5 لتر', 'زيت نباتي صافي 5L', 2, NULL, 1, 600.0, 650.0, 630.0, 18, 5, 'قارورة', 0, '2027-01-01', 1, 0, '${now}', '${now}'),
    ('613000000003', 'سكر أبيض 1 كغ', 'سكر رفيع 1kg', 2, NULL, 1, 85.0, 95.0, 90.0, 120, 20, 'كيس', 0, '2028-06-01', 1, 0, '${now}', '${now}');
  `);

  saveDb();
}
