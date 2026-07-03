# CC History

> 桌面端应用，用于浏览和管理你与 Claude Code、Hermes、Codex 的所有对话历史与用量。

本应用为 **Tauri 2** 原生桌面程序，无需启动任何服务，直接读取本地文件与数据库。支持 macOS（可扩展至 Windows / Linux）。

## 功能特性

- **多来源会话浏览**
  - Claude Code：扫描 `~/.claude/projects/` 下的 `.jsonl` 会话
  - Hermes：读取 `~/.hermes/state.db`（SQLite）
  - Codex：读取 `~/.codex/state_5.sqlite` 及其 rollout 文件
- **完整对话查看器**：渲染文本、思考过程（thinking）、工具调用（tool_use）与工具结果（tool_result）等消息块，附用户消息大纲导航
- **全文搜索**：跨所有会话检索关键词
- **用量与成本统计**：按日趋势、项目排名、模型分布的 Token 用量（支持 Claude / Hermes / 全部 三种来源，默认近 30 天）
- **自动更新**：启动时检查 GitHub Releases 新版本，应用内一键下载安装并重启
- **明暗主题切换**：终端美学风格，主题本地持久化
- **设置 / 关于页**：版本信息与外链（通过 opener 插件安全打开）

## 下载安装

最新版本始终在 [GitHub Releases](https://github.com/OrangeSAM/cc-history/releases/latest) 页面获取，链接永久指向最新版。

各平台对应的安装包（`<版本>` 为当前发布版本号）：

| 平台 | 架构 | 安装包文件名 |
|------|------|------|
| macOS | Apple Silicon (M1/M2/M3…) | `CC.History_<版本>_aarch64.dmg` |
| Windows | x64（安装版） | `CC.History_<版本>_x64-setup.exe` |
| Windows | x64（MSI 包） | `CC.History_<版本>_x64_en-US.msi` |

> 暂未提供 macOS Intel (x64) 与 Windows ARM 安装包。已安装旧版本的用户启动后会收到应用内自动更新提示，无需手动重新下载。

## 为什么做这个

Claude Code 的对话历史存储在本地 `~/.claude/projects/` 目录，但无法通过 GitHub Pages 部署（数据在本地）。使用 **Tauri** 打包成桌面应用，**无需启动服务**，直接读取本地文件。后续逐步接入了 Hermes、Codex 两个来源，并加入了用量统计与自动更新。

## 技术栈

| 层次 | 技术 |
|------|------|
| 桌面框架 | **Tauri 2.11** (Rust) |
| 前端框架 | **Vue 3** + **Vite 8** |
| 语言 | **TypeScript** |
| 样式 | **Tailwind CSS 4** |
| 本地数据库 | **rusqlite** (bundled SQLite，读取 Hermes / Codex) |
| Tauri 插件 | `fs` · `updater` · `process` · `opener` · `log` |

## 目录结构

> 注意：Tauri 后端目录是 `tauri/`，不是常见的 `src-tauri/`。

```
claude-history-viewer/
├── frontend/                      # Vue 前端
│   ├── src/
│   │   ├── views/                # 页面组件
│   │   │   ├── HomeView.vue      # 首页 - 项目列表 + 数据来源入口
│   │   │   ├── ProjectView.vue   # 项目会话列表
│   │   │   ├── SessionView.vue   # Claude Code 会话详情
│   │   │   ├── HermesSessionView.vue  # Hermes 会话详情
│   │   │   ├── CodexSessionView.vue   # Codex 会话详情
│   │   │   ├── SearchView.vue    # 全文搜索
│   │   │   ├── StatsView.vue     # 用量与成本统计
│   │   │   └── SettingsView.vue  # 设置 / 关于
│   │   ├── composables/          # useTheme / useUpdater
│   │   ├── router/               # Vue Router 配置
│   │   ├── api/                  # API 调用 (Tauri IPC 封装)
│   │   └── types/                # TypeScript 类型定义
│   └── vite.config.ts
├── tauri/                         # Tauri 后端 (Rust)
│   ├── src/
│   │   ├── lib.rs                # 业务逻辑 + Tauri commands
│   │   └── main.rs               # 入口文件
│   ├── Cargo.toml                # Rust 依赖配置
│   ├── tauri.conf.json           # Tauri 应用配置
│   └── capabilities/             # 权限配置
└── package.json                  # 根项目配置（编排前后端命令）
```

## 数据流

1. **Rust** (`tauri/src/lib.rs`) 暴露 9 个 `#[command]`，前端通过 `@tauri-apps/api/core` 的 `invoke()` 调用：
   - Claude Code：`get_projects` · `get_sessions` · `get_session_previews` · `get_messages`
   - Hermes：`get_hermes_sessions` · `get_hermes_messages`
   - Codex：`get_codex_sessions` · `get_codex_messages`
   - 统计：`get_usage_stats`（按 `claude` / `hermes` / `all` 聚合 Token 用量）
2. **前端 API 层** (`frontend/src/api/index.ts`) 对每个 command 做了类型化封装
3. **Vue Router** 配置 8 个路由：`/`（首页）、`/project/:slug`、`/session`、`/hermes/session`、`/codex/session`、`/search`、`/stats`、`/settings`

## 数据来源

| 来源 | 路径 | 格式 |
|------|------|------|
| Claude Code | `~/.claude/projects/` | `.jsonl` 会话文件 |
| Hermes | `~/.hermes/state.db` | SQLite |
| Codex | `~/.codex/state_5.sqlite` + rollout 文件 | SQLite + `.jsonl` |

## 快速开始

### 环境要求

- Node.js
- Rust 工具链（`cargo`，用于 Tauri 编译）
- macOS 构建需要 Xcode Command Line Tools

### 安装依赖

```bash
npm install
```

### 命令说明

| 命令 | 说明 |
|------|------|
| `npm run dev` | 仅启动前端 Vite 热更新（无 Tauri 窗口） |
| `npm run tauri:dev` | 开发模式，启动完整桌面应用 |
| `npm run tauri:build` | 打包发布（先 build 前端，再编译 Rust） |

### 开发模式

```bash
npm run tauri:dev
```

### 打包发布

```bash
npm run tauri:build
```

打包完成后，应用生成在 `tauri/target/release/bundle/` 目录下。CI 配置见 `.github/workflows/build.yml`，签名与 `latest.json` 由 `bundle.createUpdaterArtifacts: true` 自动生成。

## 自动更新

应用通过 Tauri `updater` 插件检查 [GitHub Releases](https://github.com/OrangeSAM/cc-history/releases/latest) 中的 `latest.json`，发现新版本后顶部横幅提示，可一键下载安装并重启。更新签名公钥内置在 `tauri.conf.json` 中。

## License

MIT
