import { useEffect } from 'react'
import type { Settings } from '../types'

/**
 * settings.theme ('light' | 'dark' | 'system')을 <html> 태그에 반영
 * - 'dark'   → html에 class="dark" 추가
 * - 'light'  → class="dark" 제거
 * - 'system' → 시스템 prefers-color-scheme에 따라 자동 전환
 */
export function useTheme(theme: Settings['theme'] | undefined) {
  useEffect(() => {
    const html = document.documentElement

    if (!theme || theme === 'system') {
      // 시스템 설정 감지
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = (dark: boolean) => {
        html.classList.toggle('dark', dark)
      }
      apply(mq.matches)
      mq.addEventListener('change', e => apply(e.matches))
      return () => mq.removeEventListener('change', e => apply(e.matches))
    } else {
      html.classList.toggle('dark', theme === 'dark')
    }
  }, [theme])
}
