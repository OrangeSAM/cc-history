<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useUpdater } from './composables/useUpdater'

const {
  updateAvailable,
  updateVersion,
  downloading,
  downloadProgress,
  error,
  downloadAndInstall,
  dismiss
} = useUpdater()
</script>

<template>
  <div class="relative min-h-screen">
    <!-- 更新提示横幅 -->
    <Transition name="slide-down">
      <div
        v-if="updateAvailable"
        class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
        style="background: linear-gradient(135deg, var(--accent) 0%, var(--accent) 100%); color: #000;"
      >
        <div class="flex items-center gap-3">
          <span class="text-lg">🚀</span>
          <span class="font-medium">
            新版本 v{{ updateVersion }} 可用
          </span>
          <span v-if="downloading" class="text-sm opacity-80">
            下载中...
          </span>
        </div>
        <div class="flex items-center gap-3">
          <button
            v-if="!downloading"
            @click="downloadAndInstall"
            class="px-4 py-1.5 rounded-md font-medium text-sm transition-all"
            style="background: rgba(0,0,0,0.2); color: #000;"
            @mouseenter="$event.target.style.background = 'rgba(0,0,0,0.3)'"
            @mouseleave="$event.target.style.background = 'rgba(0,0,0,0.2)'"
          >
            更新并重启
          </button>
          <button
            v-if="!downloading"
            @click="dismiss"
            class="px-3 py-1.5 rounded-md text-sm opacity-70 hover:opacity-100 transition-opacity"
          >
            稍后
          </button>
          <div v-if="downloading" class="w-24 h-2 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.2);">
            <div
              class="h-full rounded-full transition-all duration-300"
              style="background: rgba(0,0,0,0.5);"
              :style="{ width: `${downloadProgress}%` }"
            />
          </div>
        </div>
      </div>
    </Transition>

    <!-- 错误提示 -->
    <Transition name="slide-down">
      <div
        v-if="error"
        class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
        style="background: #dc2626; color: #fff;"
      >
        <span>更新失败: {{ error }}</span>
        <button @click="error = null" class="text-sm opacity-70 hover:opacity-100">关闭</button>
      </div>
    </Transition>

    <RouterView />
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
