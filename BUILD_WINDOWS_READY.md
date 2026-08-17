# Mizan DZ — Windows Ready

هذه النسخة مهيأة لبناء مثبت Windows مستقل نسبيًا: يتم تضمين `node.exe` وbackend وملف `sql-wasm.wasm` داخل موارد Tauri، لذلك لا يحتاج المستخدم النهائي إلى تثبيت Node.js.

## البناء على Windows

1. ثبّت Node.js 22 LTS وRust وVisual Studio C++ Build Tools.
2. نفّذ `npm ci`.
3. ضع `node.exe` في `src-tauri/resources/node.exe`، أو استخدم GitHub Actions الذي ينزله تلقائيًا.
4. نفّذ `npm run tauri:build`.
5. ستجد المثبت داخل `src-tauri/target/release/bundle/nsis/`.

## البناء عبر GitHub Actions

ارفع المشروع إلى GitHub، ثم افتح Actions وشغّل `Build Mizan DZ for Windows`. سيُبنى NSIS EXE وMSI على Windows ويُرفعان كـ Artifacts.

> ملاحظة: لا يمكنني من بيئة Linux الحالية اختبار تشغيل EXE نفسه. تم تعديل التغليف لتجنب الاعتماد على Node المثبت على جهاز المستخدم، لكن الاختبار النهائي يجب أن يتم على Windows.
