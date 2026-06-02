import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  ipcMain,
  nativeImage,
  shell,
  screen,
} from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import Store from 'electron-store'

// ─── 설정 저장소 ───────────────────────────────────────────
interface AppConfig {
  windowMode: 'normal' | 'medium' | 'mini'
  alwaysOnTop: boolean
  alwaysOnBottom: boolean
  startMinimized: boolean
  windowBounds: { x?: number; y?: number; width: number; height: number }
  autoLaunch: boolean
}

const store = new Store<AppConfig>({
  defaults: {
    windowMode: 'normal',
    alwaysOnTop: false,
    alwaysOnBottom: false,
    startMinimized: false,
    windowBounds: { width: 1280, height: 800 },
    autoLaunch: false,
  },
})

// ─── 윈도우 크기 정의 ──────────────────────────────────────
const WINDOW_SIZES = {
  normal: { width: 1280, height: 800, minWidth: 800,  minHeight: 600,  frame: true,  resizable: true  },
  medium: { width: 360,  height: 600, minWidth: 320,  minHeight: 400,  frame: false, resizable: true  },
  mini:   { width: 280,  height: 80,  minWidth: 240,  minHeight: 60,   frame: false, resizable: false },
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ─── URL 결정 ──────────────────────────────────────────────
function getAppUrl(mode: AppConfig['windowMode']): string {
  if (isDev) {
    const base = 'http://localhost:5173'
    return { normal: `${base}/`, medium: `${base}/widget/medium`, mini: `${base}/widget/mini` }[mode]
  } else {
    const index = `file://${path.join(process.resourcesPath, 'web-dist', 'index.html').replace(/\\/g, '/')}`
    return { normal: index, medium: `${index}#/widget/medium`, mini: `${index}#/widget/mini` }[mode]
  }
}

// ─── 윈도우 생성 ──────────────────────────────────────────
function createWindow() {
  const mode   = store.get('windowMode')
  const size   = WINDOW_SIZES[mode]
  const bounds = store.get('windowBounds')
  const onTop  = store.get('alwaysOnTop')

  mainWindow = new BrowserWindow({
    width:         mode === 'normal' ? (bounds.width  ?? size.width)  : size.width,
    height:        mode === 'normal' ? (bounds.height ?? size.height) : size.height,
    x:             mode === 'normal' ? bounds.x : undefined,
    y:             mode === 'normal' ? bounds.y : undefined,
    minWidth:      size.minWidth,
    minHeight:     size.minHeight,
    frame:         size.frame,
    resizable:     size.resizable,
    alwaysOnTop:   onTop,
    transparent:   mode === 'mini',
    skipTaskbar:   mode === 'mini',
    titleBarStyle:   'default',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    show: false,
    icon: getIconPath(),
  })

  // file:// 에서 외부 http 요청 허용 (PocketBase 연결)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' file: http: https: ws: wss: data: blob:"
        ]
      }
    })
  })

  mainWindow.loadURL(getAppUrl(mode))

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return

    // 미니/중형: 우하단 배치
    if (mode !== 'normal') {
      const display = screen.getPrimaryDisplay()
      const { width: sw, height: sh } = display.workAreaSize
      mainWindow.setPosition(sw - size.width - 20, sh - size.height - 20)
    }

    if (!store.get('startMinimized')) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // 창 위치/크기 저장 (normal 모드만)
  if (mode === 'normal') {
    mainWindow.on('close', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        store.set('windowBounds', mainWindow.getBounds())
      }
    })
  }

  // DevTools (개발 모드는 자동, 프로덕션은 F12/Ctrl+Shift+I로 토글)
  if (isDev && mode === 'normal') {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (
      (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) &&
      input.type === 'keyDown'
    ) {
      if (mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow?.webContents.openDevTools({ mode: 'detach' })
      }
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── 트레이 ───────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(getIconPath())
  const trayIcon = icon.isEmpty()
    ? nativeImage.createEmpty()
    : icon.resize({ width: 16, height: 16 })

  tray = new Tray(trayIcon)
  tray.setToolTip('Focal')
  updateTrayMenu()
  tray.on('double-click', () => toggleWindow())
}

function updateTrayMenu() {
  if (!tray) return
  const mode  = store.get('windowMode')
  const onTop = store.get('alwaysOnTop')

  const menu = Menu.buildFromTemplate([
    { label: 'Focal 열기', click: () => showWindow() },
    { type: 'separator' },
    {
      label: '화면 모드',
      submenu: [
        { label: '일반', type: 'radio', checked: mode === 'normal', click: () => setWindowMode('normal') },
        { label: '중형', type: 'radio', checked: mode === 'medium', click: () => setWindowMode('medium') },
        { label: '미니', type: 'radio', checked: mode === 'mini',   click: () => setWindowMode('mini')   },
      ],
    },
    { label: '항상 위에 표시', type: 'checkbox', checked: onTop, click: () => toggleAlwaysOnTop() },
    { type: 'separator' },
    { label: 'Focal 종료', click: () => app.quit() },
  ])
  tray.setContextMenu(menu)
}

// ─── 윈도우 모드 전환 ──────────────────────────────────────
function setWindowMode(mode: AppConfig['windowMode']) {
  store.set('windowMode', mode)
  const old = mainWindow
  mainWindow = null

  if (old && !old.isDestroyed()) {
    old.removeAllListeners()
    old.destroy()
  }

  createWindow()
  updateTrayMenu()
}

function toggleAlwaysOnTop() {
  const next = !store.get('alwaysOnTop')
  store.set('alwaysOnTop', next)
  if (next) {
    store.set('alwaysOnBottom', false)
    mainWindow?.setAlwaysOnTop(true)
  } else {
    mainWindow?.setAlwaysOnTop(false)
  }
  updateTrayMenu()
}

function toggleAlwaysOnBottom() {
  const next = !store.get('alwaysOnBottom')
  store.set('alwaysOnBottom', next)
  if (next) {
    store.set('alwaysOnTop', false)
    // 'below-normal' level로 다른 창보다 아래에 위치
    mainWindow?.setAlwaysOnTop(true, 'below-normal' as Parameters<typeof mainWindow.setAlwaysOnTop>[1])
  } else {
    mainWindow?.setAlwaysOnTop(false)
  }
  updateTrayMenu()
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    showWindow()
    return
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    showWindow()
  }
}

