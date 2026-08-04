#!/bin/sh
set -eu

node server.js &
node_pid=$!

attempt=0
until wget -q -O /dev/null http://127.0.0.1:3000/ 2>/dev/null; do
  if ! kill -0 "$node_pid" 2>/dev/null; then
    wait "$node_pid"
    exit $?
  fi
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 50 ]; then
    echo "Next.js did not become ready before nginx startup." >&2
    exit 1
  fi
  sleep 0.1
done

exec "$@"
