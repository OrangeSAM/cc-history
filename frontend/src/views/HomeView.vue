<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getProjects } from '../api'
import type { Project } from '../types'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const projects = ref<Project[]>([])
const loading = ref(true)
const error = ref('')
const { theme, toggleTheme } = useTheme()

const stats = computed(() => {
  const projectCount = projects.value.length
  const sessionCount = projects.value.reduce((sum, p) => sum + p.session_count, 0)
  return { projectCount, sessionCount }
})

onMounted(async () => {
  try {
    projects.value = await getProjects()
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

// 生成项目首字母的颜色
function getProjectColor(name: string): string {
  const colors = [
    '#f5a623', // amber
    '#4ade80', // green
    '#60a5fa', // blue
    '#f472b6', // pink
    '#a78bfa', // violet
    '#fbbf24', // yellow
    '#34d399', // emerald
    '#2dd4bf', // teal
  ]
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}
</script>

<template>
  <div class="min-h-screen bg-terminal scanlines">
    <main class="max-w-4xl mx-auto px-6 py-10">
      <!-- 标题区 -->
      <div class="mb-8 flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-glow" style="color: var(--accent);">
            Claude History
          </h1>
        </div>
        <!-- 搜索按钮 -->
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
        <!-- 主题切换按钮 -->
        <button
          @click="toggleTheme"
          class="p-2.5 rounded-lg border transition-all duration-200"
          style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-secondary);"
          :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <!-- 太阳图标 -->
          <svg v-if="theme === 'dark'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <!-- 月亮图标 -->
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
      </div>

      <!-- 统计摘要 -->
      <div
        v-if="!loading && !error && projects.length > 0"
        class="mb-8 p-5 rounded-xl border"
        style="background: var(--bg-card); border-color: var(--border-color);"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs" style="color: var(--text-muted);">PROJECTS</p>
            <p class="text-3xl font-bold text-glow" style="color: var(--accent);">{{ stats.projectCount }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs" style="color: var(--text-muted);">SESSIONS</p>
            <p class="text-3xl font-bold text-glow" style="color: var(--accent);">{{ stats.sessionCount }}</p>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="space-y-3">
        <div
          v-for="i in 5"
          :key="i"
          class="rounded-lg border p-4 animate-pulse"
          style="background: var(--bg-card); border-color: var(--border-color);"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded" style="background: var(--bg-secondary);"></div>
            <div class="flex-1">
              <div class="h-4 w-32 rounded mb-2" style="background: var(--bg-secondary);"></div>
              <div class="h-3 w-20 rounded" style="background: var(--bg-secondary);"></div>
            </div>
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

      <!-- 项目列表 -->
      <div v-else class="space-y-3">
        <div
          v-for="project in projects"
          :key="project.id"
          @click="goToProject(project)"
          class="card-glow rounded-lg border p-4 cursor-pointer"
          style="background: var(--bg-card); border-color: var(--border-color);"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="w-9 h-9 rounded flex items-center justify-center text-sm font-bold shadow-lg"
                :style="{ backgroundColor: getProjectColor(project.name), color: '#000' }"
              >
                {{ project.name.charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0">
                <h2 class="font-medium truncate" style="color: var(--text-primary);">{{ project.name }}</h2>
                <p class="text-xs" style="color: var(--text-muted);">{{ project.session_count }} sessions</p>
              </div>
            </div>
            <div class="text-right flex-shrink-0 ml-3">
              <p class="text-xs" style="color: var(--text-muted);">{{ formatDate(project.last_modified) }}</p>
            </div>
          </div>
        </div>

        <div
          v-if="projects.length === 0"
          class="text-center py-12"
          style="color: var(--text-muted);"
        >
          No projects found
        </div>
      </div>
    </main>
  </div>
</template>
