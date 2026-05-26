<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getUsageStats, getHermesSessions } from '../api'
import type { UsageStats, DailyUsage, HermesSession } from '../types'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const { theme, toggleTheme } = useTheme()

const stats = ref<UsageStats | null>(null)
const loading = ref(true)
const error = ref('')
const activeSource = ref<'claude' | 'hermes'>('claude')
const hermesSessions = ref<HermesSession[]>([])
const hoveredDay = ref<DailyUsage | null>(null)
const chartHoverX = ref(-1)

// Pricing map (per million tokens, USD)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus':     { input: 15, output: 75 },
  'claude-sonnet':   { input: 3,  output: 15 },
  'claude-haiku':    { input: 0.8, output: 4 },
}

function getModelPrice(model: string): { input: number; output: number } | null {
  for (const [prefix, price] of Object.entries(PRICING)) {
    if (model.startsWith(prefix)) return price
  }
  return null
}

function calcCost(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = getModelPrice(model)
  if (!price) return null
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output
}

const totalCost = computed(() => {
  if (!stats.value) return null
  let cost = 0
  let hasUnknown = false
  for (const m of stats.value.model_usage) {
    const c = calcCost(m.model, m.input_tokens, m.output_tokens)
    if (c === null) hasUnknown = true
    else cost += c
  }
  return { cost, hasUnknown }
})

const cacheHitRate = computed(() => {
  if (!stats.value || stats.value.total_input_tokens === 0) return 0
  return (stats.value.total_cache_read_tokens / stats.value.total_input_tokens) * 100
})

const activeDays = computed(() => {
  return stats.value?.daily_usage.length ?? 0
})

const chartData = computed(() => {
  if (!stats.value) return { points: '', maxVal: 1 }
  const days = stats.value.daily_usage
  if (days.length === 0) return { points: '', maxVal: 1 }

  let maxVal = 1
  for (const d of days) {
    const total = d.input_tokens + d.output_tokens
    if (total > maxVal) maxVal = total
  }

  return { days, maxVal }
})

function chartX(index: number): number {
  const data = chartData.value.days as DailyUsage[]
  if (data.length <= 1) return 50
  return 50 + (index / (data.length - 1)) * 700
}

function chartY(tokens: number): number {
  return 200 - (tokens / chartData.value.maxVal) * 190
}

function svgPath(field: 'input_tokens' | 'output_tokens'): string {
  const data = chartData.value.days as DailyUsage[]
  if (data.length === 0) return ''

  // Build area path
  let d = `M ${chartX(0)} ${chartY(0)}`
  for (let i = 1; i < data.length; i++) {
    const total = (data[i] as any)[field] as number
    d += ` L ${chartX(i)} ${chartY(total)}`
  }
  // Close area to bottom
  d += ` L ${chartX(data.length - 1)} 200 L ${chartX(0)} 200 Z`
  return d
}

function svgLine(field: 'input_tokens' | 'output_tokens'): string {
  const data = chartData.value.days as DailyUsage[]
  if (data.length === 0) return ''
  let d = `M ${chartX(0)} ${chartY((data[0] as any)[field] as number)}`
  for (let i = 1; i < data.length; i++) {
    d += ` L ${chartX(i)} ${chartY((data[i] as any)[field] as number)}`
  }
  return d
}

function onChartHover(e: MouseEvent) {
  const data = chartData.value.days as DailyUsage[]
  if (data.length === 0) return
  const svg = (e.target as HTMLElement).closest('svg')
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  const x = e.clientX - rect.left
  const ratio = (x - 50) / 700
  const idx = Math.round(ratio * (data.length - 1))
  if (idx >= 0 && idx < data.length) {
    chartHoverX.value = chartX(idx)
    hoveredDay.value = data[idx]
  }
}

function onChartLeave() {
  chartHoverX.value = -1
  hoveredDay.value = null
}

function goToProject(projectId: string) {
  router.push({ name: 'project', params: { slug: projectId } })
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

function fmtPercent(n: number): string {
  return n.toFixed(1) + '%'
}

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    if (activeSource.value === 'hermes') {
      const [s, h] = await Promise.all([
        getUsageStats('hermes'),
        getHermesSessions().catch(() => [] as HermesSession[]),
      ])
      stats.value = s
      hermesSessions.value = h
    } else {
      stats.value = await getUsageStats('claude')
      hermesSessions.value = []
    }
  } catch (err) {
    console.error('Error:', err)
    error.value = '加载统计数据失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStats()
})

