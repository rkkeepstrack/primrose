#!/usr/bin/env bash
# Works out the next release from the commits since the last vX.Y.Z tag and
# writes grouped release notes. Prints the tag; run from the repo root.
#
#   release-version.sh NOTES_FILE [EXPLICIT_VERSION]
#
# Bump: a "!" after the type or a BREAKING CHANGE line = major (minor while
# still on 0.x), any feat = minor, anything else = patch.
set -euo pipefail

notes=${1:?usage: release-version.sh NOTES_FILE [VERSION]}
explicit=${2:-}

# one definition of a conventional subject, for the bump, the sections and
# the prefix stripping alike: type, optional (scope), optional !, colon
types='feat|fix|perf|chore|refactor|docs|test|ci|build|style'
prefix() { echo "^($1)(\([^)]*\))?(!)?: *"; }
semver='^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'

# pre-releases (v1.2.0-rc1) are not a base to count from
last=$(git describe --tags --abbrev=0 --match 'v[0-9]*' --exclude '*-*' 2>/dev/null || echo v0.0.0)
if [ "$last" = v0.0.0 ]; then range=HEAD; else range="$last..HEAD"; fi
if [ -z "$(git log --no-merges --format=%H "$range")" ]; then
  echo "nothing has been committed since $last, nothing to release" >&2
  exit 1
fi

if [ -n "$explicit" ]; then
  if ! [[ $explicit =~ $semver ]]; then
    echo "version must look like 1.2.3, got: $explicit" >&2
    exit 1
  fi
  tag="v${explicit#v}"
  newest=$(printf '%s\n%s\n' "${last#v}" "${tag#v}" | sort -V | tail -n1)
  if [ "$last" != v0.0.0 ] && { [ "$newest" != "${tag#v}" ] || [ "$tag" = "$last" ]; }; then
    echo "${explicit#v} is not newer than $last" >&2
    exit 1
  fi
else
  text=$(git log --no-merges --format='%s%n%b' "$range")
  bump=patch
  if grep -Eq "^[a-z]+(\([^)]*\))?!:|^BREAKING CHANGE" <<<"$text"; then bump=major
  elif grep -Eq "$(prefix feat)" <<<"$text"; then bump=minor
  fi
  IFS=. read -r major minor patch <<<"${last#v}"
  major=$((10#$major)) minor=$((10#$minor)) patch=$((10#$patch))
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

subjects=$(git log --no-merges --format='%s (%h)' "$range")
# the section title names the type, so each line drops its "type(TICKET): "
section() {
  local title=$1 lines
  lines=$(grep -E "$(prefix "$2")" <<<"$subjects" | sed -E "s/$(prefix "$2")/- /" || true)
  if [ -n "$lines" ]; then printf '## %s\n%s\n\n' "$title" "$lines"; fi
}
{
  section Features feat
  section Fixes fix
  section Performance perf
  section Other 'chore|refactor|docs|test|ci|build|style'
  # everything without a known prefix, so nothing silently goes missing
  unsorted=$(grep -Ev "$(prefix "$types")" <<<"$subjects" | sed 's/^/- /' || true)
  if [ -n "$unsorted" ]; then printf '## Unsorted\n%s\n\n' "$unsorted"; fi
} >"$notes"

echo "$tag"
