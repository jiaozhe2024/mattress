#!/usr/bin/env bash
# cc-watchdog.sh 的回归测试：验证时间解析 与「不误杀」行为
# 运行：bash scripts/test-cc-watchdog.sh
set -u
PASS=0
FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS  $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL  $1  (got: $2  want: $3)"; }
eq()   { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "$2" "$3"; fi; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WD="$SCRIPT_DIR/cc-watchdog.sh"

# 从被测脚本里抽出纯解析函数（避免整脚本执行副作用）
extract_fn() { sed -n "/^$1() {/,/^}/p" "$WD"; }
eval "$(extract_fn cpu_seconds)"
eval "$(extract_fn etime_seconds)"

# ---- 用假 ps 桩模拟各种 time 输出 ----
make_ps_stub() {
    local time_val=$1 etime_val=$2 tmpdir
    tmpdir=$(mktemp -d)
    cat > "$tmpdir/ps" <<STUB
#!/usr/bin/env bash
case "\$*" in
  *"-o time="*)  echo "$time_val" ;;
  *"-o etime="*) echo "$etime_val" ;;
esac
STUB
    chmod +x "$tmpdir/ps"
    echo "$tmpdir"
}

echo "== cpu_seconds 解析（macOS ps -o time= 格式：[时:]分:秒.厘秒）=="
ORIG_PATH="$PATH"
T=$(make_ps_stub "0:00.01" "00:30");     PATH="$T:$PATH"; eq "0:00.01 -> 0.01"        "$(cpu_seconds 1)" "0.01"
T=$(make_ps_stub "2:22.85" "02:22");     PATH="$T:$PATH"; eq "2:22.85 -> 142.85"      "$(cpu_seconds 1)" "142.85"
T=$(make_ps_stub "1:02:22.85" "62:22");  PATH="$T:$PATH"; eq "1:02:22.85 -> 3742.85"  "$(cpu_seconds 1)" "3742.85"
T=$(make_ps_stub "10:00.00" "10:00");    PATH="$T:$PATH"; eq "10:00.00 -> 600.00"     "$(cpu_seconds 1)" "600.00"
T=$(make_ps_stub "" "10:00");            PATH="$T:$PATH"
cpu_seconds 1 >/dev/null 2>&1; eq "空输出 -> 返回非 0" "$?" "1"

echo "== etime_seconds 解析 =="
T=$(make_ps_stub "0:01" "00:45");       PATH="$T:$PATH"; eq "00:45 -> 45"          "$(etime_seconds 1)" "45"
T=$(make_ps_stub "0:01" "05:30");       PATH="$T:$PATH"; eq "05:30 -> 330"         "$(etime_seconds 1)" "330"
T=$(make_ps_stub "0:01" "01:05:30");    PATH="$T:$PATH"; eq "01:05:30 -> 3930"     "$(etime_seconds 1)" "3930"
T=$(make_ps_stub "0:01" "2-01:05:30");  PATH="$T:$PATH"; eq "2-01:05:30 -> 176730" "$(etime_seconds 1)" "176730"

# 关键：必须恢复真实 PATH，否则下面的 python 会调用到假 ps 桩
PATH="$ORIG_PATH"
export PATH

# 清理假 ps 桩目录
for d in /tmp/tmp.*; do [ -x "$d/ps" ] && rm -rf "$d"; done 2>/dev/null || true

# 用 python 驱动真实进程验证 CPU 波动（写临时脚本，避免 heredoc 变量污染）
echo "== 真实进程 CPU 时间行为 =="
PROBE=$(mktemp /tmp/wd_probe_XXXXXX.py)
cat > "$PROBE" <<'PY'
import subprocess, sys, time

def cpu(pid):
    return subprocess.run(["ps", "-p", str(pid), "-o", "time="],
                          capture_output=True, text=True).stdout.strip()

busy = subprocess.Popen([sys.executable, "-c",
    "import time\nt0=time.process_time()\nwhile time.process_time()-t0<600: pass"])
time.sleep(2.0); b1 = cpu(busy.pid)
time.sleep(3.0); b2 = cpu(busy.pid)
busy.kill(); busy.wait()

idle = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(600)"])
time.sleep(2.0); i1 = cpu(idle.pid)
time.sleep(3.0); i2 = cpu(idle.pid)
idle.kill(); idle.wait()

print(f"{b1}\t{b2}\t{'grew' if b1 != b2 else 'flat'}")
print(f"{i1}\t{i2}\t{'flat' if i1 == i2 else 'grew'}")
PY
python3 "$PROBE" > /tmp/wd_probe_out.txt 2>/tmp/wd_probe_err.txt
rm -f "$PROBE"

if [ -s /tmp/wd_probe_err.txt ]; then
    echo "  (probe stderr: $(head -2 /tmp/wd_probe_err.txt))"
fi

B_LINE=$(sed -n '1p' /tmp/wd_probe_out.txt)
I_LINE=$(sed -n '2p' /tmp/wd_probe_out.txt)
B1=$(printf '%s' "$B_LINE" | awk -F'\t' '{print $1}')
B2=$(printf '%s' "$B_LINE" | awk -F'\t' '{print $2}')
BV=$(printf '%s' "$B_LINE" | awk -F'\t' '{print $3}')
I1=$(printf '%s' "$I_LINE" | awk -F'\t' '{print $1}')
I2=$(printf '%s' "$I_LINE" | awk -F'\t' '{print $2}')
IV=$(printf '%s' "$I_LINE" | awk -F'\t' '{print $3}')

if [ "${BV:-}" = "grew" ]; then
    ok "忙进程 CPU 增长（${B1:-?} -> ${B2:-?}）→ 看门狗放过"
else
    bad "忙进程 CPU 未增长" "${B1:-?} -> ${B2:-?} (${BV:-?})" "grew"
fi
if [ "${IV:-}" = "flat" ]; then
    ok "静进程 CPU 不变（${I1:-?} = ${I2:-?}）→ 看门狗判挂死"
else
    bad "静进程 CPU 居然增长" "${I1:-?} -> ${I2:-?} (${IV:-?})" "flat"
fi

echo "== 源码结构回归（防旧 bug 复现）=="
grep -q 'for pid in \$pids' "$WD" \
    && ok "按单个 pid 循环判定（非无差别 kill）" \
    || bad "未找到按 pid 循环结构" "missing" "for pid in \$pids"

grep -q 'mmin -5' "$WD" \
    && bad "仍用「5 分钟内有无文件写入」误判依据" "present" "absent" \
    || ok "已移除「5 分钟内有无文件写入」误判依据"

grep -qE 'mins.*-lt.*STALE_MIN' "$WD" \
    && bad "仍用进程运行时长直接判挂死" "present" "absent" \
    || ok "不再用运行时长直接判挂死（改 CPU 增长探测）"

grep -q 'lsof' "$WD" \
    && bad "仍依赖 lsof 关联 jsonl" "present" "absent" \
    || ok "不依赖 lsof 关联 jsonl（旧注释与实现不符已消除）"

echo
echo "结果：PASS=$PASS  FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
