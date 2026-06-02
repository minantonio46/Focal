import { useState, useEffect } from 'react'
import useAppStore from '../stores/useAppStore'
import { upsertSettings } from '../lib/api'
import type { Settings } from '../types'
import CategoryTab from './settings/CategoryTab'

type SettingsTab = 'general' | 'urgency' | 'category'

const URGENCY_DEFAULT: NonNullable<Settings['urgency_thresholds']> = {
  s9: 60,
  s8: 1440,
  s7: 10080,
  s6: null,
  s5: 43200,
  s4: null,
  s3: 259200,
  s2: 525600,
}

const FALLBACK_MINS: Record<string, number> = {
  s9: 60, s8: 1440, s7: 10080, s6: 21600,
  s5: 43200, s4: 129600, s3: 259200, s2: 525600,
}

function minsToDisplay(m: number): { value: number; unit: '시간' | '일' | '주' | '달' | '년' } {
  if (m % (60 * 24 * 365) === 0) return { value: m / (60 * 24 * 365), unit: '년' }
  if (m % (60 * 24 * 30) === 0)  return { value: m / (60 * 24 * 30),  unit: '달' }
  if (m % (60 * 24 * 7) === 0)   return { value: m / (60 * 24 * 7),   unit: '주' }
  if (m % (60 * 24) === 0)       return { value: m / (60 * 24),        unit: '일' }
  return { value: m / 60, unit: '시간' }
}

function unitToMins(value: number, unit: string): number {
  if (unit === '년') return value * 60 * 24 * 365
  if (unit === '달') return value * 60 * 24 * 30
  if (unit === '주') return value * 60 * 24 * 7
  if (unit === '일') return value * 60 * 24
  return value * 60
}

// ─── 헬퍼 컴포넌트 ───────────────────────────────────────────

function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-800">
      <label htmlFor={htmlFor} className="text-sm text-gray-300">{label}</label>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{title}</h3>
      <div className="bg-gray-900 rounded-xl px-5 divide-y divide-gray-800">
        {children}
      </div>
    </div>
  )
}

function WithSaved({ saved, children }: { saved: boolean; children: React.ReactNode }) {
  return (
    <div className="relative flex items-center">
      <span className={`absolute right-full mr-2 text-xs text-green-400 whitespace-nowrap transition-opacity duration-300 ${saved ? 'opacity-100' : 'opacity-0'}`}>
        저장됨
      </span>
      {children}
    </div>
  )
}

// ─── 일반 탭 ─────────────────────────────────────────────────

