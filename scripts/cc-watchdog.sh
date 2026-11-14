#!/usr/bin/env bash
# CC 看门狗：巡检 claude -p 进程，发现真挂死才 kill + 本地通知
# 由 Hermes cron 每 15 分钟调度；也可手动运行 `bash cc-watchdog.sh`
#
# 【判定依据】进程自身 CPU 时间是否增长（不依赖 jsonl 归属，也不看文件写入）
#   原因：claude -p 在跑构建/测试的十几分钟里不写任何文件，也不追加 jsonl，
#   用"文件 mtime 或 jsonl mtime 陈旧"判挂死会误杀正在干活的任务。
#   真正挂死的进程 CPU 时间停止增长，这是唯一可靠信号。
#
# 【三次采样】间隔 SAMPLE_GAP 秒采 3 次 CPU 时间：
#   - 任一次出现增长 → 活的，不动
#   - 三次完全不变且进程已运行 >= STALE_MIN → 判挂死
#
# 【多进程安全】每个 pid 独立判定；绝不像旧版那样"发现任一陈旧 session 就杀全部 claude -p"。
set -u

PROJ_DIR="$HOME/.claude/projects/-Users-jiaozhe-own-mattress-ux"
WATCHDOG_LOG=/Users/jiaozhe/own/mattress-ux/docs/exec-plans/watchdog.log
STALE_MIN=10        # 进程运行满这么多分钟才开始怀疑
SAMPLE_GAP=20       # 三次采样间隔（秒）
NOTIFY_APP="Hermes Watchdog"

ts() { date "+%Y-%m-%d %H:%M:%S"; }

# CPU 时间（秒，浮点）。
# macOS `ps -o time=` 输出格式：[时:]分:秒.厘秒 —— 一定有小数点，冒号 1 个或 2 个
#   0:00.01    -> 0 分 0.01 秒
#   2:22.85    -> 2 分 22.85 秒
#   1:02:22.85 -> 1 时 2 分 22.85 秒
# 注意不能用 -F'[:.]' 一刀切：那样 "2:22.85" 会被当成 3 段而误算成小时级。
cpu_seconds() {
    local pid=$1 raw
    raw=$(ps -p "$pid" -o time= 2>/dev/null | tr -d ' ') || return 1
    [ -z "$raw" ] && return 1
    echo "$raw" | awk '
        {
            n = split($0, colon, ":")     # 先按冒号分；最后一段可能带小数
            last = colon[n]
            if (n == 1)      print last + 0
            else if (n == 2) printf "%.2f\n", colon[1]*60 + last
            else if (n == 3) printf "%.2f\n", colon[1]*3600 + colon[2]*60 + last
            else             print 0
        }
    '
}

# 进程运行秒数
etime_seconds() {
    local pid=$1 raw
    raw=$(ps -p "$pid" -o etime= 2>/dev/null | tr -d ' ') || return 1
    [ -z "$raw" ] && return 1
    echo "$raw" | awk -F'[-:]' '
        NF==4 { print $1*86400 + $2*3600 + $3*60 + $4; exit }  # dd-hh:mm:ss
        NF==3 { print $1*3600 + $2*60 + $3; exit }             # hh:mm:ss
        NF==2 { print $1*60 + $2; exit }                       # mm:ss
        NF==1 { print $1; exit }
        { print 0 }
    '
}

# 取该进程的任务标识（用于日志/通知，取命令行里任务 id 或前 60 字符）
proc_tag() {
    local pid=$1
    ps -p "$pid" -o command= 2>/dev/null \
        | grep -oE '(BE|MP|NG)-[0-9]+[A-Z]?' \
        | head -1 \
        || true
}

msg_buf=""
killed_any=0

pids=$(pgrep -f "claude -p" 2>/dev/null || true)
if [ -z "$pids" ]; then
    echo "[$(ts)] patrol ok (no active claude -p)" > "$WATCHDOG_LOG.last"
    exit 0
fi

for pid in $pids; do
    # 进程可能在采样间隙退出
    et=$(etime_seconds "$pid") || continue
    [ -z "$et" ] && continue

    # 运行不足 STALE_MIN 分钟：不问，直接放过
    if [ "$et" -lt $((STALE_MIN * 60)) ]; then
        continue
    fi

    # 三次采样 CPU 时间
    c1=$(cpu_seconds "$pid") || continue
    sleep "$SAMPLE_GAP"
    c2=$(cpu_seconds "$pid") || continue
    sleep "$SAMPLE_GAP"
    c3=$(cpu_seconds "$pid") || continue

    # 任一次增长即为活进程
    grew=$(awk -v a="$c1" -v b="$c2" -v c="$c3" 'BEGIN { print (b>a || c>b) ? 1 : 0 }')
    if [ "$grew" -eq 1 ]; then
        continue
    fi

    # CPU 时间三次完全不变 + 已运行 >= STALE_MIN 分钟 → 真挂死
    tag=$(proc_tag "$pid")
    etime_h=$(ps -p "$pid" -o etime= 2>/dev/null | tr -d ' ')
    cmd=$(ps -p "$pid" -o command= 2>/dev/null | cut -c1-80)
    echo "[$(ts)] KILL pid=$pid task=${tag:-unknown} etime=$etime_h cpu=$c3(s, unchanged over $((SAMPLE_GAP*2))s) cmd=$cmd" >> "$WATCHDOG_LOG"
    kill -9 "$pid" 2>/dev/null
    killed_any=1
    msg_buf="${msg_buf}PID ${pid}${tag:+ ($tag)} hung: CPU flat ${SAMPLE_GAP}x2s after ${etime_h}, killed.
"
done

if [ "$killed_any" -eq 1 ]; then
    osascript -e "display notification \"${msg_buf}\" with title \"${NOTIFY_APP}\"" 2>/dev/null || true
fi

if [ ! -f "$WATCHDOG_LOG" ]; then
    echo "[$(ts)] watchdog init" >> "$WATCHDOG_LOG"
fi
echo "[$(ts)] patrol ok (active_claude=$(echo "$pids" | wc -l | tr -d ' '), killed=$killed_any)" > "$WATCHDOG_LOG.last"
