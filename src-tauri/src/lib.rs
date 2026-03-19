use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub session_count: usize,
    pub last_modified: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub name: String,
    pub path: String,
    pub last_modified: String,
    pub size: u64,
}

#[tauri::command]
fn get_projects() -> Result<Vec<Project>, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let projects_dir = home.join(".claude/projects");

    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects: Vec<Project> = vec![];

    if let Ok(entries) = fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();

                if name.starts_with('.') {
                    continue;
                }

                let session_count = fs::read_dir(&path)
                    .map(|entries| {
                        entries.flatten()
                            .filter(|e| e.path().to_string_lossy().ends_with(".jsonl"))
                            .count()
                    })
                    .unwrap_or(0);

                if session_count == 0 {
                    continue;
                }

                let mut last_modified = String::new();
                if let Ok(entries) = fs::read_dir(&path) {
                    if let Some(first) = entries.flatten().find(|e| e.path().to_string_lossy().ends_with(".jsonl")) {
                        if let Ok(metadata) = first.metadata() {
                            if let Ok(time) = metadata.modified() {
                                if let Ok(duration) = time.duration_since(std::time::UNIX_EPOCH) {
                                    last_modified = format!("{}", duration.as_secs());
                                }
                            }
                        }
                    }
                }

                let display_name = name
                    .replace("-Users-liuyibi-Desktop-", "")
                    .replace("-", " / ");

                projects.push(Project {
                    id: name,
                    name: display_name,
                    path: path.to_string_lossy().to_string(),
                    session_count,
                    last_modified,
                });
            }
        }
    }

    projects.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    Ok(projects)
}

#[tauri::command]
fn get_sessions(project_id: String) -> Result<Vec<Session>, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let project_path = home.join(".claude/projects").join(&project_id);

    if !project_path.exists() {
        return Err("Project not found".to_string());
    }

    let mut sessions: Vec<Session> = vec![];

    if let Ok(entries) = fs::read_dir(&project_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            let filename = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");

            if !filename.ends_with(".jsonl") {
                continue;
            }

            let id = filename.replace(".jsonl", "");

            let mut last_modified = String::new();
            let mut size = 0u64;

            if let Ok(metadata) = entry.metadata() {
                if let Ok(time) = metadata.modified() {
                    if let Ok(duration) = time.duration_since(std::time::UNIX_EPOCH) {
                        last_modified = format!("{}", duration.as_secs());
                    }
                }
                size = metadata.len();
            }

            sessions.push(Session {
                id: id.clone(),
                name: id,
                path: path.to_string_lossy().to_string(),
                last_modified,
                size,
            });
        }
    }

    sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    Ok(sessions)
}

#[tauri::command]
fn get_messages(session_path: String) -> Result<String, String> {
    fs::read_to_string(&session_path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![get_projects, get_sessions, get_messages])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
