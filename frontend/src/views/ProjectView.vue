<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getSessionPreviews } from '../api'
import type { SessionPreview } from '../types'
import { useTheme } from '../composables/useTheme'

const props = defineProps<{
  slug: string
}>()

const router = useRouter()
const sessions = ref<SessionPreview[]>([])
const loading = ref(true)
const error = ref('')
const { theme, toggleTheme } = useTheme()

const projectName = computed(() => {
  return props.slug.replace(/-/g, ' / ').replace(/Users.*Desktop./i, '')
})

onMounted(async () => {
  try {
    sessions.value = await getSessionPreviews(props.slug)
  } catch (err) {
    console.error('Error:', err)
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
})

function formatDate(timestamp: string): string {
  if (!timestamp) return ''
  const date = new Date(parseInt(timestamp) * 1000)
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function formatTime(timestamp: string): string {
  if (!timestamp) return ''
  const date = new Date(parseInt(timestamp) * 1000)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function goToSession(session: SessionPreview) {
  router.push({ name: 'session', query: { project: props.slug, id: session.id } })
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-terminal scanlines">
    <header
      class="sticky top-0 z-10 border-b"
      style="background: var(--bg-secondary); border-color: var(--border-color);"
    >
      <div class="max-w-4xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              @click="goHome"
              class="p-2 rounded-lg transition-colors hover:bg-white/5"
              style="color: var(--text-secondary);"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 class="text-base font-medium" style="color: var(--text-primary);">{{ projectName }}</h1>
              <p class="text-xs" style="color: var(--text-muted);">{{ sessions.length }} sessions</p>
            </div>
          </div>
          <button
            @click="toggleTheme"
            class="p-2 rounded-lg border transition-all duration-200"
            style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-secondary);"
            :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <svg v-if="theme === 'dark'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-6">
      <!-- 加载状态 -->
      <div v-if="loading" class="space-y-3">
        <div
          v-for="i in 5"
          :key="i"
          class="rounded-lg border p-4 animate-pulse"
          style="background: var(--bg-card); border-color: var(--border-color);"
        >
          <div class="flex items-center gap-2 mb-3">
            <div class="w-2 h-2 rounded-full" style="background: var(--bg-secondary);"></div>
            <div class="h-3 w-20 rounded" style="background: var(--bg-secondary);"></div>
          </div>
          <div class="space-y-2">
            <div class="h-4 w-full rounded" style="background: var(--bg-secondary);"></div>
            <div class="h-4 w-3/4 rounded" style="background: var(--bg-secondary);"></div>
          </div>
        </div>
      </div>

      <!-- 错误状态 -->
      <div
        v-else-if="error"
        class="p-4 rounded-lg border"
        style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #ef4444;"
      >
        {{ error }}
      </div>

      <!-- 会话列表 -->
      <div v-else class="space-y-3">
        <div
          v-for="session in sessions"
          :key="session.id"
          @click="goToSession(session)"
          class="card-glow rounded-lg border p-4 cursor-pointer"
          style="background: var(--bg-card); border-color: var(--border-color);"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-2 h-2 rounded-full" style="background: var(--accent);"></div>
                <span class="text-xs font-mono" style="color: var(--text-muted);">{{ session.id.slice(0, 8) }}...</span>
                <span class="text-xs" style="color: var(--text-muted);">· {{ session.message_count }} msgs</span>
              </div>
              <p
                v-if="session.preview"
                class="text-sm line-clamp-2"
                style="color: var(--text-secondary);"
              >
                {{ session.preview }}
              </p>
              <p
                v-else
                class="text-sm italic"
                style="color: var(--text-muted);"
              >
                No preview
              </p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-xs" style="color: var(--text-muted);">{{ formatDate(session.last_modified) }}</p>
              <p class="text-xs" style="color: var(--text-muted);">{{ formatTime(session.last_modified) }}</p>
            </div>
          </div>
        </div>

        <div
          v-if="sessions.length === 0"
          class="text-center py-12"
          style="color: var(--text-muted);"
        >
          No sessions found
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
