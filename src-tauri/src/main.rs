// Prevents additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

fn start_backend(app: &tauri::AppHandle) -> Result<Child, String> {
    let resource_dir = app
        .path_resolver()
        .resource_dir()
        .ok_or_else(|| "تعذر تحديد مجلد موارد التطبيق".to_string())?;

    let node = resource_dir.join("node.exe");
    let server = resource_dir.join("server.cjs");

    if !node.exists() {
        return Err(format!("node.exe غير موجود: {}", node.display()));
    }
    if !server.exists() {
        return Err(format!("server.cjs غير موجود: {}", server.display()));
    }

    let child = Command::new(&node)
        .arg(&server)
        .env("NODE_ENV", "production")
        .env("MIZAN_RESOURCE_DIR", &resource_dir)
        .current_dir(&resource_dir)
        .spawn()
        .map_err(|e| format!("فشل تشغيل خادم Mizan DZ: {e}"))?;

    Ok(child)
}

fn main() {
    let backend = Mutex::new(None::<Child>);

    tauri::Builder::default()
        .manage(backend)
        .setup(|app| {
            let child = start_backend(&app.handle())
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            *app.state::<Mutex<Option<Child>>>().lock().unwrap() = Some(child);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Mizan DZ application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app_handle.try_state::<Mutex<Option<Child>>>() {
                    if let Some(mut child) = state.lock().unwrap().take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        });
}
