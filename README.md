# Algolab

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)
![Django](https://img.shields.io/badge/Django-5.2-092E20?style=flat-square)
![DRF](https://img.shields.io/badge/DRF-3.16-red?style=flat-square)
![Celery](https://img.shields.io/badge/Celery-queue-37814A?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?style=flat-square)

적용 및 사용 문의는 rudwns7g@kookmin.ac.kr or issue 바랍니다.

실제 동작은 https://algolab.cs.kookmin.ac.kr 에서 확인 가능합니다.

> Public portfolio version. Private deployment values and the grading worker implementation are intentionally excluded.

Algolab은 프로그래밍 과제, 시험 기능을 제공하는 교육 플랫폼입니다. 해당 저장소는 포트폴리오 공개를 위한 버전이며, 실제 채점 워커와 운영 값은 포함하지 않습니다.

---

### 주요 기능

| 영역 | 기능 |
| --- | --- |
| 강의 관리 | 강의 생성, 섹션 구성, 수강생 관리, 활동 및 제출 현황 조회 |
| 문제 관리 | 문제 작성, 언어별 실행 설정, 시간/메모리 제한, 테스트케이스 메타데이터 관리 |
| 시험/과제 | 시험 잠금, 마감 처리, 제출 이력, 결과 조회 |
| 코드 작성 | Monaco Editor 기반 코드 작성, 사용자 입력 실행, 결과 확인 |
| 커뮤니티 | 문제별 게시글, 댓글, 공지, Markdown 편집 및 렌더링 |
| 인증/보안 | JWT 쿠키 인증, 단일 세션 제어, OAuth 연동 설정, 내부 API 토큰 검증 |
| 큐 연동 | Backend가 Celery task를 발행하고, 비공개 외부 채점 워커가 이를 소비하는 구조 |

### 공개 저장소 범위

이 저장소에서 제외한 것:

- 실제 채점 워커 구현
- Docker sandbox 실행 코드
- 실제 운영 도메인, IP, 토큰, 비밀번호
- Redis dump, Django collected static, IDE 설정, 로컬 테스트

### 아키텍처

```text
Client Browser
    |
    v
Next.js Frontend
    |
    v
Nginx Reverse Proxy
    |
    v
Django REST API
    |
    +--> PostgreSQL
    |
    +--> Redis Cache
    |
    +--> Redis Queue / Result Store
    |
    v
External Grading Worker
```

### 기술 스택

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, TanStack Query, Monaco Editor |
| Backend | Django 5.2, Django REST Framework, Simple JWT, django-allauth, drf-spectacular |
| Queue/Cache | Celery task dispatch, Redis |
| Database | PostgreSQL, PgBouncer |
| Infra | Docker Compose, Nginx, Certbot, Gunicorn |

### 코드 구조

```text
.
├── Frontend/src/              # Next.js frontend
├── backend/                   # Django REST backend
│   ├── accounts/              # auth, JWT, session, OAuth
│   ├── api/                   # shared domain models and admin resources
│   ├── backend/settings/      # Django settings
│   └── instructor/            # lecture, problem, submission, grading APIs
├── nginx-confs/               # reverse proxy templates
├── compose.yaml               # local/all-in-one public stack
├── compose.backend.yaml       # backend host deployment stack
├── SEPARATE_DEPLOY.md         # bilingual deployment guide
└── PUBLIC_RELEASE_CHECKLIST.md
```

### 실행 방법

환경 파일을 준비합니다.

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp Frontend/src/.env.example Frontend/src/.env
```

각 `.env` 파일의 placeholder 값을 로컬 환경에 맞게 변경합니다.

필수 값:

- `SECRET_KEY`
- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `INTERNAL_API_TOKEN`
- `APP_DOMAIN`
- `CERTBOT_EMAIL`

로컬 또는 단일 호스트 공개 구성:

```bash
docker compose --env-file .env -f compose.yaml up -d --build
```

분리 배포 구성:

```bash
docker compose --env-file .env -f compose.backend.yaml up -d --build
```

자세한 배포 설명은 [SEPARATE_DEPLOY.md](./SEPARATE_DEPLOY.md)를 확인하세요.

### 설계 포인트

- 프론트엔드는 Next.js API route proxy를 통해 backend와 통신합니다.
- 제출 실행과 채점은 Celery task boundary로 분리해 외부 worker로 확장할 수 있게 했습니다.
- 내부 worker API는 `X-Internal-Token` 헤더 기반으로만 검증하도록 정리했습니다.
- 공개 저장소에는 비밀값과 실제 채점 worker 구현을 포함하지 않습니다.

### 라이선스

Portfolio use only. 실제 서비스 운영 정보와 비공개 채점 구현은 별도 저장소에서 관리합니다.

---

## English

For adoption and usage inquiries, please contact rudwns7g@kookmin.ac.kr or open an issue.

You can check the live service at https://algolab.cs.kookmin.ac.kr.

> Public portfolio version. Private deployment values and the grading worker implementation are intentionally excluded.

Algolab is an education platform for programming assignments and exams. This repository is the public portfolio version, and it does not include the real grading worker or production values.

### Features

| Area | Features |
| --- | --- |
| Course management | Create courses, organize sections, manage students, inspect activity and submissions |
| Problem management | Author problems, configure language commands, set time/memory limits, manage testcase metadata |
| Exams/assignments | Exam locking, deadline handling, submission history, result lookup |
| Code editor | Monaco Editor based coding, custom input execution, result display |
| Community | Problem-specific posts, replies, notices, Markdown editing and rendering |
| Auth/security | JWT cookie auth, single-session control, OAuth settings, internal API token validation |
| Queue integration | The backend publishes Celery tasks consumed by a private external grading worker |

### Public Repository Scope

Excluded from this repository:

- Actual grading worker implementation
- Docker sandbox execution code
- Production domains, IPs, tokens, and passwords
- Redis dumps, Django collected static files, IDE metadata, local tests

### Architecture

```text
Client Browser
    |
    v
Next.js Frontend
    |
    v
Nginx Reverse Proxy
    |
    v
Django REST API
    |
    +--> PostgreSQL
    |
    +--> Redis Cache
    |
    +--> Redis Queue / Result Store
    |
    v
External Grading Worker
```

### Tech Stack

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, TanStack Query, Monaco Editor |
| Backend | Django 5.2, Django REST Framework, Simple JWT, django-allauth, drf-spectacular |
| Queue/Cache | Celery task dispatch, Redis |
| Database | PostgreSQL, PgBouncer |
| Infra | Docker Compose, Nginx, Certbot, Gunicorn |

### Project Structure

```text
.
├── Frontend/src/              # Next.js frontend
├── backend/                   # Django REST backend
│   ├── accounts/              # auth, JWT, session, OAuth
│   ├── api/                   # shared domain models and admin resources
│   ├── backend/settings/      # Django settings
│   └── instructor/            # lecture, problem, submission, grading APIs
├── nginx-confs/               # reverse proxy templates
├── compose.yaml               # local/all-in-one public stack
├── compose.backend.yaml       # backend host deployment stack
├── SEPARATE_DEPLOY.md         # bilingual deployment guide
└── PUBLIC_RELEASE_CHECKLIST.md
```

### Running

Prepare environment files:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp Frontend/src/.env.example Frontend/src/.env
```

Replace placeholder values in each `.env` file.

Required values:

- `SECRET_KEY`
- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `INTERNAL_API_TOKEN`
- `APP_DOMAIN`
- `CERTBOT_EMAIL`

Local or single-host public stack:

```bash
docker compose --env-file .env -f compose.yaml up -d --build
```

Separated backend deployment:

```bash
docker compose --env-file .env -f compose.backend.yaml up -d --build
```

See [SEPARATE_DEPLOY.md](./SEPARATE_DEPLOY.md) for deployment details.

### Design Notes

- The frontend talks to the backend through Next.js API route proxies.
- Submission execution and grading are isolated behind a Celery task boundary for external worker scaling.
- Internal worker APIs validate only the `X-Internal-Token` header.
- Secrets and the private grading worker implementation are not included in this public repository.

### License

Portfolio use only. Production deployment details and private grading implementation are managed separately.
