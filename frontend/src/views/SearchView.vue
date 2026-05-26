<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getProjects, getSessions, getMessages } from '../api'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const { theme, toggleTheme } = useTheme()

const query = ref('')
const searching = ref(false)
const searched = ref(false)
const results = ref<SearchResult[]>([])

interface SearchResult {
  projectId: string
  projectName: string
  sessionId: string
  sessionPath: string
  matches: { line: string; preview: string }[]
}

async function doSearch() {
  const q = query.value.trim()
  if (!q) return
  searching.value = true
  searched.value = false
  results.value = []

  try {
    const projects = await getProjects()
    for (const project of projects) {
      const sessions = await getSessions(project.id)
      for (const session of sessions) {
        const content = await getMessages(session.path)
        const lines = content.split('\n').filter(l => l.trim())
        const matches: { line: string; preview: string }[] = []
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            // Hermes format: data.content (string); Claude format: data.message.content
            const msgContent = data.content ?? data.message?.content
            let text = ''
            if (typeof msgContent === 'string') {
              text = msgContent
            } else if (Array.isArray(msgContent)) {
              text = msgContent
                .map((c: any) => c.text || c.content || '')
                .join(' ')
            }
            if (text.toLowerCase().includes(q.toLowerCase())) {
              const idx = text.toLowerCase().indexOf(q.toLowerCase())
              const start = Math.max(0, idx - 60)
              const end = Math.min(text.length, idx + q.length + 60)
              const preview = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
              matches.push({ line, preview })
            }
          } catch { /* skip */ }
        }
        if (matches.length > 0) {
          results.value.push({
            projectId: project.id,
            projectName: project.name,
            sessionId: session.id,
            sessionPath: session.path,
            matches: matches.slice(0, 3)
          })
        }
      }
    }
  } finally {
    searching.value = false
    searched.value = true
  }
}

function openSession(result: SearchResult) {
  router.push({ name: 'session', query: { project: result.projectId, id: result.sessionId } })
}

function highlight(text: string, q: string): string {
  if (!q) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
}
</script>

<template>
  <div class="min-h-screen bg-terminal scanlines">
    <header class="sticky top-0 z-10 border-b" style="background: var(--bg-secondary); border-color: var(--border-color);">
      <div class="max-w-4xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button @click="router.push({ name: 'home' })" class="p-2 rounded-lg transition-colors hover:bg-white/5" style="color: var(--text-secondary);">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 class="text-base font-medium" style="color: var(--text-primary);">全文搜索</h1>
          </div>
          <button @click="toggleTheme" class="p-2 rounded-lg transition-colors hover:bg-white/5" style="color: var(--text-secondary);">
            <svg v-if="theme === 'dark'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-8">
      <!-- Search bar -->
      <div class="flex gap-3 mb-8">
        <input
          v-model="query"
          @keydown.enter="doSearch"
          type="text"
          placeholder="搜索所有会话..."
          class="flex-1 px-4 py-2 rounded-lg border text-sm outline-none"
          style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-primary);"
          autofocus
        />
        <button
          @click="doSearch"
          :disabled="searching || !query.trim()"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style="background: var(--accent); color: #000;"
        >
          {{ searching ? '搜索中...' : '搜索' }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="searching" class="text-center py-12" style="color: var(--text-muted);">正在搜索所有会话...</div>

      <!-- Results -->
      <div v-else-if="searched">
        <p class="text-sm mb-4" style="color: var(--text-muted);">找到 {{ results.length }} 个会话</p>
        <div v-if="results.length === 0" class="text-center py-12" style="color: var(--text-muted);">无匹配结果</div>
        <div v-else class="space-y-4">
          <div
            v-for="result in results"
            :key="result.sessionId"
            @click="openSession(result)"
            class="rounded-xl border p-4 cursor-pointer transition-colors hover:border-accent"
            style="background: var(--bg-card); border-color: var(--border-color);"
          >
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs font-medium" style="color: var(--accent);">{{ result.projectName }}</span>
              <span class="text-xs" style="color: var(--text-muted);">/ {{ result.sessionId.slice(0, 8) }}...</span>
              <span class="ml-auto text-xs" style="color: var(--text-muted);">{{ result.matches.length }} 处匹配</span>
            </div>
            <div class="space-y-1">
              <p
                v-for="(m, i) in result.matches"
                :key="i"
                class="text-xs"
                style="color: var(--text-secondary);"
                v-html="highlight(m.preview, query)"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
mark {
  background: var(--accent);
  color: #000;
  padding: 0 2px;
  border-radius: 2px;
}
</style>
