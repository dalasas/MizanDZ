# Mizan DZ — Windows build package

تم تجهيز المشروع ليُبنى كتطبيق Windows عبر Tauri مع:

- واجهة React/Vite.
- Backend محلي يعمل عبر Node.js مضمّن داخل موارد التطبيق.
- SQLite/SQL.js مع ملف WASM مضمّن.
- NSIS EXE وMSI.
- إيقاف الـ backend عند إغلاق التطبيق.
- ربط قاعدة البيانات بمجلد `%APPDATA%\MizanDZ`.
- GitHub Actions لبناء Windows تلقائيًا.

هذه الحزمة هي **مصدر Windows-ready** وليست ملف EXE مُجمّعًا مسبقًا، لأن بيئة التنفيذ الحالية ليست Windows ولا تحتوي toolchain الخاصة بـ Tauri/Visual C++ اللازمة لإنتاج EXE موثوق.
