# Phase 1 — 맥 미니 서버 환경 구성 가이드

## 사전 준비
- Mac mini M4 앞에서 직접 작업하거나 SSH로 접속한 상태
- Tailscale이 맥 미니에 이미 설치되어 있음

---

## STEP 1: PocketBase 설치

맥 미니 터미널을 열고 아래 명령어를 순서대로 실행하세요.

```bash
# 1-1. 작업 폴더 생성
mkdir -p ~/pocketbase/logs
mkdir -p ~/pocketbase-backups
cd ~/pocketbase

# 1-2. PocketBase 최신 버전 다운로드 (Apple Silicon M4용)
curl -L https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_*_darwin_arm64.zip -o pocketbase.zip

# 위 명령이 안 되면 아래 방법 사용:
# 브라우저에서 https://github.com/pocketbase/pocketbase/releases/latest 접속
# darwin_arm64.zip 파일 직접 다운로드 후 ~/pocketbase/ 에 압축 해제

# 1-3. 압축 해제
unzip pocketbase.zip
rm pocketbase.zip

# 1-4. 실행 권한 부여
chmod +x ~/pocketbase/pocketbase

# 1-5. 버전 확인
~/pocketbase/pocketbase --version
```

---

## STEP 2: PocketBase 첫 실행 및 Superuser 계정 생성

```bash
# 2-1. PocketBase 실행 (첫 실행)
~/pocketbase/pocketbase serve --http=0.0.0.0:8090
```

터미널에 아래와 같은 메시지가 뜨면 정상:
```
Server started at http://127.0.0.1:8090
 ↪ REST API: http://127.0.0.1:8090/api/
 ↪ Admin UI: http://127.0.0.1:8090/_/
```

```bash
# 2-2. 실행 중인 상태에서 새 터미널 탭 열고 Superuser 계정 생성
~/pocketbase/pocketbase superuser create your@email.com yourpassword
```

> ⚠️ 이메일과 비밀번호는 기억해두세요. 앱 로그인에 사용됩니다.

```bash
# 2-3. 첫 실행 터미널로 돌아와서 Ctrl+C 로 중단 (launchd로 다시 시작할 예정)
```

---

## STEP 3: YOUR_USERNAME 확인

```bash
# 맥 미니의 사용자 이름 확인
whoami
# 예: minantonio (이 값으로 아래 STEP 4, 5에서 YOUR_USERNAME 교체)
```

---

## STEP 4: backup.sh 설치

```bash
# 4-1. 이 저장소의 server/scripts/backup.sh 를 맥 미니에 복사
# (GitHub에서 클론하거나 직접 복사)
cp /path/to/Focal/server/scripts/backup.sh ~/pocketbase/backup.sh

# 4-2. 실행 권한 부여
chmod +x ~/pocketbase/backup.sh

# 4-3. 수동 실행 테스트
~/pocketbase/backup.sh
# 출력 예: [2026-05-27 03:00:00] 백업 완료: /Users/minantonio/pocketbase-backups/2026-05-27

# 4-4. 백업 폴더 확인
ls ~/pocketbase-backups/
```

---

## STEP 5: launchd 자동실행 등록

### 5-1. plist 파일 복사 및 YOUR_USERNAME 교체

```bash
# plist 파일을 LaunchAgents 폴더로 복사
cp /path/to/Focal/server/scripts/com.focal.pocketbase.plist \
   ~/Library/LaunchAgents/com.focal.pocketbase.plist

cp /path/to/Focal/server/scripts/com.focal.backup.plist \
   ~/Library/LaunchAgents/com.focal.backup.plist

# YOUR_USERNAME을 실제 사용자 이름으로 교체 (STEP 3에서 확인한 값)
# 예: minantonio
sed -i '' 's/YOUR_USERNAME/minantonio/g' ~/Library/LaunchAgents/com.focal.pocketbase.plist
sed -i '' 's/YOUR_USERNAME/minantonio/g' ~/Library/LaunchAgents/com.focal.backup.plist
```

### 5-2. launchd에 등록 및 시작

```bash
# PocketBase 자동실행 등록
launchctl load ~/Library/LaunchAgents/com.focal.pocketbase.plist

# 백업 스케줄 등록
launchctl load ~/Library/LaunchAgents/com.focal.backup.plist

# 등록 확인
launchctl list | grep focal
# 출력 예:
# -  0  com.focal.pocketbase
# -  0  com.focal.backup
```

### 5-3. PocketBase 동작 확인

```bash
# 로그 확인
tail -f ~/pocketbase/logs/pocketbase.log

# 프로세스 확인
ps aux | grep pocketbase

# 로컬 접속 테스트
curl http://127.0.0.1:8090/api/health
# 출력: {"code":200,"message":"API is healthy.","data":{}}
```

---

## STEP 6: Tailscale IP 확인

