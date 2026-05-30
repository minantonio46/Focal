/**
 * notificationService.ts
 *
 * 알림 폴링 & 발송 서비스
 *
 * 동작 방식:
 *  - startNotificationPoller() 로 앱 마운트 시 시작 (30초 주기)
 *  - PB notifications 컬렉션에서 pending/snoozed 항목 조회
 *  - fire_at(또는 snoozed_until) ≤ now 인 항목을 발송 처리
 *  - Electron 환경: window.electronAPI.showNotification() 호출
 *  - 웹 환경: Web Notifications API 사용 (권한 요청 포함)
 *
 * 스누즈:
 *  - 웹: 알림 클릭 → snoozeNotification() 호출 (status='snoozed', snoozed_until 설정)
 *  - 스누즈 시각이 되면 다시 발송
 */

import { fetchPendingNotifications, updateNotification } from './api'
import type { Notification } from '../types'

// ─── Electron IPC 타입 (Phase 11 전까지 optional) ────────────────
interface ElectronAPI {
  showNotification: (title: string, body: string) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

// ─── 웹 알림 권한 요청 ────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

// ─── 알림 발송 ────────────────────────────────────────────────────
function fireNotification(
  title: string,
  body: string,
  onClickSnooze?: () => void,
): void {
  // Electron 환경 우선
  if (window.electronAPI?.showNotification) {
    window.electronAPI.showNotification(title, body)
    return
  }
  // 웹 Notifications API fallback
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const notif = new Notification(title, { body, icon: '/favicon.ico' })
    if (onClickSnooze) {
      notif.onclick = () => { notif.close(); onClickSnooze() }
    }
  }
}

// ─── 스누즈 처리 ─────────────────────────────────────────────────
export async function snoozeNotification(
  notification: Notification,
  snoozeMinutes: number,
): Promise<void> {
  const snoozeUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000)
  await updateNotification(notification.id, {
    status:        'snoozed',
    snoozed_until: snoozeUntil.toISOString(),
  })
}

// ─── 알림 무시 처리 ──────────────────────────────────────────────
export async function dismissNotification(notification: Notification): Promise<void> {
  await updateNotification(notification.id, { status: 'dismissed' })
}

// ─── 폴링: pending/snoozed 알림 체크 & 발송 ──────────────────────
async function pollAndFire(
  getScheduleTitle: (scheduleId: string) => string | undefined,
  snoozeMinutes: number,
): Promise<void> {
  let pending: Notification[]
  try {
    pending = await fetchPendingNotifications()
  } catch {
    return
  }

  const now = new Date()

  for (const notif of pending) {
    const fireTime = notif.status === 'snoozed' && notif.snoozed_until
      ? new Date(notif.snoozed_until)
      : new Date(notif.fire_at)

    if (fireTime > now) continue

    const title = getScheduleTitle(notif.schedule_id) ?? '일정 알림'
    const body  = notif.status === 'snoozed'
      ? `${title} — 스누즈 알림`
      : `${title} 시작됩니다`

    // 웹 알림 클릭 시 스누즈 처리, 클릭 안 하면 sent
    let snoozed = false
    fireNotification(title, body, () => {
      snoozed = true
      void snoozeNotification(notif, snoozeMinutes)
    })

    // 스누즈 콜백이 실행될 수 있는 시간(500ms) 대기 후 sent 업데이트
    await new Promise(r => setTimeout(r, 500))
    if (!snoozed) {
      try { await updateNotification(notif.id, { status: 'sent' }) } catch { /* ignore */ }
    }
  }
}

// ─── 폴러 시작/중지 ──────────────────────────────────────────────
let _pollInterval: ReturnType<typeof setInterval> | null = null

export function startNotificationPoller(
  getScheduleTitle: (scheduleId: string) => string | undefined,
  snoozeMinutes: number,
): void {
  stopNotificationPoller()
  void pollAndFire(getScheduleTitle, snoozeMinutes)
  _pollInterval = setInterval(
    () => void pollAndFire(getScheduleTitle, snoozeMinutes),
    30_000,
  )
}

export function stopNotificationPoller(): void {
  if (_pollInterval !== null) {
    clearInterval(_pollInterval)
    _pollInterval = null
  }
}