function GeneralTab({ cur, savedKey, handleChange }: {
  cur: Settings
  savedKey: string | null
  handleChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void
}) {
  return (
    <>
      <Section title="표시">
        <Row label="테마" htmlFor="setting-theme">
          <WithSaved saved={savedKey === 'theme'}>
            <select id="setting-theme" value={cur.theme ?? 'system'}
              onChange={e => handleChange('theme', e.target.value as Settings['theme'])}
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500">
              <option value="system">시스템 기본</option>
              <option value="light">라이트</option>
              <option value="dark">다크</option>
            </select>
          </WithSaved>
        </Row>
        <Row label="시간 표시 형식" htmlFor="setting-time-format">
          <WithSaved saved={savedKey === 'time_format'}>
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              {(['24h', '12h'] as const).map(fmt => (
                <button key={fmt} onClick={() => handleChange('time_format', fmt)}
                  className={`px-4 py-1.5 text-sm transition-colors ${cur.time_format === fmt ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {fmt === '24h' ? '24시간' : '12시간'}
                </button>
              ))}
            </div>
          </WithSaved>
        </Row>
        <Row label="캘린더 시간 블록 단위" htmlFor="setting-slot">
          <WithSaved saved={savedKey === 'calendar_slot_mins'}>
            <select id="setting-slot" value={cur.calendar_slot_mins ?? 30}
              onChange={e => handleChange('calendar_slot_mins', Number(e.target.value))}
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500">
              {[15, 30, 60].map(m => <option key={m} value={m}>{m}분</option>)}
            </select>
          </WithSaved>
        </Row>
      </Section>

      <Section title="알림">
        <Row label="기본 알림 타이밍">
          <WithSaved saved={savedKey === 'default_reminder'}>
            <div className="flex flex-wrap gap-1.5 justify-end max-w-xs">
              {[{ label: '10분 전', value: 10 }, { label: '30분 전', value: 30 },
                { label: '1시간 전', value: 60 }, { label: '하루 전', value: 1440 }].map(({ label, value }) => {
                const selected = (cur.default_reminder ?? []).includes(value)
                return (
                  <button key={value}
                    onClick={() => {
                      const prev = cur.default_reminder ?? []
                      handleChange('default_reminder', selected ? prev.filter(v => v !== value) : [...prev, value])
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${selected ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    {label}
                  </button>
                )
              })}
            </div>
          </WithSaved>
        </Row>
        <Row label="하루 전 알림 시각" htmlFor="setting-allday-time">
          <WithSaved saved={savedKey === 'all_day_reminder_time'}>
            <input id="setting-allday-time" type="time" value={cur.all_day_reminder_time ?? '09:00'}
              onChange={e => handleChange('all_day_reminder_time', e.target.value)}
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500" />
          </WithSaved>
        </Row>
        <Row label="시간 있는 일정 하루 전 알림">
          <WithSaved saved={savedKey === 'timed_reminder_mode'}>
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              {([['exact', '24시간 전'], ['fixed_time', '설정 시각']] as const).map(([val, label]) => (
                <button key={val} onClick={() => handleChange('timed_reminder_mode', val)}
                  className={`px-3 py-1.5 text-sm transition-colors ${(cur.timed_reminder_mode ?? 'exact') === val ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>
          </WithSaved>
        </Row>
        <Row label="스누즈 시간" htmlFor="setting-snooze">
          <WithSaved saved={savedKey === 'snooze_minutes'}>
            <select id="setting-snooze" value={cur.snooze_minutes ?? 10}
              onChange={e => handleChange('snooze_minutes', Number(e.target.value))}
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500">
              {[5, 10, 15, 30].map(m => <option key={m} value={m}>{m}분</option>)}
            </select>
          </WithSaved>
        </Row>
      </Section>

      <Section title="자동 삭제">
        <Row label="완료된 Todo 자동 삭제" htmlFor="setting-todo-delete">
          <WithSaved saved={savedKey === 'todo_delete_days'}>
            <select id="setting-todo-delete" value={cur.todo_delete_days ?? 30}
              onChange={e => handleChange('todo_delete_days', Number(e.target.value))}
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500">
              <option value={0}>삭제 안 함</option>
              <option value={7}>7일 후</option>
              <option value={14}>14일 후</option>
              <option value={30}>30일 후</option>
              <option value={90}>90일 후</option>
            </select>
          </WithSaved>
        </Row>
        <Row label="지난 일정 자동 삭제" htmlFor="setting-schedule-delete">
          <WithSaved saved={savedKey === 'schedule_delete_days'}>
            <select id="setting-schedule-delete" value={cur.schedule_delete_days ?? 90}
              onChange={e => handleChange('schedule_delete_days', Number(e.target.value))}
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500">
              <option value={0}>삭제 안 함</option>
              <option value={30}>30일 후</option>
              <option value={60}>60일 후</option>
              <option value={90}>90일 후</option>
              <option value={180}>180일 후</option>
              <option value={365}>1년 후</option>
            </select>
          </WithSaved>
        </Row>
      </Section>
    </>
  )
}

// ─── 긴급도 탭 ───────────────────────────────────────────────

function UrgencyTab({ cur, savedKey, sortedWarning, handleChange }: {
  cur: Settings
  savedKey: string | null
  sortedWarning: boolean
  handleChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void
}) {
  const thresholds = cur.urgency_thresholds ?? URGENCY_DEFAULT

  return (
    <Section title="긴급도 구간 (이 시간 이내면 해당 점수)">
      {sortedWarning && (
        <div className="py-2 px-3 my-1 bg-amber-900/40 border border-amber-700/50 rounded-lg text-xs text-amber-300">
          ⚠️ 시간 역전이 감지되어 자동으로 정렬되었습니다.
        </div>
      )}
      <div className="flex items-center justify-between py-4 border-b border-gray-800">
        <span className="text-sm text-gray-300">점수 10 기준</span>
        <span className="text-sm text-gray-600">마감 초과 — 고정</span>
      </div>
      {([
        { key: 's9', score: 9 }, { key: 's8', score: 8 },
        { key: 's7', score: 7 }, { key: 's6', score: 6 },
        { key: 's5', score: 5 }, { key: 's4', score: 4 },
        { key: 's3', score: 3 }, { key: 's2', score: 2 },
      ] as const).map(({ key, score }) => {
        const mins = thresholds[key]
        const enabled = mins != null
        const displayMins = mins ?? FALLBACK_MINS[key]
        const { value: dispVal, unit: dispUnit } = minsToDisplay(displayMins)
        return (
          <Row key={key} label={`점수 ${score} 기준`}>
            <WithSaved saved={savedKey === 'urgency_thresholds'}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleChange('urgency_thresholds', { ...thresholds, [key]: enabled ? null : unitToMins(dispVal, dispUnit) })}
                  className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  <span className={`block w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <div className={`flex items-center gap-1 transition-opacity ${enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                  <input type="number" min={1} max={999} value={dispVal}
                    onChange={e => {
                      const v = Math.max(1, parseInt(e.target.value) || 1)
                      handleChange('urgency_thresholds', { ...thresholds, [key]: unitToMins(v, dispUnit) })
                    }}
                    className="w-16 bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500 text-center" />
                  <select value={dispUnit}
                    onChange={e => handleChange('urgency_thresholds', { ...thresholds, [key]: unitToMins(dispVal, e.target.value) })}
                    className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500">
                    <option value="시간">시간</option>
                    <option value="일">일</option>
                    <option value="주">주</option>
                    <option value="달">달</option>
                    <option value="년">년</option>
                  </select>
                </div>
              </div>
            </WithSaved>
          </Row>
        )
      })}
      <div className="flex items-center justify-between py-4 border-t border-gray-800">
        <span className="text-sm text-gray-300">점수 1 기준</span>
        <span className="text-sm text-gray-600">기한 없음 — 고정</span>
      </div>
      <div className="py-3 flex justify-end">
        <button
          onClick={() => handleChange('urgency_thresholds', undefined as unknown as Settings['urgency_thresholds'])}
          className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
          기본값으로 초기화
        </button>
      </div>
    </Section>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, setSettings } = useAppStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [saving, setSaving] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [local, setLocal] = useState<Partial<Settings>>({})
  const [initialized, setInitialized] = useState(false)
  const [sortedWarning, setSortedWarning] = useState(false)

  useEffect(() => {
    if (settings && !initialized) {
      setLocal(settings)
      setInitialized(true)
    }
  }, [settings, initialized])

  const cur: Settings = { ...settings, ...local } as Settings

  async function save(patch: Partial<Settings>, key: string) {
    if (!settings?.id || saving) return
    setSaving(true)
    try {
      const updated = await upsertSettings(settings.id, patch)
      setSettings(updated)
      setSavedKey(key)
      setTimeout(() => setSavedKey(null), 1500)
    } catch (err) {
      console.error('설정 저장 실패:', err)
    } finally {
      setSaving(false)
    }
  }

  function handleChange<K extends keyof Settings>(key: K, value: Settings[K]) {
    let finalValue = value

    if (key === 'urgency_thresholds' && value != null) {
      const th = value as NonNullable<Settings['urgency_thresholds']>
      const KEYS = ['s9', 's8', 's7', 's6', 's5', 's4', 's3', 's2'] as const
      const active = KEYS
        .map(k => ({ key: k, mins: th[k] }))
        .filter(x => x.mins != null) as { key: typeof KEYS[number]; mins: number }[]
      const isReversed = active.some((curr, i) => i > 0 && curr.mins <= active[i - 1].mins)
      if (isReversed) {
        const sortedMins = [...active].sort((a, b) => a.mins - b.mins).map(x => x.mins)
        const reordered = { ...th }
        let sortIdx = 0
        KEYS.forEach(k => { if (th[k] != null) reordered[k] = sortedMins[sortIdx++] })
        finalValue = reordered as Settings[K]
        setSortedWarning(true)
        setTimeout(() => setSortedWarning(false), 3000)
      }
    }

    setLocal(prev => ({ ...prev, [key]: finalValue }))
    save({ [key]: finalValue } as Partial<Settings>, key)
  }

  if (!settings) {
    return <div className="p-6 text-gray-400 text-sm">설정을 불러오는 중…</div>
  }

  const TABS: { key: SettingsTab; label: string }[] = [
    { key: 'general',  label: '일반' },
    { key: 'urgency',  label: '긴급도' },
    { key: 'category', label: '카테고리' },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex-shrink-0 px-6 pt-6 pb-0">
        <h2 className="text-2xl font-bold mb-4 text-white">설정</h2>
        <div className="flex gap-1 border-b border-gray-800">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-y-auto px-6 pt-6">
        {activeTab === 'general'  && <GeneralTab  cur={cur} savedKey={savedKey} handleChange={handleChange} />}
        {activeTab === 'urgency'  && <UrgencyTab  cur={cur} savedKey={savedKey} sortedWarning={sortedWarning} handleChange={handleChange} />}
        {activeTab === 'category' && <CategoryTab />}
      </div>
    </div>
  )
}
