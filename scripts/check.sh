#!/usr/bin/env bash
# 发布前的完整检查：安装依赖 → 编译 → 单元测试 → 端到端测试（真实 dsh）→ 个人信息扫描。
# 全部通过才退出 0。先运行一次 scripts/setup-test-env.sh。
#
# 可选环境变量：
#   TEST_ENV_DIR        测试环境目录（默认 <仓库>/.cache/test-env）
#   SKIP_E2E=1          跳过端到端测试（只在确实跑不了时用，并在交接文档里写明）
#   SCAN_PATTERNS_FILE  个人信息扫描词表，一行一个（默认 <仓库>/../.private/个人信息扫描词.txt，不在仓库里）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_DIR="${TEST_ENV_DIR:-$ROOT/.cache/test-env}"
SCAN_FILE="${SCAN_PATTERNS_FILE:-$ROOT/../.private/个人信息扫描词.txt}"
cd "$ROOT"

if [ ! -x "$ENV_DIR/node/bin/node" ]; then
  echo "没有测试环境，先运行 scripts/setup-test-env.sh" >&2
  exit 1
fi
export PATH="$ENV_DIR/node/bin:$PATH"
PNPM=(npx --yes pnpm@11.28.5)

echo "== 安装依赖"
"${PNPM[@]}" install --frozen-lockfile >/dev/null

echo "== 编译"
"${PNPM[@]}" run build >/dev/null

echo "== 设置页脚本语法"
# 设置页 client.js 是手写、不经编译的，写坏了 dsh 网页整个打不开；单元测试和端到端测试都碰不到它，单独查一遍
node --check lib/client.js || { echo "lib/client.js 有语法错误，dsh 网页会加载失败" >&2; exit 1; }
# 中英文词典里同一个名字写两次时，后面的会悄悄盖掉前面的，界面上显示错的字
node -e '
const s = require("fs").readFileSync("lib/client.js", "utf8"); let bad = []
for (const lang of ["zh", "en"]) {
  const start = s.indexOf("\n\t\tvar " + lang + " = {\n"); const end = s.indexOf("\n\t\t};", start)
  const keys = [...s.slice(start, end).matchAll(/^\t\t\t([A-Za-z_][A-Za-z0-9_]*):/gm)].map(m => m[1])
  bad.push(...keys.filter((k, i) => keys.indexOf(k) !== i).map(k => lang + "." + k))
}
if (bad.length) { console.error("设置页词典里有重名：" + bad.join(", ")); process.exit(1) }
' || exit 1

echo "== 单元测试"
"${PNPM[@]}" test 2>&1 | grep -E "^(not ok|ℹ (pass|fail))" || true
"${PNPM[@]}" test >/dev/null 2>&1 || { echo "单元测试没通过，运行 pnpm test 看详情" >&2; exit 1; }

if [ "${SKIP_E2E:-0}" != "1" ]; then
  echo "== 端到端测试（真实 dsh + 假模型 + 假 NapCat）"
  DSH_BIN="$ENV_DIR/dsh/node_modules/.bin/dsh" node test/e2e.mjs 2>&1 | grep -v "^\s*at " | tail -20
  [ "${PIPESTATUS[0]}" = "0" ] || { echo "端到端测试没通过" >&2; exit 1; }
else
  echo "== 跳过端到端测试（SKIP_E2E=1）"
fi

echo "== 个人信息扫描"
HITS=""
if [ -f "$SCAN_FILE" ]; then
  HITS="$(grep -rnF -f "$SCAN_FILE" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.cache . || true)"
else
  echo "（没有找到扫描词表 $SCAN_FILE，只扫通用的密钥格式）"
fi
HITS="$HITS$(grep -rnE 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|BEGIN (RSA |OPENSSH )?PRIVATE KEY' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.cache . || true)"
if [ -n "$HITS" ]; then
  echo "发现个人信息或密钥（不能推到公开仓库）：" >&2
  echo "$HITS" | cut -c1-160 >&2
  exit 1
fi
echo "没有发现"

echo
echo "全部检查通过。"
