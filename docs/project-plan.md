# Focal — 프로젝트 계획서

> **문서 버전**: v2.2 | **최초 작성**: 2026-05-26 | **최종 수정**: 2026-05-29
> **상태**: 🟢 Phase 4 완료, Phase 5 진행 예정

관련 문서: [기능 명세](./spec.md) · [데이터 모델](./data-model.md) · [개발 체크리스트](./dev-phases.md)

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | Focal |
| 목적 | PC와 모바일에서 실시간 연동되는 개인 일정 관리 |
| 사용자 | 1인 (개인 전용) |
| 플랫폼 | React 웹 + Electron (PC) / React Native Expo (Android) |
| 총 비용 | 완전 무료 |

---

## 2. 기술 스택

| 구분 | 기술 | 비고 |
|------|------|------|
| 서버 하드웨어 | Mac mini M4 2024 (16GB) | 24시간 가동 중 |
| 백엔드/DB | PocketBase v0.38.2 | 실시간 DB + API + Admin UI |
| 외부 접속 | Tailscale VPN | 맥 미니·노트북 연결됨. 폰 앱 설치 필요 |
| PC 웹 | React + Vite + Tailwind CSS | 브라우저 접근용 |
| PC 데스크탑 | Electron | 바탕화면 위젯 |
| 모바일 | React Native (Expo) | Android 전용 |
| 모바일 위젯 | react-native-android-widget | 홈화면 위젯 소·중·대 |
| 상태 관리 | Zustand | 웹·앱 공통 |
| 알림 (모바일) | Expo Notifications | |
| 알림 (PC) | Electron Notification API | |
| 백업 | macOS launchd | 매일 새벽 3시 자동 |

---

## 3. 시스템 구성도

```
[사용자 기기]                         [집 — Mac mini M4]
┌──────────────────┐                 ┌─────────────────────────┐
│  PC 브라우저      │                 │                         │
│  Electron 위젯앱  │◄──Tailscale──►│   PocketBase            │
├──────────────────┤    (VPN 터널)   │   ├─ REST API           │
│  Android 폰      │◄──Tailscale──►│   ├─ Realtime (WS)      │
│  - 앱            │                 │   ├─ Admin UI (:8090/_/)│
│  - 홈화면 위젯   │                 │   └─ SQLite DB          │
└──────────────────┘                 └─────────────────────────┘
```

---

## 4. 서버 운영

### 접속 정보
| 항목 | 값 |
|------|-----|
| PocketBase (내부) | `http://127.0.0.1:8090` |
| PocketBase (Tailscale) | `http://<TAILSCALE_IP>:8090` |
| Admin UI | `http://<TAILSCALE_IP>:8090/_/` |
| 인증 | Superuser 토큰 (자동 로그인, 401/403 시 자동 재인증) |

### 백업
- 매일 새벽 3시 자동 실행 → `~/pocketbase-backups/YYYY-MM-DD/`
- 최근 30일치 보관

### 보안
- 외부 인터넷 노출 없음 (Tailscale VPN 전용)
- 모든 Collection API Rules: `Superusers only`

---

## 5. 개발 환경

| 항목 | 내용 |
|------|------|
| 노트북 OS | Windows 11 |
| 서버 OS | macOS (Mac mini M4, 사용자명: iyeongmin) |
| Git (노트북) | TortoiseGit |
| Git (맥 미니) | Sourcetree |
| Node.js | 20 LTS 이상 |
| PocketBase | v0.38.2 |

---

## 6. 진행 현황

| Phase | 내용 | 상태 |
|-------|------|------|
| 0 | 계획서 작성 및 설계 확정 | ✅ 완료 |
| 1 | PocketBase 설치 + 자동실행 + 백업 | ✅ 완료 |
| 2 | React 웹 뼈대 + 사이드바 + PocketBase 연동 | ✅ 완료 |
| 3 | Todo & 일정 CRUD + 폼 + 카테고리 | ✅ 완료 |
| 4 | 캘린더 뷰 (월간·주간·일간) | ✅ 완료 |
| 5 | 반복 일정 | ⬜ 대기 |
| 6 | 알림/리마인더 + 스누즈 | ⬜ 대기 |
| 7 | 오프라인 캐시 + 자동 동기화 | ⬜ 대기 |
| 8 | 우선순위 뷰 (매트릭스 + 점수 목록) | ⬜ 대기 |
| 9 | 검색 | ⬜ 대기 |
| 10 | 설정 + 카테고리 관리 + UI Polish | ⬜ 대기 |
| 11 | Electron 데스크탑 앱 | ⬜ 대기 |
| 12 | React Native 모바일 앱 | ⬜ 대기 |
| 13 | 모바일 홈화면 위젯 | ⬜ 대기 |
| 14 | 통합 테스트 + 마무리 | ⬜ 대기 |

세부 체크리스트 → [dev-phases.md](./dev-phases.md)

---

## 7. 미결 사항

- [x] 맥 미니 Tailscale IP 확인 (개인 메모 보관)
- [x] 핸드폰 기종 확인 → Android → `react-native-android-widget`
- [ ] Admin UI에서 settings 컬렉션에 `time_format` Select 필드 추가 (Phase 10 전)

---

## 8. 폴더 구조

```
Focal/
├── docs/
│   ├── project-plan.md     ← 이 파일 (개요 + 현황)
│   ├── spec.md             ← 기능 명세
│   ├── data-model.md       ← 데이터 모델
│   └── dev-phases.md       ← Phase별 체크리스트
├── server/scripts/
├── web/                    ← React + Vite (개발 중)
│   └── src/
│       ├── components/layout/    ✅
│       ├── components/modal/     ✅
│       ├── components/todo/      ✅
│       ├── components/calendar/  ✅
│       ├── lib/                  ✅ (pocketbase, api, dateUtils)
│       ├── stores/               ✅
│       ├── types/                ✅
│       └── pages/                ✅
├── desktop/                ← (Phase 11)
└── mobile/                 ← (Phase 12~13)
```

---

## 9. 변경 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| v1.0 | 2026-05-26 | 전체 기능 명세 완성, 앱 이름 확정 |
| v1.1~1.8 | 2026-05-27 | 세부 스펙 반복 수정 |
| v1.9 | 2026-05-27 | Phase 1 완료 |
| v2.0 | 2026-05-27 | 시간 표시 형식 설정 추가 (12h/24h) |
| v2.1 | 2026-05-27 | Phase 2·3 완료. 버그 수정. 계획서 4개 파일로 분리 |
| v2.2 | 2026-05-29 | Phase 4 완료. MonthView timeFormat 수정, 현재 시각 선 실시간 업데이트, 폼 defaultDate 연동 |
