import { ref, onMounted } from 'vue'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export function useUpdater() {
  const updateAvailable = ref(false)
  const updateVersion = ref('')
  const updateNotes = ref('')
  const downloading = ref(false)
  const downloadProgress = ref(0)
  const error = ref<string | null>(null)

  let pendingUpdate: Update | null = null

  const checkForUpdates = async () => {
    try {
      const update = await check()
      if (update) {
        updateAvailable.value = true
        updateVersion.value = update.version
        updateNotes.value = update.body || ''
        pendingUpdate = update
      }
    } catch (e) {
      // 静默失败，不影响正常使用
      console.warn('Update check failed:', e)
    }
  }

  const downloadAndInstall = async () => {
    if (!pendingUpdate) return

    downloading.value = true
    error.value = null

    try {
      await pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            downloadProgress.value = 0
            break
          case 'Progress':
            downloadProgress.value = event.data.chunkLength
            break
          case 'Finished':
            downloadProgress.value = 100
            break
        }
      })

      // 安装完成后重启应用
      await relaunch()
    } catch (e) {
      error.value = String(e)
      downloading.value = false
    }
  }

  const dismiss = () => {
    updateAvailable.value = false
    pendingUpdate = null
  }

  onMounted(() => {
    // 延迟检查，避免影响启动速度
    setTimeout(checkForUpdates, 3000)
  })

  return {
    updateAvailable,
    updateVersion,
    updateNotes,
    downloading,
    downloadProgress,
    error,
    downloadAndInstall,
    dismiss
  }
}
