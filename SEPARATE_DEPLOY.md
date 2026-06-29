# Deployment Guide / 배포 가이드

This document is safe for a public repository. It uses placeholders instead of production domains, IP addresses, passwords, or tokens.

이 문서는 공개 저장소에 올릴 수 있도록 작성되었습니다. 실제 운영 도메인, IP, 비밀번호, 토큰 대신 placeholder만 사용합니다.

## 한국어

### 공개 배포 범위

이 공개 저장소의 배포 구성은 다음 컴포넌트만 포함합니다.

- `frontend`: Next.js application
- `backend`: Django REST API
- `postgres`: PostgreSQL database
- `pgbouncer`: PostgreSQL connection pooler, `compose.backend.yaml` only
- `redis`: Celery broker
- `redis-cache`: Django cache/session related Redis
- `redis-result`: grading result handoff Redis
- `nginx-proxy`: reverse proxy
- `certbot`: TLS certificate renewal

실제 채점 워커와 Docker sandbox 실행 코드는 공개 저장소에서 제외했습니다. backend는 Celery task를 발행할 수 있지만, task를 소비하는 worker는 비공개 배포 환경에서 별도로 연결해야 합니다.

### 환경 파일 준비

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp Frontend/src/.env.example Frontend/src/.env
```

절대 커밋하면 안 되는 파일:

- `.env`
- `inc.env`
- `backend/.env`
- `Frontend/src/.env`

### 필수 값

Root `.env`:

- `APP_DOMAIN`
- `CERTBOT_EMAIL`
- `DB_PASSWORD`
- `REDIS_PASSWORD`

`backend/.env`:

- `SECRET_KEY`
- `INTERNAL_API_TOKEN`
- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`

`Frontend/src/.env`:

- `NEXT_PUBLIC_BASE_API_URL`
- `NEXT_PUBLIC_AUTH_API_URL`
- `NEXT_PUBLIC_SITE_URL`

### 단일 호스트 배포

```bash
docker compose --env-file .env -f compose.yaml config -q
docker compose --env-file .env -f compose.yaml up -d --build
```

### backend 중심 분리 배포

```bash
docker compose --env-file .env -f compose.backend.yaml config -q
docker compose --env-file .env -f compose.backend.yaml up -d --build
```

### 외부 채점 워커 연결

공개 저장소에는 worker 구현이 없습니다. 비공개 worker를 붙일 때는 다음 계약을 맞춰야 합니다.

- backend와 동일한 `INTERNAL_API_TOKEN` 사용
- Celery broker URL은 backend의 `CELERY_BROKER_URL`과 동일한 Redis를 사용
- 결과 handoff는 backend의 `GRADE_RESULT_REDIS_URL` 또는 동일한 `redis-result` Redis를 사용
- 내부 API 호출은 `X-Internal-Token` 헤더를 사용
- Redis를 외부 host에 노출해야 한다면 공개 인터넷이 아닌 private network 또는 firewall allowlist만 사용

### 운영 주의사항

- Redis 포트를 공개 인터넷에 노출하지 마세요.
- Docker socket을 사용하는 worker는 host root 권한과 동급으로 취급하세요.
- 운영 도메인, IP, OAuth secret, DB/Redis 비밀번호는 저장소에 커밋하지 마세요.
- private history에 노출된 값은 최신 커밋에서 삭제했더라도 반드시 rotate하세요.

---

## English

### Public Deployment Scope

This public repository deploys only the following components:

- `frontend`: Next.js application
- `backend`: Django REST API
- `postgres`: PostgreSQL database
- `pgbouncer`: PostgreSQL connection pooler, `compose.backend.yaml` only
- `redis`: Celery broker
- `redis-cache`: Redis for Django cache/session related data
- `redis-result`: Redis for grading result handoff
- `nginx-proxy`: reverse proxy
- `certbot`: TLS certificate renewal

The actual grading worker and Docker sandbox execution code are intentionally excluded. The backend can publish Celery tasks, but the worker that consumes them must be connected from a private deployment environment.

### Prepare Environment Files

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp Frontend/src/.env.example Frontend/src/.env
```

Never commit:

- `.env`
- `inc.env`
- `backend/.env`
- `Frontend/src/.env`

### Required Values

Root `.env`:

- `APP_DOMAIN`
- `CERTBOT_EMAIL`
- `DB_PASSWORD`
- `REDIS_PASSWORD`

`backend/.env`:

- `SECRET_KEY`
- `INTERNAL_API_TOKEN`
- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`

`Frontend/src/.env`:

- `NEXT_PUBLIC_BASE_API_URL`
- `NEXT_PUBLIC_AUTH_API_URL`
- `NEXT_PUBLIC_SITE_URL`

### Single-Host Deployment

```bash
docker compose --env-file .env -f compose.yaml config -q
docker compose --env-file .env -f compose.yaml up -d --build
```

### Backend-Centered Separated Deployment

```bash
docker compose --env-file .env -f compose.backend.yaml config -q
docker compose --env-file .env -f compose.backend.yaml up -d --build
```

### Connecting an External Grading Worker

The public repository does not include the worker implementation. A private worker must follow this contract:

- Use the same `INTERNAL_API_TOKEN` as the backend
- Use the same Redis broker as the backend `CELERY_BROKER_URL`
- Use `GRADE_RESULT_REDIS_URL` or the same `redis-result` Redis for result handoff
- Call internal APIs with the `X-Internal-Token` header
- If Redis must be reachable from another host, expose it only through a private network or a strict firewall allowlist

### Operational Notes

- Do not expose Redis ports to the public internet.
- Treat Docker socket access in workers as equivalent to host root access.
- Do not commit production domains, IP addresses, OAuth secrets, or DB/Redis passwords.
- Rotate every value that ever appeared in private history, even if it was removed from the latest commit.
