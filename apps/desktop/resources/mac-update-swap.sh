#!/bin/sh
# Roastpilot's Mac update swap (docs/spec/install-and-update.md, Mac installer; ADR 0018).
# macOS only, and a shell script on purpose: it runs after the app has quit, so it can't be the
# app. Started detached by the app's last quit step:
#
#   mac-update-swap.sh <pid> <installed.app> <staged.app> <relaunch 0|1> <log> [wait seconds]
#
# Waits for <pid> to end, moves <installed.app> aside to <installed.app>.old, moves <staged.app>
# into its place, and deletes the old one. Any failure puts the old app back. Every step is
# appended to <log>; the last `result: ok` or `result: failed <why>` line is what the app reads at
# its next launch.
set -u

if [ "$#" -lt 5 ]; then
  echo "usage: $0 <pid> <installed.app> <staged.app> <relaunch 0|1> <log> [wait seconds]" >&2
  exit 2
fi

pid=$1
installed=$2
staged=$3
relaunch=$4
log=$5
wait_seconds=${6:-30}
old="$installed.old"
PATH="${PATH:-}:/usr/bin:/bin:/usr/sbin:/sbin"

say() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$log"
}

fail() {
  say "result: failed $*"
  exit 1
}

say "staged: $staged"
say "installing over: $installed (pid $pid, relaunch $relaunch)"

case "$pid" in '' | *[!0-9]*) fail "not a process id: $pid" ;; esac
case "$wait_seconds" in '' | *[!0-9]*) fail "not a number of seconds: $wait_seconds" ;; esac
case "$installed" in *.app) ;; *) fail "not an app: $installed" ;; esac
case "$staged" in *.app) ;; *) fail "not an app: $staged" ;; esac

# The app is still saving and closing: wait for its process to end, polling five times a second.
ticks=$((wait_seconds * 5))
while kill -0 "$pid" 2>/dev/null; do
  if [ "$ticks" -le 0 ]; then
    fail "the app did not quit within $wait_seconds s"
  fi
  ticks=$((ticks - 1))
  sleep 0.2
done
say "the app has quit"

[ -d "$staged" ] || fail "the new app is missing: $staged"
[ -d "$installed" ] || fail "the installed app is missing: $installed"
# A leftover from an earlier swap: mv would put the app inside it.
if [ -e "$old" ]; then
  rm -rf "$old" || fail "could not delete an earlier $old"
fi

mv "$installed" "$old" || fail "could not move the installed app aside"
if ! mv "$staged" "$installed"; then
  # A move across disks can stop half way: drop the half copy, then put the old app back.
  if [ -e "$installed" ]; then
    rm -rf "$installed"
  fi
  if mv "$old" "$installed"; then
    say "rolled back: the old app is in place"
  else
    say "ROLLBACK FAILED: the old app is at $old"
  fi
  fail "could not move the new app into place"
fi
say "swapped"

# Downloaded by the app itself it carries no quarantine flag; this only makes sure.
xattr -dr com.apple.quarantine "$installed" 2>/dev/null || say "could not clear quarantine (ignored)"
rm -rf "$old" || say "could not delete $old (ignored)"
say "result: ok"

if [ "$relaunch" = 1 ]; then
  open -n "$installed" || say "could not start the new version"
fi
exit 0
