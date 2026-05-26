<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getSessions, getMessages } from '../api'
import type { Message, ContentBlock, SessionStats } from '../types'
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
const showStats = ref(false)
const activeOutlineIndex = ref(-1)
const messageRefs = ref<HTMLElement[]>([])
const stats = ref<SessionStats>({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, toolCalls: 0, durationMs: 0 })
const { theme, toggleTheme } = useTheme()

const userOutlines = computed(() => {
  return messages.value
    .filter(msg => msg.type === 'user')
    .map((msg, i) => ({
      index: messages.value.indexOf(msg),
      outlineIndex: i,
      preview: msg.content.length > 60 ? msg.content.slice(0, 60) + '...' : msg.content || '(无内容)',
      timestamp: msg.timestamp
    }))
})

onMounted(() => {
  if (slug.value && sessionId.value) loadMessages()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})

function onScroll() {
  // find which user message is closest to top of viewport
  let best = -1
  let bestDist = Infinity
  for (const outline of userOutlines.value) {
    const el = messageRefs.value[outline.index]
    if (!el) continue
    const rect = el.getBoundingClientRect()
    const dist = Math.abs(rect.top - 80)
    if (rect.top <= window.innerHeight && dist < bestDist) {
      bestDist = dist
      best = outline.outlineIndex
    }
  }
  activeOutlineIndex.value = best
}

async function loadMessages() {
  try {
    const sessions = await getSessions(slug.value)
    const session = sessions.find((s: any) => s.id === sessionId.value)
    if (!session) throw new Error('Session not found')
    const content = await getMessages(session.path)
    const { msgs, sessionStats } = parseMessages(content)
    messages.value = msgs
    stats.value = sessionStats
    error.value = ''
  } catch (err) {
    console.error('Error:', err)
    error.value = '加载失败'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function isHermesFormat(firstLine: string): boolean {
  try {
    const data = JSON.parse(firstLine)
    return data.role !== undefined && data.type === undefined
  } catch {
    return false
  }
}

function parseHermesMessages(content: string): { msgs: Message[]; sessionStats: SessionStats } {
  const lines = content.split('\n').filter(line => line.trim())
  const msgs: Message[] = []
  const sessionStats: SessionStats = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, toolCalls: 0, durationMs: 0 }
  let firstTs = 0
  let lastTs = 0

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      const role = data.role

      const ts = data.timestamp ? new Date(data.timestamp).getTime() : 0
      if (ts) {
        if (!firstTs || ts < firstTs) firstTs = ts
        if (ts > lastTs) lastTs = ts
      }

      if (role === 'session_meta') {
        msgs.push({
          id: data.timestamp || '',
          type: 'snapshot',
          content: `Session: model=${data.model || '?'}, platform=${data.platform || 'cli'}`,
          blocks: [],
          timestamp: data.timestamp || ''
        })
      } else if (role === 'user') {
        const text = typeof data.content === 'string' ? data.content : ''
        msgs.push({
          id: data.timestamp || '',
          type: 'user',
          content: text,
          blocks: [{ type: 'text', text }],
          timestamp: data.timestamp || ''
        })
      } else if (role === 'assistant') {
        const blocks: ContentBlock[] = []
        if (data.reasoning) {
          blocks.push({ type: 'thinking', thinking: data.reasoning })
        }
        const text = typeof data.content === 'string' ? data.content : ''
        if (text) {
          blocks.push({ type: 'text', text })
        }
        msgs.push({
          id: data.timestamp || '',
          type: 'assistant',
          content: text,
          blocks,
          timestamp: data.timestamp || ''
        })
      }
    } catch {
      // skip invalid JSON
    }
  }

  if (firstTs && lastTs) sessionStats.durationMs = lastTs - firstTs
  return { msgs, sessionStats }
}