// ─── 아이콘 경로 ──────────────────────────────────────────
function getIconPath(): string {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const devPath  = path.join(__dirname, '..', 'resources', iconFile)
  const prodPath = path.join(process.resourcesPath, iconFile)
  return fs.existsSync(devPath) ? devPath : prodPath
}

// ─── 자동 시작 (Windows) ───────────────────────────────────
function setAutoLaunch(enable: boolean) {
  store.set('autoLaunch', enable)
  app.setLoginItemSettings({ openAtLogin: enable, path: app.getPath('exe') })
}

// ─── IPC 핸들러 ───────────────────────────────────────────
function registerIpcHandlers() {
  ipcMain.handle('set-window-mode', (_e, mode: AppConfig['windowMode']) => {
    setWindowMode(mode)
  })

  ipcMain.handle('toggle-always-on-top', () => {
    toggleAlwaysOnTop()
    return store.get('alwaysOnTop')
  })

  ipcMain.handle('toggle-always-on-bottom', () => {
    toggleAlwaysOnBottom()
    return store.get('alwaysOnBottom')
  })

  ipcMain.handle('get-app-config', () => ({
    windowMode:    store.get('windowMode'),
    alwaysOnTop:   store.get('alwaysOnTop'),
    alwaysOnBottom: store.get('alwaysOnBottom'),
    autoLaunch:    store.get('autoLaunch'),
  }))

  ipcMain.handle('set-auto-launch', (_e, enable: boolean) => {
    setAutoLaunch(enable)
  })

  ipcMain.handle('window-minimize', () => mainWindow?.minimize())
  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window-close', () => mainWindow?.hide())
  ipcMain.handle('app-quit', () => app.quit())

  ipcMain.handle('show-notification', (_e, title: string, body: string) => {
    const { Notification } = require('electron')
    new Notification({ title, body, icon: getIconPath() }).show()
  })

  ipcMain.handle('open-external', (_e, url: string) => {
    shell.openExternal(url)
  })
}

// ─── 앱 초기화 ────────────────────────────────────────────
app.whenReady().then(() => {
  // 기본 메뉴바 제거
  Menu.setApplicationMenu(null)

  // 개발 환경에서는 항상 normal 모드로 시작
  if (isDev) store.set('windowMode', 'normal')

  registerIpcHandlers()
  createWindow()
  createTray()

  globalShortcut.register('CommandOrControl+Shift+F', () => toggleWindow())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
