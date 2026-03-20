<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getSessions, getMessages } from '../api'
import type { Message } from '../types'

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
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <header class="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button @click="goBack" class="p-2 rounded-lg hover:bg-gray-100">
              <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 class="text-lg font-semibold text-gray-900">{{ sessionId?.slice(0, 8) }}...</h1>
              <p class="text-xs text-gray-500">{{ messages.length }} 条消息</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="showOutline = !showOutline"
              class="p-2 rounded-lg transition-colors"
              :class="showOutline ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'"
              title="显示/隐藏大纲"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              @click="handleRefresh"
              :disabled="refreshing"
              class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              title="刷新"
            >
              <svg
                class="w-5 h-5 text-gray-600"
                :class="{ 'animate-spin': refreshing }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="flex">
      <!-- 大纲面板 -->
      <aside v-if="showOutline && userOutlines.length > 0" class="w-64 flex-shrink-0 bg-white border-r border-gray-200 hidden md:block">
        <div class="sticky top-[65px] p-4 max-h-[calc(100vh-65px)] overflow-y-auto">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">
            消息大纲 <span class="text-gray-400 font-normal">({{ userOutlines.length }})</span>
          </h2>
          <div class="space-y-2">
            <button
              v-for="(outline, idx) in userOutlines"
              :key="idx"
              @click="scrollToMessage(outline.index)"
              class="w-full text-left p-2 rounded-lg hover:bg-blue-50 transition-colors group"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-medium text-blue-600">#{{ idx + 1 }}</span>
                <span v-if="outline.timestamp" class="text-xs text-gray-400">
                  {{ formatDate(outline.timestamp) }}
                </span>
              </div>
              <p class="text-xs text-gray-600 line-clamp-2 group-hover:text-gray-800">
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
              <div class="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div class="flex items-center gap-2 mb-3">
                  <div class="h-3 w-16 bg-gray-200 rounded"></div>
                  <div class="h-3 w-24 bg-gray-100 rounded"></div>
                </div>
                <div class="space-y-2">
                  <div class="h-4 w-full bg-gray-100 rounded"></div>
                  <div class="h-4 w-3/4 bg-gray-100 rounded"></div>
                  <div class="h-4 w-1/2 bg-gray-100 rounded"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
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
              <div v-if="idx > 0" class="absolute left-5 top-0 bottom-[-1rem] w-px bg-gray-200"></div>

              <!-- 时间轴点 -->
              <div
                class="absolute left-4 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10"
                :class="{
                  'bg-blue-500': msg.type === 'user',
                  'bg-green-500': msg.type === 'assistant',
                  'bg-gray-400': msg.type === 'snapshot'
                }"
              ></div>

              <div
                class="ml-8 rounded-xl p-4"
                :class="{
                  'bg-blue-50 border border-blue-100': msg.type === 'user',
                  'bg-white border border-gray-200 shadow-sm': msg.type === 'assistant',
                  'bg-gray-100 border border-gray-200': msg.type === 'snapshot'
                }"
              >
                <!-- 消息头 -->
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-xs font-semibold"
                      :class="{
                        'text-blue-600': msg.type === 'user',
                        'text-green-600': msg.type === 'assistant',
                        'text-gray-500': msg.type === 'snapshot'
                      }"
                    >
                      {{ msg.type === 'user' ? '👤 你' : msg.type === 'assistant' ? '🤖 Claude' : '📁 快照' }}
                    </span>
                    <span v-if="msg.timestamp" class="text-xs text-gray-400">
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
                      class="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-600"
                    >
                      复制
                    </button>
                    <pre class="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm font-mono"><code>{{ block.replace(/```\w*\n?/g, '').trim() }}</code></pre>
                  </div>
                </div>

                <!-- 文本内容 -->
                <div class="text-gray-800 whitespace-pre-wrap break-words">
                  {{ getTextContent(msg.content) || '(无内容)' }}
                </div>
              </div>
            </div>

            <div v-if="messages.length === 0" class="text-center py-12 text-gray-500">
              暂无消息
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>
</template>
