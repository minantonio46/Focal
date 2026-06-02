/**
 * Electron 전용 커스텀 타이틀바
 * - 웹 브라우저 환경에서는 렌더링 안 됨
 */
import { useState, useEffect } from 'react'
import { isElectron } from '../../lib/electron'
import type { ElectronAppConfig } from '../../lib/electron'

export default function ElectronTitleBar() {
  const [config, setConfig] = useState<ElectronAppConfig | null>(null)

  useEffect(() => {
    if (!isElectron()) return
    window.electronAPI!.getAppConfig().then(setConfig)
  }, [])

  if (!isElectron() || !config) return null

  async function handleModeChange(mode: 'normal' | 'medium' | 'mini') {
    await window.electronAPI!.setWindowMode(mode)
  }

  async function handleAlwaysOnTop() {
    const next = await window.electronAPI!.toggleAlwaysOnTop()
    setConfig(prev => prev ? { ...prev, alwaysOnTop: next } : prev)
  }

  async function handleAutoLaunch() {
    const next = !config!.autoLaunch
    await window.electronAPI!.setAutoLaunch(next)
    setConfig(prev => prev ? { ...prev, autoLaunch: next } : prev)
  }

  return (
    <div className="flex items-center justify-end px-3 py-1 bg-gray-950 border-b border-gray-800 flex-shrink-0 gap-1.5">
      {/* 창 모드 전환 */}
      <div className="flex gap-0.5 bg-gray-800 rounded p-0.5 mr-1">
        {([
          ['normal', '일반'],
          ['medium', '중형'],
          ['mini',   '미니'],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
              config.windowMode === mode
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 항상 위에 */}
      <button
        onClick={handleAlwaysOnTop}
        className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
          config.alwaysOnTop
            ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
            : 'text-gray-600 hover:text-gray-300 border border-transparent'
        }`}
      >
        항상 위에
      </button>

      {/* 자동 시작 */}
      <button
        onClick={handleAutoLaunch}
        className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
          config.autoLaunch
            ? 'bg-green-900/50 text-green-300 border border-green-700'
            : 'text-gray-600 hover:text-gray-300 border border-transparent'
        }`}
      >
        자동 시작
      </button>

      {/* 완전 종료 */}
      <button
        onClick={() => window.electronAPI!.appQuit()}
        className="px-2.5 py-0.5 rounded text-xs text-gray-600 hover:text-red-400 border border-transparent hover:border-red-900 transition-colors flex items-center gap-1"
      >
        <span>⏻</span>
        <span>완전 종료</span>
      </button>
    </div>
  )
}
