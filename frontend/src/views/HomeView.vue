<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getProjects } from '../api'
import type { Project } from '../types'

const router = useRouter()
const projects = ref<Project[]>([])
const loading = ref(true)
const error = ref('')

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
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <main class="max-w-4xl mx-auto px-6 py-8">
      <!-- 统计摘要 -->
      <div v-if="!loading && !error && projects.length > 0" class="mb-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-5 text-white">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm opacity-80">项目数量</p>
            <p class="text-3xl font-bold">{{ stats.projectCount }}</p>
          </div>
          <div class="text-right">
            <p class="text-sm opacity-80">总会话数</p>
            <p class="text-3xl font-bold">{{ stats.sessionCount }}</p>
          </div>
        </div>
      </div>

      <div v-if="loading" class="space-y-4">
        <div v-for="i in 5" :key="i" class="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-gray-200"></div>
            <div class="flex-1">
              <div class="h-4 w-32 bg-gray-200 rounded mb-2"></div>
              <div class="h-3 w-24 bg-gray-100 rounded"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
        {{ error }}
      </div>

      <!-- 响应式项目列表 -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          v-for="project in projects"
          :key="project.id"
          @click="goToProject(project)"
          class="group bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-200 cursor-pointer"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md flex-shrink-0">
                {{ project.name.charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0">
                <h2 class="font-medium text-gray-900 truncate">{{ project.name }}</h2>
                <p class="text-xs text-gray-500">{{ project.session_count }} 个会话</p>
              </div>
            </div>
            <div class="text-right flex-shrink-0 ml-2">
              <p class="text-xs text-gray-500">{{ formatDate(project.last_modified) }}</p>
            </div>
          </div>
        </div>

        <div v-if="projects.length === 0" class="col-span-full text-center py-12 text-gray-500">
          暂无项目
        </div>
      </div>
    </main>
  </div>
</template>