```bash
# 맥 미니의 Tailscale IP 확인
tailscale ip -4
# 예: 100.64.x.x
```

> 📝 이 IP를 **project-plan.md 9.3 섹션**의 `<맥미니-Tailscale-IP>` 에 기록하세요.

---

## STEP 7: 노트북에서 접속 확인

노트북 브라우저에서:
```
http://<맥미니-Tailscale-IP>:8090/_/
```
→ PocketBase Admin UI가 뜨면 성공!

Superuser 이메일/비밀번호로 로그인하세요.

---

## STEP 8: Collection 생성

Admin UI (`http://<Tailscale-IP>:8090/_/`) 에 로그인한 후,
**Collections** 탭에서 아래 4개 컬렉션을 생성합니다.

### 8-1. categories (Base Collection)

| 필드명 | 타입 | 옵션 |
|--------|------|------|
| parent_id | Relation → categories | nullable, cascade delete: false |
| name | Text | required, max 100 |
| color | Text | required (HEX, 예: #3B82F6) |
| default_importance | Number | required, min 1, max 10, default 5 |
| order | Number | default 0 |

**API Rules** (모두 동일하게):
```
@request.auth.id != ""
```

### 8-2. schedules (Base Collection)

| 필드명 | 타입 | 옵션 |
|--------|------|------|
| title | Text | required, max 100 |
| description | Text | nullable |
| location | Text | nullable, max 100 |
| start_at | Date | nullable |
| end_at | Date | nullable |
| is_all_day | Bool | default false |
| is_todo | Bool | default false |
| is_completed | Bool | default false |
| completed_at | Date | nullable |
| importance | Number | required, min 1, max 10, default 5 |
| category_id | Relation → categories | nullable |
| sub_category_id | Relation → categories | nullable |
| deadline_precision | Select | values: none,year,month,day,datetime / default none |
| expire_type | Select | values: expire,keep / default keep |
| repeat_type | Select | values: none,daily,weekly,monthly,yearly / default none |
| repeat_days | JSON | nullable |
| repeat_end_at | Date | nullable |
| repeat_count | Number | nullable |
| parent_id | Relation → schedules | nullable |
| reminder_mins | JSON | nullable |

**API Rules**: 모두 `@request.auth.id != ""`

### 8-3. notifications (Base Collection)

| 필드명 | 타입 | 옵션 |
|--------|------|------|
| schedule_id | Relation → schedules | required, cascade delete: true |
| fire_at | Date | required |
| status | Select | values: pending,sent,snoozed,dismissed / default pending |
| snoozed_until | Date | nullable |

**API Rules**: 모두 `@request.auth.id != ""`

### 8-4. settings (Base Collection)

| 필드명 | 타입 | 옵션 |
|--------|------|------|
| theme | Select | values: light,dark,system / default system |
| default_reminder | JSON | default [10] |
| snooze_minutes | Number | default 10 |
| todo_delete_days | Number | default 30 |
| schedule_delete_days | Number | default 180 |
| calendar_slot_mins | Number | default 60 |

**API Rules**: 모두 `@request.auth.id != ""`

---

## STEP 9: 기본 카테고리 데이터 입력

Admin UI → **schedules** 가 아닌 **categories** Collection → **+ New record** 로 5개 입력:

| name | color | default_importance | order |
|------|-------|--------------------|-------|
| 업무 | #3B82F6 | 7 | 1 |
| 개인 | #8B5CF6 | 5 | 2 |
| 건강 | #10B981 | 6 | 3 |
| 가족 | #F97316 | 6 | 4 |
| 기타 | #6B7280 | 5 | 5 |

(parent_id는 모두 비워두면 대카테고리가 됩니다)

---

## STEP 10: settings 기본값 레코드 생성

Admin UI → **settings** Collection → **+ New record**:

| 필드 | 값 |
|------|-----|
| theme | system |
| default_reminder | [10] |
| snooze_minutes | 10 |
| todo_delete_days | 30 |
| schedule_delete_days | 180 |
| calendar_slot_mins | 60 |

---

## ✅ Phase 1 완료 체크리스트

- [ ] PocketBase 설치 및 실행 확인
- [ ] Superuser 계정 생성
- [ ] launchd 자동실행 등록 (맥 재부팅 후에도 자동 시작)
- [ ] backup.sh 동작 확인
- [ ] 백업 launchd 스케줄 등록 (매일 03:00)
- [ ] Tailscale IP 확인 및 project-plan.md 업데이트
- [ ] 노트북에서 Admin UI 접속 확인
- [ ] 4개 Collection 생성 완료
- [ ] API Rules 설정 완료
- [ ] 기본 카테고리 5개 입력
- [ ] settings 기본값 레코드 생성

모두 완료되면 **Phase 2 (React 웹 뼈대)** 시작!
