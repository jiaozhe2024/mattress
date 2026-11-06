#!/usr/bin/env bash
# CC 看门狗：巡检活跃 claude -p 进程，发现挂死（session jsonl 10min 无增长）自动 kill + 本地通知
# 由 Hermes cron 每 15 分钟调度；也可手动运行 `bash cc-watchdog.sh`
set -u
PROJ_DIR=~/.claude/projects/-Users-jiaozhe-own-mattress-ux
WATCHDOG_LOG=/Users/jiaozhe/own/mattress-ux/docs/exec-plans/watchdog.log
STALE_MIN=10
NOTIFY_APP="Hermes Watchdog"

now_epoch=$(date +%s)
msg_buf=""

# 遍历项目下最新 2 个 jsonl（对应最近两个活跃 CC 会话）
for jsonl in $(ls -t "$PROJ_DIR"/*.jsonl 2>/dev/null | head -2); do
    # session jsonl 文件 mtime（epoch）
    f_mtime=$(stat -f %m "$jsonl" 2>/dev/null)
    [ -z "$f_mtime" ] && continue
    age_min=$(( (now_epoch - f_mtime) / 60 ))
    [ "$age_min" -lt "$STALE_MIN" ] && continue  # 还在活跃，跳过

    # 该 session 是否对应一个还在跑的 claude -p 进程（粗判：任意 claude -p 进程存在）
    # claude 进程本身不持有 jsonl 文件句柄，靠 mtime 间接判断：
    # 若 mtime 陈旧但没有任何 claude -p 进程，说明进程已正常退出，跳过
    alive=$(pgrep -f "claude -p" | wc -l | tr -d ' ')
    if [ "$alive" -eq 0 ]; then continue; fi

    # 有活跃 claude -p 进程 + jsonl 陈旧 → 可能挂死；用 pid 命中具体进程
    # 通过 lsof 找到打开此 jsonl 的进程（若无直接对应则取所有 claude -p 进程中最陈旧的）
    for pid in $(pgrep -f "claude -p"); do
        # 获取进程已运行时长，超过 STALE_MIN*2 且 cpu 时间几乎不涨 → 判挂死
        etime=$(ps -p $pid -o etime= 2>/dev/null | tr -d ' ')
        [ -z "$etime" ] && continue
        # 提取分钟数（etime 格式如 01:56:36 或 116:36）
        mins=$(echo "$etime" | awk -F: '{if (NF==3) print $1*60+$2; else if (NF==2) print $1; else print 0}')
        [ "$mins" -lt "$STALE_MIN" ] && continue

        # 检查该进程最近是否在产出（工作树 mmin 探测）
        recent_write=$(find /Users/jiaozhe/own/mattress-ux -type f -mmin -5 -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$recent_write" -gt 0 ]; then continue; fi  # 5min 内有产出 = 正在写，别杀

        # 真挂死：kill + 通知 + 日志
        ts=$(date "+%Y-%m-%d %H:%M:%S")
        session_id=$(basename "$jsonl" .jsonl)
        # 取该进程启动命令前 80 字符供日志辨识
        cmd=$(ps -p $pid -o command= 2>/dev/null | cut -c1-80)
        echo "[$ts] KILL pid=$pid session=$session_id etime=$etime cmd=$cmd" >> "$WATCHDOG_LOG"
        kill -9 "$pid" 2>/dev/null
        msg_buf="${msg_buf}PID ${pid} (runtime ${mins}min) hung, killed.
"
    done
done

# 本地 macOS 通知（有挂死处置才弹）
if [ -n "$msg_buf" ]; then
    osascript -e "display notification \"${msg_buf}\" with title \"${NOTIFY_APP}\"" 2>/dev/null || true
fi

# 无事件时也记一次轻量状态（便于 tail 查看最后一次巡检）
last_check=$(date "+%Y-%m-%d %H:%M:%S")
if [ ! -f "$WATCHDOG_LOG" ]; then echo "[$last_check] watchdog init" >> "$WATCHDOG_LOG"; fi
echo "[$last_check] patrol ok (active_claude=$(pgrep -f 'claude -p' | wc -l | tr -d ' '))" > "$WATCHDOG_LOG.last"
