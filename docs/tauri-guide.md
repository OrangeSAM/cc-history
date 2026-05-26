# Tauri 入门指南

本文档通过这个项目（Claude History Viewer）来介绍 Tauri 的核心概念和使用方法。

## 目录

1. [什么是 Tauri？](#1-什么是-tauri)
2. [项目结构](#2-项目结构)
3. [Tauri 命令（Custom Commands）](#3-tauri-命令custom-commands)
4. [Tauri 插件（Plugins）](#4-tauri-插件plugins)
5. [权限系统（Capabilities）](#5-权限系统capabilities)
6. [前端交互](#6-前端交互)
7. [配置文件详解](#7-配置文件详解)
8. [开发与构建](#8-开发与构建)

---

## 1. 什么是 Tauri？

Tauri 是一个用于构建桌面应用的框架，核心特点是：

| 特性 | 说明 |
|------|------|
| **语言** | Rust（后端）+ Web 技术（前端） |
| **体积** | 打包后仅 2-10 MB（对比 Electron 的 150MB+） |
| **安全** | 默认沙箱化，默认禁用 Node.js |
| **性能** | Rust 原生性能 |
| **版本** | 当前主流是 **Tauri v2** |

**简单理解**：Tauri = Rust 写的浏览器引擎 + Web 前端 = 桌面应用

### 与 Electron 的核心区别

- Electron 使用 Chromium + Node.js，Tauri 使用系统原生 WebView
- Electron 打包体积大，Tauri 打包体积小
- Electron 默认全权限，Tauri 默认最小权限

---

## 2. 项目结构

```
claude-history-viewer/
├── frontend/                 # Vue 3 前端（Web 技术）
│   ├── src/
│   │   ├── api/
│   │   │   └── index.ts      # 前端调用 Rust 的接口
│   │   ├── views/
│   │   └── main.ts
│   ├── dist/                 # 构建输出目录
│   └── package.json
│
├── tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs           # 入口点
│   │   └── lib.rs            # 命令定义（核心逻辑）
│   ├── Cargo.toml            # Rust 依赖
│   ├── tauri.conf.json       # Tauri 配置
│   ├── capabilities/         # 权限配置（Tauri v2 新增）
│   │   └── default.json
│   └── icons/                # 应用图标
│
└── package.json              # 项目总入口
```

**数据流向**：

```
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│  前端 (Vue)      │  invoke() │   Rust 后端      │   fs     │   文件系统       │
│                 │ ────────> │                 │ ───────> │                 │
│  HomeView.vue   │ <──────── │   lib.rs        │ <─────── │  ~/.claude/     │
│                 │  Result   │                 │  Data    │                 │
└─────────────────┘          └─────────────────┘          └─────────────────┘
```

---

## 3. Tauri 命令（Custom Commands）

Tauri 命令是 **前端调用 Rust 函数的桥梁**。

### 3.1 定义命令

在 Rust 端，使用 `#[tauri::command]` 装饰器标记函数：

```rust
// tauri/src/lib.rs

#[tauri::command]
fn get_messages(session_path: String) -> Result<String, String> {
    fs::read_to_string(&session_path).map_err(|e| e.to_string())
}
```

**关键点**：
- 返回类型是 `Result<T, String>`，成功返回 `Ok(value)`，失败返回 `Err(message)`
- 参数可以是基本类型（`String`, `i32` 等）或自定义结构体
- 使用 `serde` 进行序列化/反序列化

### 3.2 注册命令

在 `run()` 函数中注册所有命令：

```rust
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_projects,
            get_sessions,
            get_messages,
            get_session_previews
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`generate_handler![]` 宏会自动生成命令绑定代码。

### 3.3 完整示例

```rust
use serde::{Deserialize, Serialize};

// 定义数据结构
#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub session_count: usize,
    pub last_modified: String,
}

// 定义命令
#[tauri::command]
fn get_projects() -> Result<Vec<Project>, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let projects_dir = home.join(".claude/projects");

    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects: Vec<Project> = vec![];
    // ... 读取目录、解析数据 ...

    Ok(projects)
}
```

---

## 4. Tauri 插件（Plugins）

插件扩展 Tauri 的功能。这个项目使用了两个插件：

### 4.1 添加依赖

在 `tauri/Cargo.toml` 中声明：

```toml
[dependencies]
tauri-plugin-fs = "2"    # 文件系统插件
tauri-plugin-log = "2"  # 日志插件
```

### 4.2 注册插件

在 `run()` 函数中初始化：

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())    // 注册文件系统插件
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 4.3 常用插件

| 插件 | 用途 |
|------|------|
| `tauri-plugin-fs` | 文件系统读写 |
| `tauri-plugin-shell` | 打开外部链接、运行命令 |
| `tauri-plugin-dialog` | 原生对话框（打开/保存文件） |
| `tauri-plugin-notification` | 系统通知 |
| `tauri-plugin-log` | 日志记录 |

---

## 5. 权限系统（Capabilities）

**这是 Tauri v2 的新特性**，用于精细控制前端能访问哪些 API。

### 5.1 配置文件

`tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:read-all"
  ]
}
```

### 5.2 权限粒度

```json
{
  "permissions": [
    "fs:default",              // 基础文件系统权限
    "fs:read-all",             // 读取所有文件
    "fs:allow-read-text-file"  // 允许读取文本文件
  ]
}
```

### 5.3 权限检查流程

```
前端调用 fs API
    ↓
检查 capabilities 配置
    ↓
有权限 → 执行操作
无权限 → 拒绝并返回错误
```

---

## 6. 前端交互

### 6.1 安装 API 包

```bash
npm install @tauri-apps/api
```

### 6.2 调用 Rust 命令

使用 `invoke()` 函数调用 Rust 命令：

```typescript
// frontend/src/api/index.ts
import { invoke } from '@tauri-apps/api/core'

export async function getProjects() {
  return invoke<Project[]>('get_projects')
}

export async function getMessages(sessionPath: string) {
  return invoke<string>('get_messages', { sessionPath })
}
```

**语法**：
```typescript
invoke<T>('命令名称', { 参数1, 参数2 })
```

### 6.3 在 Vue 组件中使用

```typescript
// HomeView.vue
import { getProjects } from '../api'

const projects = ref<Project[]>([])

onMounted(async () => {
  try {
    projects.value = await getProjects()
  } catch (err) {
    console.error('Failed to load projects:', err)
  }
})
```

---

## 7. 配置文件详解

### 7.1 tauri.conf.json

```json
{
  "productName": "CC History",        // 应用名称
  "version": "0.1.0",                 // 版本号
  "identifier": "com.cchistory.desktop", // 唯一标识符

  "build": {
    "frontendDist": "../frontend/dist",  // 前端构建输出目录
    "devUrl": "http://localhost:5173"     // 开发时前端地址
  },

  "app": {
    "windows": [{
      "title": "Claude Code 历史",     // 窗口标题
      "width": 1000,                   // 窗口宽度
      "height": 700,                   // 窗口高度
      "resizable": true,               // 是否可调整大小
      "center": true                   // 是否居中显示
    }]
  },

  "bundle": {
    "active": true,
    "targets": "all"                   // 打包目标平台
  }
}
```

### 7.2 Cargo.toml

```toml
[package]
name = "app"
version = "0.1.0"
edition = "2021"              # Rust 版本
rust-version = "1.77.2"       # 最低 Rust 版本

[lib]
name = "app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]  # 库类型

[dependencies]
serde_json = "1.0"            # JSON 序列化
serde = { version = "1.0", features = ["derive"] }  # 序列化框架
tauri = { version = "2.10.3", features = [] }       # Tauri 核心
tauri-plugin-fs = "2"          # 文件系统插件
tauri-plugin-log = "2"         # 日志插件
dirs = "5"                     # 获取用户目录（如 home 目录）
```

---

## 8. 开发与构建

### 8.1 开发模式

```bash
npm run tauri:dev
```

这会同时启动：
1. Vite 开发服务器（热重载）
2. Tauri 应用（带 DevTools）

### 8.2 生产构建

```bash
npm run tauri:build
```

这会：
1. 构建前端：`vite build`
2. 打包应用：`tauri build`

### 8.3 构建脚本（package.json）

```json
{
  "scripts": {
    "dev": "vite --config frontend/vite.config.ts",
    "build": "vite build --config frontend/vite.config.ts",
    "tauri:dev": "npm run dev & tauri dev",
    "tauri:build": "npm run build && tauri build"
  }
}
```

---

## 附录：常见问题

### Q: Tauri 和 Electron 如何选择？

| 场景 | 推荐 |
|------|------|
| 需要最小化安装包体积 | Tauri |
| 需要调用大量 Node.js 模块 | Electron |
| 需要极高的兼容性 | Electron |
| 重视安全性和性能 | Tauri |

### Q: 如何调试 Tauri 应用？

1. 开发模式下，应用窗口会自带 DevTools
2. 可以像 Web 开发一样使用 Console.log
3. Rust 端日志可以通过 `tauri-plugin-log` 查看

### Q: Tauri v2 相比 v1 有什么变化？

- 新增 **Capabilities** 权限系统
- 插件系统重新设计
- 移动端支持改进

---

## 下一步

- 查看 `tauri/src/lib.rs` 了解命令的完整实现
- 查看 `frontend/src/api/index.ts` 了解前端调用方式
- 运行 `npm run tauri:dev` 启动应用进行实践
