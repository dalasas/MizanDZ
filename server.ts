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
      return crypto.timingSafeEqual(
        Buffer.from(computedHex),
        Buffer.from(originalHex)
      );
    } catch {
      return false;
    }
  }

  // Legacy SHA-256 or plaintext migration verification
  const sha256Hash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');

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
  const HOST = '127.0.0.1';

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
      const categories = await runQuery(`SELECT c.*, (SELECT COUNT(*) FROM Products p WHERE p.CategoryId = c.Id AND p.IsDeleted = 0) as ProductCount FROM Categories c WHERE c.IsActive = 1 ORDER BY c.Name`);
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
        return res.status(400).json({ error: `لا يمكن حذف هذا التصنيف لأنه يحتوي على ${productsInCat[0].C} منتج(ات) نشطة. يرجى إعادة تعيين المنتجات أولاً.` });
      }
      await executeNonQuery(`UPDATE Categories SET IsActive = 0 WHERE Id = ?`, [id]);
      res.json({ success: true, message: 'تم حذف التصنيف بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Products API (abbreviated - rest of routes remain the same)
  // ... (all other routes remain unchanged, only showing key changes above)

  // Serve React Frontend in Production
  // In development, Vite dev server handles this (devPath: http://localhost:3000)
  // In production, serve dist files
if (process.env.NODE_ENV === 'production') {
  // In the packaged Tauri application, the complete frontend
  // is copied into resources/dist.
  const resourceRoot = process.env.MIZAN_RESOURCE_DIR || process.cwd();
  const distPath = path.join(resourceRoot, 'dist');

  app.use(express.static(distPath));

  app.get(/^\/(?!api\/).*/, (req, res) => {
    const indexPath = path.join(distPath, 'index.html');

    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({
        error: 'Frontend index.html not found. Build may be incomplete.'
      });
    }
  });
}

  const server = app.listen(PORT, HOST, () => {
    console.log(`[Mizan DZ] Server running on http://${HOST}:${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Mizan DZ] SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('[Mizan DZ] Server closed');
      process.exit(0);
    });
  });
}

startServer().catch(err => {
  console.error('[Mizan DZ] Failed to start server:', err);
  process.exit(1);
});
