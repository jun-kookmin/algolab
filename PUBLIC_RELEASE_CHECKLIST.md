# Public Release Checklist / 공개 릴리즈 체크리스트

Use this checklist before pushing this repository to a public GitHub repository.

공개 GitHub 저장소에 push하기 전에 아래 항목을 확인하세요.

## 한국어

### 반드시 제거하거나 교체할 값

- private history에 한 번이라도 커밋된 모든 토큰과 비밀번호
- `INTERNAL_API_TOKEN`
- Redis 비밀번호
- DB 비밀번호
- OAuth client secret
- 실제 운영 도메인, 서버 IP, 방화벽 rule, Redis 접속 정보

### Git에 들어가면 안 되는 파일

- `.env`
- `inc.env`
- `backend/.env`
- `Frontend/src/.env`
- `backend/staticfiles/`
- `infra/redis/`
- `.idea/`
- `.codex`
- `.DS_Store`
- Redis dump/AOF 파일
- 로컬 seed/test/debug 스크립트

### 이 저장소에서 제외한 구현

- 실제 채점 워커 구현
- Docker sandbox 실행 코드
- 운영 환경 전용 worker 배포 스크립트
- 실서비스 reviewer mapping 또는 Discord webhook workflow

### 히스토리 정리

최신 커밋에서 파일을 삭제하는 것만으로는 충분하지 않습니다. 과거 커밋에 비밀값이 있었다면 private history를 그대로 공개 저장소에 push하면 안 됩니다.

권장 방식:

```bash
git checkout --orphan public-portfolio
git add .
git commit -m "Public portfolio release"
git remote add public <new-public-repo-url>
git push public public-portfolio:main
```

히스토리를 보존해야 한다면 `git filter-repo` 또는 BFG Repo-Cleaner를 사용하고, 노출된 값은 그래도 모두 rotate해야 합니다.

### 공개해도 되는 범위

- 강의/문제/제출 CRUD
- REST API serializer/view/permission 구조
- Celery task dispatch boundary
- header-only internal token validation
- Frontend 화면과 API client
- Docker Compose 기반 frontend/backend/DB/Redis/Nginx 구성

### 공개 전 확인 명령

```bash
git status --short --branch
git diff --check
rg -n -S "(BEGIN .*PRIVATE KEY|discord(app)?\\.com/api/webhooks|real-domain.example|real-secret)" .
```

---

## English

### Values That Must Be Removed Or Rotated

- Every token or password that ever appeared in private history
- `INTERNAL_API_TOKEN`
- Redis passwords
- Database passwords
- OAuth client secrets
- Production domains, server IPs, firewall rules, and Redis connection details

### Files That Must Stay Out Of Git

- `.env`
- `inc.env`
- `backend/.env`
- `Frontend/src/.env`
- `backend/staticfiles/`
- `infra/redis/`
- `.idea/`
- `.codex`
- `.DS_Store`
- Redis dump/AOF files
- Local seed/test/debug scripts

### Implementations Excluded From This Repository

- Actual grading worker implementation
- Docker sandbox execution code
- Production-only worker deployment scripts
- Real service reviewer mapping or Discord webhook workflows

### History Cleanup

Deleting files in the latest commit is not enough. If secrets existed in older commits, do not push the private history to a public repository.

Recommended approach:

```bash
git checkout --orphan public-portfolio
git add .
git commit -m "Public portfolio release"
git remote add public <new-public-repo-url>
git push public public-portfolio:main
```

If history must be preserved, use `git filter-repo` or BFG Repo-Cleaner and rotate every exposed value anyway.

### Safe To Keep Public

- Course/problem/submission CRUD
- REST API serializer/view/permission structure
- Celery task dispatch boundary
- Header-only internal token validation
- Frontend screens and API client
- Docker Compose based frontend/backend/DB/Redis/Nginx setup

### Pre-Publish Checks

```bash
git status --short --branch
git diff --check
rg -n -S "(BEGIN .*PRIVATE KEY|discord(app)?\\.com/api/webhooks|real-domain.example|real-secret)" .
```
