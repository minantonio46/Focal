# Focal — 개발 체크리스트

> [← 프로젝트 계획서](./project-plan.md)

---

## Phase 0 — 계획서 작성 ✅

- [x] 기술 스택 확정
- [x] 일정 vs Todo 차이 및 공유 필드 정의
- [x] 데이터 모델 설계
- [x] 네비게이션 구조 확정
- [x] UX 세부 동작 전체 확정
- [x] 개발 단계 계획 수립
- [x] GitHub 저장소 생성

---

## Phase 1 — 서버 환경 구성 ✅

- [x] PocketBase v0.38.2 설치 및 실행
- [x] Superuser 계정 생성 (minantonio46@gmail.com)
- [x] launchd 자동실행 등록
- [x] 백업 스크립트 + launchd 스케줄 등록 (매일 03:00)
- [x] Tailscale IP 확인 (개인 메모 보관)
- [x] 노트북에서 Admin UI 접근 확인
- [x] Collection 4개 생성 (schedules / categories / notifications / settings)
- [x] API Rules 설정 (Superusers only)
- [x] 기본 카테고리 6개 입력 (학교/취업/건강/가족/취미/기타)
- [x] settings 기본값 레코드 생성

---

## Phase 2 — React 웹 뼈대 ✅

- [x] React + Vite + Tailwind CSS 프로젝트 생성
- [x] PocketBase JS SDK 설치 및 초기화 (initAuth, withAuth)
- [x] Zustand 스토어 구성
- [x] 환경 변수 설정 (.env, gitignore)
- [x] 사이드바 레이아웃 구현
- [x] React Router 라우팅 구성 (5개 페이지)
- [x] PocketBase 연결 상태 표시 (30초 주기 헬스체크)

---

## Phase 3 — Todo & 일정 CRUD ✅

- [x] Todo/일정 통합 폼 (is_todo 토글)
- [x] 시작/종료 날짜+시각, 종일 여부 (종일 시 날짜만 입력)
- [x] 중요도 슬라이더 (카테고리 선택 시 자동 채움)
- [x] 대카테고리 > 소카테고리 선택 UI
- [x] 카테고리 드롭다운에서 바로 생성 (이름/색상/중요도, 자동 order 계산)
- [x] 마감 정밀도 UI (없음/연/월/일/시분, Todo 전용)
- [x] 기한 초과 동작 (expire/keep, Todo + 마감 있을 때만 표시)
- [x] 장소, 메모 입력
- [x] 상세보기 모달 (보기/편집 모드 전환, 종일 배지 표시)
- [x] Todo 완료 체크 → 취소선 + 필터 반영
- [x] expire_type=expire 시 빨간색 강조 + 만료 뱃지
- [x] 목록 Todo/일정 탭 전환
- [x] 필터 탭 (미완료 기본 / 완료 / 전체, Todo 탭에서만)
- [x] 시간순 정렬: 기한 있음 → 기한 없음 섹션 구분
- [x] 점수순 정렬 (중요도 × 긴급도점수)
- [x] Todo/일정 자동 삭제 (settings 기반, 앱 시작 시 실행)
- [x] 시간 표시 유틸 (dateUtils.ts, settings.time_format 반영)
- [x] 토큰 만료 시 자동 재인증 (withAuth)

---

## Phase 4 — 캘린더 뷰 ✅

- [x] 월간 뷰 (일정 제목 작게 표시, "+N개")
- [x] 주간 뷰 (calendar_slot_mins 단위 블록, 카테고리 색상)
- [x] 일간 뷰 (시간 블록 + Todo 섹션)
- [x] 날짜 선택 시 상세 표시
- [x] 드래그 앤 드롭으로 일정 이동 (PC)

---

## Phase 5 — 반복 일정 ✅

### 핵심 아키텍처: Virtual Expansion
- [x] DB에는 부모 레코드 1개만 저장 (인스턴스 pre-generation 제거)
- [x] 캘린더 렌더링 시 `expandSchedulesForRange()`로 동적 계산
- [x] PB 스키마 추가: `exception_date` (Text), `excluded_dates` (JSON)

### 반복 설정 UI
- [x] 반복 주기 설정 UI (매일/매주/매월/매년)
- [x] 요일 지정 UI (매주 전용)
- [x] 종료 조건 설정 — 무기한/종료일/횟수 (생성 후 변경 가능)

### 수정 다이얼로그 (이 일정만 / 이후 전체 / 모두)
- [x] 이 일정만: 가상 인스턴스 → exception 레코드 생성
- [x] 이후 전체: 부모 truncate + 새 부모 생성
- [x] 모두: 부모 및 모든 exception 레코드 메타 업데이트

### 삭제 다이얼로그 (이 일정만 / 이후 전체 / 모두)
- [x] 이 일정만: 부모 `excluded_dates`에 날짜 추가
- [x] 이후 전체: `exception_date >= occDate` 예외 레코드 삭제 + `repeat_end_at` 업데이트
- [x] 모두: 부모 + 모든 exception 레코드 삭제

