#!/usr/bin/env bash
set -euo pipefail
T="$1"; BASE="feature/backend-agent"
MAIN="$(git rev-parse --show-toplevel)"; WT="$MAIN-$T"
REQUIRED=(.claude/CLAUDE.md .claude/CONTEXT.MD .claude/agents/checkpoint.md .scratch/options/README.md tools/hooks/pre-commit)
fail() { echo "STOP: $1"; exit 1; }
[ "$(git branch --show-current)" = "$BASE" ] || fail "main checkout is not on $BASE"
[ -z "$(git status --porcelain --untracked-files=no)" ] || fail "uncommitted tracked changes"
U="$(git ls-files --others --exclude-standard)"
[ -z "$U" ] || fail "untracked files would not reach the worktree: $U"
ls issues/$T-*.md >/dev/null 2>&1 || fail "no ticket file issues/$T-*.md"
for f in "${REQUIRED[@]}"; do git ls-files --error-unmatch "$f" >/dev/null 2>&1 || fail "$f is not committed"; done
git worktree add "$WT" -b "ticket/$T" "$BASE"
for f in "${REQUIRED[@]}" issues/$T-*.md; do [ -e "$WT/$f" ] || fail "$f missing in the new worktree"; done
echo "Ready: $WT at $(git rev-parse --short HEAD). Open a NEW Claude session in that folder."
