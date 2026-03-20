# Claude Code 历史查看器

桌面端应用，用于浏览和管理你与 Claude Code 的所有对话历史。

## 功能特性

- 查看所有 Claude Code 项目列表
- 浏览每个项目的会话记录
- 查看完整的对话内容（用户 + AI）
- 消息展开/收起功能

## 为什么做这个

Claude Code 的对话历史存储在本地 `~/.claude/projects/` 目录，但无法通过 GitHub Pages 部署（数据在本地）。使用 **Tauri** 打包成桌面应用，**无需启动服务**，直接读取本地文件。

## 技术栈

| 层次 | 技术 |
|------|------|
| 桌面框架 | **Tauri 2.x** (Rust) |
| 前端框架 | **Next.js 16** (App Router) |
| 语言 | **TypeScript** |
| 样式 | **Tailwind CSS** |

## 目录结构

```
claude-history-viewer/
├── src/                          # Next.js 前端源码
│   └── app/                      # App Router 页面
│       ├── page.tsx              # 首页 - 项目列表
│       ├── layout.tsx            # 根布局
│       └── projects/             # 项目页面路由
│           ├── [slug]/           # 项目详情页
│           │   └── page.tsx      # 会话列表
│           └── [slug]/[sessionId]/
│               └── page.tsx      # 会话消息页
├── src-tauri/                    # Tauri 后端 (Rust)
│   ├── src/
│   │   ├── lib.rs                # Rust 业务逻辑
│   │   └── main.rs               # 入口文件
│   ├── Cargo.toml                # Rust 依赖配置
│   └── tauri.conf.json           # Tauri 应用配置
├── public/                       # 静态资源
├── package.json                  # Node.js 依赖
└── next.config.ts                # Next.js 配置
```

### 目录详解

- **`src/app/`** - Next.js 16 App Router 页面目录
- **`src/app/page.tsx`** - 首页，显示项目列表
- **`src/app/projects/[slug]/page.tsx`** - 单个项目页面，显示会话列表
- **`src/app/projects/[slug]/[sessionId]/page.tsx`** - 会话详情页面，显示对话消息
- **`src-tauri/src/lib.rs`** - Tauri 后端核心逻辑，提供文件读取 API
- **`src-tauri/tauri.conf.json`** - Tauri 窗口、构建等配置

## 快速开始

### 安装依赖

```bash
npm install
```

### 命令说明

| 命令 | 说明 |
|------|------|
| `npm run tauri:dev` | 开发模式，启动桌面应用窗口 |
| `npm run tauri:build` | 打包成 macOS 应用 |
| `npm run lint` | 运行 ESLint 检查代码 |

> **注意**：由于前端依赖 Tauri 后端的 IPC API，单独运行前端 (`npm run dev`) 没有意义，必须通过 Tauri 命令启动。

### 开发模式

```bash
npm run tauri:dev
```

这会同时启动 Next.js 开发服务器和 Tauri 桌面应用窗口。

### 打包发布

```bash
npm run tauri:build
```

打包完成后，应用会生成在 `src-tauri/target/release/bundle/` 目录下。

## 数据来源

对话历史读取自本地目录：`~/.claude/projects/`

## License

MIT
