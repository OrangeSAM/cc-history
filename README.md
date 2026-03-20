# Claude Code 历史查看器

桌面端应用，用于浏览和管理你与 Claude Code 的所有对话历史。

## 功能特性

- 查看所有 Claude Code 项目列表
- 浏览每个项目的会话记录
- 查看完整的对话内容（用户 + AI）
- 消息大纲导航

## 为什么做这个

Claude Code 的对话历史存储在本地 `~/.claude/projects/` 目录，但无法通过 GitHub Pages 部署（数据在本地）。使用 **Tauri** 打包成桌面应用，**无需启动服务**，直接读取本地文件。

## 技术栈

| 层次 | 技术 |
|------|------|
| 桌面框架 | **Tauri 2.x** (Rust) |
| 前端框架 | **Vue 3** + **Vite** |
| 语言 | **TypeScript** |
| 样式 | **Tailwind CSS 4** |

## 目录结构

```
claude-history-viewer/
├── frontend/                      # Vue 前端项目
│   ├── src/
│   │   ├── views/                # 页面组件
│   │   │   ├── HomeView.vue      # 首页 - 项目列表
│   │   │   ├── ProjectView.vue   # 项目会话列表
│   │   │   └── SessionView.vue   # 会话详情
│   │   ├── router/               # Vue Router 配置
│   │   ├── api/                  # API 调用 (Tauri IPC)
│   │   └── types/                # TypeScript 类型定义
│   ├── package.json
│   └── vite.config.ts
├── src-tauri/                    # Tauri 后端 (Rust)
│   ├── src/
│   │   ├── lib.rs                # Rust 业务逻辑
│   │   └── main.rs               # 入口文件
│   ├── Cargo.toml                # Rust 依赖配置
│   └── tauri.conf.json           # Tauri 应用配置
└── package.json                  # 项目配置
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 命令说明

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式，启动前端热更新 |
| `npm run tauri:dev` | 开发模式，启动桌面应用窗口 |
| `npm run tauri:build` | 打包成 macOS 应用 |

### 开发模式

```bash
npm run tauri:dev
```

### 打包发布

```bash
npm run tauri:build
```

打包完成后，应用会生成在 `src-tauri/target/release/bundle/` 目录下。

## 数据来源

对话历史读取自本地目录：`~/.claude/projects/`

## License

MIT
