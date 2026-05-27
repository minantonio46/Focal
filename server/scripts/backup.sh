#!/bin/bash
# Focal — PocketBase 자동 백업 스크립트
# 위치: ~/pocketbase/backup.sh
# 실행: 매일 새벽 3:00 (launchd)

BACKUP_DIR="$HOME/pocketbase-backups"
DATA_DIR="$HOME/pocketbase/pb_data"
DATE=$(date +%F)
TARGET="$BACKUP_DIR/$DATE"

# 오늘 날짜 폴더에 복사
mkdir -p "$TARGET"
cp -r "$DATA_DIR" "$TARGET/"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 백업 완료: $TARGET"

# 30일 이상 된 백업 자동 삭제
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} + 2>/dev/null

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 30일 이전 백업 정리 완료"
