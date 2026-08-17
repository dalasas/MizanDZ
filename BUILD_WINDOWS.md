# Mizan DZ — دليل البناء على نظام الويندوز (BUILD_WINDOWS.md)

هذا المستند يشرح بالتفصيل كيفية تجميع وبناء مشروع **Mizan DZ** ليصبح برنامج تثبيت كلاسيكي لسطح المكتب **(.exe / .msi)** على نظام التشغيل Windows 10 أو Windows 11.

---

## 🛠️ المتطلبات الأساسية (Prerequisites)

لبناء مشروع Tauri على أجهزة الويندوز، يلزم توفر البيئة التالية:

1. **Node.js (LTS Version)**
   - تنزيل وتثبيت أحدث نسخة LTS من [nodejs.org](https://nodejs.org/).

2. **Rust & Cargo**
   - تنزيل وتثبيت أداة `rustup-init.exe` من [rustup.rs](https://rustup.rs/).
   - اختيار التثبيت الافتراضي (`x86_64-pc-windows-msvc`).

3. **C++ Build Tools & Windows SDK**
   - فتح **Visual Studio Installer** واختيار حزمة العمل **Desktop development with C++**.
   - التأكد من تثبيت **MSVC v143** و **Windows 10/11 SDK**.

4. **WebView2 Runtime** (مدمج افتراضياً مع Windows 11 و10 الحديثة).

---

## 🚀 الأوامر والتنفيذ (Commands)

افتح موجه الأوامر (CMD أو PowerShell) في المجلد الرئيسي للمشروع ونفذ الأوامر التالية بالترتيب:

```cmd
:: 1. تثبيت الحزم والمكتبات
npm install

:: 2. بناء واجهة المستخدم وسيرفر الخادم المدمج
npm run build

:: 3. بناء وتجميع حزمة الويندوز النهائية (Tauri Build)
npm run tauri:build
```

---

## 📂 موقع ملفات التثبيت الناتجة (Output Artifacts)

عند اكتمال البناء، ستتولى منصة Tauri إنشاء الملفات التالية:

* **MSI Installer**:
  `src-tauri/target/release/bundle/msi/Mizan DZ_1.0.0_x64_en-US.msi`
* **NSIS EXE Setup**:
  `src-tauri/target/release/bundle/nsis/Mizan DZ_1.0.0_x64-setup.exe`

---

## 🛡️ مسار قاعدة البيانات والأمان

عند تشغيل المثبت على أجهزة العملاء:
* **قاعدة البيانات**: يتم إنشاؤها تلقائياً في `%APPDATA%/MizanDZ/database/mizan_dz.sqlite`.
* **النسخ الاحتياطية**: يتم إنشاؤها في `%APPDATA%/MizanDZ/backups/`.
* **إلغاء التثبيت (Uninstall)**: يظل مجلد `%APPDATA%/MizanDZ/` محفوظاً لمنع ضياع البيانات التجارية للمحل.
