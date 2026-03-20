<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getSessionPreviews } from '../api'
import type { SessionPreview } from '../types'

const props = defineProps<{
  slug: string
}>()

const router = useRouter()
const sessions = ref<SessionPreview[]>([])
const loading = ref(true)
const error = ref('')

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
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <header class="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-6 py-4">
        <div class="flex items-center gap-4">
          <button @click="goHome" class="p-2 rounded-lg hover:bg-gray-100">
            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 class="text-lg font-semibold text-gray-900">{{ projectName }}</h1>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-8">
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 5" :key="i" class="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-2 h-2 rounded-full bg-gray-200"></div>
            <div class="h-3 w-20 bg-gray-200 rounded"></div>
          </div>
          <div class="space-y-2">
            <div class="h-4 w-full bg-gray-100 rounded"></div>
            <div class="h-4 w-3/4 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
        {{ error }}
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="session in sessions"
          :key="session.id"
          @click="goToSession(session)"
          class="group bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-200 cursor-pointer"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                <span class="text-xs text-gray-400 font-mono">{{ session.id.slice(0, 8) }}...</span>
                <span class="text-xs text-gray-400">· {{ session.message_count }} 条消息</span>
              </div>
              <p v-if="session.preview" class="text-sm text-gray-600 line-clamp-2 group-hover:text-gray-900">
                {{ session.preview }}
              </p>
              <p v-else class="text-sm text-gray-400 italic">暂无预览</p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-xs text-gray-500">{{ formatDate(session.last_modified) }}</p>
              <p class="text-xs text-gray-400">{{ formatTime(session.last_modified) }}</p>
            </div>
          </div>
        </div>

        <div v-if="sessions.length === 0" class="text-center py-12 text-gray-500">
          暂无会话
        </div>
      </div>
    </main>
  </div>
</template>
