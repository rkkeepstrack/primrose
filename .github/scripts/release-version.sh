#!/usr/bin/env bash
# Works out the next release from the commits since the last v* tag and
# writes grouped release notes. Prints the tag; run from the repo root.
#
#   release-version.sh NOTES_FILE [EXPLICIT_VERSION]
#
# Bump: a "!" after the type or a BREAKING CHANGE line = major (minor while
# still on 0.x), any feat = minor, anything else = patch.
set -euo pipefail

notes=${1:?usage: release-version.sh NOTES_FILE [VERSION]}
explicit=${2:-}

last=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || echo v0.0.0)
if [ "$last" = v0.0.0 ]; then range=HEAD; else range="$last..HEAD"; fi
if [ -z "$(git log --no-merges --format=%H "$range")" ]; then
  echo "nothing has been committed since $last, nothing to release" >&2
  exit 1
fi

if [ -n "$explicit" ]; then
  if ! [[ $explicit =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "version must look like 1.2.3, got: $explicit" >&2
    exit 1
  fi
  tag="v${explicit#v}"
else
  text=$(git log --no-merges --format='%s%n%b' "$range")
  bump=patch
  if grep -Eq '^[a-z]+(\([^)]*\))?!:|^BREAKING CHANGE' <<<"$text"; then bump=major
  elif grep -Eq '^feat(\([^)]*\))?:' <<<"$text"; then bump=minor
  fi
  IFS=. read -r major minor patch <<<"${last#v}"
  case $bump in
    major) if [ "$major" = 0 ]; then minor=$((minor + 1)); patch=0; else major=$((major + 1)); minor=0; patch=0; fi ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
  esac
  tag="v$major.$minor.$patch"
fi

if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "tag $tag already exists" >&2
  exit 1
fi

# the section title names the type, so each line drops its "type(TICKET): "
section() {
  local title=$1 pattern=$2 lines
  lines=$(git log --no-merges --format='%s (%h)' "$range" |
    grep -E "^($pattern)" |
    sed -E 's/^[a-z]+(\([^)]*\))?!?: */- /' || true)
  if [ -n "$lines" ]; then printf '## %s\n%s\n\n' "$title" "$lines"; fi
}
{
  section Features 'feat(\(|!|:)'
  section Fixes 'fix(\(|!|:)'
  section Performance 'perf(\(|!|:)'
  section Other '(chore|refactor|docs|test|ci|build|style)(\(|!|:)'
  # everything without a known prefix, so nothing silently goes missing
  unsorted=$(git log --no-merges --format='%s (%h)' "$range" |
    grep -Ev '^(feat|fix|perf|chore|refactor|docs|test|ci|build|style)(\(|!|:)' |
    sed 's/^/- /' || true)
  if [ -n "$unsorted" ]; then printf '## Unsorted\n%s\n\n' "$unsorted"; fi
} >"$notes"

echo "$tag"