### 버그 수정 / 개선
- [x] 무한루프 방지: `VALID_REPEAT_TYPES` 유효성 체크, `MAX_OCCURRENCES(5000)` 상한
- [x] 31일/29일/30일 월반복: `Math.min(originalDay, lastDay)` — 윤년 포함 자동 처리
- [x] `repeat_type = ''` PB 기본값 처리 (빈 문자열 → 비반복으로 인식)
- [x] 목록에서 반복 일정: RepeatDialog 없이 전체 삭제/편집으로 단순화
- [x] 비반복 일정/Todo 삭제 확인: 브라우저 `confirm()` → `ConfirmDialog` (커스텀 팝업)
- [x] 이중 confirm 버그 수정 (DetailModal + handleDelete 중복 호출)

---

## Phase 6 — 알림 / 리마인더 ✅

- [x] 폼에 알림 타이밍 설정 UI (10분/30분/1시간/하루 전, 복수)
- [x] 종일 일정: 시간 기반 알림 비활성화
- [x] 기한 없는 Todo: 알림 UI 비활성화
- [x] Electron Notification API 연동 (window.electronAPI.showNotification / 웹 fallback)
- [x] 스누즈 기능 (settings.snooze_minutes 기반)

---

## Phase 7 — 오프라인 지원 ✅

- [x] PocketBase SDK 로컬 캐시 설정
  - `lib/offlineCache.ts`: IndexedDB 기반 schedules/categories/settings 캐시
  - 온라인 fetch 시 캐시 자동 갱신, 앱 시작 시 캐시 먼저 로드
  - CRUD 함수 전체에 캐시 read/write 연동 (api.ts)
- [x] 오프라인 상태 감지 및 UI 표시
  - `lib/offlineManager.ts`: navigator.onLine + window 'online'/'offline' 이벤트
  - `components/layout/OfflineBanner.tsx`: 노란 배너 + 미동기화 건수 표시
- [x] 온라인 복귀 시 자동 동기화
  - `lib/syncQueue.ts`: IndexedDB 큐에 오프라인 변경 적재
  - 복귀 시 flushQueue() → 서버 반영 → 최신 데이터 fetch → 캐시 갱신 → store 반영
- [x] 충돌 감지 및 해결 UI
  - 필드 단위 수정(changedFields) + baseUpdated 타임스탬프 기반 충돌 감지
  - `lib/conflictStore.ts`: 충돌 정보 IndexedDB 보관
  - `components/modal/ConflictModal.tsx`: 충돌 필드 비교 + 내 버전 / 서버 버전 선택 UI

---

## Phase 8 — 우선순위 뷰 ✅

- [x] 긴급도 점수 계산 (일정=start_at, Todo=마감기한)
- [x] 아이젠하워 매트릭스 2D 차트
- [x] 우선순위 점수 목록 (내림차순)
- [x] 매트릭스 / 점수 목록 탭 전환

---

## Phase 9 — 검색 ⬜

- [ ] 사이드바 돋보기 → 검색창 UI
- [ ] 제목 + 메모 전문 검색
- [ ] 결과 목록 표시 및 클릭 시 모달 이동

---

## Phase 10 — 설정 + 카테고리 관리 + UI Polish ⬜

- [ ] Admin UI에서 settings에 `time_format` Select 필드 추가
- [ ] 설정 화면 (테마 / 시간표시형식 / 알림 / 스누즈 / 삭제기간 / 시간블록단위)
- [ ] 카테고리 사이드바 화면 (대>소 트리, 이름/색상/중요도 편집, 삭제)
- [ ] 다크 모드 (시스템 연동 + 수동)
- [ ] 빈 상태(Empty State) 화면
- [ ] 로딩 스켈레톤
- [ ] 전체 UI 일관성 점검
- [ ] label/input 접근성 (htmlFor/id 연결)

---

## Phase 11 — Electron 데스크탑 앱 ⬜

- [ ] Electron 프로젝트 설정 및 React 앱 래핑
- [ ] frameless 창 + 커스텀 타이틀바
- [ ] 위젯 형태 3종 전환
- [ ] 항상 위에 표시 토글 (기본: false)
- [ ] 시스템 트레이 아이콘 + 우클릭 메뉴
- [ ] 전역 단축키 (Ctrl+Shift+F)
- [ ] 맥 로그인 시 자동 실행

---

## Phase 12 — React Native 모바일 앱 ⬜

- [ ] Expo 프로젝트 생성 (하단 탭바 4개)
- [ ] NativeWind + Zustand + PocketBase SDK
- [ ] Tailscale 앱 설치 (핸드폰)
- [ ] 캘린더 / 목록 / 우선순위 / 설정 화면
- [ ] 스와이프 액션 (완료 / 삭제)
- [ ] Expo Notifications 연동

---

## Phase 13 — 모바일 홈화면 위젯 ⬜

- [ ] react-native-android-widget 설치
- [ ] 소형: 다음 일정 + 미완료 Todo 수
- [ ] 중형: 오늘 일정 목록 (최대 5개)
- [ ] 대형: 이번 주 미리보기

---

## Phase 14 — 통합 테스트 및 마무리 ⬜

- [ ] PC 웹 ↔ 모바일 실시간 동기화 확인
- [ ] 오프라인 → 온라인 전환 시나리오
- [ ] 반복 일정 엣지 케이스
- [ ] 알림 / 스누즈 정상 동작
- [ ] 자동 삭제 동작 확인
- [ ] 카테고리 기본 중요도 자동 적용 확인
- [ ] 매트릭스 / 점수 정확성 확인
- [ ] README 최종 정리


---
