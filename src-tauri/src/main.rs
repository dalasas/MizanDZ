// Prevents additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{create_dir_all, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{api::dialog, Manager, RunEvent};

fn ensure_log_dir(app: &tauri::AppHandle) -> PathBuf {
    // Prefer the app_config_dir for storing logs, fallback to resource_dir
    let base = app
        .path_resolver()
        .app_config_dir()
        .or_else(|| app.path_resolver().resource_dir())
        .unwrap_or_else(|| PathBuf::from("."));
    let log_dir = base.join("mizan_logs");
    if let Err(e) = create_dir_all(&log_dir) {
        // best-effort
        eprintln!("Failed to create log dir: {:?}", e);
    }
    log_dir
}

fn spawn_child_and_log(mut cmd: Command, log_path: PathBuf) -> Result<Child, String> {
    // Ensure stdout/stderr pipes
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("فشل تشغيل خادم Mizan DZ: {e}"))?;

    // Spawn thread to capture stdout
    if let Some(stdout) = child.stdout.take() {
        let log_path_clone = log_path.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path_clone)
            {
                for line in reader.lines() {
                    if let Ok(text) = line {
                        let _ = writeln!(file, "[backend stdout] {}", text);
                    }
                }
            }
        });
    }

    // Spawn thread to capture stderr
    if let Some(stderr) = child.stderr.take() {
        let log_path_clone = log_path.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path_clone)
            {
                for line in reader.lines() {
                    if let Ok(text) = line {
                        let _ = writeln!(file, "[backend stderr] {}", text);
                    }
                }
            }
        });
    }

    Ok(child)
}

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

    // Logging path
    let log_dir = ensure_log_dir(app);
    let log_file = log_dir.join("mizan-backend.log");

    let mut cmd = Command::new(&node);
    cmd.arg(&server)
        .env("NODE_ENV", "production")
        .env("MIZAN_RESOURCE_DIR", &resource_dir)
        .current_dir(&resource_dir);

    spawn_child_and_log(cmd, log_file)
}

fn main() {
    let backend = Arc::new(Mutex::new(None::<Child>));

    tauri::Builder::default()
        .manage(backend.clone())
        .setup(|app| {
            match start_backend(&app.handle()) {
                Ok(child) => {
                    *app.state::<Arc<Mutex<Option<Child>>>>().lock().unwrap() = Some(child);
                    Ok(())
                }
                Err(err_msg) => {
                    // Write the error to a file in config dir and resource dir for diagnostics
                    if let Some(cfg_dir) = app.path_resolver().app_config_dir() {
                        let _ = std::fs::create_dir_all(&cfg_dir);
                        let _ = std::fs::write(cfg_dir.join("mizan-backend-error.txt"), &err_msg);
                    }
                    if let Some(res_dir) = app.path_resolver().resource_dir() {
                        let _ = std::fs::create_dir_all(&res_dir);
                        let _ = std::fs::write(res_dir.join("mizan-backend-error.txt"), &err_msg);
                    }

                    // In debug builds allow the UI to open for developers; in release builds fail loudly so the user sees the diagnostic.
                    #[cfg(debug_assertions)]
                    {
                        if let Some(window) = app.get_window("main") {
                            let _ = dialog::message(Some(&window), "Backend failed to start", &err_msg);
                        }
                        Ok(())
                    }

                    #[cfg(not(debug_assertions))]
                    {
                        eprintln!("Backend failed to start: {}", err_msg);
                        // Exit with non-zero so the failure is obvious in production
                        std::process::exit(1);
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Mizan DZ application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app_handle.try_state::<Arc<Mutex<Option<Child>>>>() {
                    if let Some(mut child) = state.lock().unwrap().take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        });
}
