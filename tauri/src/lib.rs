use serde::{Deserialize, Serialize};
use std::fs;
use std::io::BufRead;
use std::io::BufReader;

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

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionPreview {
    pub id: String,
    pub preview: String,
    pub message_count: usize,
    pub last_modified: String,
}

#[tauri::command]
fn get_session_previews(project_id: String) -> Result<Vec<SessionPreview>, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let project_path = home.join(".claude/projects").join(&project_id);

    if !project_path.exists() {
        return Err("Project not found".to_string());
    }

    let mut previews: Vec<SessionPreview> = vec![];

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

            // 读取文件获取预览
            let file = match fs::File::open(&path) {
                Ok(f) => f,
                Err(_) => continue,
            };
            let reader = BufReader::new(file);

            // 先统计总行数（消息数量）
            let message_count = reader.lines().count();

            // 重新打开文件获取预览
            let file = match fs::File::open(&path) {
                Ok(f) => f,
                Err(_) => continue,
            };
            let reader = BufReader::new(file);

            let mut lines: Vec<String> = vec![];
            let mut last_modified = String::new();

            for line in reader.lines().take(20) {
                if let Ok(line) = line {
                    lines.push(line.clone());

                    // 尝试解析获取第一条消息的时间戳
                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&line) {
                        if last_modified.is_empty() {
                            // 支持秒级时间戳数字或字符串
                            if let Some(ts) = data.get("timestamp") {
                                if let Some(ts_str) = ts.as_str() {
                                    // 如果是数字字符串，转换为 i64
                                    if let Ok(ts_num) = ts_str.parse::<i64>() {
                                        last_modified = ts_num.to_string();
                                    }
                                } else if let Some(ts_num) = ts.as_i64() {
                                    last_modified = ts_num.to_string();
                                }
                            }
                        }
                    }
                }
            }

            // 从消息中提取预览文本
            let mut preview = String::new();
            for line in &lines {
                if let Ok(data) = serde_json::from_str::<serde_json::Value>(line) {
                    let msg_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("");
                    if msg_type == "user" {
                        if let Some(content) = data.get("message").and_then(|m| m.get("content")) {
                            if let Some(text) = content.as_str() {
                                preview = text.chars().take(100).collect();
                                if text.len() > 100 {
                                    preview.push_str("...");
                                }
                                break;
                            } else if let Some(arr) = content.as_array() {
                                if let Some(first) = arr.first() {
                                    if let Some(text) = first.get("text").and_then(|v| v.as_str()) {
                                        preview = text.chars().take(100).collect();
                                        if text.len() > 100 {
                                            preview.push_str("...");
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 获取文件修改时间
            if last_modified.is_empty() {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(time) = metadata.modified() {
                        if let Ok(duration) = time.duration_since(std::time::UNIX_EPOCH) {
                            last_modified = duration.as_secs().to_string();
                        }
                    }
                }
            }

            previews.push(SessionPreview {
                id,
                preview,
                message_count,
                last_modified,
            });
        }
    }

    previews.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    Ok(previews)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![get_projects, get_sessions, get_messages, get_session_previews])
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