function parseMessages(content: string): { msgs: Message[]; sessionStats: SessionStats } {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length > 0 && isHermesFormat(lines[0])) {
    return parseHermesMessages(content)
  }

  const msgs: Message[] = []
  const sessionStats: SessionStats = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, toolCalls: 0, durationMs: 0 }
  let firstTs = 0
  let lastTs = 0

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      const type = data.type

      // accumulate token stats from assistant messages
      if (type === 'assistant' && data.message?.usage) {
        const u = data.message.usage
        sessionStats.inputTokens += u.input_tokens || 0
        sessionStats.outputTokens += u.output_tokens || 0
        sessionStats.cacheReadTokens += u.cache_read_input_tokens || 0
        sessionStats.cacheWriteTokens += u.cache_creation_input_tokens || 0
      }

      // track timestamps for duration
      const ts = data.timestamp ? new Date(data.timestamp).getTime() : 0
      if (ts) {
        if (!firstTs || ts < firstTs) firstTs = ts
        if (ts > lastTs) lastTs = ts
      }

      if (type === 'file-history-snapshot') {
        msgs.push({
          id: data.messageId || data.snapshot?.messageId || '',
          type: 'snapshot',
          content: `File snapshot: ${Object.keys(data.snapshot?.trackedFileBackups || {}).join(', ') || 'No files'}`,
          blocks: [],
          timestamp: data.timestamp || data.snapshot?.timestamp || ''
        })
      } else if (type === 'user') {
        const rawContent = data.message?.content
        const blocks: ContentBlock[] = []
        let textParts: string[] = []
        if (typeof rawContent === 'string') {
          textParts = [rawContent]
          blocks.push({ type: 'text', text: rawContent })
        } else if (Array.isArray(rawContent)) {
          for (const c of rawContent) {
            blocks.push(c as ContentBlock)
            if (c.type === 'text') textParts.push(c.text || '')
          }
        }
        const text = textParts.join('')
        if (text.trim() || blocks.some(b => b.type === 'tool_result')) {
          msgs.push({
            id: data.uuid || data.messageId || '',
            type: 'user',
            content: text,
            blocks,
            timestamp: data.timestamp || ''
          })
        }
      } else if (type === 'assistant') {
        const rawContent = data.message?.content
        const blocks: ContentBlock[] = []
        let textParts: string[] = []
        if (typeof rawContent === 'string') {
          textParts = [rawContent]
          blocks.push({ type: 'text', text: rawContent })
        } else if (Array.isArray(rawContent)) {
          for (const c of rawContent) {
            blocks.push(c as ContentBlock)
            if (c.type === 'text') textParts.push(c.text || '')
            if (c.type === 'tool_use') sessionStats.toolCalls++
          }
        }
        msgs.push({
          id: data.uuid || data.message?.id || '',
          type: 'assistant',
          content: textParts.join('\n\n'),
          blocks,
          timestamp: data.timestamp || ''
        })
      }
    } catch {
      // skip invalid JSON
    }
  }

  if (firstTs && lastTs) sessionStats.durationMs = lastTs - firstTs
  return { msgs, sessionStats }
}

