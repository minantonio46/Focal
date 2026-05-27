# Focal — 데이터 모델

> [← 프로젝트 계획서](./project-plan.md)

PocketBase Collections. 모든 API Rules: `Superusers only`

---

## schedules

```
id                 : string   (자동 생성)
title              : string   필수, 최대 100자
description        : text     선택
location           : string   선택, 최대 100자
start_at           : datetime 일정 필수 / Todo 선택 (마감 기한)
end_at             : datetime 일정 전용, 미입력 시 당일 23:59
is_all_day         : bool     기본 false
is_todo            : bool     기본 false
is_completed       : bool     기본 false (Todo 전용)
completed_at       : datetime 완료 시각 자동 기록 (Todo 전용)
importance         : float    1.0~10.0
category_id        : relation → categories
sub_category_id    : relation → categories (nullable)
deadline_precision : select   none | year | month | day | datetime (Todo 전용)
expire_type        : select   expire | keep  기본 keep (Todo 전용)
repeat_type        : select   none | daily | weekly | monthly | yearly
repeat_days        : json     요일 배열 예: [1,3,5] = 월·수·금
repeat_end_at      : datetime 반복 종료일 (nullable)
repeat_count       : number   반복 횟수 (nullable)
parent_id          : relation → schedules  반복 원본 참조
reminder_mins      : json     알림 시각 배열 예: [10, 30, 60]
created            : datetime 자동
updated            : datetime 자동
```

---

## categories

```
id                 : string  자동 생성
parent_id          : relation → categories  비어있으면 대카테고리
name               : string  필수
color              : string  HEX 색상코드
default_importance : float   1.0~10.0, 기본 5.0
order              : number  정렬 순서 (같은 레벨 내 최대값+1로 자동 계산)
```

---

## notifications

```
id            : string   자동 생성
schedule_id   : relation → schedules
fire_at       : datetime 알림 발송 예정 시각
status        : select   pending | sent | snoozed | dismissed
snoozed_until : datetime 스누즈 재발송 시각 (nullable)
created       : datetime 자동
```

---

## settings

```
id                    : string
theme                 : select  light | dark | system  기본 system
time_format           : select  12h | 24h              기본 24h
default_reminder      : json    기본 알림 배열 예: [10]
snooze_minutes        : number  기본 10
todo_delete_days      : number  기본 30
schedule_delete_days  : number  기본 180
calendar_slot_mins    : number  기본 60
```

> ⚠️ `time_format` 필드는 Admin UI에서 수동 추가 필요 (Phase 10 전)
> settings 컬렉션 → 편집 → New field → Select → values: `12h` / `24h` (줄바꿈 구분)