watch(activeSource, () => {
  loadStats()
})
</script>

<template>
  <div class="min-h-screen bg-terminal scanlines">
    <!-- Header -->
    <header class="sticky top-0 z-10 border-b" style="background: var(--bg-secondary); border-color: var(--border-color);">
      <div class="max-w-5xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-4">
            <button @click="router.push({ name: 'home' })" class="p-2 rounded-lg transition-colors hover:bg-white/5" style="color: var(--text-secondary);">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 class="text-base font-medium" style="color: var(--text-primary);">用量与成本</h1>
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
      <!-- Source toggle -->
      <div class="max-w-5xl mx-auto px-6 pt-4">
        <div class="flex rounded-lg border p-0.5" style="background: var(--bg-secondary); border-color: var(--border-color);">
          <button
            @click="activeSource = 'claude'"
            class="flex-1 py-2 rounded-md text-sm font-medium transition-all"
            :style="activeSource === 'claude'
              ? { background: 'var(--accent)', color: '#000' }
              : { color: 'var(--text-muted)' }"
          >Claude Code</button>
          <button
            @click="activeSource = 'hermes'"
            class="flex-1 py-2 rounded-md text-sm font-medium transition-all"
            :style="activeSource === 'hermes'
              ? { background: '#8b5cf6', color: '#fff' }
              : { color: 'var(--text-muted)' }"
          >Hermes</button>
        </div>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-6 py-8">
      <!-- Loading -->
      <div v-if="loading" class="space-y-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div v-for="i in 4" :key="i" class="rounded-xl border p-5 animate-pulse" style="background: var(--bg-card); border-color: var(--border-color);">
            <div class="h-3 w-16 rounded mb-3" style="background: var(--border-color);"></div>
            <div class="h-7 w-24 rounded" style="background: var(--border-color);"></div>
          </div>
        </div>
        <div class="rounded-xl border p-6 animate-pulse" style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="h-48 rounded" style="background: var(--border-color);"></div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="p-4 rounded-lg border" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #ef4444;">
        {{ error }}
      </div>

      <!-- Data -->
      <template v-else-if="stats">
        <!-- Summary Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class="rounded-xl border p-5" style="background: var(--bg-card); border-color: var(--border-color);">
            <p class="text-xs mb-1" style="color: var(--text-muted);">ESTIMATED COST</p>
            <p class="text-2xl font-bold" style="color: var(--accent);">
              {{ totalCost ? fmtCost(totalCost.cost) : '—' }}
              <span v-if="totalCost?.hasUnknown" class="text-xs ml-1" style="color: var(--text-muted);">*</span>
            </p>
            <p v-if="totalCost?.hasUnknown" class="text-xs mt-1" style="color: var(--text-muted);">* 仅计算已知模型</p>
          </div>
          <div class="rounded-xl border p-5" style="background: var(--bg-card); border-color: var(--border-color);">
            <p class="text-xs mb-1" style="color: var(--text-muted);">TOTAL TOKENS</p>
            <p class="text-2xl font-bold" style="color: var(--accent);">{{ fmtNum(stats.total_input_tokens + stats.total_output_tokens) }}</p>
            <p class="text-xs mt-1" style="color: var(--text-muted);">in {{ fmtNum(stats.total_input_tokens) }} / out {{ fmtNum(stats.total_output_tokens) }}</p>
          </div>
          <div class="rounded-xl border p-5" style="background: var(--bg-card); border-color: var(--border-color);">
            <p class="text-xs mb-1" style="color: var(--text-muted);">CACHE HIT RATE</p>
            <p class="text-2xl font-bold" style="color: var(--accent);">{{ fmtPercent(cacheHitRate) }}</p>
            <p class="text-xs mt-1" style="color: var(--text-muted);">{{ fmtNum(stats.total_cache_read_tokens) }} read / {{ fmtNum(stats.total_cache_write_tokens) }} write</p>
          </div>
          <div class="rounded-xl border p-5" style="background: var(--bg-card); border-color: var(--border-color);">
            <p class="text-xs mb-1" style="color: var(--text-muted);">ACTIVE DAYS</p>
            <p class="text-2xl font-bold" style="color: var(--accent);">{{ activeDays }}</p>
            <p class="text-xs mt-1" style="color: var(--text-muted);">最近 30 天</p>
          </div>
        </div>

        <!-- Daily trend chart -->
        <div v-if="stats.daily_usage.length > 0" class="rounded-xl border p-6 mb-8" style="background: var(--bg-card); border-color: var(--border-color);">
          <h2 class="text-sm font-medium mb-4" style="color: var(--text-secondary);">每日 Token 用量趋势</h2>
          <div class="relative overflow-x-auto">
            <svg
              viewBox="0 0 800 220"
              class="w-full"
              style="min-width: 600px;"
              @mousemove="onChartHover"
              @mouseleave="onChartLeave"
            >
              <!-- Grid lines -->
              <line v-for="i in 4" :key="i" :x1="50" :y1="200 - i * 47.5" :x2="750" :y2="200 - i * 47.5" stroke="var(--border-color)" stroke-width="0.5" />
              <!-- Y axis labels -->
              <text v-for="i in 4" :key="'y'+i" x="44" :y="203 - i * 47.5" text-anchor="end" font-size="9" fill="var(--text-muted)">
                {{ fmtNum(chartData.maxVal * i / 4) }}
              </text>

              <!-- Input area -->
              <path :d="svgPath('input_tokens')" fill="rgba(96, 165, 250, 0.12)" />
              <!-- Output area -->
              <path :d="svgPath('output_tokens')" fill="rgba(251, 146, 60, 0.12)" />
              <!-- Input line -->
              <path :d="svgLine('input_tokens')" fill="none" stroke="#60a5fa" stroke-width="1.5" />
              <!-- Output line -->
              <path :d="svgLine('output_tokens')" fill="none" stroke="#fb923c" stroke-width="1.5" />

              <!-- Hover indicator -->
              <line v-if="chartHoverX >= 0" :x1="chartHoverX" y1="10" :x2="chartHoverX" y2="200" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="4" />
            </svg>

            <!-- Tooltip -->
            <div v-if="hoveredDay" class="text-xs mt-2 flex gap-4" style="color: var(--text-secondary);">
              <span style="color: var(--text-primary);">{{ hoveredDay.date }}</span>
              <span style="color: #60a5fa;">Input: {{ fmtNum(hoveredDay.input_tokens) }}</span>
              <span style="color: #fb923c;">Output: {{ fmtNum(hoveredDay.output_tokens) }}</span>
              <span style="color: var(--text-muted);">Cache R: {{ fmtNum(hoveredDay.cache_read_tokens) }}</span>
            </div>

            <!-- Legend -->
            <div class="flex gap-4 mt-3 text-xs">
              <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 inline-block" style="background: #60a5fa;"></span> <span style="color: var(--text-muted);">Input tokens</span></span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 inline-block" style="background: #fb923c;"></span> <span style="color: var(--text-muted);">Output tokens</span></span>
            </div>
          </div>
        </div>
        <div v-else class="rounded-xl border p-6 mb-8 text-center" style="background: var(--bg-card); border-color: var(--border-color);">
          <p style="color: var(--text-muted);">暂无用量数据</p>
        </div>

        <!-- Project ranking + Model breakdown (side by side on large screens) -->
        <div :class="activeSource === 'claude' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8' : 'mb-8'">
          <!-- Project ranking (Claude only) -->
          <div v-if="activeSource === 'claude' && stats.project_usage.length > 0" class="rounded-xl border p-6" style="background: var(--bg-card); border-color: var(--border-color);">
            <h2 class="text-sm font-medium mb-4" style="color: var(--text-secondary);">项目排名</h2>
            <div class="space-y-2">
              <div
                v-for="(p, i) in stats.project_usage.slice(0, 10)"
                :key="p.project_id"
                @click="goToProject(p.project_id)"
                class="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
              >
                <span class="text-xs w-5 flex-shrink-0" style="color: var(--text-muted);">{{ i + 1 }}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs truncate" style="color: var(--text-primary);">{{ p.project_name }}</p>
                  <p class="text-xs" style="color: var(--text-muted);">{{ p.session_count }} sessions</p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-xs font-medium" style="color: var(--accent);">{{ fmtNum(p.input_tokens + p.output_tokens) }}</p>
                  <p class="text-xs" style="color: var(--text-muted);">{{ fmtNum(p.input_tokens) }} / {{ fmtNum(p.output_tokens) }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Model breakdown -->
          <div v-if="stats.model_usage.length > 0" class="rounded-xl border p-6" style="background: var(--bg-card); border-color: var(--border-color);">
            <h2 class="text-sm font-medium mb-4" style="color: var(--text-secondary);">模型用量分布</h2>
            <div class="space-y-3">
              <div v-for="m in stats.model_usage" :key="m.model" class="flex items-center gap-3">
                <span class="text-xs w-28 flex-shrink-0 truncate" style="color: var(--text-primary);">{{ m.model }}</span>
                <div class="flex-1 h-5 rounded-sm relative overflow-hidden" style="background: var(--bg-secondary);">
                  <div
                    class="absolute inset-y-0 left-0 rounded-sm transition-all"
                    :style="{
                      width: ((m.input_tokens + m.output_tokens) / (stats.total_input_tokens + stats.total_output_tokens) * 100) + '%',
                      background: 'var(--accent)',
                      opacity: 0.7
                    }"
                  />
                </div>
                <span class="text-xs w-14 text-right flex-shrink-0" style="color: var(--text-muted);">{{ fmtNum(m.input_tokens + m.output_tokens) }}</span>
                <span class="text-xs w-16 text-right flex-shrink-0" style="color: var(--accent);">
                  {{ getModelPrice(m.model) ? fmtCost(calcCost(m.model, m.input_tokens, m.output_tokens)!) : '—' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- All projects detail table (Claude only) -->
        <div v-if="activeSource === 'claude' && stats.project_usage.length > 0" class="rounded-xl border overflow-hidden" style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <th class="text-left p-3" style="color: var(--text-muted);">项目</th>
                  <th class="text-right p-3" style="color: var(--text-muted);">会话</th>
                  <th class="text-right p-3" style="color: var(--text-muted);">Input</th>
                  <th class="text-right p-3" style="color: var(--text-muted);">Output</th>
                  <th class="text-right p-3" style="color: var(--text-muted);">Cache Read</th>
                  <th class="text-right p-3" style="color: var(--text-muted);">Cache Write</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in stats.project_usage"
                  :key="p.project_id"
                  @click="goToProject(p.project_id)"
                  class="cursor-pointer transition-colors hover:bg-white/5"
                  style="border-bottom: 1px solid var(--border-color);"
                >
                  <td class="p-3" style="color: var(--text-primary);">{{ p.project_name }}</td>
                  <td class="p-3 text-right" style="color: var(--text-secondary);">{{ p.session_count }}</td>
                  <td class="p-3 text-right" style="color: #60a5fa;">{{ fmtNum(p.input_tokens) }}</td>
                  <td class="p-3 text-right" style="color: #fb923c;">{{ fmtNum(p.output_tokens) }}</td>
                  <td class="p-3 text-right" style="color: var(--text-secondary);">{{ fmtNum(p.cache_read_tokens) }}</td>
                  <td class="p-3 text-right" style="color: var(--text-secondary);">{{ fmtNum(p.cache_write_tokens) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Hermes session detail table -->
        <div v-if="activeSource === 'hermes' && hermesSessions.length > 0" class="rounded-xl border overflow-hidden" style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <th class="text-left p-3" style="color: var(--text-muted);">会话</th>
                  <th class="text-right p-3" style="color: var(--text-muted);">Model</th>
                  <th class="text-right p-3" style="color: var(--text-muted);">Input</th>
                  <th class="text-right p-3" style="color: var(--text-muted);">Output</th>
                  <th class="text-right p-3" style="color: var(--text-muted);">Cache Read</th>
                  <th class="text-right p-3" style="color: var(--text-muted);">Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="s in hermesSessions"
                  :key="s.id"
                  @click="router.push({ name: 'hermes-session', query: { id: s.id } })"
                  class="cursor-pointer transition-colors hover:bg-white/5"
                  style="border-bottom: 1px solid var(--border-color);"
                >
                  <td class="p-3 max-w-xs truncate" style="color: var(--text-primary);">{{ s.title || s.id.slice(0, 8) + '...' }}</td>
                  <td class="p-3 text-right" style="color: var(--text-secondary);">{{ s.model }}</td>
                  <td class="p-3 text-right" style="color: #60a5fa;">{{ fmtNum(s.input_tokens) }}</td>
                  <td class="p-3 text-right" style="color: #fb923c;">{{ fmtNum(s.output_tokens) }}</td>
                  <td class="p-3 text-right" style="color: var(--text-secondary);">{{ fmtNum(s.cache_read_tokens) }}</td>
                  <td class="p-3 text-right" style="color: var(--accent);">{{ fmtCost(s.estimated_cost_usd) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
