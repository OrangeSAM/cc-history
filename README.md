# Claude Code 对话历史查看器

浏览和管理你与 Claude Code 的所有对话历史。

## 功能

- 📁 查看所有 Claude Code 项目列表
- 📋 浏览每个项目的会话记录
- 💬 查看完整的对话内容（用户 + AI）
- 🔄 消息展开/收起功能

## 技术栈

- **Next.js 16** - App Router
- **TypeScript**
- **Tailwind CSS**

## 快速开始

```bash
# 克隆项目
git clone git@github.com:OrangeSAM/cc-history.git
cd cc-history

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000 查看。

## 项目结构

```
src/
├── app/
│   ├── page.tsx                    # 首页 - 项目列表
│   ├── api/
│   │   └── projects/
│   │       ├── route.ts            # 获取项目列表
│   │       └── [slug]/
│   │           └── sessions/
│   │               ├── route.ts    # 获取会话列表
│   │               └── [sessionId]/
│   │                   └── route.ts # 获取消息
│   └── projects/
│       ├── [slug]/page.tsx         # 项目详情页
│       └── [slug]/[sessionId]/page.tsx  # 对话详情页
```

## 数据来源

对话历史来自 `~/.claude/projects/` 目录。

## License

MIT
