#!/bin/bash
set -euo pipefail
umask 077

usage() {
  cat <<'USAGE'
Usage: ./install.sh [--update | --ref <tag-or-commit>] [--open] [--with-usage]
       ./install.sh --show
  No flag   Install the checked-out commit (ignores working-tree edits).
  --update  Fetch and install origin/main without changing the checkout.
  --ref     Install a specific commit or locally available tag.
  --with-usage  Explicitly build the optional, pinned Rust usage scanner (requires Cargo).
  --open    After installing, open Herdr Desktop and show the PA Cafe tab.
  --show    Show the installed PA Cafe tab without reinstalling; starts Herdr if needed.
Quit Herdr Desktop first. Works on macOS, Linux and Git for Windows. Uses HERDR_APP_HOME when set.
USAGE
}
fail() { printf 'PA Cafe: %s\n' "$*" >&2; exit 1; }

ref=HEAD
update=false
open_tab=false
show_only=false
build_usage=false
if [[ "${1-}" == '--show' && $# -eq 1 ]]; then
  show_only=true
  shift
fi
while [[ $# -gt 0 ]]; do
  case "$1" in
    --update) [[ "$ref" == HEAD && "$update" == false ]] || { usage >&2; exit 2; }; update=true ;;
    --ref) [[ $# -ge 2 && -n "$2" && "$ref" == HEAD && "$update" == false ]] || { usage >&2; exit 2; }; ref=$2; shift ;;
    --open) open_tab=true ;;
    --with-usage) build_usage=true ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
  shift
done

warn() { printf 'PA Cafe warning: %s\n' "$*" >&2; }

command -v git >/dev/null 2>&1 && git --version >/dev/null 2>&1 ||
  fail 'Git is required. Install it from https://git-scm.com/downloads and try again.'
for tool in tar grep mktemp uname; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool is required to safely extract the mod."
done

windows=false
case "$(uname -s)" in
  Darwin|Linux) ;;
  MINGW*|MSYS*|CYGWIN*) windows=true ;;
  *) fail 'Supported platforms: macOS, Linux, and Windows using Git for Windows.' ;;
esac

if "$windows"; then
  command -v cygpath >/dev/null 2>&1 || fail 'Run this from Git for Windows (Git Bash).'
fi
shell_path() {
  if "$windows"; then cygpath -au -- "$1"; else printf '%s\n' "$1"; fi
}
native_path() {
  if "$windows"; then cygpath -am -- "$1"; else printf '%s\n' "$1"; fi
}

repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
user_home=$HOME
if "$windows" && [[ -n "${USERPROFILE-}" ]]; then user_home=$(shell_path "$USERPROFILE"); fi
app_home=$(shell_path "${HERDR_APP_HOME:-${XDG_CONFIG_HOME:-"$user_home/.config"}/herdr-app}")
case "$app_home" in /*) ;; *) app_home="$PWD/$app_home" ;; esac

herdr=$(command -v herdr-app || true)
if [[ ! -x "$herdr" ]]; then
  if "$windows"; then
    if [[ -n "${LOCALAPPDATA-}" ]]; then
      herdr="$(shell_path "$LOCALAPPDATA")/Programs/herdr-app/herdr-app.exe"
    fi
  else
    for executable in "$user_home/.local/bin/herdr-app" "${XDG_DATA_HOME:-"$user_home/.local/share"}/herdr-app/herdr-app"       "$user_home/Applications/Herdr.app/Contents/MacOS/Herdr" /Applications/Herdr.app/Contents/MacOS/Herdr; do
      if [[ -x "$executable" ]]; then herdr=$executable; break; fi
    done
  fi
fi
if [[ ! -x "$herdr" ]]; then
  herdr=''
  warn 'Herdr Desktop was not found. The mod files will still be copied. Install Herdr: https://herdr.dev/app/'
fi
if [[ -n "$herdr" ]]; then
  case "$herdr" in /*) ;; *) herdr="$PWD/$herdr" ;; esac
fi
if ! command -v node >/dev/null 2>&1; then
  warn 'Node.js is missing from PATH. The files can be copied; install Node.js 22+ before pairing: https://nodejs.org/'
else
  version=$(node -p 'process.versions.node' 2>/dev/null || true)
  case "$version" in
    ''|*[!0-9.]*) warn 'Could not read the Node.js version. Install Node.js 22+ before pairing.' ;;
    *)
      major=${version%%.*}
      minor=${version#*.}; minor=${minor%%.*}
      if [[ "$major" -lt 18 || ( "$major" -eq 18 && "$minor" -lt 17 ) ]]; then
        warn "Node.js $version is too old. The files can be copied; install Node.js 22+ before pairing."
      elif [[ "$major" -lt 22 ]]; then
        warn "Node.js $version uses polling. Node.js 22+ enables WebSocket standby."
      fi
      ;;
  esac
fi
core=''
if "$windows" && [[ -n "${LOCALAPPDATA-}" ]]; then core="$(shell_path "$LOCALAPPDATA")/Programs/herdr-core/herdr-core.exe"; fi
if ! command -v hc >/dev/null 2>&1 && ! command -v herdr-core >/dev/null 2>&1 &&
   [[ ! -x "$user_home/.local/bin/hc" && ! -x "$user_home/.local/bin/herdr-core" && ! -x "$core" ]]; then
  warn 'Herdr Core was not found. Install it with Herdr Desktop before dispatching.'
fi
show_tab() {
  [[ -n "$herdr" ]] || return 1
  command -v node >/dev/null 2>&1 || return 1
  local helper="$app_home/mods/pacafe-desktop/open-desktop.mjs"
  [[ -f "$helper" && ! -L "$helper" ]] || return 1
  node "$(native_path "$helper")" open "$(native_path "$app_home")" "$(native_path "$herdr")"
}
if "$show_only"; then
  show_tab || fail 'Could not open the installed PA Cafe tab. Check that the mod, Herdr Desktop and Node.js are installed.'
  exit 0
fi
git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  fail 'Run install.sh from a Git checkout.'

check_stopped() {
  # Windows' AF_UNIX socket may not be exposed as -S/-e by Git Bash.
  if ! "$windows" || [[ -z "$herdr" ]]; then
    [[ -S "$app_home/herdr-app.sock" || -e "$app_home/herdr-app.sock" ]] || return 0
  fi
  if [[ -z "$herdr" ]]; then
    fail 'Found a Desktop socket but could not check whether it is open. Quit Herdr and make herdr-app available before replacing the mod.'
  fi
  if HERDR_APP_HOME="$(native_path "$app_home")" "$herdr" status >/dev/null 2>&1; then
    fail 'Quit Herdr Desktop before installing. Herdr Core and its terminals can stay running.'
  fi
}
check_stopped

if "$update"; then
  git -C "$repo" fetch --no-tags origin refs/heads/main:refs/remotes/origin/main
  ref=refs/remotes/origin/main
fi
revision=$(git -C "$repo" rev-parse --verify --end-of-options "${ref}^{commit}") ||
  fail "Cannot resolve the requested Git revision: $ref"

package=mods/pacafe-desktop
# Reject links before loading code. The installed copy must be a self-contained bundle.
objects=$(git -C "$repo" ls-tree -r "$revision" -- "$package")
[[ -n "$objects" ]] || fail "No $package bundle at $revision."
if printf '%s\n' "$objects" | grep -Eq '^(120000|160000) '; then
  fail 'The bundle contains a symlink or submodule.'
fi

check_home=$(mktemp -d /tmp/pacafe-check.XXXXXX)
lock=''
staged=''
backup=''
target="$app_home/$package"
cleanup() {
  local rc=$?
  trap - EXIT
  if [[ -n "$backup" && -d "$backup/pacafe-desktop" && ! -e "$target" && ! -L "$target" ]]; then
    if ! mv "$backup/pacafe-desktop" "$target"; then
      printf 'PA Cafe: restore previous mod from %s/pacafe-desktop\n' "$backup" >&2
    else
      rmdir "$backup" || true
    fi
  elif [[ -n "$backup" && ! -e "$backup/pacafe-desktop" ]]; then
    rmdir "$backup" || true
  fi
  if [[ -n "$staged" ]]; then rm -rf -- "$staged"; fi
  if [[ -n "$lock" ]]; then rmdir "$lock" || true; fi
  rm -rf -- "$check_home"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$check_home/user" "$check_home/app" "$check_home/runtime"
git -C "$repo" archive "$revision" -- "$package" | tar -xf - -C "$check_home"
candidate="$check_home/$package"
[[ -f "$candidate/mod.json" && -f "$candidate/main.js" ]] ||
  fail "Invalid bundle at $revision."

usage_binary=''
usage_name='pacafe-tokscale-history'
if "$windows"; then usage_name="$usage_name.exe"; fi
if "$build_usage"; then
  command -v cargo >/dev/null 2>&1 || fail 'Cargo (with a Rust 2024 toolchain) is required for --with-usage.'
  source_path=tools/tokscale-history
  source_objects=$(git -C "$repo" ls-tree -r "$revision" -- "$source_path")
  [[ -n "$source_objects" ]] || fail "No usage scanner source at $revision."
  if printf '%s\n' "$source_objects" | grep -Eq '^(120000|160000) '; then
    fail 'The scanner source contains a symlink or submodule.'
  fi
  git -C "$repo" archive "$revision" -- "$source_path" | tar -xf - -C "$check_home"
  [[ -f "$check_home/$source_path/Cargo.toml" && -f "$check_home/$source_path/Cargo.lock" ]] ||
    fail 'The selected commit has no locked usage scanner.'
  printf 'Building optional PA Cafe usage scanner from %s…\n' "$revision"
  # Cargo reads configuration from its current directory, not just the manifest.
  # Build outside the user's checkout; only the selected Git commit supplies source.
  (
    cd "$check_home"
    cargo build --locked --release --manifest-path "$(native_path "$check_home/$source_path/Cargo.toml")" \
      --target-dir "$(native_path "$check_home/usage-target")"
  ) || fail 'Usage scanner build failed; the installed mod was not changed.'
  built_scanner="$check_home/usage-target/release/$usage_name"
  [[ -f "$built_scanner" && -x "$built_scanner" && ! -L "$built_scanner" ]] ||
    fail 'Expected native usage scanner was not built; the installed mod was not changed.'
  # Keep the verified build out of the native Check app's mod directories/staging.
  usage_binary="$check_home/$usage_name"
  cp -- "$built_scanner" "$usage_binary"
  mkdir -p "$candidate/bin"
  cp -- "$usage_binary" "$candidate/bin/$usage_name"
fi

if [[ -n "$herdr" ]]; then
  printf 'Checking PA Cafe bundle %s…\n' "$revision"
  # The native checker uses its own app/Core state, never the user's active profile.
  HOME="$(native_path "$check_home/user")" USERPROFILE="$(native_path "$check_home/user")"     HERDR_APP_HOME="$(native_path "$check_home/app")" XDG_CONFIG_HOME="$(native_path "$check_home/config")"     XDG_DATA_HOME="$(native_path "$check_home/data")" XDG_STATE_HOME="$(native_path "$check_home/state")"     XDG_CACHE_HOME="$(native_path "$check_home/cache")" XDG_RUNTIME_DIR="$(native_path "$check_home/runtime")"     HC_RUNTIME="$(native_path "$check_home/runtime")" HC_SOCKET="$(native_path "$check_home/core.sock")"     HC_SESSION="pa-${check_home##*.}"     "$herdr" check "$(native_path "$candidate")" || fail 'Herdr could not load the candidate; nothing was installed.'
else
  printf 'Native check skipped because Herdr Desktop is missing. Verified Git bundle %s.\n' "$revision"
fi

check_stopped
mkdir -p "$app_home"
lock_path="$app_home/.pacafe-desktop-install.lock"
mkdir "$lock_path" 2>/dev/null || fail "Another install is in progress (lock: $lock_path)."
lock=$lock_path
[[ ! -L "$app_home/mods" && ! -L "$target" ]] || fail 'Refusing to replace a linked mods directory.'
[[ ! -e "$target" || -d "$target" ]] || fail 'Expected a directory at the PA Cafe mod path.'
mkdir -p "$app_home/mods"
staged=$(mktemp -d "$app_home/.pacafe-desktop-install.XXXXXX")
# Extract from Git again so checker-generated files never enter the installed bundle.
git -C "$repo" archive "$revision" -- "$package" | tar -xf - --strip-components 1 -C "$staged"
if [[ -n "$usage_binary" ]]; then
  mkdir -p "$staged/pacafe-desktop/bin"
  cp -- "$usage_binary" "$staged/pacafe-desktop/bin/$usage_name"
fi
printf '%s\n' "$revision" > "$staged/pacafe-desktop/.pacafe-source-commit"
if [[ -d "$target" ]]; then
  # Keep recovered files outside Herdr's scanned mods paths.
  backup=$(mktemp -d "$app_home/.pacafe-desktop-backup.XXXXXX")
  mv "$target" "$backup/pacafe-desktop"
fi
mv "$staged/pacafe-desktop" "$target"

printf 'Installed PA Cafe %s\n  %s\n' "$revision" "$target"
if [[ -n "$backup" ]]; then printf 'Previous bundle: %s/pacafe-desktop\n' "$backup"; fi
if "$open_tab" && [[ -n "$herdr" ]]; then
  if show_tab; then
    printf 'Opening PA Cafe in Herdr Desktop. If there is no local Space, follow the prompt in PA Cafe Settings.\n'
  else
    warn 'The mod was installed, but the PA Cafe tab could not open. Try ./install.sh --show after opening Herdr.'
  fi
elif [[ -n "$herdr" ]]; then
  printf 'Run ./install.sh --show to open the PA Cafe tab.\n'
else
  printf 'Install Herdr Desktop, then run ./install.sh --show to open the PA Cafe tab.\n'
fi
