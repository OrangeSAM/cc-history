# Claude Code 对话历史查看器

桌面端应用，用于浏览和管理你与 Claude Code 的所有对话历史。

## 是什么

这是一个**桌面应用**，可以：
- 📁 查看所有 Claude Code 项目列表
- 📋 浏览每个项目的会话记录
- 💬 查看完整的对话内容（用户 + AI）
- 🔄 消息展开/收起功能

## 为什么做这个

Claude Code 的对话历史存储在本地 `~/.claude/projects/` 目录，但：
- 无法通过 GitHub Pages 部署（数据在本地）
- 每次需要启动 Node.js 服务才能访问

所以用 **Tauri** 打包成桌面应用，**无需启动服务**，直接读取本地文件。

## 技术栈

| 层次 | 技术 |
|------|------|
| 桌面框架 | **Tauri 2.x** (Rust) |
| 前端框架 | **Next.js 16** (App Router) |
| 语言 | **TypeScript** |
| 样式 | **Tailwind CSS** |

## 项目结构

```
claude-history-viewer/
├── src/
│   └── app/                    # Next.js 前端
│       ├── page.tsx            # 首页 - 项目列表
│       ├── api/                # API 接口
│       └── projects/           # 页面路由
├── src-tauri/                  # Tauri 后端 (Rust)
│   ├── src/lib.rs              # Rust 代码
│   ├── Cargo.toml              # Rust 依赖
│   └── tauri.conf.json        # Tauri 配置
└── package.json                # Node.js 依赖
```

## 开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发模式（同时运行 Next.js + Tauri）
npm run tauri dev
```

首次运行会编译 Rust 依赖，需要几分钟。

## 打包

```bash
# 打包成 macOS 应用
npm run tauri build

# 打包成 Windows .exe
npm run tauri build -- --target x86_64-pc-windows-msvc
```

## 数据来源

对话历史读取自本地目录：`~/.claude/projects/`

## License

MIT
