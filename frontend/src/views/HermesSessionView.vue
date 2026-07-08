<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getHermesMessages } from '../api'
import type { HermesMessage, Message, ContentBlock } from '../types'
import { useTheme } from '../composables/useTheme'
import MarkdownView from '../components/MarkdownView.vue'

const router = useRouter()
const route = useRoute()
const sessionId = computed(() => route.query.id as string)

const messages = ref<Message[]>([])
const loading = ref(true)
const error = ref('')
const { theme, toggleTheme } = useTheme()

onMounted(async () => {
  if (!sessionId.value) return
  try {
    const raw = await getHermesMessages(sessionId.value)
    messages.value = raw.map(convertMessage)
  } catch (err) {
    console.error('Error:', err)
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
})

function convertMessage(raw: HermesMessage): Message {
  const blocks: ContentBlock[] = []
  let content = ''

  if (raw.role === 'assistant') {
    if (raw.reasoning) {
      blocks.push({ type: 'thinking', thinking: raw.reasoning })
    }
    if (raw.content) {
      blocks.push({ type: 'text', text: raw.content })
    }
    content = raw.content
  } else if (raw.role === 'user') {
    if (raw.content) {
      blocks.push({ type: 'text', text: raw.content })
    }
    content = raw.content
  } else if (raw.role === 'session_meta') {
    blocks.push({ type: 'text', text: raw.content })
    content = raw.content
  }

  const type = hermesMessageType(raw.role)

  return {
    id: String(raw.id),
    type,
    content,
    blocks,
    timestamp: raw.timestamp || ''
  }
}

function hermesMessageType(role: string): Message['type'] {
  if (role === 'user') return 'user'
  if (role === 'assistant') return 'assistant'
  return 'snapshot'
}

function goBack() {
  router.push({ name: 'home' })
}

function formatDate(timestamp: string): string {
  if (!timestamp) return ''
  return new Date(parseInt(timestamp) * 1000).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
        <div class="space-y-6">
          <div
            v-for="(msg, idx) in messages"
            :key="msg.id || idx"
            class="flex gap-3"
          >
            <div class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-1"
              :style="msg.type === 'user' ? { background: 'var(--accent)', color: '#000' } : msg.type === 'assistant' ? { background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--accent)' } : { background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }"
            >
              {{ msg.type === 'user' ? 'U' : msg.type === 'assistant' ? 'A' : 'M' }}
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-medium" style="color: var(--text-secondary);">{{ msg.type === 'user' ? 'User' : msg.type === 'assistant' ? 'Assistant' : 'Meta' }}</span>
                <span v-if="msg.timestamp" class="text-xs" style="color: var(--text-muted);">{{ formatDate(msg.timestamp) }}</span>
              </div>

              <div class="space-y-3">
                <template v-for="(block, bi) in msg.blocks" :key="bi">
                  <!-- Thinking block -->
                  <details v-if="block.type === 'thinking'" class="rounded-lg border" style="border-color: var(--border-color); background: var(--bg-card);">
                    <summary class="px-3 py-2 text-xs cursor-pointer" style="color: var(--text-muted);">Thinking...</summary>
                    <div class="px-3 pb-3">
                      <MarkdownView compact :content="(block as any).thinking || ''" />
                    </div>
                  </details>
                  <!-- Text block -->
                  <div v-else-if="block.type === 'text'">
                    <MarkdownView :content="(block as any).text || ''" />
                  </div>
                </template>
                <div v-if="msg.blocks.length === 0" class="whitespace-pre-wrap break-words" style="color: var(--text-secondary);">{{ msg.content || '(empty)' }}</div>
              </div>
            </div>
          </div>

          <div v-if="messages.length === 0" class="text-center py-12" style="color: var(--text-muted);">No messages</div>
        </div>
      </template>
    </main>
  </div>
</template>
