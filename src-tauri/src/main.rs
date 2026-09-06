// Prevents an additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{Manager, RunEvent};

const BACKEND_HOST: &str = "127.0.0.1";
const BACKEND_PORT: u16 = 3000;

fn backend_is_ready() -> bool {
    TcpStream::connect_timeout(
        &format!("{}:{}", BACKEND_HOST, BACKEND_PORT)
            .parse()
            .expect("valid backend address"),
        Duration::from_millis(250),
    )
    .is_ok()
}

fn start_backend(app: &tauri::AppHandle) -> Result<Child, String> {
    let resource_dir = app
        .path_resolver()
        .resource_dir()
        .ok_or_else(|| "تعذر تحديد مجلد موارد التطبيق".to_string())?;

    let node = resource_dir.join("node.exe");
    let server = resource_dir.join("server.cjs");

    if !node.exists() {
        return Err(format!(
            "node.exe غير موجود: {}",
            node.display()
        ));
    }

    if !server.exists() {
        return Err(format!(
            "server.cjs غير موجود: {}",
            server.display()
        ));
    }

    let mut child = Command::new(&node)
        .arg(&server)
        .env("NODE_ENV", "production")
        .env("MIZAN_RESOURCE_DIR", &resource_dir)
        .current_dir(&resource_dir)
        .spawn()
        .map_err(|e| format!("فشل تشغيل خادم Mizan DZ: {e}"))?;

    // Wait until the local API server is actually listening.
    for _ in 0..40 {
        thread::sleep(Duration::from_millis(250));

        if backend_is_ready() {
            return Ok(child);
        }

        if let Ok(Some(status)) = child.try_wait() {
            return Err(format!(
                "خادم Mizan DZ توقف قبل أن يصبح جاهزاً (exit status: {status})"
            ));
        }
    }

    let _ = child.kill();
    let _ = child.wait();

    Err(format!(
        "لم يصبح خادم Mizan DZ جاهزاً على http://{}:{} خلال 10 ثوانٍ",
        BACKEND_HOST, BACKEND_PORT
    ))
}

fn main() {
    let backend = Mutex::new(None::<Child>);

    tauri::Builder::default()
        .manage(backend)
        .setup(|app| {
            let child = start_backend(&app.handle())
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

            *app.state::<Mutex<Option<Child>>>()
                .lock()
                .unwrap() = Some(child);

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Mizan DZ application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(state) =
                    app_handle.try_state::<Mutex<Option<Child>>>()
                {
                    if let Some(mut child) =
                        state.lock().unwrap().take()
                    {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        });
}
