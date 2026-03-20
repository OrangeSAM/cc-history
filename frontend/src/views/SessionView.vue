<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getSessions, getMessages } from '../api'
import type { Message } from '../types'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const route = useRoute()

const slug = computed(() => route.query.project as string)
const sessionId = computed(() => route.query.id as string)

const messages = ref<Message[]>([])
const loading = ref(true)
const error = ref('')
const refreshing = ref(false)
const showOutline = ref(true)
const messageRefs = ref<HTMLElement[]>([])
const { theme, toggleTheme } = useTheme()

const userOutlines = computed(() => {
  return messages.value
    .filter(msg => msg.type === 'user')
    .map(msg => ({
      index: messages.value.indexOf(msg),
      preview: msg.content.length > 50 ? msg.content.slice(0, 50) + '...' : msg.content || '(无内容)',
      timestamp: msg.timestamp
    }))
})

onMounted(() => {
  if (slug.value && sessionId.value) {
    loadMessages()
  }
})

async function loadMessages() {
  try {
    const sessions = await getSessions(slug.value)
    const session = sessions.find((s: any) => s.id === sessionId.value)
    if (!session) throw new Error('Session not found')

    const content = await getMessages(session.path)
    messages.value = parseMessages(content)
    error.value = ''
  } catch (err) {
    console.error('Error:', err)
    error.value = '加载失败'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function parseMessages(content: string): Message[] {
  const lines = content.split('\n').filter(line => line.trim())
  const result: Message[] = []

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      const type = data.type

      if (type === 'file-history-snapshot') {
        result.push({
          id: data.messageId || data.snapshot?.messageId || '',
          type: 'snapshot',
          content: `File snapshot: ${Object.keys(data.snapshot?.trackedFileBackups || {}).join(', ') || 'No files'}`,
          timestamp: data.timestamp || data.snapshot?.timestamp || ''
        })
      } else if (type === 'user') {
        const content = data.message?.content
        let text = ''
        if (typeof content === 'string') {
          text = content
        } else if (Array.isArray(content)) {
          text = content
            .filter((c: any) => c.type !== 'tool_result')
            .map((c: any) => c.text || c.content || '')
            .join('')
        }
        if (text.trim()) {
          result.push({
            id: data.uuid || data.messageId || '',
            type: 'user',
            content: text,
            timestamp: data.timestamp || ''
          })
        }
      } else if (type === 'assistant') {
        const content = data.message?.content
        let text = ''
        if (typeof content === 'string') {
          text = content
        } else if (Array.isArray(content)) {
          text = content.map((c: any) => {
            if (c.type === 'text') return c.text || ''
            if (c.type === 'thinking') return `💭 ${c.thinking || ''}`
            return c.content || c.text || ''
          }).join('\n\n')
        }
        result.push({
          id: data.uuid || data.message?.id || '',
          type: 'assistant',
          content: text,
          timestamp: data.timestamp || ''
        })
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  }

  return result
}

function scrollToMessage(index: number) {
  const el = messageRefs.value[index]
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function handleRefresh() {
  refreshing.value = true
  loadMessages()
}

function goBack() {
  router.push({ name: 'project', params: { slug: slug.value } })
}

function formatDate(timestamp: string): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getCodeBlocks(content: string): string[] {
  const regex = /```[\s\S]*?```/g
  return content.match(regex) || []
}

function getTextContent(content: string): string {
  const codeBlocks = getCodeBlocks(content)
  let text = content
  if (codeBlocks.length > 0) {
    text = content.replace(new RegExp(/```[\s\S]*?```/g), '').trim()
  }
  return text
}

async function copyCode(code: string) {
  await navigator.clipboard.writeText(code.replace(/```\w*\n?/g, '').trim())
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
              @click="goBack"
              class="p-2 rounded-lg transition-colors hover:bg-white/5"
              style="color: var(--text-secondary);"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 class="text-base font-medium" style="color: var(--text-primary);">
                {{ sessionId?.slice(0, 8) }}...
              </h1>
              <p class="text-xs" style="color: var(--text-muted);">{{ messages.length }} messages</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="showOutline = !showOutline"
              class="p-2 rounded-lg transition-colors"
              :style="showOutline ? { background: 'var(--accent-subtle)', color: 'var(--accent)' } : { color: 'var(--text-secondary)' }"
              title="显示/隐藏大纲"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              @click="handleRefresh"
              :disabled="refreshing"
              class="p-2 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-50"
              style="color: var(--text-secondary);"
              title="刷新"
            >
              <svg
                class="w-5 h-5"
                :class="{ 'animate-spin': refreshing }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
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
      </div>
    </header>

    <div class="flex">
      <!-- 大纲面板 -->
      <aside
        v-if="showOutline && userOutlines.length > 0"
        class="w-64 flex-shrink-0 hidden md:block border-r"
        style="background: var(--bg-secondary); border-color: var(--border-color);"
      >
        <div class="sticky top-[65px] p-4 max-h-[calc(100vh-65px)] overflow-y-auto">
          <h2 class="text-sm font-medium mb-3" style="color: var(--text-secondary);">
            Outline <span class="font-normal" style="color: var(--text-muted);">({{ userOutlines.length }})</span>
          </h2>
          <div class="space-y-2">
            <button
              v-for="(outline, idx) in userOutlines"
              :key="idx"
              @click="scrollToMessage(outline.index)"
              class="w-full text-left p-2 rounded-lg transition-colors group"
              style="background: var(--bg-card); border: 1px solid var(--border-color);"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-medium" style="color: var(--accent);">#{{ idx + 1 }}</span>
                <span v-if="outline.timestamp" class="text-xs" style="color: var(--text-muted);">
                  {{ formatDate(outline.timestamp) }}
                </span>
              </div>
              <p class="text-xs line-clamp-2" style="color: var(--text-secondary);">
                {{ outline.preview }}
              </p>
            </button>
          </div>
        </div>
      </aside>

      <!-- 消息列表 -->
      <main class="flex-1 px-6 py-8" :class="{ 'md:pl-0': showOutline }">
        <div :class="showOutline ? 'max-w-3xl' : 'max-w-4xl'" class="mx-auto space-y-6">
          <!-- 加载状态 -->
          <div v-if="loading" class="space-y-6">
            <div v-for="i in 5" :key="i" class="ml-8">
              <div
                class="rounded-xl border p-4 animate-pulse"
                style="background: var(--bg-card); border-color: var(--border-color);"
              >
                <div class="flex items-center gap-2 mb-3">
                  <div class="h-3 w-16 rounded" style="background: var(--bg-secondary);"></div>
                  <div class="h-3 w-24 rounded" style="background: var(--bg-secondary);"></div>
                </div>
                <div class="space-y-2">
                  <div class="h-4 w-full rounded" style="background: var(--bg-secondary);"></div>
                  <div class="h-4 w-3/4 rounded" style="background: var(--bg-secondary);"></div>
                  <div class="h-4 w-1/2 rounded" style="background: var(--bg-secondary);"></div>
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

          <!-- 消息列表 -->
          <template v-else>
            <div
              v-for="(msg, idx) in messages"
              :key="`${idx}-${msg.type}`"
              :ref="el => { if (el) messageRefs[idx] = el as HTMLElement }"
              class="relative"
            >
              <!-- 时间轴线 -->
              <div
                v-if="idx > 0"
                class="absolute left-5 top-0 bottom-[-1rem] w-px"
                style="background: var(--border-color);"
              ></div>

              <!-- 时间轴点 -->
              <div
                class="absolute left-4 w-3 h-3 rounded-full border-2 z-10"
                style="border-color: var(--bg-primary);"
                :style="{
                  background: msg.type === 'user' ? 'var(--accent)' :
                             msg.type === 'assistant' ? '#4ade80' : 'var(--text-muted)'
                }"
              ></div>

              <div
                class="ml-8 rounded-xl p-4 border"
                :style="{
                  background: msg.type === 'user' ? 'var(--bg-card)' : 'var(--bg-secondary)',
                  borderColor: msg.type === 'user' ? 'var(--accent-subtle)' : 'var(--border-color)'
                }"
              >
                <!-- 消息头 -->
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-xs font-medium"
                      :style="{
                        color: msg.type === 'user' ? 'var(--accent)' :
                               msg.type === 'assistant' ? '#4ade80' : 'var(--text-muted)'
                      }"
                    >
                      {{ msg.type === 'user' ? 'You' : msg.type === 'assistant' ? 'Claude' : 'Snapshot' }}
                    </span>
                    <span v-if="msg.timestamp" class="text-xs" style="color: var(--text-muted);">
                      {{ formatDate(msg.timestamp) }}
                    </span>
                  </div>
                </div>

                <!-- 代码块 -->
                <div v-if="getCodeBlocks(msg.content).length > 0" class="space-y-3 mb-3">
                  <div
                    v-for="(block, i) in getCodeBlocks(msg.content)"
                    :key="i"
                    class="relative group"
                  >
                    <button
                      @click="copyCode(block)"
                      class="absolute top-2 right-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      style="background: rgba(255,255,255,0.1); color: var(--text-secondary);"
                    >
                      Copy
                    </button>
                    <pre
                      class="rounded-lg p-4 overflow-x-auto text-sm"
                      style="background: #0d0d0d; color: var(--text-primary); font-family: 'SF Mono', monospace;"
                    ><code>{{ block.replace(/```\w*\n?/g, '').trim() }}</code></pre>
                  </div>
                </div>

                <!-- 文本内容 -->
                <div
                  class="whitespace-pre-wrap break-words"
                  style="color: var(--text-secondary);"
                >
                  {{ getTextContent(msg.content) || '(empty)' }}
                </div>
              </div>
            </div>

            <div
              v-if="messages.length === 0"
              class="text-center py-12"
              style="color: var(--text-muted);"
            >
              No messages
            </div>
          </template>
        </div>
      </main>
    </div>
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