function scrollToMessage(index: number) {
  const el = messageRefs.value[index]
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  return new Date(timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms: number): string {
  if (!ms) return '-'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function getCodeBlocks(content: string): string[] {
  return content.match(/```[\s\S]*?```/g) || []
}

function getTextContent(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '').trim()
}

async function copyCode(code: string) {
  await navigator.clipboard.writeText(code.replace(/```\w*\n?/g, '').trim())
}

function toolInputPreview(input: Record<string, unknown>): string {
  try {
    const str = JSON.stringify(input, null, 2)
    return str.length > 300 ? str.slice(0, 300) + '...' : str
  } catch {
    return ''
  }
}

function toolResultText(block: any): string {
  if (typeof block.content === 'string') return block.content
  if (Array.isArray(block.content)) {
    return block.content.map((c: any) => c.text || c.content || '').join('')
  }
  return ''
}
</script>

<template>
  <div class="min-h-screen bg-terminal scanlines">
    <header class="sticky top-0 z-10 border-b" style="background: var(--bg-secondary); border-color: var(--border-color);">
      <div class="max-w-4xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button @click="goBack" class="p-2 rounded-lg transition-colors hover:bg-white/5" style="color: var(--text-secondary);">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 class="text-base font-medium" style="color: var(--text-primary);">{{ sessionId?.slice(0, 8) }}...</h1>
              <p class="text-xs" style="color: var(--text-muted);">{{ messages.length }} messages</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- Stats toggle -->
            <button
              @click="showStats = !showStats"
              class="p-2 rounded-lg transition-colors"
              :style="showStats ? { background: 'var(--accent-subtle)', color: 'var(--accent)' } : { color: 'var(--text-secondary)' }"
              title="统计面板"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
            <!-- Outline toggle -->
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
            <!-- Refresh -->
            <button @click="handleRefresh" :disabled="refreshing" class="p-2 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-50" style="color: var(--text-secondary);" title="刷新">
              <svg class="w-5 h-5" :class="{ 'animate-spin': refreshing }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <!-- Theme toggle -->
            <button @click="toggleTheme" class="p-2 rounded-lg transition-colors hover:bg-white/5" style="color: var(--text-secondary);" title="切换主题">
              <svg v-if="theme === 'dark'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Stats panel -->
        <div v-if="showStats" class="mt-3 pt-3 border-t grid grid-cols-3 gap-3" style="border-color: var(--border-color);">
          <div class="rounded-lg p-3" style="background: var(--bg-card); border: 1px solid var(--border-color);">
            <p class="text-xs mb-1" style="color: var(--text-muted);">Input tokens</p>
            <p class="text-sm font-medium" style="color: var(--accent);">{{ fmtNum(stats.inputTokens) }}</p>
          </div>
          <div class="rounded-lg p-3" style="background: var(--bg-card); border: 1px solid var(--border-color);">
            <p class="text-xs mb-1" style="color: var(--text-muted);">Output tokens</p>
            <p class="text-sm font-medium" style="color: var(--accent);">{{ fmtNum(stats.outputTokens) }}</p>
          </div>
          <div class="rounded-lg p-3" style="background: var(--bg-card); border: 1px solid var(--border-color);">
            <p class="text-xs mb-1" style="color: var(--text-muted);">Cache read</p>
            <p class="text-sm font-medium" style="color: var(--accent);">{{ fmtNum(stats.cacheReadTokens) }}</p>
          </div>
          <div class="rounded-lg p-3" style="background: var(--bg-card); border: 1px solid var(--border-color);">
            <p class="text-xs mb-1" style="color: var(--text-muted);">Cache write</p>
            <p class="text-sm font-medium" style="color: var(--accent);">{{ fmtNum(stats.cacheWriteTokens) }}</p>
          </div>
          <div class="rounded-lg p-3" style="background: var(--bg-card); border: 1px solid var(--border-color);">
            <p class="text-xs mb-1" style="color: var(--text-muted);">Tool calls</p>
            <p class="text-sm font-medium" style="color: var(--accent);">{{ stats.toolCalls }}</p>
          </div>
          <div class="rounded-lg p-3" style="background: var(--bg-card); border: 1px solid var(--border-color);">
            <p class="text-xs mb-1" style="color: var(--text-muted);">Duration</p>
            <p class="text-sm font-medium" style="color: var(--accent);">{{ formatDuration(stats.durationMs) }}</p>
          </div>
        </div>
      </div>
    </header>

    <div class="flex">
      <!-- Outline panel -->
      <aside
        v-if="showOutline && userOutlines.length > 0"
        class="w-64 flex-shrink-0 hidden md:block border-r"
        style="background: var(--bg-secondary); border-color: var(--border-color);"
      >
        <div class="sticky top-[65px] p-4 max-h-[calc(100vh-65px)] overflow-y-auto">
          <h2 class="text-sm font-medium mb-3" style="color: var(--text-secondary);">Outline <span class="font-normal" style="color: var(--text-muted);">({{ userOutlines.length }})</span></h2>
          <div class="space-y-1">
            <button
              v-for="outline in userOutlines"
              :key="outline.index"
              @click="scrollToMessage(outline.index)"
              class="w-full text-left p-2 rounded-lg transition-colors"
              :style="activeOutlineIndex === outline.outlineIndex
                ? { background: 'var(--accent-subtle)', borderColor: 'var(--accent)', border: '1px solid var(--accent)' }
                : { background: 'var(--bg-card)', border: '1px solid var(--border-color)' }"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-medium" style="color: var(--accent);">#{{ outline.outlineIndex + 1 }}</span>
                <span v-if="outline.timestamp" class="text-xs" style="color: var(--text-muted);">{{ formatDate(outline.timestamp) }}</span>
              </div>
              <p class="text-xs line-clamp-2" style="color: var(--text-secondary);">{{ outline.preview }}</p>
            </button>
          </div>
        </div>
      </aside>

      <!-- Message list -->
      <main class="flex-1 px-6 py-8" :class="{ 'md:pl-0': showOutline }">
        <div :class="showOutline ? 'max-w-3xl' : 'max-w-4xl'" class="mx-auto space-y-6">
          <div v-if="loading" class="space-y-6">
            <div v-for="i in 5" :key="i" class="ml-8">
              <div class="rounded-xl border p-4 animate-pulse" style="background: var(--bg-card); border-color: var(--border-color);">
                <div class="h-3 rounded mb-2" style="background: var(--border-color); width: 30%;"></div>
                <div class="h-3 rounded" style="background: var(--border-color); width: 80%;"></div>
              </div>
            </div>
          </div>

          <div v-else-if="error" class="text-center py-12" style="color: var(--text-muted);">{{ error }}</div>

          <template v-else>
            <div
              v-for="(msg, idx) in messages"
              :key="msg.id || idx"
              :ref="el => { if (el) messageRefs[idx] = el as HTMLElement }"
              class="flex gap-3"
            >
              <!-- Icon -->
              <div class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-1"
                :style="msg.type === 'user' ? { background: 'var(--accent)', color: '#000' } : msg.type === 'assistant' ? { background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--accent)' } : { background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }"
              >
                {{ msg.type === 'user' ? 'U' : msg.type === 'assistant' ? 'A' : 'S' }}
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs font-medium" style="color: var(--text-secondary);">{{ msg.type === 'user' ? 'User' : msg.type === 'assistant' ? 'Assistant' : 'Snapshot' }}</span>
                  <span v-if="msg.timestamp" class="text-xs" style="color: var(--text-muted);">{{ formatDate(msg.timestamp) }}</span>
                </div>

                <!-- Blocks rendering -->
                <div class="space-y-3">
                  <template v-for="(block, bi) in msg.blocks" :key="bi">
                    <!-- Text block -->
                    <div v-if="block.type === 'text'">
                      <div v-if="getCodeBlocks((block as any).text || '').length > 0" class="space-y-3 mb-3">
                        <div v-for="(cb, ci) in getCodeBlocks((block as any).text || '')" :key="ci" class="relative group">
                          <button @click="copyCode(cb)" class="absolute top-2 right-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity" style="background: rgba(255,255,255,0.1); color: var(--text-secondary);">Copy</button>
                          <pre class="rounded-lg p-4 overflow-x-auto text-sm" style="background: #0d0d0d; color: var(--text-primary); font-family: 'SF Mono', monospace;"><code>{{ cb.replace(/```\w*\n?/g, '').trim() }}</code></pre>
                        </div>
                      </div>
                      <div class="whitespace-pre-wrap break-words" style="color: var(--text-secondary);">{{ getTextContent((block as any).text || '') || '(empty)' }}</div>
                    </div>

                    <!-- Thinking block -->
                    <details v-else-if="block.type === 'thinking'" class="rounded-lg border" style="border-color: var(--border-color); background: var(--bg-card);">
                      <summary class="px-3 py-2 text-xs cursor-pointer" style="color: var(--text-muted);">Thinking...</summary>
                      <div class="px-3 pb-3 text-xs whitespace-pre-wrap" style="color: var(--text-secondary);">{{ (block as any).thinking }}</div>
                    </details>

                    <!-- Tool use block -->
                    <div v-else-if="block.type === 'tool_use'" class="rounded-lg border overflow-hidden" style="border-color: var(--accent); background: var(--bg-card);">
                      <div class="px-3 py-2 flex items-center gap-2 border-b" style="background: var(--accent-subtle); border-color: var(--accent);">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--accent);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span class="text-xs font-medium" style="color: var(--accent);">{{ (block as any).name }}</span>
                        <span class="text-xs ml-auto" style="color: var(--text-muted);">{{ (block as any).id?.slice(0,8) }}</span>
                      </div>
                      <pre class="px-3 py-2 text-xs overflow-x-auto" style="color: var(--text-secondary); font-family: 'SF Mono', monospace;">{{ toolInputPreview((block as any).input || {}) }}</pre>
                    </div>

                    <!-- Tool result block -->
                    <div v-else-if="block.type === 'tool_result'" class="rounded-lg border overflow-hidden" :style="(block as any).is_error ? { borderColor: '#f87171', background: 'rgba(248,113,113,0.05)' } : { borderColor: 'var(--border-color)', background: 'var(--bg-card)' }">
                      <div class="px-3 py-1.5 border-b flex items-center gap-2" :style="(block as any).is_error ? { borderColor: '#f87171', background: 'rgba(248,113,113,0.08)' } : { borderColor: 'var(--border-color)', background: 'rgba(255,255,255,0.02)' }">
                        <span class="text-xs font-medium" :style="(block as any).is_error ? { color: '#f87171' } : { color: 'var(--text-muted)' }">{{ (block as any).is_error ? 'Error' : 'Result' }}</span>
                        <span class="text-xs" style="color: var(--text-muted);">{{ (block as any).tool_use_id?.slice(0,8) }}</span>
                      </div>
                      <div class="px-3 py-2 text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto" style="color: var(--text-secondary); font-family: 'SF Mono', monospace;">{{ toolResultText(block) }}</div>
                    </div>
                  </template>

                  <!-- Fallback for snapshot or messages without blocks -->
                  <div v-if="msg.blocks.length === 0" class="whitespace-pre-wrap break-words" style="color: var(--text-secondary);">{{ msg.content || '(empty)' }}</div>
                </div>
              </div>
            </div>

            <div v-if="messages.length === 0" class="text-center py-12" style="color: var(--text-muted);">No messages</div>
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
