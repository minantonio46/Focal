import { contextBridge, ipcRenderer } from 'electron'

// ─── 렌더러에 노출할 API ──────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  // 창 모드
  setWindowMode:    (mode: 'normal' | 'medium' | 'mini') =>
    ipcRenderer.invoke('set-window-mode', mode),

  // 항상 위에
  toggleAlwaysOnTop: () =>
    ipcRenderer.invoke('toggle-always-on-top'),

  // 항상 밑에
  toggleAlwaysOnBottom: () =>
    ipcRenderer.invoke('toggle-always-on-bottom'),

  // 앱 설정 조회
  getAppConfig: () =>
    ipcRenderer.invoke('get-app-config'),

  // 자동 시작
  setAutoLaunch: (enable: boolean) =>
    ipcRenderer.invoke('set-auto-launch', enable),

  // frameless 창 제어
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose:    () => ipcRenderer.invoke('window-close'),
  appQuit:         () => ipcRenderer.invoke('app-quit'),

  // 알림
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('show-notification', title, body),

  // 외부 링크
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),
})
