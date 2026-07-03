use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::BufRead;
use std::io::BufReader;
use std::path::Path;

/// Recursively find all .jsonl files under a directory.
/// Returns (relative_id, full_path) where relative_id is the path relative to the
/// project directory with the .jsonl extension stripped.
fn find_jsonl_files(dir: &Path) -> Vec<(String, std::path::PathBuf)> {
    let mut results = Vec::new();
    find_jsonl_files_impl(dir, dir, &mut results);
    results
}

fn find_jsonl_files_impl(base: &Path, current: &Path, results: &mut Vec<(String, std::path::PathBuf)>) {
    let Ok(entries) = fs::read_dir(current) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else { continue };
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            find_jsonl_files_impl(base, &path, results);
        } else if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            let rel = path.strip_prefix(base).unwrap_or(&path);
            let id = rel.with_extension("").to_string_lossy().to_string();
            results.push((id, path));
        }
    }
}

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

                let jsonl_files = find_jsonl_files(&path);
                let session_count = jsonl_files.len();

                if session_count == 0 {
                    continue;
                }

                let mut last_modified = String::new();
                if let Some((_, first_path)) = jsonl_files.first() {
                    if let Ok(metadata) = first_path.metadata() {
                        if let Ok(time) = metadata.modified() {
                            if let Ok(duration) = time.duration_since(std::time::UNIX_EPOCH) {
                                last_modified = format!("{}", duration.as_secs());
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

    for (id, path) in find_jsonl_files(&project_path) {
        let mut last_modified = String::new();
        let mut size = 0u64;

        if let Ok(metadata) = path.metadata() {
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

#[derive(Debug, Serialize, Deserialize)]
pub struct HermesSession {
    pub id: String,
    pub model: String,
    pub title: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub estimated_cost_usd: f64,
    pub billing_provider: String,
    pub message_count: u32,
    pub tool_call_count: u32,
    pub started_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HermesMessage {
    pub id: u64,
    pub role: String,
    pub content: String,
    pub reasoning: Option<String>,
    pub timestamp: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CodexSession {
    pub id: String,
    pub title: String,
    pub model: String,
    pub cwd: String,
    pub created_at: String,
    pub updated_at: String,
    pub tokens_used: u64,
    pub first_user_message: String,
    pub rollout_path: String,
    pub preview: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CodexMessage {
    pub role: String,
    pub content: String,
    pub reasoning: Option<String>,
    pub timestamp: String,
}

#[tauri::command]
fn get_session_previews(project_id: String) -> Result<Vec<SessionPreview>, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let project_path = home.join(".claude/projects").join(&project_id);

    if !project_path.exists() {
        return Err("Project not found".to_string());
    }

    let mut previews: Vec<SessionPreview> = vec![];

    for (id, path) in find_jsonl_files(&project_path) {
        let file = match fs::File::open(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let reader = BufReader::new(file);

        let message_count = reader.lines().count();

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

                if let Ok(data) = serde_json::from_str::<serde_json::Value>(&line) {
                    if last_modified.is_empty() {
                        if let Some(ts) = data.get("timestamp") {
                            if let Some(ts_str) = ts.as_str() {
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

        if last_modified.is_empty() {
            if let Ok(metadata) = path.metadata() {
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

    previews.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    Ok(previews)
}

fn ts_to_date(secs: f64) -> String {
    let secs = secs as i64;
    let days = secs / 86400;
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02}", y, m, d)
}

#[tauri::command]
fn get_usage_stats(source: String) -> Result<UsageStats, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let projects_dir = home.join(".claude/projects");

    if !projects_dir.exists() && source != "hermes" {
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

    if source != "hermes" {
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

            let jsonl_files = find_jsonl_files(&project_path);
            let session_count = jsonl_files.len() as u32;

            for (_id, session_path) in &jsonl_files {
                let file = match fs::File::open(session_path) {
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

            // Update session_count for the project
            if let Some(p) = project_map.get_mut(&project_name_raw) {
                p.session_count = session_count;
            }
        }
    }
    }

    // Collect Hermes data from state.db
    if source != "claude" {
        let hermes_db = home.join(".hermes/state.db");
        if hermes_db.exists() {
        if let Ok(conn) = Connection::open(&hermes_db) {
            if let Ok(mut stmt) = conn.prepare(
                "SELECT COALESCE(model,''), input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, started_at
                 FROM sessions WHERE input_tokens > 0 OR output_tokens > 0"
            ) {
                if let Ok(rows) = stmt.query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, u64>(1)?,
                        row.get::<_, u64>(2)?,
                        row.get::<_, u64>(3)?,
                        row.get::<_, u64>(4)?,
                        row.get::<_, f64>(5).unwrap_or(0.0),
                    ))
                }) {
                    let mut hermes_input: u64 = 0;
                    let mut hermes_output: u64 = 0;
                    let mut hermes_cache_read: u64 = 0;
                    let mut hermes_cache_write: u64 = 0;
                    let hermes_id = "__hermes__".to_string();
                    let hermes_name = "Hermes".to_string();
                    let mut session_count: u32 = 0;

                    for row in rows.flatten() {
                        let (model, input, output, cache_read, cache_write, started_at) = row;
                        hermes_input += input;
                        hermes_output += output;
                        hermes_cache_read += cache_read;
                        hermes_cache_write += cache_write;
                        session_count += 1;

                        // Daily aggregation
                        let date = if started_at > 0.0 {
                            ts_to_date(started_at)
                        } else {
                            continue;
                        };

                        daily_map.entry(date)
                            .and_modify(|d| {
                                d.input_tokens += input;
                                d.output_tokens += output;
                                d.cache_read_tokens += cache_read;
                                d.cache_write_tokens += cache_write;
                            })
                            .or_insert(DailyUsage {
                                date: "".to_string(), // placeholder, overwritten below if needed
                                input_tokens: input,
                                output_tokens: output,
                                cache_read_tokens: cache_read,
                                cache_write_tokens: cache_write,
                            });

                        // Model aggregation
                        model_map.entry(model.clone())
                            .and_modify(|m| {
                                m.input_tokens += input;
                                m.output_tokens += output;
                            })
                            .or_insert(ModelUsage {
                                model,
                                input_tokens: input,
                                output_tokens: output,
                            });
                    }

                    // Project aggregation for Hermes
                    if session_count > 0 {
                        project_map.insert(hermes_id.clone(), ProjectUsage {
                            project_id: hermes_id,
                            project_name: hermes_name,
                            input_tokens: hermes_input,
                            output_tokens: hermes_output,
                            cache_read_tokens: hermes_cache_read,
                            cache_write_tokens: hermes_cache_write,
                            session_count,
                        });
                    }
                }
            }
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

#[tauri::command]
fn get_hermes_sessions() -> Result<Vec<HermesSession>, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let db_path = home.join(".hermes/state.db");

    if !db_path.exists() {
        return Ok(vec![]);
    }

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, COALESCE(model,''), COALESCE(title,''), input_tokens, output_tokens,
                    cache_read_tokens, cache_write_tokens, estimated_cost_usd,
                    COALESCE(billing_provider,''), message_count, tool_call_count, started_at
             FROM sessions ORDER BY started_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let sessions = stmt
        .query_map([], |row| {
            Ok(HermesSession {
                id: row.get(0)?,
                model: row.get(1)?,
                title: row.get(2)?,
                input_tokens: row.get(3)?,
                output_tokens: row.get(4)?,
                cache_read_tokens: row.get(5)?,
                cache_write_tokens: row.get(6)?,
                estimated_cost_usd: row.get(7)?,
                billing_provider: row.get(8)?,
                message_count: row.get(9)?,
                tool_call_count: row.get(10)?,
                started_at: row.get::<_, f64>(11).map(|t| format!("{:.0}", t)).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(sessions)
}

#[tauri::command]
fn get_hermes_messages(session_id: String) -> Result<Vec<HermesMessage>, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let db_path = home.join(".hermes/state.db");

    if !db_path.exists() {
        return Ok(vec![]);
    }

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, role, COALESCE(content,''), reasoning, timestamp
             FROM messages WHERE session_id = ?1 ORDER BY id",
        )
        .map_err(|e| e.to_string())?;

    let messages = stmt
        .query_map([&session_id], |row| {
            Ok(HermesMessage {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                reasoning: row.get(3)?,
                timestamp: row.get::<_, f64>(4).ok().map(|t| format!("{:.0}", t)),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(messages)
}

#[tauri::command]
fn get_codex_sessions() -> Result<Vec<CodexSession>, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let db_path = home.join(".codex/state_5.sqlite");

    if !db_path.exists() {
        return Ok(vec![]);
    }

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, COALESCE(title,''), COALESCE(model,''), COALESCE(cwd,''),
                    created_at, updated_at, tokens_used,
                    COALESCE(first_user_message,''), COALESCE(rollout_path,''), COALESCE(preview,'')
             FROM threads WHERE archived = 0 ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let sessions = stmt
        .query_map([], |row| {
            let created_ts: i64 = row.get(4)?;
            let updated_ts: i64 = row.get(5)?;
            Ok(CodexSession {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                cwd: row.get(3)?,
                created_at: created_ts.to_string(),
                updated_at: updated_ts.to_string(),
                tokens_used: row.get::<_, u64>(6).unwrap_or(0),
                first_user_message: row.get(7)?,
                rollout_path: row.get(8)?,
                preview: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(sessions)
}

#[tauri::command]
fn get_codex_messages(rollout_path: String) -> Result<Vec<CodexMessage>, String> {
    let path = Path::new(&rollout_path);
    if !path.exists() {
        return Err("Rollout file not found".to_string());
    }

    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut messages: Vec<CodexMessage> = vec![];

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        let data: serde_json::Value = match serde_json::from_str(&line) {
            Ok(d) => d,
            Err(_) => continue,
        };

        let msg_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if msg_type != "response_item" {
            continue;
        }

        let payload = match data.get("payload") {
            Some(p) => p,
            None => continue,
        };

        let role = payload.get("role").and_then(|v| v.as_str()).unwrap_or("");
        let item_type = payload.get("type").and_then(|v| v.as_str()).unwrap_or("");

        // Skip non-message items (reasoning, function calls, web search, etc.)
        if item_type != "message" {
            continue;
        }

        // Skip developer messages (system prompts)
        if role == "developer" {
            continue;
        }

        let timestamp = data.get("timestamp").and_then(|v| v.as_str()).unwrap_or("").to_string();

        let content_blocks = payload.get("content").and_then(|v| v.as_array());
        let mut text_parts: Vec<String> = vec![];
        let mut reasoning_text: Option<String> = None;

        if let Some(blocks) = content_blocks {
            for block in blocks {
                let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                match block_type {
                    "input_text" | "output_text" => {
                        if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                            // Skip environment_context and permissions blocks
                            if role == "user" && (text.starts_with("<environment_context>") || text.starts_with("<permissions")) {
                                continue;
                            }
                            text_parts.push(text.to_string());
                        }
                    }
                    "reasoning" => {
                        if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                            reasoning_text = Some(text.to_string());
                        }
                    }
                    _ => {}
                }
            }
        }

        let content = text_parts.join("\n");
        if content.is_empty() && reasoning_text.is_none() {
            continue;
        }

        messages.push(CodexMessage {
            role: role.to_string(),
            content,
            reasoning: reasoning_text,
            timestamp,
        });
    }

    Ok(messages)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_projects, get_sessions, get_messages, get_session_previews, get_usage_stats, get_hermes_sessions, get_hermes_messages, get_codex_sessions, get_codex_messages])
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
