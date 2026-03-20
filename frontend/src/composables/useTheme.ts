import { ref, watch, onMounted } from 'vue'

type Theme = 'dark' | 'light'

const theme = ref<Theme>('dark')

export function useTheme() {
  const initTheme = () => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved) {
      theme.value = saved
    } else {
      // 默认跟随系统
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      theme.value = prefersDark ? 'dark' : 'light'
    }
    applyTheme()
  }

  const applyTheme = () => {
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  const toggleTheme = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', theme.value)
    applyTheme()
  }

  watch(theme, applyTheme)

  onMounted(initTheme)

  return {
    theme,
    toggleTheme
  }
}
