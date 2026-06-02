/**
 * 위젯 공통 훅 — Electron 환경 여부 및 앱 설정 조회
 */

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

export interface ElectronAppConfig {
  windowMode:    'normal' | 'medium' | 'mini'
  alwaysOnTop:   boolean
  alwaysOnBottom: boolean
  autoLaunch:    boolean
}

declare global {
  interface Window {
    electronAPI?: {
      setWindowMode:        (mode: 'normal' | 'medium' | 'mini') => Promise<void>
      toggleAlwaysOnTop:    () => Promise<boolean>
      toggleAlwaysOnBottom: () => Promise<boolean>
      getAppConfig:         () => Promise<ElectronAppConfig>
      setAutoLaunch:        (enable: boolean) => Promise<void>
      windowMinimize:       () => Promise<void>
      windowMaximize:       () => Promise<void>
      windowClose:          () => Promise<void>
      appQuit:              () => Promise<void>
      showNotification:     (title: string, body: string) => Promise<void>
      openExternal:         (url: string) => Promise<void>
    }
  }
}
