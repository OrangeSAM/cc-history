<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'

const router = useRouter()
const { theme, toggleTheme } = useTheme()

const activeTab = ref<'general' | 'about'>('general')
const appVersion = ref('')

onMounted(async () => {
  try {
    appVersion.value = await getVersion()
  } catch {
    appVersion.value = '1.4.0'
  }
})

// Update state
const updateStatus = ref<'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'error'>('idle')
const updateVersion = ref('')
const errorMsg = ref('')
let pendingUpdate: Update | null = null

async function checkForUpdates() {
  updateStatus.value = 'checking'
  errorMsg.value = ''
  try {
    const update = await check()
    if (update) {
      updateStatus.value = 'available'
      updateVersion.value = update.version
      pendingUpdate = update
    } else {
      updateStatus.value = 'up-to-date'
    }
  } catch (e) {
    updateStatus.value = 'error'
    errorMsg.value = String(e)
  }
}

async function downloadAndInstall() {
  if (!pendingUpdate) return
  updateStatus.value = 'downloading'
  try {
    await pendingUpdate.downloadAndInstall()
    await relaunch()
  } catch (e) {
    updateStatus.value = 'error'
    errorMsg.value = String(e)
  }
}

function openGithub() {
  window.open('https://github.com/OrangeSAM/cc-history', '_blank')
}
</script>

<template>
  <div class="min-h-screen bg-terminal scanlines">
    <main class="max-w-3xl mx-auto px-6 py-10">
      <!-- Header -->
      <div class="mb-8 flex items-center gap-3">
        <button
          @click="router.back()"
          class="p-2 rounded-lg border transition-all duration-200 hover:opacity-80"
          style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-secondary);"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-2xl font-bold text-glow" style="color: var(--accent);">Settings</h1>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-8 p-1 rounded-lg" style="background: var(--bg-secondary);">
        <button
          v-for="tab in [{ key: 'general', label: '通用' }, { key: 'about', label: '关于' }]"
          :key="tab.key"
          @click="activeTab = tab.key as any"
          class="px-4 py-2 rounded-md text-sm font-medium transition-all"
          :style="activeTab === tab.key
            ? { background: 'var(--accent)', color: '#000' }
            : { color: 'var(--text-muted)' }"
        >{{ tab.label }}</button>
      </div>

      <!-- General Tab -->
      <div v-if="activeTab === 'general'" class="space-y-6">
        <!-- Theme -->
        <div class="rounded-xl border p-5" style="background: var(--bg-card); border-color: var(--border-color);">
          <h3 class="text-sm font-medium mb-4" style="color: var(--text-primary);">外观</h3>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm" style="color: var(--text-primary);">主题</p>
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">切换深色 / 浅色模式</p>
            </div>
            <button
              @click="toggleTheme"
              class="relative w-14 h-7 rounded-full transition-colors duration-200"
              :style="{ background: theme === 'dark' ? 'var(--accent)' : 'var(--border-hover)' }"
            >
              <div
                class="absolute top-0.5 w-6 h-6 rounded-full transition-transform duration-200 flex items-center justify-center"
                :style="{
                  background: '#fff',
                  transform: theme === 'dark' ? 'translateX(30px)' : 'translateX(2px)'
                }"
              >
                <svg v-if="theme === 'dark'" class="w-3.5 h-3.5" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <svg v-else class="w-3.5 h-3.5" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        <!-- Update -->
        <div class="rounded-xl border p-5" style="background: var(--bg-card); border-color: var(--border-color);">
          <h3 class="text-sm font-medium mb-4" style="color: var(--text-primary);">应用更新</h3>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm" style="color: var(--text-primary);">检查更新</p>
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">
                <template v-if="updateStatus === 'idle'">手动检查是否有新版本</template>
                <template v-else-if="updateStatus === 'checking'">检查中...</template>
                <template v-else-if="updateStatus === 'available'">
                  <span style="color: var(--accent);">新版本 v{{ updateVersion }} 可用</span>
                </template>
                <template v-else-if="updateStatus === 'up-to-date'">
                  <span style="color: #4ade80;">已是最新版本</span>
                </template>
                <template v-else-if="updateStatus === 'downloading'">下载安装中...</template>
                <template v-else-if="updateStatus === 'error'">
                  <span style="color: #ef4444;">{{ errorMsg || '检查失败' }}</span>
                </template>
              </p>
            </div>
            <button
              v-if="updateStatus !== 'available'"
              @click="checkForUpdates"
              :disabled="updateStatus === 'checking' || updateStatus === 'downloading'"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50"
              style="background: var(--accent); color: #000;"
            >
              {{ updateStatus === 'checking' ? '检查中...' : '检查' }}
            </button>
            <button
              v-else
              @click="downloadAndInstall"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style="background: var(--accent); color: #000;"
            >
              更新并重启
            </button>
          </div>
        </div>
      </div>

      <!-- About Tab -->
      <div v-if="activeTab === 'about'" class="space-y-6">
        <!-- App info -->
        <div class="rounded-xl border p-6 text-center" style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="text-4xl mb-3">📋</div>
          <h2 class="text-xl font-bold text-glow" style="color: var(--accent);">CC History</h2>
          <p class="text-sm mt-1" style="color: var(--text-muted);">v{{ appVersion }}</p>
          <p class="text-sm mt-3" style="color: var(--text-secondary);">
            Claude Code 对话历史查看器
          </p>
          <p class="text-xs mt-1" style="color: var(--text-muted);">
            支持 Claude Code · Hermes · Codex
          </p>
        </div>

        <!-- Links -->
        <div class="rounded-xl border divide-y" style="background: var(--bg-card); border-color: var(--border-color); --div-color: var(--border-color);">
          <div class="p-4 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity" @click="openGithub">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5" style="color: var(--text-secondary);" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <div>
                <p class="text-sm" style="color: var(--text-primary);">GitHub</p>
                <p class="text-xs" style="color: var(--text-muted);">OrangeSAM/cc-history</p>
              </div>
            </div>
            <svg class="w-4 h-4" style="color: var(--text-muted);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
          <div class="p-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5" style="color: var(--text-secondary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div>
                <p class="text-sm" style="color: var(--text-primary);">作者</p>
                <p class="text-xs" style="color: var(--text-muted);">SamLiu</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tech stack -->
        <div class="rounded-xl border p-5" style="background: var(--bg-card); border-color: var(--border-color);">
          <h3 class="text-sm font-medium mb-3" style="color: var(--text-primary);">技术栈</h3>
          <div class="flex flex-wrap gap-2">
            <span v-for="tag in ['Tauri 2', 'Vue 3', 'TypeScript', 'Tailwind CSS', 'Rust', 'Vite']" :key="tag"
              class="px-2.5 py-1 rounded-md text-xs font-medium"
              style="background: var(--accent-subtle); color: var(--accent);"
            >{{ tag }}</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
