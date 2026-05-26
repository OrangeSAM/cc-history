use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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

                // Strip the "-Users-<username>-" prefix (works for any username)
                let display_name = {
                    let stripped = if name.starts_with("-Users-") {
                        // Find the third '-' to get past "-Users-<username>-"
                        let after_users = &name[7..]; // skip "-Users-"
                        if let Some(pos) = after_users.find('-') {
                            &name[7 + pos + 1..] // skip past username segment
                        } else {
                            &name[..]
                        }
                    } else {
                        &name[..]
                    };
                    stripped.replace("-", " / ")
                };

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

#[derive(Debug, Serialize, Deserialize)]
pub struct UsageStats {
    pub daily_usage: Vec<DailyUsage>,
    pub project_usage: Vec<ProjectUsage>,
    pub model_usage: Vec<ModelUsage>,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cache_read_tokens: u64,
    pub total_cache_write_tokens: u64,
    pub period_days: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyUsage {
    pub date: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectUsage {
    pub project_id: String,
    pub project_name: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub session_count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelUsage {
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
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

#[tauri::command]
fn get_usage_stats() -> Result<UsageStats, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let projects_dir = home.join(".claude/projects");

    if !projects_dir.exists() {
        return Ok(UsageStats {
            daily_usage: vec![],
            project_usage: vec![],
            model_usage: vec![],
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cache_read_tokens: 0,
            total_cache_write_tokens: 0,
            period_days: 30,
        });
    }

    let mut daily_map: HashMap<String, DailyUsage> = HashMap::new();
    let mut project_map: HashMap<String, ProjectUsage> = HashMap::new();
    let mut model_map: HashMap<String, ModelUsage> = HashMap::new();

    if let Ok(entries) = fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let project_path = entry.path();
            if !project_path.is_dir() {
                continue;
            }

            let project_name_raw = project_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            if project_name_raw.starts_with('.') {
                continue;
            }

            // Strip "-Users-<username>-" prefix for display
            let display_name = {
                let stripped = if project_name_raw.starts_with("-Users-") {
                    let after_users = &project_name_raw[7..];
                    if let Some(pos) = after_users.find('-') {
                        &project_name_raw[7 + pos + 1..]
                    } else {
                        &project_name_raw[..]
                    }
                } else {
                    &project_name_raw[..]
                };
                stripped.replace("-", " / ")
            };

            let mut session_count = 0u32;

            if let Ok(session_entries) = fs::read_dir(&project_path) {
                for session_entry in session_entries.flatten() {
                    let session_path = session_entry.path();
                    if !session_path.to_string_lossy().ends_with(".jsonl") {
                        continue;
                    }

                    session_count += 1;

                    let file = match fs::File::open(&session_path) {
                        Ok(f) => f,
                        Err(_) => continue,
                    };
                    let reader = BufReader::new(file);

                    for line in reader.lines() {
                        let line = match line {
                            Ok(l) => l,
                            Err(_) => continue,
                        };

                        let data: serde_json::Value = match serde_json::from_str(&line) {
                            Ok(d) => d,
                            Err(_) => continue,
                        };

                        if data.get("type").and_then(|v| v.as_str()) != Some("assistant") {
                            continue;
                        }

                        let usage = match data.get("message").and_then(|m| m.get("usage")) {
                            Some(u) => u,
                            None => continue,
                        };

                        let input_tokens = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        let output_tokens = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        let cache_read = usage.get("cache_read_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        let cache_write = usage.get("cache_creation_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);

                        let model = data.get("message")
                            .and_then(|m| m.get("model"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string();

                        // Extract date from timestamp (YYYY-MM-DD)
                        let date = data.get("timestamp")
                            .and_then(|v| v.as_str())
                            .map(|ts| ts.chars().take(10).collect::<String>())
                            .unwrap_or_else(|| "unknown".to_string());

                        // Aggregate by day
                        daily_map.entry(date.clone())
                            .and_modify(|d| {
                                d.input_tokens += input_tokens;
                                d.output_tokens += output_tokens;
                                d.cache_read_tokens += cache_read;
                                d.cache_write_tokens += cache_write;
                            })
                            .or_insert(DailyUsage {
                                date,
                                input_tokens,
                                output_tokens,
                                cache_read_tokens: cache_read,
                                cache_write_tokens: cache_write,
                            });

                        // Aggregate by project
                        project_map.entry(project_name_raw.clone())
                            .and_modify(|p| {
                                p.input_tokens += input_tokens;
                                p.output_tokens += output_tokens;
                                p.cache_read_tokens += cache_read;
                                p.cache_write_tokens += cache_write;
                            })
                            .or_insert(ProjectUsage {
                                project_id: project_name_raw.clone(),
                                project_name: display_name.clone(),
                                input_tokens,
                                output_tokens,
                                cache_read_tokens: cache_read,
                                cache_write_tokens: cache_write,
                                session_count: 0,
                            });

                        // Aggregate by model
                        model_map.entry(model.clone())
                            .and_modify(|m| {
                                m.input_tokens += input_tokens;
                                m.output_tokens += output_tokens;
                            })
                            .or_insert(ModelUsage {
                                model,
                                input_tokens,
                                output_tokens,
                            });
                    }
                }
            }

            // Update session_count for the project
            if let Some(p) = project_map.get_mut(&project_name_raw) {
                p.session_count = session_count;
            }
        }
    }

    // Collect and sort
    let mut daily_usage: Vec<DailyUsage> = daily_map.into_values().collect();
    daily_usage.sort_by(|a, b| a.date.cmp(&b.date));

    let mut project_usage: Vec<ProjectUsage> = project_map.into_values().collect();
    project_usage.sort_by(|a, b| (b.input_tokens + b.output_tokens).cmp(&(a.input_tokens + a.output_tokens)));

    let mut model_usage: Vec<ModelUsage> = model_map.into_values().collect();
    model_usage.sort_by(|a, b| (b.input_tokens + b.output_tokens).cmp(&(a.input_tokens + a.output_tokens)));

    // Keep only last 30 days for daily
    if daily_usage.len() > 30 {
        daily_usage = daily_usage.split_off(daily_usage.len() - 30);
    }

    let total_input_tokens: u64 = project_usage.iter().map(|p| p.input_tokens).sum();
    let total_output_tokens: u64 = project_usage.iter().map(|p| p.output_tokens).sum();
    let total_cache_read_tokens: u64 = project_usage.iter().map(|p| p.cache_read_tokens).sum();
    let total_cache_write_tokens: u64 = project_usage.iter().map(|p| p.cache_write_tokens).sum();

    Ok(UsageStats {
        daily_usage,
        project_usage,
        model_usage,
        total_input_tokens,
        total_output_tokens,
        total_cache_read_tokens,
        total_cache_write_tokens,
        period_days: 30,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![get_projects, get_sessions, get_messages, get_session_previews, get_usage_stats])
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
