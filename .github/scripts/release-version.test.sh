#!/usr/bin/env bash
# Runs release-version.sh against throwaway repos. CI runs this; locally:
#   bash .github/scripts/release-version.test.sh
set -euo pipefail
# a caller's GIT_DIR (hooks, rebase -x) would point every git call below at
# the caller's repo instead of the throwaway ones
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
script="$(cd "$(dirname "$0")" && pwd)/release-version.sh"
fails=0

repo() {
  cd "$(mktemp -d "$tmp/repo.XXXX")"
  git init -q -b main
  git config user.email t@t
  git config user.name t
  git config commit.gpgsign false
}
commit() { git commit -q --allow-empty -m "$1" ${2:+-m "$2"}; }

# expect NAME WANT [VERSION]: WANT is a tag, or "error:<text the script prints>"
expect() {
  local name=$1 want=$2 got err
  if got=$("$script" notes.md ${3:-} 2>err.txt); then :; else got="error:$(cat err.txt)"; fi
  if [[ $want == error:* && $got == "$want"* ]] || [ "$got" = "$want" ]; then
    echo "ok   $name"
  else
    echo "FAIL $name: want $want, got $got"
    fails=$((fails + 1))
  fi
}

repo; commit "feat: first"
expect "untagged repo starts from v0.0.0" v0.1.0

repo; commit "feat: a"; git tag v1.2.3; commit "fix(LD-1): b"
expect "fix only bumps patch" v1.2.4

repo; commit "feat: a"; git tag v1.2.3; commit "fix: b"; commit "feat(LD-2): c"
expect "any feat bumps minor" v1.3.0

repo; commit "feat: a"; git tag v1.2.3; commit "feat!: drop the old format"
expect "bang bumps major" v2.0.0

repo; commit "feat: a"; git tag v1.2.3; commit "fix: b" "BREAKING CHANGE: files move"
expect "BREAKING CHANGE in the body bumps major" v2.0.0

repo; commit "feat: a"; git tag v0.4.1; commit "feat(X)!: big"
expect "breaking on 0.x only bumps minor" v0.5.0

repo; commit "feat: a"; git tag v1.0.0
expect "nothing since the tag is an error" "error:nothing has been committed since v1.0.0"

repo; commit "feat: a"; git tag v1.0.0; commit "fix: b"
expect "explicit version wins" v3.1.4 3.1.4
expect "explicit version must be semver" "error:version must look like 1.2.3" 3.1
expect "explicit version rejects leading zeros" "error:version must look like 1.2.3" 01.2.3
expect "explicit version must be newer than the last tag" "error:1.0.0 is not newer than v1.0.0" 1.0.0
expect "explicit version below the last tag is refused" "error:0.9.9 is not newer than v1.0.0" 0.9.9
# an existing tag off to the side (another branch), so it isn't the base
git tag v4.0.0 "$(git commit-tree "HEAD^{tree}" -m side)"
expect "explicit version must not exist" "error:tag v4.0.0 already exists" 4.0.0
git tag -d v4.0.0 >/dev/null

repo; commit "feat: a"; git tag v1.0.0
git checkout -q -b topic; commit "fix(LD-3): on a branch"
git checkout -q main; git merge -q --no-ff topic -m "Merge pull request #7 from x/topic"
commit "tweak the thing"
expect "merge commits are skipped" v1.0.1
if grep -q "Merge pull request" notes.md; then echo "FAIL merge commit leaked into notes"; fails=$((fails + 1)); else echo "ok   notes skip merge commits"; fi
if grep -q "^- on a branch" notes.md && grep -q "^- tweak the thing" notes.md; then echo "ok   notes strip prefixes and keep unprefixed commits"; else echo "FAIL notes:"; cat notes.md; fails=$((fails + 1)); fi

repo; commit "feat: a"; git tag v1.0.0; commit "fix: b"; git tag v1.1.0-rc1; commit "fix: c"
expect "pre-release tags are not a base" v1.0.1

repo; commit "feat: a"; git tag v1.0.0; commit "feat!(oops): not quite conventional"
expect "a malformed bang neither bumps major nor crashes" v1.0.1
if grep -q "^- feat!(oops): not quite conventional" notes.md; then echo "ok   malformed subjects land in Unsorted with a bullet"; else echo "FAIL notes:"; cat notes.md; fails=$((fails + 1)); fi

[ "$fails" = 0 ] || { echo "$fails failing"; exit 1; }
