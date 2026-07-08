<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import { openUrl } from '@tauri-apps/plugin-opener'

const props = withDefaults(defineProps<{
  content?: string
  /** 紧凑场景（如 thinking 折叠区），缩小字号 */
  compact?: boolean
}>(), { content: '', compact: false })

// 独立实例，避免污染全局 marked 配置
const md = new Marked({ gfm: true, breaks: true })

const container = ref<HTMLElement | null>(null)

const html = computed(() => {
  const text = props.content || ''
  if (!text.trim()) return ''
  const raw = md.parse(text, { async: false }) as string
  return DOMPurify.sanitize(raw)
})

watch(html, () => {
  nextTick(enhanceCodeBlocks)
})

onMounted(enhanceCodeBlocks)

/**
 * marked 只输出 <pre><code>，这里给它包一层 .md-code-block 并插入复制按钮。
 * 用 DOM 后处理而非自定义 renderer，避免踩 marked 跨版本的 renderer API 变化。
 */
function enhanceCodeBlocks() {
  const root = container.value
  if (!root) return
  root.querySelectorAll('pre').forEach(pre => {
    if (pre.parentElement?.classList.contains('md-code-block')) return
    const wrapper = document.createElement('div')
    wrapper.className = 'md-code-block'
    const btn = document.createElement('button')
    btn.className = 'md-copy-btn'
    btn.type = 'button'
    btn.textContent = 'Copy'
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      try {
        await navigator.clipboard.writeText(pre.textContent || '')
        btn.textContent = 'Copied!'
        setTimeout(() => { btn.textContent = 'Copy' }, 1500)
      } catch {
        /* clipboard 不可用，静默 */
      }
    })
    pre.parentNode?.insertBefore(wrapper, pre)
    wrapper.appendChild(btn)
    wrapper.appendChild(pre)
  })
}

function onClick(e: MouseEvent) {
  const anchor = (e.target as HTMLElement | null)?.closest('a')
  if (!anchor) return
  const href = anchor.getAttribute('href')
  if (!href) return
  // 仅外链走 opener（Tauri webview 直接打开外链会失效），锚点等交给默认行为
  if (/^(https?:|mailto:)/i.test(href)) {
    e.preventDefault()
    openUrl(href).catch(() => {})
  }
}
</script>

<template>
  <div
    v-if="html"
    ref="container"
    class="markdown-body"
    :class="{ 'markdown-compact': compact }"
    @click="onClick"
    v-html="html"
  />
  <div v-else class="markdown-body" :class="{ 'markdown-compact': compact }" style="color: var(--text-muted);">(empty)</div>
</template>
