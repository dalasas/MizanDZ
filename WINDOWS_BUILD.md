# Mizan DZ — دليل بناء تطبيق الويندوز (Windows Desktop Build Guide)

هذا الدليل يشرح خطوة بخطوة كيفية بناء وتجهيز حزمة التثبيت المستقلة **(.msi / .exe)** لبرنامج **ميزان (Mizan DZ)** على نظام التشغيل Windows 10 أو Windows 11.

---

## 📋 المتطلبات الأساسية للنظام (Prerequisites)

قبل البدء بالبناء، يجب تثبيت البرامج والأدوات التالية على جهاز الويندوز:

1. **Node.js LTS**:
   - قم بتنزيل وتثبيت أحدث إصدار LTS من [Node.js Official Website](https://nodejs.org/).
   - التأكد من تثبيته بفتح Terminal/PowerShell وتشغيل:
     ```cmd
     node -v
     npm -v
     ```

2. **Rust & Cargo (Rust Toolchain)**:
   - قم بتنزيل مثبت Rust الرسمي للويندوز `rustup-init.exe` من [rustup.rs](https://rustup.rs/).
   - قم بتشغيله واختيار الخيار الافتراضي (Default installation: `x86_64-pc-windows-msvc`).
   - التأكد من التثبيت:
     ```cmd
     rustc --version
     cargo --version
     ```

3. **Microsoft C++ Build Tools & Windows SDK**:
   - قم بتنزيل **Visual Studio Installer** أو **Build Tools for Visual Studio** من [Microsoft Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
   - أثناء التثبيت، حدد بيئة العمل: **Desktop development with C++** (تطوير سطح المكتب باستخدام C++).
   - تأكد من اختيار **MSVC v143 - VS 2022 C++ x64/x86 build tools** و **Windows 10/11 SDK**.

4. **WebView2 Runtime** (مدمج افتراضياً في Windows 11 و Windows 10 الحديث):
   - إذا كنت تستخدم نسخت ويندوز قديمة، قم بتنزيل **Evergreen Standalone Installer** من [Microsoft Edge WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

---

## 🛠️ خطوات بناء البرنامج (Step-by-Step Build)

### 1. استنساخ/فتح المشروع
افتح موجه الأوامر (PowerShell أو CMD) في المجلد الرئيسي للمشروع:
```cmd
cd mizan-dz
```

### 2. تثبيت الحزم والمكتبات (Dependencies)
```cmd
npm install
```

### 3. بناء واجهة المستخدم وسيرفر Node المدمج (Production Frontend Build)
```cmd
npm run build
```
*(هذا الأمر يقوم بفرز وتجميع الملفات في مجلد `dist/` وتجميع السيرفر إلى `dist/server.cjs`)*

### 4. بناء حزمة الويندوز بواسطة Tauri (Tauri Windows Desktop Build)
```cmd
npm run tauri:build
```
أو استخدام npx مباشرة:
```cmd
npx tauri build
```

---

## 📦 موقع ملفات التثبيت الناتجة (Output Installers Location)

بعد اكتمال عملية البناء بنجاح، ستجد ملفات التثبيت الحقيقية في المسارات التالية:

### 1. مثبت MSI (Windows Installer):
```text
src-tauri/target/release/bundle/msi/Mizan DZ_1.0.0_x64_en-US.msi
```

### 2. مثبت NSIS (EXE Setup):
```text
src-tauri/target/release/bundle/nsis/Mizan DZ_1.0.0_x64-setup.exe
```

---

## 🗄️ مسارات حفظ البيانات والتأمين بعد التثبيت (Desktop Data Storage)

عند تثبيت وتغليف البرنامج على جهاز العميل:
- **قاعدة البيانات الرئسية (SQLite)**:
  `%APPDATA%/MizanDZ/database/mizan_dz.sqlite`
- **النسخ الاحتياطية (Automatic Backups)**:
  `%APPDATA%/MizanDZ/backups/`
- **سجلات النظام والطباعة (Logs & Invoices)**:
  `%APPDATA%/MizanDZ/logs/` و `%APPDATA%/MizanDZ/invoices/`

### 🛡️ سلامة البيانات عند إلغاء التثبيت (Uninstall Safety):
عند إلغاء تثبيت التطبيق عبر لوحة تحكم الويندوز (Control Panel / Settings)، تظل قواعد البيانات والنسخ الاحتياطية محفوظة بأمان داخل مجلد `%APPDATA%/MizanDZ` ولن تُحذف تلقائياً لضمان عدم ضياع السجلات المالية والتجارية للعميل.
