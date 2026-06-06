<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getProjects, getHermesSessions, getUsageStats } from '../api'
import type { Project, HermesSession, UsageStats } from '../types'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const projects = ref<Project[]>([])
const hermesSessions = ref<HermesSession[]>([])
const claudeStats = ref<UsageStats | null>(null)
const loading = ref(true)
const error = ref('')
const activeSource = ref<'claude' | 'hermes'>('claude')
const { theme, toggleTheme } = useTheme()

const stats = computed(() => {
  if (activeSource.value === 'claude') {
    const total = claudeStats.value
      ? claudeStats.value.total_input_tokens + claudeStats.value.total_output_tokens
      : 0
    return {
      projectCount: projects.value.length,
      sessionCount: projects.value.reduce((sum, p) => sum + p.session_count, 0),
      totalTokens: total,
    }
  } else {
    const total = hermesSessions.value.reduce((sum, s) => sum + s.input_tokens + s.output_tokens, 0)
    const cost = hermesSessions.value.reduce((sum, s) => sum + (s.estimated_cost_usd || 0), 0)
    return {
      sessionCount: hermesSessions.value.length,
      totalTokens: total,
      totalCost: cost,
    }
  }
})

onMounted(async () => {
  try {
    const [p, h, s] = await Promise.all([
      getProjects(),
      getHermesSessions().catch(() => [] as HermesSession[]),
      getUsageStats('claude').catch(() => null),
    ])
    projects.value = p
    hermesSessions.value = h
    claudeStats.value = s
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

function goToProject(project: Project) {
  router.push({ name: 'project', params: { slug: project.id } })
}

function goToHermesSession(session: HermesSession) {
  router.push({ name: 'hermes-session', query: { id: session.id } })
}

function getColor(name: string): string {
  const colors = ['#f5a623', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24', '#34d399', '#2dd4bf']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return colors[Math.abs(hash) % colors.length]
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(Math.round(n))
}

function fmtCost(n: number): string {
  if (n >= 100) return '$' + n.toFixed(0)
  if (n >= 10) return '$' + n.toFixed(1)
  return '$' + n.toFixed(2)
}

function cleanTitle(title: string): string {
  if (!title) return '(无标题)'
  return title.replace(/<think>[\s\S]*?<\/think>/g, '').trim().slice(0, 80) || '(无标题)'
}
</script>

<template>
  <div class="min-h-screen bg-terminal scanlines">
    <main class="max-w-4xl mx-auto px-6 py-10">
      <!-- Header row: title + buttons -->
      <div class="mb-6 flex items-start justify-between">
        <h1 class="text-2xl font-bold text-glow" style="color: var(--accent);">History</h1>
        <div class="flex items-center gap-2">
          <button
            @click="router.push({ name: 'search' })"
            class="p-2.5 rounded-lg border transition-all duration-200"
            style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-secondary);"
            title="全文搜索"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button
            @click="router.push({ name: 'stats' })"
            class="p-2.5 rounded-lg border transition-all duration-200"
            style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-secondary);"
            title="用量统计"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button @click="toggleTheme" class="p-2.5 rounded-lg border transition-all duration-200"
            style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-secondary);"
            :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'">
            <svg v-if="theme === 'dark'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Source toggle -->
      <div class="mb-6 flex rounded-lg border p-0.5" style="background: var(--bg-secondary); border-color: var(--border-color);">
        <button
          @click="activeSource = 'claude'"
          class="flex-1 py-2 rounded-md text-sm font-medium transition-all"
          :style="activeSource === 'claude'
            ? { background: 'var(--accent)', backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)', color: '#000' }
            : { color: 'var(--text-muted)' }"
        >Claude Code</button>
        <button
          @click="activeSource = 'hermes'"
          class="flex-1 py-2 rounded-md text-sm font-medium transition-all"
          :style="activeSource === 'hermes'
            ? { background: '#8b5cf6', backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 4px)', color: '#fff' }
            : { color: 'var(--text-muted)' }"
        >Hermes</button>
      </div>

      <!-- Stats summary -->
      <template v-if="!loading && !error">
        <div v-if="activeSource === 'claude'" class="mb-8 p-5 rounded-xl border" style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs" style="color: var(--text-muted);">PROJECTS</p>
              <p class="text-3xl font-bold text-glow" style="color: var(--accent);">{{ stats.projectCount }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs" style="color: var(--text-muted);">SESSIONS</p>
              <p class="text-3xl font-bold text-glow" style="color: var(--accent);">{{ stats.sessionCount }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs" style="color: var(--text-muted);">TOKENS</p>
              <p class="text-3xl font-bold text-glow" style="color: var(--accent);">{{ fmtNum(stats.totalTokens) }}</p>
            </div>
          </div>
        </div>
        <div v-else class="mb-8 p-5 rounded-xl border" style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs" style="color: var(--text-muted);">SESSIONS</p>
              <p class="text-3xl font-bold text-glow" style="color: #8b5cf6;">{{ stats.sessionCount }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs" style="color: var(--text-muted);">TOKENS</p>
              <p class="text-3xl font-bold text-glow" style="color: #8b5cf6;">{{ fmtNum(stats.totalTokens) }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs" style="color: var(--text-muted);">EST. COST</p>
              <p class="text-3xl font-bold text-glow" style="color: #8b5cf6;">{{ fmtCost(stats.totalCost) }}</p>
            </div>
          </div>
        </div>
      </template>

      <!-- Loading -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="rounded-lg border p-4 animate-pulse" style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded" style="background: var(--bg-secondary);"></div>
            <div class="flex-1">
              <div class="h-4 w-32 rounded mb-2" style="background: var(--bg-secondary);"></div>
              <div class="h-3 w-20 rounded" style="background: var(--bg-secondary);"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="p-4 rounded-lg border" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #ef4444;">
        {{ error }}
      </div>

      <!-- Claude Code: project list -->
      <div v-else-if="activeSource === 'claude'" class="space-y-3">
        <div v-for="project in projects" :key="project.id" @click="goToProject(project)"
          class="card-glow rounded-lg border p-4 cursor-pointer relative overflow-hidden"
          :style="{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', '--accent-bar': getColor(project.name) }">
          <div class="absolute left-0 top-0 bottom-0 w-[3px]" :style="{ background: getColor(project.name) }"></div>
          <div class="flex items-center justify-between">
            <div class="min-w-0">
              <h2 class="font-medium truncate" style="color: var(--text-primary);">{{ project.name }}</h2>
              <p class="text-xs" style="color: var(--text-muted);">{{ project.session_count }} sessions</p>
            </div>
            <div class="text-right flex-shrink-0 ml-3">
              <p class="text-xs" style="color: var(--text-muted);">{{ formatDate(project.last_modified) }}</p>
            </div>
          </div>
        </div>
        <div v-if="projects.length === 0" class="text-center py-12" style="color: var(--text-muted);">No projects found</div>
      </div>

      <!-- Hermes: session list -->
      <div v-else-if="activeSource === 'hermes'" class="space-y-3">
        <div v-for="session in hermesSessions" :key="session.id" @click="goToHermesSession(session)"
          class="card-glow rounded-lg border p-4 cursor-pointer relative overflow-hidden"
          style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="absolute left-0 top-0 bottom-0 w-[3px]" style="background: #8b5cf6;"></div>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h2 class="text-sm font-medium mb-1 truncate" style="color: var(--text-primary);">{{ cleanTitle(session.title) }}</h2>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs" style="color: #8b5cf6;">{{ session.model }}</span>
                <span class="text-xs" style="color: var(--text-muted);">{{ session.message_count }} msgs</span>
                <span class="text-xs" style="color: var(--text-muted);">in {{ fmtNum(session.input_tokens) }} / out {{ fmtNum(session.output_tokens) }}</span>
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-xs" style="color: var(--text-muted);">{{ formatDate(session.started_at) }}</p>
            </div>
          </div>
        </div>
        <div v-if="hermesSessions.length === 0" class="text-center py-12" style="color: var(--text-muted);">No Hermes sessions found</div>
      </div>
    </main>
  </div>
</template>
