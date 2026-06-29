#!/usr/bin/env bash

set -euo pipefail

cd /app

if [[ "${ENABLE_INTERNAL_CRON:-1}" == "1" ]]; then
  cron_env_file=/tmp/backend-cron-env.sh
  umask 077
  : > "$cron_env_file"
  while IFS='=' read -r key value; do
    case "$key" in
      BASHOPTS|BASH_ARGC|BASH_ARGV|BASH_LINENO|BASH_SOURCE|BASH_VERSINFO|DIRSTACK|EUID|GROUPS|PPID|SHELLOPTS|UID)
        continue
        ;;
    esac
    printf 'export %s=%q\n' "$key" "$value" >> "$cron_env_file"
  done < <(env)

  rm -f /var/run/crond.pid /var/run/cron.pid

  python3 manage.py crontab remove >/dev/null 2>&1 || true
  python3 manage.py crontab add

  cron
fi

exec gosu app "$@"
