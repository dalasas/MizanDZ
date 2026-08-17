import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { getDb, saveDb, seedDemoDataForDev, getDbPath, getBackupsDir, reloadDbFromFile, createBackupCopy, getAppDirectories } from './src/lib/db';
import { processLocalAIQuery } from './src/lib/ai';

function hashPassword(password: string, salt?: string): string {
  if (!password) return '';
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return `scrypt:${actualSalt}:${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const [, salt, originalHex] = parts;
    const computedHex = crypto.scryptSync(password, salt, 64).toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(computedHex), Buffer.from(originalHex));
    } catch {
      return false;
    }
  }
  // Legacy SHA-256 or plaintext migration verification
  const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
  return storedHash === sha256Hash || storedHash === password;
}

// Role Permissions Map
const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: ['*'],
  Cashier: [
    'pos:use',
    'sales:read',
    'sales:create',
    'sales:refund',
    'products:read',
    'customers:read',
    'invoices:read',
    'setup:status'
  ],
  Warehouse: [
    'products:*',
    'categories:*',
    'stock:*',
    'purchases:*',
    'suppliers:*',
    'setup:status'
  ],
  Accountant: [
    'expenses:*',
    'debts:*',
    'reports:*',
    'customers:read',
    'suppliers:read',
    'sales:read',
    'purchases:read',
    'setup:status'
  ]
};

function checkRoleHasPermission(role: string, requiredPermission: string): boolean {
  if (!role) return false;
  const normalizedRole = role.charAt(0).toUpperCase() + role.slice(1);
  const permissions = ROLE_PERMISSIONS[normalizedRole] || ROLE_PERMISSIONS[role] || [];
  if (permissions.includes('*')) return true;

  const [domain] = requiredPermission.split(':');
  if (permissions.includes(`${domain}:*`)) return true;

  return permissions.includes(requiredPermission);
}

// Idempotency cache for preventing double-submit checkout
const processedIdempotencyKeys = new Map<string, { result: any; timestamp: number }>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // CORS middleware for Local Desktop / Tauri / Webview compatibility
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('tauri'))) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-User-Role, X-User-Id, X-Idempotency-Key');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Permission Verification Middleware
  const requirePermission = (permission: string) => {
    return (req: any, res: any, next: any) => {
      const userRole = (req.headers['x-user-role'] as string) || (req.body?.userRole) || 'Admin';
      if (!checkRoleHasPermission(userRole, permission)) {
        return res.status(403).json({ error: `عذراً، دورك الحسابي (${userRole}) لا يمتلك الصلاحيات المطلوبة لهذه العملية (${permission})` });
      }
      next();
    };
  };

  // Helper SQL execution wrapper
  const runQuery = async (query: string, params: any[] = []) => {
    const db = await getDb();
    const stmt = db.prepare(query);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  };

  const executeNonQuery = async (query: string, params: any[] = []) => {
    const db = await getDb();
    db.run(query, params);
    saveDb();
  };

  // --- API ROUTES ---

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'Mizan DZ — ميزان', version: '1.0.0' });
  });

  // 1.1 System Directories and Status
  app.get('/api/system/info', (req, res) => {
    const dirs = getAppDirectories();
    const dbPath = getDbPath();
    res.json({
      app: 'Mizan DZ Desktop',
      platform: process.platform,
      dbPath,
      directories: dirs,
      dbExists: fs.existsSync(dbPath),
      dbSizeBytes: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
      tauriConfigured: fs.existsSync(path.join(process.cwd(), 'src-tauri', 'tauri.conf.json'))
    });
  });

  // 2. Setup Status & Completion API
  app.get('/api/setup/status', async (req, res) => {
    try {
      const meta = await runQuery(`SELECT Key, Value FROM AppMetadata`);
      const metaMap: Record<string, string> = {};
      meta.forEach((m) => { metaMap[m.Key] = m.Value; });

      const settings = await runQuery(`SELECT Key, Value FROM Settings`);
      const settingsMap: Record<string, string> = {};
      settings.forEach((s) => { settingsMap[s.Key] = s.Value; });

      const adminUsers = await runQuery(`SELECT Id, Username, FullName, Role FROM Users WHERE Role = 'Admin' AND IsActive = 1`);

      const isSetupCompleted = metaMap.IsSetupCompleted === 'true' && adminUsers.length > 0;

      res.json({
        isSetupCompleted,
        onboardingSkipped: metaMap.OnboardingSkipped === 'true',
        shopName: settingsMap.ShopName || 'متجري (Mizan DZ)',
        shopAddress: settingsMap.ShopAddress || '',
        shopPhone: settingsMap.ShopPhone || '',
        shopLogo: settingsMap.ShopLogo || '',
        wilaya: settingsMap.Wilaya || '',
        commune: settingsMap.Commune || '',
        currency: metaMap.Currency || 'DZD',
        language: settingsMap.Language || 'ar',
        printerType: settingsMap.PrinterType || 'Thermal 80mm',
        hasAdmin: adminUsers.length > 0
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Skip Setup Endpoint (Skip for now / تخطي الآن)
  app.post('/api/setup/skip', async (req, res) => {
    try {
      const now = new Date().toISOString();
      const db = await getDb();

      db.run('BEGIN TRANSACTION;');

      try {
        const defaultSettings = [
          ['ShopName', 'متجري (Mizan DZ)'],
          ['ShopAddress', ''],
          ['ShopPhone', ''],
          ['ShopLogo', ''],
          ['Wilaya', ''],
          ['Commune', ''],
          ['PrinterType', 'Thermal 80mm'],
          ['InvoicePrefix', 'INV-'],
          ['Language', 'ar'],
          ['AutoBackup', 'true']
        ];

        for (const [key, val] of defaultSettings) {
          db.run(`INSERT OR REPLACE INTO Settings (Key, Value) VALUES (?, ?)`, [key, val]);
        }

        db.run(`INSERT OR REPLACE INTO AppMetadata (Key, Value, UpdatedAt) VALUES ('IsSetupCompleted', 'false', ?)`, [now]);
        db.run(`INSERT OR REPLACE INTO AppMetadata (Key, Value, UpdatedAt) VALUES ('OnboardingSkipped', 'true', ?)`, [now]);
        db.run(`INSERT OR REPLACE INTO AppMetadata (Key, Value, UpdatedAt) VALUES ('Currency', 'DZD', ?)`, [now]);

        // Check if an existing admin or active user exists
        const existingAdmins = await runQuery(`SELECT Id, Username, FullName, Role FROM Users WHERE Role = 'Admin' AND IsActive = 1`);

        let sessionUser;
        if (existingAdmins.length > 0) {
          sessionUser = {
            id: existingAdmins[0].Id,
            username: existingAdmins[0].Username,
            fullName: existingAdmins[0].FullName,
            role: existingAdmins[0].Role
          };
        } else {
          // Unassigned temporary session user without hardcoding default plaintext credentials
          sessionUser = {
            id: 'usr-temp-operator',
            username: 'operator',
            fullName: 'مُشغّل النظام (وضع التخطي)',
            role: 'Admin'
          };
        }

        db.run(`
          INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
          VALUES (?, 'ONBOARDING_SKIPPED', 'System', 'mizan_dz.sqlite', 'تم تخطي معالج الإعداد والدخول المباشر لوضع التخطي المؤقت', ?)
        `, [sessionUser.id, now]);

        db.run('COMMIT;');
        saveDb();

        res.json({
          success: true,
          message: 'تم تخطي معالج الإعداد والتوجيه إلى التطبيق',
          user: sessionUser,
          onboardingSkipped: true,
          isSetupCompleted: false
        });
      } catch (err) {
        db.run('ROLLBACK;');
        throw err;
      }
    } catch (err: any) {
      res.status(500).json({ error: 'فشل التخطي: ' + err.message });
    }
  });

  app.post('/api/setup/complete', async (req, res) => {
    const {
      shopName,
      shopAddress,
      shopPhone,
      shopLogo,
      wilaya,
      commune,
      currency,
      language,
      adminUsername,
      adminPassword,
      printerType,
      autoBackup
    } = req.body;

    const finalShopName = shopName?.trim() || 'متجري (Mizan DZ)';
    const finalAdminUser = adminUsername?.trim() || 'admin';
    const finalAdminPass = adminPassword || '';

    if (!finalAdminPass || finalAdminPass.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تتكون من 8 أحرف أو أرقام على الأقل' });
    }

    try {
      const now = new Date().toISOString();
      const db = await getDb();

      db.run('BEGIN TRANSACTION;');

      try {
        // Update Settings
        const settingsToSave = [
          ['ShopName', finalShopName],
          ['ShopAddress', shopAddress || ''],
          ['ShopPhone', shopPhone || ''],
          ['ShopLogo', shopLogo || ''],
          ['Wilaya', wilaya || ''],
          ['Commune', commune || ''],
          ['PrinterType', printerType || 'Thermal 80mm'],
          ['Language', language || 'ar'],
          ['AutoBackup', autoBackup ? 'true' : 'false']
        ];

        for (const [key, val] of settingsToSave) {
          db.run(`INSERT OR REPLACE INTO Settings (Key, Value) VALUES (?, ?)`, [key, val]);
        }

        // Update Metadata
        db.run(`INSERT OR REPLACE INTO AppMetadata (Key, Value, UpdatedAt) VALUES ('IsSetupCompleted', 'true', ?)`, [now]);
        db.run(`INSERT OR REPLACE INTO AppMetadata (Key, Value, UpdatedAt) VALUES ('OnboardingSkipped', 'false', ?)`, [now]);
        db.run(`INSERT OR REPLACE INTO AppMetadata (Key, Value, UpdatedAt) VALUES ('Currency', ?, ?)`, [currency || 'DZD', now]);

        // Create Admin User
        const adminId = 'usr-admin';
        const hashedAdminPass = hashPassword(finalAdminPass);
        db.run(`
          INSERT OR REPLACE INTO Users (Id, Username, FullName, PasswordHash, Role, IsActive, CreatedAt)
          VALUES (?, ?, ?, ?, 'Admin', 1, ?)
        `, [adminId, finalAdminUser, 'مدير المحل (Admin)', hashedAdminPass, now]);

        // Audit Log
        db.run(`
          INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
          VALUES (?, 'SETUP_COMPLETED', 'System', 'mizan_dz.sqlite', 'تم إكمال معالج الإعداد الأول لميزان DZ بنجاح', ?)
        `, [adminId, now]);

        db.run('COMMIT;');
        saveDb();

        res.json({
          success: true,
          message: 'تم إعداد Mizan DZ بنجاح',
          user: {
            id: adminId,
            username: finalAdminUser,
            fullName: 'مدير المحل (Admin)',
            role: 'Admin'
          }
        });
      } catch (err) {
        db.run('ROLLBACK;');
        throw err;
      }
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إكمال الإعداد: ' + err.message });
    }
  });

  // Optional Developer Reset API to test First-Time Setup anytime
  app.post('/api/setup/reset', async (req, res) => {
    let databaseInstance: any = null;
    try {
      databaseInstance = await getDb();
      const now = new Date().toISOString();

      databaseInstance.run(`PRAGMA foreign_keys = OFF;`);
      databaseInstance.run('BEGIN TRANSACTION;');
      databaseInstance.run(`DELETE FROM SaleItems;`);
      databaseInstance.run(`DELETE FROM Sales;`);
      databaseInstance.run(`DELETE FROM SuspendedSaleItems;`);
      databaseInstance.run(`DELETE FROM SuspendedSales;`);
      databaseInstance.run(`DELETE FROM PurchaseItems;`);
      databaseInstance.run(`DELETE FROM Purchases;`);
      databaseInstance.run(`DELETE FROM StockMovements;`);
      databaseInstance.run(`DELETE FROM Products;`);
      databaseInstance.run(`DELETE FROM Expenses;`);
      databaseInstance.run(`DELETE FROM CustomerPayments;`);
      databaseInstance.run(`DELETE FROM Customers WHERE Id > 1;`); // Keep default cash customer
      databaseInstance.run(`UPDATE Customers SET Balance = 0 WHERE Id = 1;`);
      databaseInstance.run(`DELETE FROM SupplierPayments;`);
      databaseInstance.run(`DELETE FROM Suppliers;`);
      databaseInstance.run(`DELETE FROM Users;`);
      databaseInstance.run(`DELETE FROM AuditLogs;`);
      databaseInstance.run(`INSERT OR REPLACE INTO AppMetadata (Key, Value, UpdatedAt) VALUES ('IsSetupCompleted', 'false', ?)`, [now]);
      databaseInstance.run(`UPDATE Settings SET Value = '' WHERE Key IN ('ShopName', 'ShopAddress', 'ShopPhone', 'ShopLogo');`);
      databaseInstance.run('COMMIT;');
      databaseInstance.run(`PRAGMA foreign_keys = ON;`);

      saveDb();
      res.json({ success: true, message: 'تم إعادة ضبط وتفريغ قاعدة البيانات إلى الحالة النظيفة بالكامل' });
    } catch (err: any) {
      if (databaseInstance) {
        try { databaseInstance.run('ROLLBACK;'); } catch (e) {}
        try { databaseInstance.run('PRAGMA foreign_keys = ON;'); } catch (e) {}
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Clear all transactions, demo products, sales, and debts without resetting shop credentials
  app.post('/api/setup/clear-data', async (req, res) => {
    let databaseInstance: any = null;
    try {
      databaseInstance = await getDb();
      const now = new Date().toISOString();

      databaseInstance.run(`PRAGMA foreign_keys = OFF;`);
      databaseInstance.run('BEGIN TRANSACTION;');
      databaseInstance.run(`DELETE FROM SaleItems;`);
      databaseInstance.run(`DELETE FROM Sales;`);
      databaseInstance.run(`DELETE FROM SuspendedSaleItems;`);
      databaseInstance.run(`DELETE FROM SuspendedSales;`);
      databaseInstance.run(`DELETE FROM PurchaseItems;`);
      databaseInstance.run(`DELETE FROM Purchases;`);
      databaseInstance.run(`DELETE FROM StockMovements;`);
      databaseInstance.run(`DELETE FROM Products;`);
      databaseInstance.run(`DELETE FROM Expenses;`);
      databaseInstance.run(`DELETE FROM CustomerPayments;`);
      databaseInstance.run(`DELETE FROM Customers WHERE Id > 1;`);
      databaseInstance.run(`UPDATE Customers SET Balance = 0 WHERE Id = 1;`);
      databaseInstance.run(`DELETE FROM SupplierPayments;`);
      databaseInstance.run(`DELETE FROM Suppliers;`);
      databaseInstance.run(`DELETE FROM AuditLogs;`);
      databaseInstance.run(`
        INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp) VALUES
        ('usr-admin', 'DATA_CLEARED', 'Database', 'mizan_dz.sqlite', 'تم مسح وإزالة كافة البيانات التجريبية والعمليات من النظام', ?)
      `, [now]);
      databaseInstance.run('COMMIT;');
      databaseInstance.run(`PRAGMA foreign_keys = ON;`);

      saveDb();
      res.json({ success: true, message: 'تم حذف كافة البيانات والعمليات التجريبية بنجاح' });
    } catch (err: any) {
      if (databaseInstance) {
        try { databaseInstance.run('ROLLBACK;'); } catch (e) {}
        try { databaseInstance.run('PRAGMA foreign_keys = ON;'); } catch (e) {}
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Optional Demo Seed API for developer testing
  app.post('/api/setup/seed-demo', async (req, res) => {
    try {
      const db = await getDb();
      seedDemoDataForDev(db);
      res.json({ success: true, message: 'تمت إضافة البيانات التجريبية بنجاح للتطوير' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Backup APIs ---
  app.get('/api/backup/download', async (req, res) => {
    try {
      saveDb();
      const dbPath = getDbPath();
      if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: 'ملف قاعدة البيانات غير موجود' });
      }
      const today = new Date().toISOString().substring(0, 10);
      res.download(dbPath, `MizanBackup_${today}.sqlite`);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backup/create', async (req, res) => {
    try {
      const backupFilename = createBackupCopy();
      res.json({ success: true, message: 'تم إنشاء النسخة الاحتياطية بنجاح', filename: backupFilename });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/backup/list', async (req, res) => {
    try {
      const backupsDir = getBackupsDir();
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.endsWith('.sqlite'))
        .map(f => {
          const stat = fs.statSync(path.join(backupsDir, f));
          return {
            filename: f,
            size: stat.size,
            createdAt: stat.birthtime.toISOString()
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backup/restore', async (req, res) => {
    const { fileData } = req.body;
    if (!fileData) return res.status(400).json({ error: 'لم يتم إرسال ملف النسخة الاحتياطية' });

    try {
      const buffer = Buffer.from(fileData, 'base64');
      await reloadDbFromFile(buffer);
      res.json({ success: true, message: 'تمت استعادة قاعدة البيانات بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشلت استعادة البيانات: ' + err.message });
    }
  });

  // 3. Settings Get & Put API
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await runQuery(`SELECT Key, Value, Description FROM Settings`);
      const map: Record<string, string> = {};
      settings.forEach((s) => { map[s.Key] = s.Value; });
      res.json(map);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/settings', async (req, res) => {
    const settingsObj = req.body; // { ShopName: '...', ShopAddress: '...' }
    try {
      const db = await getDb();
      for (const [k, v] of Object.entries(settingsObj)) {
        db.run(`INSERT OR REPLACE INTO Settings (Key, Value) VALUES (?, ?)`, [k, String(v)]);
      }
      saveDb();
      res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Authentication
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }

    try {
      const users = await runQuery(`SELECT Id, Username, FullName, PasswordHash, Role, IsActive FROM Users WHERE LOWER(Username) = LOWER(?) AND IsActive = 1`, [username.trim()]);
      if (users.length === 0) {
        return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      }

      const user = users[0];
      const isValid = verifyPassword(password, user.PasswordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      }

      // Upgrade legacy SHA-256 or plain text password to secure scrypt hash format in SQLite
      if (!user.PasswordHash.startsWith('scrypt:')) {
        const scryptHash = hashPassword(password);
        await executeNonQuery(`UPDATE Users SET PasswordHash = ? WHERE Id = ?`, [scryptHash, user.Id]);
      }

      res.json({
        success: true,
        user: {
          id: user.Id,
          username: user.Username,
          fullName: user.FullName,
          role: user.Role
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    const { username, fullName, password, role } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تتكون من 8 أحرف أو أرقام على الأقل' });
    }

    const cleanUsername = username.trim();
    const cleanFullName = (fullName && fullName.trim()) ? fullName.trim() : cleanUsername;
    const cleanRole = role || 'Cashier';
    const hashedPassword = hashPassword(password);

    try {
      const existing = await runQuery(`SELECT Id FROM Users WHERE LOWER(Username) = LOWER(?)`, [cleanUsername]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'اسم المستخدم هذا مستعمل بالفعل، يرجى اختيار اسم آخر' });
      }

      const now = new Date().toISOString();
      const userId = 'usr-' + Date.now();
      
      await executeNonQuery(`
        INSERT INTO Users (Id, Username, FullName, PasswordHash, Role, IsActive, CreatedAt)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `, [userId, cleanUsername, cleanFullName, hashedPassword, cleanRole, now]);

      res.json({
        success: true,
        message: 'تم إنشاء الحساب بنجاح',
        user: {
          id: userId,
          username: cleanUsername,
          fullName: cleanFullName,
          role: cleanRole
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إنشاء الحساب: ' + err.message });
    }
  });

  // 5. Categories API
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await runQuery(`SELECT c.*, (SELECT COUNT(*) FROM Products p WHERE p.CategoryId = c.Id AND p.IsDeleted = 0) as ProductCount FROM Categories c WHERE c.IsActive = 1 ORDER BY c.Name ASC`);
      res.json(categories);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/categories', async (req, res) => {
    const { name, description, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم التصنيف مطلوب' });

    try {
      const now = new Date().toISOString();
      await executeNonQuery(`INSERT INTO Categories (Name, Description, Icon, IsActive, CreatedAt) VALUES (?, ?, ?, 1, ?)`, [name, description || '', icon || 'Box', now]);
      res.json({ success: true, message: 'تمت إضافة التصنيف بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'عذراً، هذا التصنيف موجود بالفعل أو حدث خطأ أثناء الإضافة' });
    }
  });

  app.put('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, icon } = req.body;
    try {
      await executeNonQuery(`UPDATE Categories SET Name = ?, Description = ?, Icon = ? WHERE Id = ?`, [name, description, icon, id]);
      res.json({ success: true, message: 'تم تحديث التصنيف بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const productsInCat = await runQuery(`SELECT COUNT(*) as C FROM Products WHERE CategoryId = ? AND IsDeleted = 0`, [id]);
      if (productsInCat[0]?.C > 0) {
        return res.status(400).json({ error: `لا يمكن حذف هذا التصنيف لأنه يحتوي على ${productsInCat[0].C} منتج(ات) نشطة. يرجى إعادة تعيين المنتجات لتصنيف آخر قبل الحذف.` });
      }
      await executeNonQuery(`UPDATE Categories SET IsActive = 0 WHERE Id = ?`, [id]);
      res.json({ success: true, message: 'تم حذف التصنيف بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Products API
  app.get('/api/products', async (req, res) => {
    try {
      const { search, categoryId, lowStock, barcode } = req.query;
      let sql = `
        SELECT p.*, c.Name as CategoryName, b.Name as BrandName, s.Name as SupplierName 
        FROM Products p
        LEFT JOIN Categories c ON p.CategoryId = c.Id
        LEFT JOIN Brands b ON p.BrandId = b.Id
        LEFT JOIN Suppliers s ON p.SupplierId = s.Id
        WHERE p.IsDeleted = 0
      `;
      const params: any[] = [];

      if (barcode) {
        sql += ` AND p.Barcode = ?`;
        params.push(barcode);
      } else {
        if (search) {
          sql += ` AND (p.Name LIKE ? OR p.Barcode LIKE ? OR p.Description LIKE ?)`;
          const s = `%${search}%`;
          params.push(s, s, s);
        }
        if (categoryId) {
          sql += ` AND p.CategoryId = ?`;
          params.push(categoryId);
        }
        if (lowStock === 'true') {
          sql += ` AND p.Quantity <= p.MinQuantity`;
        }
      }

      sql += ` ORDER BY p.Id DESC`;
      const products = await runQuery(sql, params);
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products', async (req, res) => {
    const { barcode, name, description, categoryId, brandId, supplierId, purchasePrice, salePrice, wholesalePrice, quantity, minQuantity, unit, tax, expiryDate } = req.body;

    if (!barcode || !name || !categoryId || purchasePrice === undefined || salePrice === undefined) {
      return res.status(400).json({ error: 'يرجى إدخال جميع الحقول الأساسية للمنتج (الباركود، الاسم، التصنيف، وسعر الشراء والبيع)' });
    }

    try {
      const now = new Date().toISOString();
      const db = await getDb();

      // Check duplicate barcode
      const existing = await runQuery(`SELECT Id FROM Products WHERE Barcode = ? AND IsDeleted = 0`, [barcode]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'رمز الباركود مستخدم بالفعل لمنتج آخر' });
      }

      db.run(`
        INSERT INTO Products 
        (Barcode, Name, Description, CategoryId, BrandId, SupplierId, PurchasePrice, SalePrice, WholesalePrice, Quantity, MinQuantity, Unit, Tax, ExpiryDate, IsActive, IsDeleted, CreatedAt, UpdatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
      `, [barcode, name, description || '', categoryId, brandId || null, supplierId || null, purchasePrice, salePrice, wholesalePrice || 0, quantity || 0, minQuantity || 5, unit || 'قطع', tax || 0, expiryDate || null, now, now]);

      // Get inserted product ID
      const newProdRes = await runQuery(`SELECT Id FROM Products WHERE Barcode = ?`, [barcode]);
      const newProdId = newProdRes[0]?.Id;

      if (newProdId) {
        if ((quantity || 0) > 0) {
          // Record Opening Stock Movement (المخزون الأولي)
          db.run(`
            INSERT INTO StockMovements (ProductId, MovementType, Quantity, PreviousQuantity, NewQuantity, ReferenceType, ReferenceId, UserId, Date, Notes)
            VALUES (?, 'OpeningStock', ?, 0, ?, 'ProductCreation', ?, 'usr-admin', ?, 'إدخال المخزون الأولي عند إضافة المنتج')
          `, [newProdId, quantity, quantity, newProdId, now]);
        }

        // Record Audit Log
        db.run(`
          INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
          VALUES ('usr-admin', 'CREATE_PRODUCT', 'Products', ?, ?, ?)
        `, [String(newProdId), `إنشاء منتج جديد: ${name} (باركود: ${barcode})، بكمية أوليّة: ${quantity || 0}`, now]);
      }

      saveDb();
      res.json({ success: true, message: 'تمت إضافة المنتج بنجاح إلى قاعدة البيانات' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dedicated Opening Stock Endpoint (إدخال المخزون الأولي)
  app.post('/api/products/opening-stock', async (req, res) => {
    const { productId, openingQuantity, purchasePrice, salePrice, notes, userId } = req.body;

    if (!productId || openingQuantity === undefined || openingQuantity < 0) {
      return res.status(400).json({ error: 'يرجى تحديد المنتج والكمية الأولية الصالحة' });
    }

    try {
      const db = await getDb();
      const now = new Date().toISOString();

      const prodRes = await runQuery(`SELECT Quantity, PurchasePrice, SalePrice FROM Products WHERE Id = ?`, [productId]);
      if (prodRes.length === 0) return res.status(404).json({ error: 'المنتج غير موجود' });

      const oldQty = prodRes[0].Quantity || 0;
      const diff = openingQuantity - oldQty;

      // Update Product Quantity & Optionally Prices
      db.run(`
        UPDATE Products SET
          Quantity = ?,
          PurchasePrice = COALESCE(?, PurchasePrice),
          SalePrice = COALESCE(?, SalePrice),
          UpdatedAt = ?
        WHERE Id = ?
      `, [openingQuantity, purchasePrice || null, salePrice || null, now, productId]);

      // Record OpeningStock Movement (غير محسوب كشراء أو بيع)
      db.run(`
        INSERT INTO StockMovements (ProductId, MovementType, Quantity, PreviousQuantity, NewQuantity, ReferenceType, ReferenceId, UserId, Date, Notes)
        VALUES (?, 'OpeningStock', ?, ?, ?, 'OpeningStockSetup', ?, ?, ?, ?)
      `, [productId, diff, oldQty, openingQuantity, productId, userId || 'usr-admin', now, notes || 'إدخال المخزون الأولي']);

      saveDb();
      res.json({ success: true, message: 'تم تسجيل المخزون الأولي بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { barcode, name, description, categoryId, brandId, supplierId, purchasePrice, salePrice, wholesalePrice, quantity, minQuantity, unit, tax, expiryDate } = req.body;

    try {
      const now = new Date().toISOString();
      const db = await getDb();

      // Get old quantity
      const oldProdRes = await runQuery(`SELECT Quantity FROM Products WHERE Id = ?`, [id]);
      const oldQty = oldProdRes[0]?.Quantity || 0;

      db.run(`
        UPDATE Products SET
          Barcode = ?, Name = ?, Description = ?, CategoryId = ?, BrandId = ?, SupplierId = ?,
          PurchasePrice = ?, SalePrice = ?, WholesalePrice = ?, Quantity = ?, MinQuantity = ?,
          Unit = ?, Tax = ?, ExpiryDate = ?, UpdatedAt = ?
        WHERE Id = ?
      `, [barcode, name, description, categoryId, brandId || null, supplierId || null, purchasePrice, salePrice, wholesalePrice || 0, quantity, minQuantity || 5, unit || 'قطع', tax || 0, expiryDate || null, now, id]);

      // Record stock adjustment movement if quantity changed
      if (quantity !== oldQty) {
        const diff = quantity - oldQty;
        db.run(`
          INSERT INTO StockMovements (ProductId, MovementType, Quantity, PreviousQuantity, NewQuantity, ReferenceType, ReferenceId, UserId, Date, Notes)
          VALUES (?, 'StockAdjustment', ?, ?, ?, 'ManualEdit', ?, 'usr-admin', ?, 'تعديل يدوي للكمية في بطاقة المنتج')
        `, [id, diff, oldQty, quantity, id, now]);
      }

      db.run(`
        INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
        VALUES ('usr-admin', 'EDIT_PRODUCT', 'Products', ?, ?, ?)
      `, [String(id), `تعديل بطاقة المنتج: ${name} (باركود: ${barcode})`, now]);

      saveDb();
      res.json({ success: true, message: 'تم تحديث بيانات المنتج بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const now = new Date().toISOString();
      await executeNonQuery(`UPDATE Products SET IsDeleted = 1, UpdatedAt = ? WHERE Id = ?`, [now, id]);
      
      const db = await getDb();
      db.run(`
        INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
        VALUES ('usr-admin', 'DELETE_PRODUCT', 'Products', ?, 'حذف منتج من النظام', ?)
      `, [String(id), now]);
      saveDb();

      res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stock Movements & Adjustments API
  app.get('/api/stock-movements', async (req, res) => {
    const { productId, movementType, search } = req.query;
    try {
      let sql = `
        SELECT sm.*, p.Name as ProductName, p.Barcode, p.Unit
        FROM StockMovements sm
        JOIN Products p ON sm.ProductId = p.Id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (productId) {
        sql += ` AND sm.ProductId = ?`;
        params.push(productId);
      }
      if (movementType) {
        sql += ` AND sm.MovementType = ?`;
        params.push(movementType);
      }
      if (search) {
        sql += ` AND (p.Name LIKE ? OR p.Barcode LIKE ? OR sm.Notes LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      sql += ` ORDER BY sm.Id DESC LIMIT 200`;
      const movements = await runQuery(sql, params);
      res.json(movements);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/stock-adjustments', async (req, res) => {
    const { productId, newQuantity, reason, notes, userId } = req.body;

    if (!productId || newQuantity === undefined || newQuantity < 0) {
      return res.status(400).json({ error: 'يرجى إدخال معرّف المنتج والكمية الجديدة الصالحة' });
    }

    try {
      const db = await getDb();
      const now = new Date().toISOString();

      const prodRes = await runQuery(`SELECT Quantity, Name FROM Products WHERE Id = ? AND IsDeleted = 0`, [productId]);
      if (prodRes.length === 0) {
        return res.status(404).json({ error: 'المنتج غير موجود' });
      }

      const prevQty = prodRes[0].Quantity || 0;
      const diff = newQuantity - prevQty;

      if (diff === 0) {
        return res.json({ success: true, message: 'الكمية مطابقة للمخزون الحالي دون تغيير' });
      }

      db.run('BEGIN TRANSACTION;');

      try {
        db.run(`UPDATE Products SET Quantity = ?, UpdatedAt = ? WHERE Id = ?`, [newQuantity, now, productId]);

        const fullNotes = `تعديل مخزون [السبب: ${reason || 'جرد / تصحيح'}]: ${notes || ''}`.trim();
        db.run(`
          INSERT INTO StockMovements (ProductId, MovementType, Quantity, PreviousQuantity, NewQuantity, ReferenceType, ReferenceId, UserId, Date, Notes)
          VALUES (?, 'StockAdjustment', ?, ?, ?, 'StockAdjustment', ?, ?, ?, ?)
        `, [productId, diff, prevQty, newQuantity, productId, userId || 'usr-admin', now, fullNotes]);

        db.run(`
          INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
          VALUES (?, 'STOCK_ADJUSTMENT', 'Products', ?, ?, ?)
        `, [userId || 'usr-admin', String(productId), `تعديل كمية المخزون للمنتج ${prodRes[0].Name} من ${prevQty} إلى ${newQuantity}`, now]);

        db.run('COMMIT;');
        saveDb();

        res.json({ success: true, message: 'تم تعديل المخزون وتسجيل الحركة بنجاح', prevQuantity: prevQty, newQuantity });
      } catch (err) {
        db.run('ROLLBACK;');
        throw err;
      }
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل المخزون: ' + err.message });
    }
  });

  // Suspended Sales API (تعليق الفاتورة)
  app.get('/api/pos/suspended', async (req, res) => {
    try {
      const sales = await runQuery(`
        SELECT ss.*, COALESCE(c.Name, 'زبون عادي') as CustomerName
        FROM SuspendedSales ss
        LEFT JOIN Customers c ON ss.CustomerId = c.Id
        ORDER BY ss.Id DESC
      `);

      for (const sale of sales) {
        sale.items = await runQuery(`SELECT * FROM SuspendedSaleItems WHERE SuspendedSaleId = ?`, [sale.Id]);
      }

      res.json(sales);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/pos/suspend', async (req, res) => {
    const { customerId, items, userId, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'لا يمكن تعليق سلة فارغة' });
    }

    try {
      const db = await getDb();
      const now = new Date().toISOString();

      db.run('BEGIN TRANSACTION;');

      try {
        db.run(`
          INSERT INTO SuspendedSales (CustomerId, UserId, Notes, CreatedAt)
          VALUES (?, ?, ?, ?)
        `, [customerId || 1, userId || 'usr-admin', notes || '', now]);

        const suspIdRes = await runQuery(`SELECT last_insert_rowid() as Id`);
        const suspId = suspIdRes[0]?.Id;

        for (const item of items) {
          db.run(`
            INSERT INTO SuspendedSaleItems (SuspendedSaleId, ProductId, ProductName, UnitPrice, CostPrice, Quantity)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [suspId, item.id, item.name, item.salePrice, item.purchasePrice, item.quantity]);
        }

        db.run('COMMIT;');
        saveDb();

        res.json({ success: true, id: suspId, message: 'تم تعليق الفاتورة بنجاح ويمكن العثور عليها في قائمة المبيعات المعلقة' });
      } catch (err) {
        db.run('ROLLBACK;');
        throw err;
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/pos/suspended/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await executeNonQuery(`DELETE FROM SuspendedSales WHERE Id = ?`, [id]);
      res.json({ success: true, message: 'تم حذف الفاتورة المعلقة' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. POS Checkout / Sales API
  app.post('/api/sales', async (req, res) => {
    const { customerId, items, paymentMethod, paidAmount, discount, notes, userId } = req.body;
    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body?.idempotencyKey;

    if (idempotencyKey) {
      const cached = processedIdempotencyKeys.get(idempotencyKey);
      if (cached && (Date.now() - cached.timestamp < 30000)) {
        return res.json(cached.result);
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'سلة المبيعات فارغة' });
    }

    try {
      const db = await getDb();
      const now = new Date().toISOString();

      // Validate customer if customerId is provided
      let validCustomerId: number | null = null;
      let customerName = 'زبون عادي (نقدي)';
      let customerPhone = '';

      if (customerId !== undefined && customerId !== null && customerId !== '' && Number(customerId) > 0) {
        const parsedCustId = Number(customerId);
        const custCheck = await runQuery(`SELECT Id, Name, Phone FROM Customers WHERE Id = ?`, [parsedCustId]);
        if (custCheck.length === 0) {
          return res.status(400).json({ error: 'العميل المحدد غير موجود في قاعدة البيانات' });
        }
        validCustomerId = custCheck[0].Id;
        customerName = custCheck[0].Name || 'زبون عادي';
        customerPhone = custCheck[0].Phone || '';
      }

      // 1. Validate stock availability and enrich item fields
      const enrichedItems: any[] = [];
      let subTotal = 0;
      let totalCost = 0;

      for (const item of items) {
        const prodCheck = await runQuery(`SELECT Quantity, Name, SalePrice, PurchasePrice FROM Products WHERE Id = ? AND IsDeleted = 0`, [item.id]);
        if (prodCheck.length === 0) {
          return res.status(400).json({ error: `المنتج غير موجود أو محذوف` });
        }
        const availStock = prodCheck[0].Quantity || 0;
        const reqQty = Math.max(1, Number(item.quantity) || 1);
        if (availStock < reqQty) {
          return res.status(400).json({
            error: `الكمية المطلوبة للمنتج "${item.name || prodCheck[0].Name}" (${reqQty}) أكبر من المخزون المتوفر (${availStock}).`
          });
        }

        const unitSalePrice = (item.salePrice !== undefined && item.salePrice !== null) ? Number(item.salePrice) : (prodCheck[0].SalePrice || 0);
        const unitCostPrice = (item.purchasePrice !== undefined && item.purchasePrice !== null) ? Number(item.purchasePrice) : (prodCheck[0].PurchasePrice || 0);
        const lineTotal = unitSalePrice * reqQty;

        enrichedItems.push({
          id: item.id,
          name: item.name || prodCheck[0].Name || 'منتج',
          quantity: reqQty,
          salePrice: unitSalePrice,
          purchasePrice: unitCostPrice,
          totalPrice: lineTotal,
          prevStock: availStock
        });

        subTotal += lineTotal;
        totalCost += (unitCostPrice * reqQty);
      }
      
      const salesCountRes = await runQuery(`SELECT COUNT(*) as C FROM Sales`);
      const nextNum = (salesCountRes[0]?.C || 0) + 1;
      const invoiceNum = `MZ-${now.substring(0, 4)}-${String(nextNum).padStart(6, '0')}`;

      const grandTotal = Math.max(0, subTotal - (discount || 0));
      
      // Calculate paid and remaining accurately
      let paid = grandTotal;
      if (paymentMethod === 'Debt' || paymentMethod === 'CREDIT') {
        paid = (paidAmount !== undefined && paidAmount !== null && paidAmount !== '') ? Math.min(Math.max(0, Number(paidAmount)), grandTotal) : 0;
      } else if (paidAmount !== undefined && paidAmount !== null && paidAmount !== '') {
        paid = Math.min(Math.max(0, Number(paidAmount)), grandTotal);
      }

      const remaining = grandTotal - paid;

      db.run('BEGIN TRANSACTION;');

      try {
        db.run(`
          INSERT INTO Sales 
          (InvoiceNumber, CustomerId, UserId, SubTotal, Discount, TotalTax, GrandTotal, PaidAmount, RemainingAmount, PaymentMethod, Status, Notes, CreatedAt)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'Completed', ?, ?)
        `, [invoiceNum, validCustomerId || 1, userId || 'usr-admin', subTotal, discount || 0, grandTotal, paid, remaining, paymentMethod || 'Cash', notes || '', now]);

        const saleIdRes = await runQuery(`SELECT Id FROM Sales WHERE InvoiceNumber = ?`, [invoiceNum]);
        const saleId = saleIdRes[0]?.Id;

        for (const item of enrichedItems) {
          db.run(`
            INSERT INTO SaleItems 
            (SaleId, ProductId, ProductName, UnitPrice, CostPrice, Quantity, Discount, TotalPrice)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)
          `, [saleId, item.id, item.name, item.salePrice, item.purchasePrice, item.quantity, item.totalPrice]);

          const newQty = item.prevStock - item.quantity;
          db.run(`UPDATE Products SET Quantity = ? WHERE Id = ?`, [newQty, item.id]);

          db.run(`
            INSERT INTO StockMovements (ProductId, MovementType, Quantity, PreviousQuantity, NewQuantity, ReferenceType, ReferenceId, UserId, Date, Notes)
            VALUES (?, 'Sale', ?, ?, ?, 'SaleInvoice', ?, ?, ?, ?)
          `, [item.id, -item.quantity, item.prevStock, newQty, saleId, userId || 'usr-admin', now, `بيع في فاتورة رقم ${invoiceNum}`]);
        }

        if (remaining > 0 && validCustomerId && validCustomerId !== 1) {
          const custRes = await runQuery(`SELECT Balance FROM Customers WHERE Id = ?`, [validCustomerId]);
          const currentBal = custRes[0]?.Balance || 0;
          db.run(`UPDATE Customers SET Balance = ? WHERE Id = ?`, [currentBal + remaining, validCustomerId]);
        }

        db.run(`
          INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
          VALUES (?, 'CREATE_SALE', 'Sales', ?, ?, ?)
        `, [userId || 'usr-admin', String(saleId), `إصدار فاتورة بيع رقم ${invoiceNum} للعميل (${customerName}) بمبلغ ${grandTotal} دج`, now]);

        db.run('COMMIT;');
        saveDb();

        const responsePayload = {
          success: true,
          invoiceNumber: invoiceNum,
          saleId,
          customerId: validCustomerId,
          customerName,
          customerPhone,
          grandTotal,
          paid,
          remaining,
          message: 'تم إتمام عملية البيع وحفظ الفاتورة بنجاح وتحديث المخزون'
        };

        if (idempotencyKey) {
          processedIdempotencyKeys.set(idempotencyKey, { result: responsePayload, timestamp: Date.now() });
        }

        res.json(responsePayload);
      } catch (err) {
        db.run('ROLLBACK;');
        throw err;
      }
    } catch (err: any) {
      res.status(500).json({ error: 'فشلت عملية البيع: ' + err.message });
    }
  });

  // Sale Refund Endpoint
  app.post('/api/sales/:id/refund', async (req, res) => {
    const { id } = req.params;
    const { items, reason, userId } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد العناصر المراد إرجاعها' });
    }

    try {
      const db = await getDb();
      const now = new Date().toISOString();

      const saleRes = await runQuery(`SELECT * FROM Sales WHERE Id = ?`, [id]);
      if (saleRes.length === 0) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
      const sale = saleRes[0];

      db.run('BEGIN TRANSACTION;');

      try {
        let totalRefundAmount = 0;

        for (const item of items) {
          const prodRes = await runQuery(`SELECT Quantity, Name, SalePrice FROM Products WHERE Id = ?`, [item.productId]);
          if (prodRes.length === 0) continue;

          const prevQty = prodRes[0].Quantity || 0;
          const returnQty = Math.max(1, Number(item.quantity) || 1);
          const newQty = prevQty + returnQty;
          const unitPrice = prodRes[0].SalePrice || 0;
          totalRefundAmount += (unitPrice * returnQty);

          db.run(`UPDATE Products SET Quantity = ? WHERE Id = ?`, [newQty, item.productId]);

          db.run(`
            INSERT INTO StockMovements (ProductId, MovementType, Quantity, PreviousQuantity, NewQuantity, ReferenceType, ReferenceId, UserId, Date, Notes)
            VALUES (?, 'SaleReturn', ?, ?, ?, 'SaleInvoiceRefund', ?, ?, ?, ?)
          `, [item.productId, returnQty, prevQty, newQty, id, userId || 'usr-admin', now, `إرجاع مبيعات للفاتورة رقم ${sale.InvoiceNumber} - ${reason || ''}`]);
        }

        db.run(`
          INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
          VALUES (?, 'REFUND_SALE', 'Sales', ?, ?, ?)
        `, [userId || 'usr-admin', String(id), `إرجاع عناصر من الفاتورة رقم ${sale.InvoiceNumber} بقيمة ${totalRefundAmount} دج`, now]);

        db.run('COMMIT;');
        saveDb();

        res.json({ success: true, message: 'تم تسجيل المرتجع وإعادة السلع إلى المخزون بنجاح' });
      } catch (err) {
        db.run('ROLLBACK;');
        throw err;
      }
    } catch (err: any) {
      res.status(500).json({ error: 'فشلت عملية الإرجاع: ' + err.message });
    }
  });

  // Sales Invoices List & Details API
  app.get('/api/sales', async (req, res) => {
    const { search, customerId, date } = req.query;
    try {
      let sql = `
        SELECT s.*, 
               COALESCE(c.Name, 'زبون عادي (نقدي)') as CustomerName,
               COALESCE(c.Phone, '') as CustomerPhone,
               COALESCE(c.Address, '') as CustomerAddress
        FROM Sales s
        LEFT JOIN Customers c ON s.CustomerId = c.Id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (customerId) {
        sql += ` AND s.CustomerId = ?`;
        params.push(customerId);
      }
      if (date) {
        sql += ` AND strftime('%Y-%m-%d', s.CreatedAt) = ?`;
        params.push(date);
      }
      if (search) {
        sql += ` AND (s.InvoiceNumber LIKE ? OR c.Name LIKE ? OR c.Phone LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      sql += ` ORDER BY s.Id DESC LIMIT 100`;
      const sales = await runQuery(sql, params);

      for (const sale of sales) {
        sale.items = await runQuery(`SELECT * FROM SaleItems WHERE SaleId = ?`, [sale.Id]);
      }

      res.json(sales);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sales/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const sales = await runQuery(`
        SELECT s.*, 
               COALESCE(c.Name, 'زبون عادي (نقدي)') as CustomerName,
               COALESCE(c.Phone, '') as CustomerPhone,
               COALESCE(c.Address, '') as CustomerAddress
        FROM Sales s
        LEFT JOIN Customers c ON s.CustomerId = c.Id
        WHERE s.Id = ?
      `, [id]);

      if (sales.length === 0) {
        return res.status(404).json({ error: 'الفاتورة غير موجودة' });
      }

      const sale = sales[0];
      sale.items = await runQuery(`SELECT * FROM SaleItems WHERE SaleId = ?`, [id]);
      res.json(sale);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Customer Debt Payments API (تسديد الديون)
  app.get('/api/customers/:id/payments', async (req, res) => {
    const { id } = req.params;
    try {
      const payments = await runQuery(`SELECT * FROM CustomerPayments WHERE CustomerId = ? ORDER BY Id DESC`, [id]);
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/customers/:id/payments', async (req, res) => {
    const { id } = req.params;
    const { amount, paymentMethod, notes, userId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'يرجى إدخال مبلغ تسديد صالح أكبر من 0' });
    }

    try {
      const db = await getDb();
      const now = new Date().toISOString();

      const custRes = await runQuery(`SELECT Balance, Name FROM Customers WHERE Id = ?`, [id]);
      if (custRes.length === 0) {
        return res.status(404).json({ error: 'الزبون غير موجود' });
      }

      const currentBalance = custRes[0].Balance || 0;
      const newBalance = Math.max(0, currentBalance - amount);

      db.run('BEGIN TRANSACTION;');

      try {
        db.run(`UPDATE Customers SET Balance = ? WHERE Id = ?`, [newBalance, id]);

        db.run(`
          INSERT INTO CustomerPayments (CustomerId, Amount, PaymentMethod, UserId, Notes, CreatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [id, amount, paymentMethod || 'Cash', userId || 'usr-admin', notes || '', now]);

        db.run(`
          INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
          VALUES (?, 'CUSTOMER_PAYMENT', 'Customers', ?, ?, ?)
        `, [userId || 'usr-admin', String(id), `تسديد مبلغ ${amount} دج لحساب الزبون ${custRes[0].Name}. الرصيد السابق: ${currentBalance} دج، الرصيد المتبقي: ${newBalance} دج`, now]);

        db.run('COMMIT;');
        saveDb();

        res.json({ success: true, message: 'تم تسجيل التسديد وتخفيض دين الزبون بنجاح', newBalance });
      } catch (err) {
        db.run('ROLLBACK;');
        throw err;
      }
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تسديد الدين: ' + err.message });
    }
  });

  // Product Export & Import JSON API
  app.get('/api/products/export', async (req, res) => {
    try {
      const products = await runQuery(`
        SELECT p.*, c.Name as CategoryName
        FROM Products p
        LEFT JOIN Categories c ON p.CategoryId = c.Id
        WHERE p.IsDeleted = 0
      `);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=products_export.json');
      res.send(JSON.stringify(products, null, 2));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products/import', async (req, res) => {
    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'لا توجد بيانات منتجات صالحة للاستيراد' });
    }

    try {
      const db = await getDb();
      const now = new Date().toISOString();
      let importedCount = 0;

      db.run('BEGIN TRANSACTION;');

      try {
        for (const p of products) {
          if (!p.barcode || !p.name || !p.salePrice) continue;

          // Check if exists
          const exist = await runQuery(`SELECT Id FROM Products WHERE Barcode = ? AND IsDeleted = 0`, [p.barcode]);
          if (exist.length > 0) {
            db.run(`
              UPDATE Products SET Name = ?, PurchasePrice = ?, SalePrice = ?, Quantity = Quantity + ?, UpdatedAt = ?
              WHERE Barcode = ?
            `, [p.name, p.purchasePrice || 0, p.salePrice || 0, p.quantity || 0, now, p.barcode]);
          } else {
            db.run(`
              INSERT INTO Products 
              (Barcode, Name, Description, CategoryId, PurchasePrice, SalePrice, WholesalePrice, Quantity, MinQuantity, Unit, IsActive, IsDeleted, CreatedAt, UpdatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
            `, [p.barcode, p.name, p.description || '', p.categoryId || 1, p.purchasePrice || 0, p.salePrice || 0, p.wholesalePrice || 0, p.quantity || 0, p.minQuantity || 5, p.unit || 'قطع', now, now]);
          }
          importedCount++;
        }

        db.run('COMMIT;');
        saveDb();

        res.json({ success: true, message: `تم استيراد ${importedCount} منتج بنجاح في قاعدة البيانات` });
      } catch (err) {
        db.run('ROLLBACK;');
        throw err;
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Real SQLite Dashboard Statistics API
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const todayStr = new Date().toISOString().substring(0, 10);

      // Today Sales
      const todaySalesRes = await runQuery(`
        SELECT COUNT(*) as Count, COALESCE(SUM(GrandTotal), 0) as Revenue, COALESCE(SUM(PaidAmount), 0) as Paid
        FROM Sales WHERE strftime('%Y-%m-%d', CreatedAt) = ?
      `, [todayStr]);

      // Today COGS
      const todayCogsRes = await runQuery(`
        SELECT COALESCE(SUM(si.CostPrice * si.Quantity), 0) as COGS
        FROM SaleItems si
        JOIN Sales s ON si.SaleId = s.Id
        WHERE strftime('%Y-%m-%d', s.CreatedAt) = ?
      `, [todayStr]);

      // Today Expenses
      const todayExpRes = await runQuery(`
        SELECT COALESCE(SUM(Amount), 0) as TotalExp FROM Expenses WHERE ExpenseDate = ?
      `, [todayStr]);

      // Inventory Total Value
      const stockValRes = await runQuery(`
        SELECT COUNT(*) as TotalProducts, COALESCE(SUM(Quantity * PurchasePrice), 0) as TotalValue
        FROM Products WHERE IsDeleted = 0
      `);

      // Low Stock Products
      const lowStockRes = await runQuery(`
        SELECT p.*, c.Name as CategoryName FROM Products p LEFT JOIN Categories c ON p.CategoryId = c.Id
        WHERE p.IsDeleted = 0 AND p.Quantity <= p.MinQuantity ORDER BY p.Quantity ASC LIMIT 5
      `);

      // Customer Total Debts
      const debtRes = await runQuery(`
        SELECT COALESCE(SUM(Balance), 0) as TotalDebts FROM Customers WHERE Id > 1
      `);

      // Supplier Total Debts
      const supDebtRes = await runQuery(`
        SELECT COALESCE(SUM(Balance), 0) as TotalSupDebts FROM Suppliers
      `);

      // Today Purchases
      const todayPurRes = await runQuery(`
        SELECT COALESCE(SUM(TotalAmount), 0) as TotalPurchases, COUNT(*) as Count
        FROM Purchases WHERE strftime('%Y-%m-%d', CreatedAt) = ?
      `, [todayStr]);

      // Total All Time Sales Count
      const totalSalesCountRes = await runQuery(`SELECT COUNT(*) as TotalSalesCount FROM Sales`);

      // Recent Sales
      const recentSales = await runQuery(`
        SELECT s.*, COALESCE(c.Name, 'زبون عادي') as CustomerName 
        FROM Sales s LEFT JOIN Customers c ON s.CustomerId = c.Id 
        ORDER BY s.Id DESC LIMIT 5
      `);

      const revenue = todaySalesRes[0]?.Revenue || 0;
      const cogs = todayCogsRes[0]?.COGS || 0;
      const expenses = todayExpRes[0]?.TotalExp || 0;
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - expenses;

      res.json({
        todaySales: revenue,
        todayInvoiceCount: todaySalesRes[0]?.Count || 0,
        todayPurchases: todayPurRes[0]?.TotalPurchases || 0,
        todayPurchaseCount: todayPurRes[0]?.Count || 0,
        totalSalesCount: totalSalesCountRes[0]?.TotalSalesCount || 0,
        todayGrossProfit: grossProfit,
        todayExpenses: expenses,
        todayNetProfit: netProfit,
        totalStockValue: stockValRes[0]?.TotalValue || 0,
        totalProductsCount: stockValRes[0]?.TotalProducts || 0,
        totalCustomerDebts: debtRes[0]?.TotalDebts || 0,
        totalSupplierDebts: supDebtRes[0]?.TotalSupDebts || 0,
        lowStockProducts: lowStockRes,
        recentSales
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Customers API & Ledger Statement
  app.get('/api/customers', async (req, res) => {
    try {
      const customers = await runQuery(`SELECT * FROM Customers ORDER BY Id ASC`);
      res.json(customers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/customers', async (req, res) => {
    const { name, phone, address, debtLimit, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم العميل مطلوب' });

    try {
      const now = new Date().toISOString();
      await executeNonQuery(`
        INSERT INTO Customers (Name, Phone, Address, DebtLimit, Balance, Notes, CreatedAt)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `, [name, phone || '', address || '', debtLimit || 50000, notes || '', now]);
      
      const inserted = await runQuery(`SELECT * FROM Customers WHERE Name = ? ORDER BY Id DESC LIMIT 1`, [name]);
      res.json({ success: true, message: 'تمت إضافة العميل بنجاح', customer: inserted[0] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    const { name, phone, address, debtLimit, notes } = req.body;
    try {
      await executeNonQuery(`
        UPDATE Customers SET Name = ?, Phone = ?, Address = ?, DebtLimit = ?, Notes = ? WHERE Id = ?
      `, [name, phone || '', address || '', debtLimit || 50000, notes || '', id]);
      res.json({ success: true, message: 'تم تحديث بيانات الزبون' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    if (Number(id) === 1) return res.status(400).json({ error: 'لا يمكن حذف الزبون الافتراضي للنظام' });
    try {
      await executeNonQuery(`DELETE FROM Customers WHERE Id = ?`, [id]);
      res.json({ success: true, message: 'تم حذف الزبون بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/customers/:id/statement', async (req, res) => {
    const { id } = req.params;
    try {
      const custRes = await runQuery(`SELECT * FROM Customers WHERE Id = ?`, [id]);
      if (custRes.length === 0) return res.status(404).json({ error: 'الزبون غير موجود' });

      const sales = await runQuery(`
        SELECT Id, InvoiceNumber as Reference, GrandTotal as Total, PaidAmount as Paid, RemainingAmount as Debit, CreatedAt as Date, 'Sale' as Type
        FROM Sales WHERE CustomerId = ? ORDER BY CreatedAt ASC
      `, [id]);

      const payments = await runQuery(`
        SELECT Id, ('تسديد دين #' || Id) as Reference, Amount as Credit, PaymentMethod, CreatedAt as Date, 'Payment' as Type, Notes
        FROM CustomerPayments WHERE CustomerId = ? ORDER BY CreatedAt ASC
      `, [id]);

      const events = [
        ...sales.map(s => ({ ...s, Debit: s.Debit, Credit: 0, Description: `فاتورة بيع #${s.Reference}` })),
        ...payments.map(p => ({ ...p, Debit: 0, Credit: p.Credit, Description: `دفع نقدًا (${p.Notes || 'تسديد'})` }))
      ].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());

      let runningBalance = 0;
      const statement = events.map(ev => {
        runningBalance += (ev.Debit - ev.Credit);
        return { ...ev, Balance: runningBalance };
      });

      res.json({ customer: custRes[0], statement, totalDebit: sales.reduce((a, b) => a + b.Debit, 0), totalCredit: payments.reduce((a, b) => a + b.Credit, 0), currentBalance: custRes[0].Balance });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Suppliers API & Ledger Statement
  app.get('/api/suppliers', async (req, res) => {
    try {
      const suppliers = await runQuery(`SELECT * FROM Suppliers ORDER BY Id ASC`);
      res.json(suppliers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/suppliers', async (req, res) => {
    const { name, phone, address, notes, company } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم المورد مطلوب' });

    try {
      const now = new Date().toISOString();
      await executeNonQuery(`
        INSERT INTO Suppliers (Name, Phone, Address, Balance, Notes, CreatedAt)
        VALUES (?, ?, ?, 0, ?, ?)
      `, [name, phone || '', address || '', notes || company || '', now]);
      res.json({ success: true, message: 'تمت إضافة المورد بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/suppliers/:id', async (req, res) => {
    const { id } = req.params;
    const { name, phone, address, notes } = req.body;
    try {
      await executeNonQuery(`
        UPDATE Suppliers SET Name = ?, Phone = ?, Address = ?, Notes = ? WHERE Id = ?
      `, [name, phone || '', address || '', notes || '', id]);
      res.json({ success: true, message: 'تم تحديث بيانات المورد' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/suppliers/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await executeNonQuery(`DELETE FROM Suppliers WHERE Id = ?`, [id]);
      res.json({ success: true, message: 'تم حذف المورد بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/suppliers/:id/payments', async (req, res) => {
    const { id } = req.params;
    try {
      const payments = await runQuery(`SELECT * FROM SupplierPayments WHERE SupplierId = ? ORDER BY Id DESC`, [id]);
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/suppliers/:id/payments', async (req, res) => {
    const { id } = req.params;
    const { amount, paymentMethod, notes, userId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'يرجى إدخال مبلغ تسديد صالح للمورد' });
    }

    try {
      const db = await getDb();
      const now = new Date().toISOString();

      const supRes = await runQuery(`SELECT Balance, Name FROM Suppliers WHERE Id = ?`, [id]);
      if (supRes.length === 0) return res.status(404).json({ error: 'المورد غير موجود' });

      const currentBalance = supRes[0].Balance || 0;
      const newBalance = Math.max(0, currentBalance - amount);

      db.run('BEGIN TRANSACTION;');

      try {
        db.run(`UPDATE Suppliers SET Balance = ? WHERE Id = ?`, [newBalance, id]);

        db.run(`
          INSERT INTO SupplierPayments (SupplierId, Amount, PaymentMethod, UserId, Notes, CreatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [id, amount, paymentMethod || 'Cash', userId || 'usr-admin', notes || '', now]);

        db.run(`
          INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
          VALUES (?, 'SUPPLIER_PAYMENT', 'Suppliers', ?, ?, ?)
        `, [userId || 'usr-admin', String(id), `تسديد مبلغ ${amount} دج للمورد ${supRes[0].Name}. الرصيد السابق: ${currentBalance} دج، الرصيد المتبقي: ${newBalance} دج`, now]);

        db.run('COMMIT;');
        saveDb();

        res.json({ success: true, message: 'تم تسديد مبلغ المورد وتحديث الرصيد بنجاح', newBalance });
      } catch (err) {
        db.run('ROLLBACK;');
        throw err;
      }
    } catch (err: any) {
      res.status(500).json({ error: 'فشلت عملية تسديد المورد: ' + err.message });
    }
  });

  app.get('/api/suppliers/:id/statement', async (req, res) => {
    const { id } = req.params;
    try {
      const supRes = await runQuery(`SELECT * FROM Suppliers WHERE Id = ?`, [id]);
      if (supRes.length === 0) return res.status(404).json({ error: 'المورد غير موجود' });

      const purchases = await runQuery(`
        SELECT Id, InvoiceNumber as Reference, TotalAmount as Total, PaidAmount as Paid, RemainingAmount as CreditAddition, CreatedAt as Date, 'Purchase' as Type
        FROM Purchases WHERE SupplierId = ? ORDER BY CreatedAt ASC
      `, [id]);

      const payments = await runQuery(`
        SELECT Id, ('تسديد للمورد #' || Id) as Reference, Amount as CreditReduction, PaymentMethod, CreatedAt as Date, 'Payment' as Type, Notes
        FROM SupplierPayments WHERE SupplierId = ? ORDER BY CreatedAt ASC
      `, [id]);

      const events = [
        ...purchases.map(p => ({ ...p, Debit: p.CreditAddition, Credit: 0, Description: `فاتورة شراء #${p.Reference}` })),
        ...payments.map(p => ({ ...p, Debit: 0, Credit: p.CreditReduction, Description: `تسديد نقدًا للمورد (${p.Notes || ''})` }))
      ].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());

      let runningBalance = 0;
      const statement = events.map(ev => {
        runningBalance += (ev.Debit - ev.Credit);
        return { ...ev, Balance: runningBalance };
      });

      res.json({ supplier: supRes[0], statement, currentBalance: supRes[0].Balance });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Purchases API (المشتريات)
  app.get('/api/purchases', async (req, res) => {
    const { supplierId, startDate, endDate, search } = req.query;
    try {
      let sql = `
        SELECT p.*, s.Name as SupplierName
        FROM Purchases p
        JOIN Suppliers s ON p.SupplierId = s.Id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (supplierId) {
        sql += ` AND p.SupplierId = ?`;
        params.push(supplierId);
      }
      if (startDate) {
        sql += ` AND strftime('%Y-%m-%d', p.CreatedAt) >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND strftime('%Y-%m-%d', p.CreatedAt) <= ?`;
        params.push(endDate);
      }
      if (search) {
        sql += ` AND (p.InvoiceNumber LIKE ? OR s.Name LIKE ?)`;
        const st = `%${search}%`;
        params.push(st, st);
      }

      sql += ` ORDER BY p.Id DESC LIMIT 100`;
      const purchases = await runQuery(sql, params);

      for (const pur of purchases) {
        pur.items = await runQuery(`SELECT * FROM PurchaseItems WHERE PurchaseId = ?`, [pur.Id]);
      }

      res.json(purchases);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/purchases/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const purRes = await runQuery(`
        SELECT p.*, s.Name as SupplierName
        FROM Purchases p
        JOIN Suppliers s ON p.SupplierId = s.Id
        WHERE p.Id = ?
      `, [id]);

      if (purRes.length === 0) return res.status(404).json({ error: 'فاتورة الشراء غير موجودة' });

      const pur = purRes[0];
      pur.items = await runQuery(`SELECT * FROM PurchaseItems WHERE PurchaseId = ?`, [id]);
      res.json(pur);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/purchases', async (req, res) => {
    const { supplierId, items, paidAmount, notes, userId } = req.body;
    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'يرجى اختيار المورد وتحديد السلع المشتراة' });
    }

    try {
      const db = await getDb();
      const now = new Date().toISOString();
      const datePrefix = now.substring(0, 10).replace(/-/g, '');

      const purCountRes = await runQuery(`SELECT COUNT(*) as C FROM Purchases`);
      const nextNum = (purCountRes[0]?.C || 0) + 1;
      const invoiceNum = `PUR-${now.substring(0, 4)}-${String(nextNum).padStart(6, '0')}`;

      let totalAmount = 0;
      items.forEach(it => {
        totalAmount += (Number(it.unitCost) * Number(it.quantity));
      });

      const paid = Math.min(Math.max(0, Number(paidAmount) || 0), totalAmount);
      const remaining = totalAmount - paid;
      const paymentStatus = remaining === 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Credit');

      db.run('BEGIN TRANSACTION;');

      try {
        db.run(`
          INSERT INTO Purchases (InvoiceNumber, SupplierId, UserId, TotalAmount, PaidAmount, RemainingAmount, PaymentStatus, Notes, CreatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [invoiceNum, supplierId, userId || 'usr-admin', totalAmount, paid, remaining, paymentStatus, notes || '', now]);

        const purIdRes = await runQuery(`SELECT last_insert_rowid() as Id`);
        const purchaseId = purIdRes[0].Id;

        for (const item of items) {
          const itemTotal = Number(item.unitCost) * Number(item.quantity);
          
          db.run(`
            INSERT INTO PurchaseItems (PurchaseId, ProductId, ProductName, UnitCost, Quantity, TotalCost)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [purchaseId, item.productId, item.productName || 'منتج', item.unitCost, item.quantity, itemTotal]);

          // Update Product Stock and Cost Price
          const prodRes = await runQuery(`SELECT Quantity FROM Products WHERE Id = ?`, [item.productId]);
          const prevQty = prodRes[0]?.Quantity || 0;
          const newQty = prevQty + Number(item.quantity);

          db.run(`
            UPDATE Products SET Quantity = ?, PurchasePrice = ?, UpdatedAt = ? WHERE Id = ?
          `, [newQty, item.unitCost, now, item.productId]);

          // Record Stock Movement (Purchase)
          db.run(`
            INSERT INTO StockMovements (ProductId, MovementType, Quantity, PreviousQuantity, NewQuantity, ReferenceType, ReferenceId, UserId, Date, Notes)
            VALUES (?, 'Purchase', ?, ?, ?, 'PurchaseInvoice', ?, ?, ?, ?)
          `, [item.productId, item.quantity, prevQty, newQty, purchaseId, userId || 'usr-admin', now, `إدخال مشتريات بموجب الفاتورة #${invoiceNum}`]);
        }

        // Increase Supplier Debt if remaining > 0
        if (remaining > 0) {
          const supRes = await runQuery(`SELECT Balance FROM Suppliers WHERE Id = ?`, [supplierId]);
          const currentBal = supRes[0]?.Balance || 0;
          db.run(`UPDATE Suppliers SET Balance = ? WHERE Id = ?`, [currentBal + remaining, supplierId]);
        }

        db.run(`
          INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
          VALUES (?, 'CREATE_PURCHASE', 'Purchases', ?, ?, ?)
        `, [userId || 'usr-admin', String(purchaseId), `تسجيل فاتورة شراء رقم ${invoiceNum} بمبلغ ${totalAmount} دج`, now]);

        db.run('COMMIT;');
        saveDb();

        res.json({
          success: true,
          purchaseId,
          invoiceNumber: invoiceNum,
          totalAmount,
          paid,
          remaining,
          message: 'تم تسجيل فاتورة الشراء وتحديث المخزون ورصيد المورد بنجاح'
        });
      } catch (err) {
        db.run('ROLLBACK;');
        throw err;
      }
    } catch (err: any) {
      res.status(500).json({ error: 'فشلت عملية إضافة المشتريات: ' + err.message });
    }
  });

  // 12. Expenses API (المصاريف)
  app.get('/api/expenses/categories', async (req, res) => {
    try {
      const categories = await runQuery(`SELECT * FROM ExpenseCategories ORDER BY Id ASC`);
      res.json(categories);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/expenses', async (req, res) => {
    const { startDate, endDate, categoryId } = req.query;
    try {
      let sql = `
        SELECT e.*, ec.Name as CategoryName
        FROM Expenses e
        LEFT JOIN ExpenseCategories ec ON e.CategoryId = ec.Id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (categoryId) {
        sql += ` AND e.CategoryId = ?`;
        params.push(categoryId);
      }
      if (startDate) {
        sql += ` AND e.ExpenseDate >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND e.ExpenseDate <= ?`;
        params.push(endDate);
      }

      sql += ` ORDER BY e.ExpenseDate DESC, e.Id DESC`;
      const expenses = await runQuery(sql, params);
      res.json(expenses);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/expenses', async (req, res) => {
    const { categoryId, title, amount, expenseDate, notes, userId } = req.body;
    if (!title || !amount || !categoryId) {
      return res.status(400).json({ error: 'يرجى ملء جميع الحقول المطلوبة للمصروف' });
    }

    try {
      const today = new Date().toISOString().substring(0, 10);
      const now = new Date().toISOString();
      await executeNonQuery(`
        INSERT INTO Expenses (CategoryId, Title, Amount, UserId, ExpenseDate, Notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [categoryId, title, amount, userId || 'usr-admin', expenseDate || today, notes || '']);

      const db = await getDb();
      db.run(`
        INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Details, Timestamp)
        VALUES (?, 'CREATE_EXPENSE', 'Expenses', '0', ?, ?)
      `, [userId || 'usr-admin', `تسجيل مصروف: ${title} بمبلغ ${amount} دج`, now]);
      saveDb();

      res.json({ success: true, message: 'تم تسجيل المصروف بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await executeNonQuery(`DELETE FROM Expenses WHERE Id = ?`, [id]);
      res.json({ success: true, message: 'تم حذف المصروف بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 13. Comprehensive Reports & Analytics API
  app.get('/api/reports/profit', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
      let salesWhere = `WHERE 1=1`;
      let expWhere = `WHERE 1=1`;
      const salesParams: any[] = [];
      const expParams: any[] = [];

      if (startDate) {
        salesWhere += ` AND strftime('%Y-%m-%d', CreatedAt) >= ?`;
        expWhere += ` AND ExpenseDate >= ?`;
        salesParams.push(startDate);
        expParams.push(startDate);
      }
      if (endDate) {
        salesWhere += ` AND strftime('%Y-%m-%d', CreatedAt) <= ?`;
        expWhere += ` AND ExpenseDate <= ?`;
        salesParams.push(endDate);
        expParams.push(endDate);
      }

      const salesRes = await runQuery(`SELECT COALESCE(SUM(GrandTotal), 0) as Revenue, COALESCE(SUM(Discount), 0) as TotalDiscounts, COUNT(*) as InvoicesCount FROM Sales ${salesWhere}`, salesParams);
      const cogsRes = await runQuery(`
        SELECT COALESCE(SUM(si.CostPrice * si.Quantity), 0) as COGS
        FROM SaleItems si
        JOIN Sales s ON si.SaleId = s.Id
        ${salesWhere.replace(/CreatedAt/g, 's.CreatedAt')}
      `, salesParams);

      const expRes = await runQuery(`SELECT COALESCE(SUM(Amount), 0) as TotalExpenses FROM Expenses ${expWhere}`, expParams);

      const revenue = salesRes[0]?.Revenue || 0;
      const cogs = cogsRes[0]?.COGS || 0;
      const grossProfit = revenue - cogs;
      const expenses = expRes[0]?.TotalExpenses || 0;
      const netProfit = grossProfit - expenses;

      res.json({
        revenue,
        cogs,
        grossProfit,
        expenses,
        netProfit,
        invoicesCount: salesRes[0]?.InvoicesCount || 0,
        totalDiscounts: salesRes[0]?.TotalDiscounts || 0
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/reports/daily-closing', async (req, res) => {
    const { date } = req.query;
    const targetDate = (date as string) || new Date().toISOString().substring(0, 10);

    try {
      const salesRes = await runQuery(`
        SELECT 
          COALESCE(SUM(GrandTotal), 0) as TotalSales,
          COALESCE(SUM(CASE WHEN PaymentMethod != 'CREDIT' THEN PaidAmount ELSE 0 END), 0) as CashSales,
          COALESCE(SUM(RemainingAmount), 0) as DebtSales,
          COUNT(*) as InvoicesCount
        FROM Sales WHERE strftime('%Y-%m-%d', CreatedAt) = ?
      `, [targetDate]);

      const custPayRes = await runQuery(`
        SELECT COALESCE(SUM(Amount), 0) as TotalCustPayments FROM CustomerPayments WHERE strftime('%Y-%m-%d', CreatedAt) = ?
      `, [targetDate]);

      const supPayRes = await runQuery(`
        SELECT COALESCE(SUM(Amount), 0) as TotalSupPayments FROM SupplierPayments WHERE strftime('%Y-%m-%d', CreatedAt) = ?
      `, [targetDate]);

      const expRes = await runQuery(`
        SELECT COALESCE(SUM(Amount), 0) as TotalExpenses FROM Expenses WHERE ExpenseDate = ?
      `, [targetDate]);

      const cashSales = salesRes[0]?.CashSales || 0;
      const custPayments = custPayRes[0]?.TotalCustPayments || 0;
      const supPayments = supPayRes[0]?.TotalSupPayments || 0;
      const expenses = expRes[0]?.TotalExpenses || 0;

      const totalCashInBox = cashSales + custPayments;
      const totalCashOut = supPayments + expenses;
      const netBoxCash = totalCashInBox - totalCashOut;

      res.json({
        date: targetDate,
        totalSales: salesRes[0]?.TotalSales || 0,
        cashSales,
        debtSales: salesRes[0]?.DebtSales || 0,
        invoicesCount: salesRes[0]?.InvoicesCount || 0,
        customerDebtCollected: custPayments,
        supplierDebtPaid: supPayments,
        expensesPaid: expenses,
        totalCashInBox,
        totalCashOut,
        netBoxCash
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. Local AI Query Endpoint
  app.post('/api/ai/query', async (req, res) => {
    const { query, userId } = req.body;
    if (!query) return res.status(400).json({ error: 'السؤال مطلوب' });

    try {
      const aiResult = await processLocalAIQuery(query, userId || 'usr-admin');
      res.json(aiResult);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for dev
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Mizan DZ Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
