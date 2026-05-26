# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm install              # Install root + frontend JS dependencies
npm run dev              # Start Vite dev server (frontend only, no Tauri window)
npm run tauri:dev        # Start full desktop app in dev mode (requires Rust toolchain)
npm run tauri:build      # Bundle macOS .app → tauri/target/release/bundle/
```

No test suite or lint script is configured.

## Architecture

This is a **Tauri 2 desktop app** (not a web app). It cannot be deployed to a server — it must run as a native binary to access the local filesystem.

### Project layout

- `frontend/` — Vue 3 + Vite + TypeScript + Tailwind CSS 4 (frontend)
- `tauri/` — Rust backend (Tauri commands, IPC, file I/O). Note: directory is `tauri/`, not `src-tauri/`.

### Data flow

1. **Rust** (`tauri/src/lib.rs`) exposes four Tauri `#[command]`s called via IPC:
   - `get_projects` — scans `~/.claude/projects/` and returns `Project[]` with session counts
   - `get_session_previews` — lists sessions for a project with preview text and message count
   - `get_sessions` — lists `.jsonl` session files for a project
   - `get_messages` — reads a `.jsonl` file and returns its raw content as a string
2. **Frontend API** (`frontend/src/api/index.ts`) wraps each command with `invoke()` from `@tauri-apps/api/core`
3. **Vue Router** (`frontend/src/router/index.ts`) uses `createWebHistory` with three routes:
   - `/` → `HomeView.vue` — project list with stats
   - `/project/:slug` → `ProjectView.vue` — sessions within a project
   - `/session` → `SessionView.vue` — full conversation viewer
4. **Types** are defined in `frontend/src/types/index.ts`: `Project`, `SessionPreview`, `Session`, `Message`, `UserMessageOutline`

### Styling

Tailwind CSS 4 via `@tailwindcss/vite` plugin (no `tailwind.config.*` file). Dark terminal aesthetic with CSS custom properties (`--accent`, `--bg-card`, `--border-color`, etc.) defined in `frontend/src/style.css`. Theme toggle is in `frontend/src/composables/useTheme.ts` and persisted client-side.
