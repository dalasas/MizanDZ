# Mizan DZ — ميزان الجزائر لإدارة المحلات والمبيعات (Offline-First POS)

**ميزان (Mizan DZ V1.0)** هو نظام تجاري متكامل ومستقل يعمل على أجهزة **Windows Desktop** بدون الحاجة للاتصال بالإنترنت (**100% Offline-First**)، مخصص لإدارة السوبرماركت، المحلات التجارية، ونقاط البيع في الجزائر.

---

## 🚀 المميزات الرئيسية (Core Features)

* 🛒 **نقطة البيع السريعة (POS)**: واجهة بيع شاشة لمس/لوحة مفاتيح خفيفة مع دعم اختصارات السريعة (F1, F2, F6) وماسح الباركود.
* 📦 **إدارة المخزون والمنتجات (Inventory & Products)**: متابعة كميات المخزون، حدود التنبيه بالنقص، وتحديد أسعار الشراء والبيع للجملة والتجزئة.
* 🧾 **الفواتير والطباعة (Invoices & Thermal Printing)**: طباعة الفواتير الحرارية بقياسات (80mm و 58mm) وطباعة A4 مع الشعار وتفاصيل المحل.
* 👥 **إدارة الزبائن والديون (Customers & Debts)**: دفتر ديون الزبائن، متابعة الأقساط، وكشوفات الحساب.
* 🚚 **إدارة الموردين والمشتريات (Suppliers & Purchases)**: تسجيل فواتير السلع المدخلة وتتبع مستحقات الموردين.
* 💸 **المصاريف والخزينة (Expenses & Cash Flow)**: تسجيل المصاريف التشغيلية (كراء، كهرباء، أجور) وحساب صافي الأرباح.
* 📊 **التقارير المالية (Reports & Analytics)**: أرباح يومية، حركة المخزون، والتقرير المالي النهائي.
* 💾 **النسخ الاحتياطي التلقائي (Automatic SQLite Backup)**: حماية كاملة للبيانات وحفظها محلياً في مجلد المستندات الخاص بالعميل (`%APPDATA%/MizanDZ/`).
* 🌐 **واجهة باللغة العربية والفرنسية (Arabic/French UI)**: دعم محلي ممتاز للتجار في الجزائر.

---

## 🏗️ المعمارية التقنية (Architecture & Stack)

* **Frontend Framework**: React 18 + TypeScript + Vite + Tailwind CSS
* **Desktop Runtime**: Tauri (Rust-based ultra-lightweight desktop container)
* **Embedded Database**: SQLite (`mizan_dz.sqlite` via sql.js / Node / Rust native driver)
* **Backend Bridge**: Node.js Express internal server compiled with `esbuild` to CommonJS (`dist/server.cjs`)
* **Styling & UI**: Modern RTL Arabic-first interface with Lucide React icons

---

## 📁 المجلدات والملفات الرئيسية (Directory Structure)

```text
mizan-dz/
├── src/                    # كود الواجهة الأمامية (React Components, Pages, State)
│   ├── components/         # المكونات والواجهات (POS, Products, Purchases, Reports...)
│   └── lib/                # مكتبات المحرك وقاعدة البيانات (db.ts, ai.ts...)
├── src-tauri/              # إعدادات وكود تطبيق Tauri للويندوز (Rust desktop wrapper)
│   ├── Cargo.toml          # ملف الاعتمادات لمشروع Rust
│   ├── tauri.conf.json     # إعدادات تطبيق Tauri والهوية والأيقونات
│   └── icons/              # أيقونات تطبيق الويندوز (ico, png, icns)
├── server.ts               # الخادم الداخلي لمعالجة استعلامات قاعدة بيانات SQLite
├── package.json            # الاعتمادات وأوامر التشغيل والبناء
├── WINDOWS_BUILD.md        # دليل بناء ملف التثبيت (.msi/.exe) على نظام الويندوز
├── RELEASE_CHECKLIST.md    # قائمة التحقق من الجاهزية قبل الإصدار
└── README.md               # التوثيق الرسمي للمشروع
```

---

## 🛠️ أوامر التشغيل والبناء (Scripts)

### تشغيل البيئة التطويرية (Development):
```cmd
npm run dev
```

### فحص الكود وأنواع TypeScript (Lint & Type Check):
```cmd
npm run lint
```

### بناء حزمة الإنتاج (Production Build):
```cmd
npm run build
```

### بناء مثبت الويندوز النهائي (Tauri Desktop Build):
```cmd
npm run tauri:build
```

---

## 🔒 حماية وسلامة البيانات (Data Security)

* تُحفظ جميع البيانات التجارية والمالية داخل ملف SQLite محلي آمن في مسار الويندوز الخاص بالمستخدم: `%APPDATA%/MizanDZ/database/mizan_dz.sqlite`.
* تُحفظ النسخ الاحتياطية تلقائياً في `%APPDATA%/MizanDZ/backups/`.
* عند إلغاء تثبيت التطبيق، تظل ملفات قاعدة البيانات محتفظاً بها بأمان ولا تُحذف لتجنب فقدان سجلات المحل.

---

## 📄 الترخيص (License)
Mizan DZ — All Rights Reserved © 2026.
