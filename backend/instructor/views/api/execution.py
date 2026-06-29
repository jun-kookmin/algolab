import json
import os
import ast
import uuid
import redis
from urllib.parse import urlparse, urlunparse
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.cache import cache
from django.utils import timezone
from django.db import transaction
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiExample, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from django.shortcuts import get_object_or_404
from api import models
from ...permissions import IsAuthenticatedOrInternal, _valid_internal_token
from rest_framework.permissions import IsAuthenticated
from ...serializers.submission import (
    ExamSubmissionCreateSerializer, SubmissionCreateSerializer
)
from ...serializers.execution import (
    ExecutionRunRequestSerializer, ExecutionRunResponseSerializer
)
from ...task_queue import enqueue_run, enqueue_exam, enqueue_homework
from django.contrib.auth import get_user_model
from accounts.permissions import user_in_groups
from instructor.pending_cleanup import is_auto_timeout_submission
from variables.groups import GroupEnum

User = get_user_model()
_GRADE_RESULT_REDIS_URL = os.getenv("GRADE_RESULT_REDIS_URL")
_REDIS_URL_FALLBACK = os.getenv("REDIS_URL", "redis://redis:6379/0")
_REDIS_SOCKET_CONNECT_TIMEOUT = float(os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT", "1.0"))
_REDIS_SOCKET_TIMEOUT = float(os.getenv("REDIS_SOCKET_TIMEOUT", "1.0"))
_RUN_RESULT_OWNER_TTL_SECONDS = int(os.getenv("RUN_RESULT_OWNER_TTL_SECONDS", "21600"))
_RUN_RESULT_OWNER_CACHE_PREFIX = "execution-run-owner"
_RUN_RESULT_TOKEN_TTL_SECONDS = int(os.getenv("RUN_RESULT_TOKEN_TTL_SECONDS", "21600"))
_RUN_RESULT_TOKEN_SALT = "execution-run-result-owner-v1"
ADMIN = GroupEnum.ADMINISTRATOR.value
PROF = GroupEnum.PROFESSOR.value


def _grade_result_redis():
    """
    채점 서버가 결과를 넣어두는 Redis 클라이언트.
    - GRADE_RESULT_REDIS_URL이 없으면 REDIS_URL 기반으로 DB=1로 보정.
    - decode_responses=True로 문자열 반환.
    """
    url = _GRADE_RESULT_REDIS_URL
    if not url:
        parsed = urlparse(_REDIS_URL_FALLBACK)
        # DB를 1로 교체
        path = f"/1"
        url = urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))
    return redis.Redis.from_url(
        url,
        decode_responses=True,
        socket_connect_timeout=_REDIS_SOCKET_CONNECT_TIMEOUT,
        socket_timeout=_REDIS_SOCKET_TIMEOUT,
    )


def _run_result_owner_cache_key(job_id: str) -> str:
    return f"{_RUN_RESULT_OWNER_CACHE_PREFIX}:{job_id}"


def _issue_run_result_token(job_id: str, user_id: int) -> str:
    payload = {
        "job_id": str(job_id),
        "user_id": str(user_id),
    }
    return signing.dumps(payload, salt=_RUN_RESULT_TOKEN_SALT)


def _verify_run_result_token(token: str, job_id: str, user_id: int) -> bool:
    if not token:
        return False
    try:
        payload = signing.loads(
            token,
            salt=_RUN_RESULT_TOKEN_SALT,
            max_age=_RUN_RESULT_TOKEN_TTL_SECONDS,
        )
    except (BadSignature, SignatureExpired, TypeError, ValueError):
        return False
    return (
        str(payload.get("job_id")) == str(job_id) and
        str(payload.get("user_id")) == str(user_id)
    )


def _split_command(command_text: str):
    """
    전처리 함수 
    language 테이블에 저장된 명령 문자열을 (실행 바이너리, 나머지 인자 리스트)로 분리한다.
    Private external graders expect builder_path/run_path and command lists separately.
    """
    try:
        parts = ast.literal_eval(command_text)
        if isinstance(parts, (list, tuple)) and parts:
            return str(parts[0]), list(parts[1:])
    except Exception:
        pass
    return "", []


def _checker_language_extension(language_name: str) -> str:
    ln = (language_name or "").lower().replace(" ", "")
    if ln in {"python", "py"}:
        return "py"
    if ln in {"python3", "py3"}:
        return "py"
    if ln in {"cpp", "c++", "cc", "cxx"}:
        return "cpp"
    if ln == "c":
        return "c"
    if ln == "java":
        return "java"
    return "txt"


def _resolve_checker_payload(problem, preferred_lang):
    if getattr(problem, "type", "") != "PC":
        return {}

    checker_obj = None
    try:
        checker_obj = problem.ProblemChecker_problem.first()
    except Exception:
        checker_obj = None

    if not checker_obj or not (checker_obj.code and str(checker_obj.code).strip()):
        return {}

    # TODO: 체커 언어 저장/조회 흐름이 안정화되면 아래 기존 선택 로직을 복구하고
    # 임시 C++ 강제 선택 핫픽스를 제거한다.
    # checker_languages = []
    # try:
    #     checker_languages = list(checker_obj.checker_language.all())
    # except Exception:
    #     checker_languages = []
    #
    # selected_lang = None
    # if checker_languages:
    #     if preferred_lang:
    #         for lang in checker_languages:
    #             if lang.id == preferred_lang.id:
    #                 selected_lang = lang
    #                 break
    #     if not selected_lang:
    #         selected_lang = checker_languages[0]
    # elif preferred_lang:
    #     # checker_language 미설정 데이터는 제출 언어를 우선 사용한다.
    #     selected_lang = preferred_lang
    #
    # if not selected_lang:
    #     try:
    #         selected_lang = problem.language.all().first()
    #     except Exception:
    #         selected_lang = None

    selected_lang = models.Language.objects.filter(
        language_name__iexact="C++",
        is_delete=False,
    ).first()

    if not selected_lang:
        return {}

    compile_path, compile_cmd = _split_command(getattr(selected_lang, "build_command", ""))
    run_path, run_cmd = _split_command(getattr(selected_lang, "grade_command", ""))

    if not compile_path or not run_path:
        return {}

    ext = _checker_language_extension(getattr(selected_lang, "language_name", "txt"))
    checker_filename = f"checker.{ext}"

    return {
        "checker__language__extension": ext,
        "checker__language__compile_path": compile_path,
        "checker__language__compile_command": compile_cmd,
        "checker__language__run_path": run_path,
        "checker__language__run_command": run_cmd,
        "checker__language__submit_code": {checker_filename: checker_obj.code},
    }


def _coerce_submission_code_map(raw_code):
    """제출 코드 보관 문자열을 파일맵으로 정규화한다."""
    if raw_code is None:
        return {}

    if isinstance(raw_code, dict):
        code_map = {}
        for filename, content in raw_code.items():
            if not isinstance(filename, str):
                continue
            filename = filename.strip()
            if not filename:
                continue
            if content is None:
                code_map[filename] = ""
            else:
                code_map[filename] = str(content)
        return code_map

    if isinstance(raw_code, str):
        normalized = raw_code.strip()
        if not normalized:
            return {}
        try:
            parsed = json.loads(normalized)
        except json.JSONDecodeError:
            return {"__raw__": normalized}

        if isinstance(parsed, dict):
            code_map = {}
            for filename, content in parsed.items():
                if not isinstance(filename, str):
                    continue
                filename = filename.strip()
                if not filename:
                    continue
                if content is None:
                    code_map[filename] = ""
                else:
                    code_map[filename] = str(content)
            return code_map

        return {"__raw__": normalized}

    return {"__raw__": str(raw_code)}


def _is_uuid_like(value) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except Exception:
        return False


def _is_privileged(user_obj):
    return bool(user_obj and user_in_groups(user_obj, ADMIN, PROF))


def _can_access_lecture(user_obj, lecture):
    if not user_obj or not getattr(user_obj, "is_authenticated", False):
        return False
    if user_in_groups(user_obj, ADMIN):
        return True
    if user_in_groups(user_obj, PROF):
        return bool(lecture and lecture.instructor_id == user_obj.id)
    if not lecture:
        return False
    return models.StudentInLecture.objects.filter(
        lecture=lecture,
        student_id=user_obj.id,
        is_delete=False,
    ).exists()


def _is_lecture_closed_for_section_problem(section_problem, user_obj):
    if not section_problem:
        return False
    if user_in_groups(user_obj, ADMIN):
        return False
    if user_obj and user_in_groups(user_obj, PROF) and getattr(section_problem, "section", None) is not None:
        if _can_access_lecture(user_obj, getattr(section_problem.section, "lecture", None)):
            return False
    lecture = getattr(section_problem.section, "lecture", None)
    end_date = getattr(lecture, "end_date", None) if lecture else None
    return bool(end_date and timezone.now() > end_date)


def _is_before_start_for_section_problem(section_problem, user_obj):
    if not section_problem:
        return False
    if _is_privileged(user_obj):
        return False
    start_date = getattr(section_problem, "start_date", None)
    return bool(start_date and timezone.now() < start_date)


def _submission_lecture(submission):
    if isinstance(submission, models.ExamSubmit):
        return getattr(submission.exam, "lecture", None)
    if isinstance(submission, models.ProblemSubmit):
        section_problem = getattr(submission, "section_problem", None)
        return getattr(getattr(section_problem, "section", None), "lecture", None)
    return None


def get_owned_submission(user, submission_uuid):
    if not _is_uuid_like(submission_uuid):
        return None

    for model_cls in (models.ProblemSubmit, models.ExamSubmit):
        try:
            submission = model_cls.objects.get(uuid=submission_uuid)
            if user.is_anonymous:
                return submission
            if user_in_groups(user, ADMIN):
                return submission
            if user_in_groups(user, PROF):
                lecture = _submission_lecture(submission)
                if _can_access_lecture(user, lecture):
                    return submission
                continue
            if submission.user_id == user.id:
                return submission
        except (ValueError, TypeError):
            continue
        except model_cls.DoesNotExist:
            continue
    return None


def persist_grade_result(submission, payload: dict):
    if is_auto_timeout_submission(submission):
        return submission, False

    fields = []
    if "status" in payload:
        submission.status = payload.get("status")
        fields.append("status")
    if "score" in payload:
        submission.score = payload.get("score")
        fields.append("score")
    if "excution_time" in payload:
        submission.execution_time = payload.get("excution_time")
        fields.append("execution_time")
    if "memory" in payload:
        submission.memory = payload.get("memory")
        fields.append("memory")
    if "error_message" in payload:
        submission.error_message = payload.get("error_message")
        fields.append("error_message")

    if fields:
        submission.save(update_fields=fields)
    return submission, True


def _build_persisted_grade_result_payload(submission):
    """
    Redis miss가 나더라도 이미 DB에 반영된 채점 결과를 그대로 돌려준다.
    """
    status_value = getattr(submission, "status", None)
    score_value = getattr(submission, "score", None)
    execution_time_value = getattr(submission, "execution_time", None)
    memory_value = getattr(submission, "memory", None)
    error_message_value = getattr(submission, "error_message", None)

    has_terminal_status = bool(status_value and str(status_value).upper() not in {"PENDING", "PD"})
    has_result_fields = any(
        value not in (None, "")
        for value in (score_value, execution_time_value, memory_value, error_message_value)
    )
    if not has_terminal_status and not has_result_fields:
        return None

    payload = {
        "status": status_value or "PENDING",
        "score": score_value if score_value is not None else 0,
        "excution_time": execution_time_value if execution_time_value is not None else 0,
        "memory": memory_value if memory_value is not None else 0,
        "error_message": error_message_value or "",
    }
    return payload

@extend_schema_view(
    run=extend_schema(
        tags=["instructor-execution"],
        summary="과제 코드 실행(run)",
        request=ExecutionRunRequestSerializer,
        responses={202: ExecutionRunResponseSerializer},
        examples=[
            OpenApiExample(
                "실행 요청 예시",
                value={
                "section_problem_uuid": "11111111-2222-3333-4444-555555555555",
                "language": "C++",
                "code": {
                    "main.py": "print('hello')",
                    "main1.py": "print('world')"
                },
                "input_data": "3 \n 5"
                }
            ),
        ],
    ),
    grade_exam=extend_schema(
        tags=["instructor-execution"],
        summary="시험 문제 채점 요청(grade_exam)",
        request=ExamSubmissionCreateSerializer,
        responses={202: OpenApiTypes.OBJECT},
        examples=[
            OpenApiExample(
                "시험 제출 예시",
                value={
                    "user": 1,
                    "exam_uuid": "1e40c292-1111-4b9e-8f2c-abcdef123456",
                    "exam_problem_uuid": "cbb2a95a-1111-4b5a-a8f7-fedcba654321",
                    "status": "PENDING",
                    "code" : "print('hello')",
                    "submission_count": 1,
                    "judge_count": 1,
                    "language": "C++",
                    "submission_time": "2025-11-11T20:32:15+09:00"
                }
            )
        ],
    ),
    grade_homework=extend_schema(
        tags=["instructor-execution"],
        summary="과제 채점 요청(grade_homework)",
        request=SubmissionCreateSerializer,
        responses={202: OpenApiTypes.OBJECT},
        examples=[
            OpenApiExample(
                "과제 제출 예시",
                value={
                    "section_uuid": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                    "section_problem_uuid": "5c69f070-1111-4b1a-8c77-abcdef123456",
                    "language": "python",
                    "code": "print('Hello, Algolab!')",
                    "limit_time": "2s",
                    "limit_memory": "256mb"
                },
            )
        ],
    ),
    grade_call=extend_schema(
        tags=["instructor-execution"],
        summary="제출 코드 및 언어정보 반환(grade_call)",
        parameters=[
            OpenApiParameter("submission_uuid", OpenApiTypes.STR, OpenApiParameter.QUERY, description="제출 UUID"),
            OpenApiParameter("problem_uuid", OpenApiTypes.STR, OpenApiParameter.QUERY, description="문제 UUID (선택)"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    ),
    get_testcases=extend_schema(
        tags=["instructor-execution"],
        summary="테스트케이스 조회(get_testcases)",
        parameters=[
            OpenApiParameter("problem_uuid", OpenApiTypes.STR, OpenApiParameter.QUERY, description="문제 UUID"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    ),
)
class ExecutionViewSet(viewsets.GenericViewSet):
    def get_permissions(self):
        if self.action in {"grade_call", "get_testcases", "grade_result"}:
            return [IsAuthenticatedOrInternal()]
        return [IsAuthenticated()]

    # api/v1/instructor/excution/run
    @action(detail=False, methods=["post"], url_path="run")
    def run(self, request, *args, **kwargs):
        sz = ExecutionRunRequestSerializer(data=request.data, context={"request": request})
        sz.is_valid(raise_exception=True)
        section_problem = sz.validated_data.get("section_problem")
        exam_problem = sz.validated_data.get("exam_problem")

        lecture = None
        if section_problem is not None:
            lecture = getattr(section_problem.section, "lecture", None)
        elif exam_problem is not None:
            lecture = getattr(getattr(exam_problem, "exam", None), "lecture", None)

        if not _can_access_lecture(request.user, lecture):
            return Response({"detail": "해당 강의 권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)
        if section_problem is not None and _is_before_start_for_section_problem(section_problem, request.user):
            return Response({"detail": "접근 가능 시간이 아닙니다."}, status=status.HTTP_403_FORBIDDEN)

        sz.validated_data["problem"]
        lang = sz.validated_data["lang"]
        code = sz.validated_data["code"]
        input_data = sz.validated_data.get("input_data")
        runcommand = getattr(lang, "grade_command", "")
        limit_time = sz.validated_data["limit_time"]
        limit_memory = sz.validated_data["limit_memory"]

        job_id = enqueue_run(
            language=lang.language_name,
            source=code,
            input_data=input_data,
            limit_time=limit_time,
            limit_memory=limit_memory,
            complie_command=lang.build_command,
            runcommand=runcommand,
            additional_time=lang.additional_time,
            additional_memory=lang.additional_memory,
        )
        cache.set(
            _run_result_owner_cache_key(job_id),
            request.user.id,
            timeout=_RUN_RESULT_OWNER_TTL_SECONDS,
        )
        run_token = _issue_run_result_token(job_id, request.user.id)

        return Response(
            ExecutionRunResponseSerializer({"job_id": job_id, "run_token": run_token}).data,
            status=status.HTTP_202_ACCEPTED
        )

    # /api/v1/instructor/execution/run/result/?job_id=uuid
    @action(detail=False, methods=["get"], url_path="run/result")
    def run_result(self, request, *args, **kwargs):
        job_id = request.query_params.get("job_id")
        if not job_id:
            return Response({"detail": "job_id가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        is_internal = _valid_internal_token(request)
        is_privileged = _is_privileged(request.user)
        if not is_internal and not is_privileged:
            owner_user_id = cache.get(_run_result_owner_cache_key(job_id))
            owner_matches = owner_user_id is not None and str(owner_user_id) == str(request.user.id)
            run_token = request.query_params.get("run_token") or request.headers.get("X-Run-Token")
            token_matches = _verify_run_result_token(run_token, job_id, request.user.id)
            if not owner_matches and not token_matches:
                return Response({"detail": "해당 실행 결과에 접근할 권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)

        r = _grade_result_redis()
        data = r.get(f"grade_container:{job_id}")
        if not data:
            return Response({"status": "PENDING"}, status=status.HTTP_202_ACCEPTED)

        try:
            payload = json.loads(data)
        except json.JSONDecodeError:
            return Response({"detail": "결과 파싱 실패"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(payload, status=status.HTTP_200_OK)
    
    # api/v1/instructor/excution/grade/exam
    @transaction.atomic
    @action(detail=False, methods=["post"], url_path="grade/exam")
    def grade_exam(self, request):
        serializer = ExamSubmissionCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        exam = serializer.validated_data.get("exam")
        if not _can_access_lecture(request.user, getattr(exam, "lecture", None)):
            return Response({"detail": "해당 시험에 접근할 권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)

        instance: models.ExamSubmit = serializer.save()

        exam_problem = get_object_or_404(
            models.ExamProblem.objects.select_related("problem"),
            id=instance.problem_id,
        )

        langs = exam_problem.problem.language.all()
        if not langs.exists():
            return Response(
                {"detail": "문제에 연결된 language가 없습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission_uuid = str(instance.uuid)
        problem_uuid = str(exam_problem.problem.uuid)
        transaction.on_commit(
            lambda: enqueue_exam(
                problem_id=instance.problem_id,
                submission_uuid=submission_uuid,
                problem_uuid=problem_uuid,
                limit_time=exam_problem.problem.limit_time,
                limit_memory=exam_problem.problem.limit_memory,
            )
        )

        return Response(
            {"submission_uuid": submission_uuid},
            status=status.HTTP_202_ACCEPTED,
        )
    
    # api/v1/instructor/excution/grade/homework    
    @transaction.atomic
    @action(detail=False, methods=["post"], url_path="grade/homework")
    def grade_homework(self, request):
        sz = SubmissionCreateSerializer(data=request.data, context={"request": request})
        sz.is_valid(raise_exception=True)
        section_problem = sz.validated_data.get("section_problem")
        if not _can_access_lecture(request.user, getattr(getattr(section_problem, "section", None), "lecture", None)):
            return Response({"detail": "해당 과제에 접근할 권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)
        if _is_before_start_for_section_problem(section_problem, request.user):
            return Response({"detail": "접근 가능 시간이 아닙니다."}, status=status.HTTP_403_FORBIDDEN)
        
        instance: models.ProblemSubmit = sz.save(
            submission_time=timezone.now(),
            status="PENDING"
        )
        section_problem_id = instance.section_problem_id if hasattr(instance, "section_problem_id") else None
        if not section_problem_id:
            return Response({"detail": "section_problem_id를 찾을 수 없습니다."}, status=400)

        submission_uuid = str(instance.uuid)
        problem_uuid = str(instance.section_problem.problem.uuid)
        transaction.on_commit(
            lambda: enqueue_homework(
                section_problem_id=section_problem_id,
                submission_uuid=submission_uuid,
                problem_uuid=problem_uuid,
                limit_time=sz.validated_data.get("limit_time"),
                limit_memory=sz.validated_data.get("limit_memory"),
            )
        )
        return Response({"submission_uuid": submission_uuid},
                        status=status.HTTP_202_ACCEPTED)

    # /api/v1/instructor/execution/grade/result/?submission_uuid=<uuid>
    @action(detail=False, methods=["get", "post"], url_path="grade/result")
    def grade_result(self, request):
        if request.method.lower() == "post":
            if not _valid_internal_token(request):
                return Response({"detail": "내부 API 전용 엔드포인트입니다."}, status=status.HTTP_403_FORBIDDEN)

            submission_uuid = request.data.get("submission_uuid")
            if not submission_uuid:
                return Response(
                    {"detail": "submission_uuid가 필요합니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payload = request.data.get("payload")
            if not isinstance(payload, dict):
                payload = {
                    key: request.data.get(key)
                    for key in ("status", "score", "excution_time", "memory", "error_message", "finished_at")
                    if key in request.data
                }
            if not payload:
                return Response({"detail": "반영할 payload가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

            submission = get_owned_submission(request.user, submission_uuid)
            if not submission:
                return Response({"detail": "제출을 찾을 수 없거나 권한이 없습니다."}, status=status.HTTP_404_NOT_FOUND)

            submission, persisted = persist_grade_result(submission, payload)
            if not persisted:
                locked_payload = _build_persisted_grade_result_payload(submission)
                return Response(locked_payload or payload, status=status.HTTP_200_OK)
            return Response(payload, status=status.HTTP_200_OK)

        submission_uuid = request.query_params.get("submission_uuid")
        if not submission_uuid:
            return Response(
                {"detail": "submission_uuid가 필요합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 제출 소유자 검증
        submission = get_owned_submission(request.user, submission_uuid)
        if not submission:
            return Response({"detail": "제출을 찾을 수 없거나 권한이 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        r = _grade_result_redis()
        submission_key = str(submission.uuid)
        data = r.get(f"grade_container:{submission_key}")
        if not data:
            persisted_payload = _build_persisted_grade_result_payload(submission)
            if persisted_payload is not None:
                return Response(persisted_payload, status=status.HTTP_200_OK)
            return Response({"status": "PENDING"}, status=status.HTTP_202_ACCEPTED)

        try:
            payload = json.loads(data)
        except json.JSONDecodeError:
            return Response({"detail": "결과 파싱 실패"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 채점 완료 결과를 DB에 반영 (과제/시험 제출 모두 확인)
        submission, persisted = persist_grade_result(submission, payload)
        if not persisted:
            locked_payload = _build_persisted_grade_result_payload(submission)
            return Response(locked_payload or payload, status=status.HTTP_200_OK)

        return Response(payload, status=status.HTTP_200_OK)

    
    # /api/v1/instructor/execution/request/grade/?submission_uuid=<uuid>
    @action(detail=False, methods=["get"], url_path="request/grade")
    def grade_call(self, request):
        if not _valid_internal_token(request):
            return Response({"detail": "내부 API 전용 엔드포인트입니다."}, status=status.HTTP_403_FORBIDDEN)

        submission_uuid = request.query_params.get("submission_uuid")

        if not submission_uuid:
            return Response(
                {"detail": "submission_uuid가 필요합니다."},
                status=status.HTTP_400_BAD_REQUEST
            )

        submission = get_owned_submission(request.user, submission_uuid)
        if not submission:
            return Response({"detail": "제출을 찾을 수 없거나 권한이 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        if isinstance(submission, models.ProblemSubmit):
            submission = models.ProblemSubmit.objects.select_related("section_problem__problem").get(id=submission.id)
            problem = submission.section_problem
        else:
            submission = models.ExamSubmit.objects.select_related("problem__problem").get(id=submission.id)
            problem = submission.problem 

        problem_langs = problem.problem.language.all()
        submission_langs = submission.language.all()

        if not submission_langs.exists():
            return Response(
                {"detail": "해당 제출에 연결된 언어가 없습니다."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not problem_langs.exists():
            return Response(
                {"detail": "문제에 설정된 언어가 없습니다."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 단일 보장
        matched_lang = problem_langs.filter(
            id__in=submission_langs.values_list("id", flat=True)
        ).first()
        if not matched_lang:
            return Response(
                {
                    "detail": f"제출 언어({', '.join(l.language_name for l in submission_langs)})가 "
                            f"문제 언어({', '.join(l.language_name for l in problem_langs)})와 일치하지 않습니다."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        def _ext(lang_name: str):
            m = {
                "python": "py",
                "py": "py",
                "c++": "cpp",
                "cpp": "cpp",
                "h":"cpp",
                "java": "java",
                "c": "c",
            }
            return m.get(lang_name.lower(), getattr(matched_lang, "extension", "txt"))

        code_map = _coerce_submission_code_map(submission.code)
        filename = f"main.{_ext(matched_lang.language_name)}"

        if code_map and "__raw__" not in code_map:
            code_data = code_map
        else:
            code_data = {filename: code_map.get("__raw__", "")}

        build_path, build_cmd = _split_command(getattr(matched_lang, "build_command", ""))
        run_path, run_cmd = _split_command(getattr(matched_lang, "grade_command", ""))

        language_info = {
            "language": matched_lang.language_name,
            "builder_path": build_path,
            "build_command": build_cmd,
            "run_path": run_path,
            "run_command": run_cmd,
            "additional_time": getattr(matched_lang, "additional_time", ""),
            "additional_memory": getattr(matched_lang, "additional_memory", ""),
        }
        prob_obj = problem.problem if hasattr(problem, "problem") else problem
        language_info.update(_resolve_checker_payload(prob_obj, matched_lang))

        data = {
            "submission_uuid": str(submission.uuid),
            "problem_uuid": str(prob_obj.uuid),
            "code": code_data,
            "language_info": language_info
        }

        return Response(data, status=status.HTTP_200_OK)
    
    # 테케 채점서버가 가져가는 코드 
    # /api/v1/instructor/execution/celery/testcase/?problem_uuid=1    
    @action(detail=False, methods=["get"], url_path="celery/testcase")
    def get_testcases(self, request):
        if not (_valid_internal_token(request) or user_in_groups(request.user, ADMIN, PROF)):
            return Response({"detail": "학생 사용자는 접근할 수 없습니다."}, status=status.HTTP_403_FORBIDDEN)

        problem_uuid = request.query_params.get("problem_uuid")

        if not problem_uuid: # 유효성 검사
            return Response(
                {"detail": "problem_uuid가 필요합니다."},
                status=status.HTTP_400_BAD_REQUEST
            )

        problem = get_object_or_404(models.Problem, uuid=problem_uuid)

        testcases = problem.ProblemInOut_problem.all()

        if not testcases.exists(): # 유효성 검사
            return Response(
                {"detail": "등록된 테스트케이스가 없습니다."},
                status=status.HTTP_404_NOT_FOUND
            )

        testcase_list = [
        {"input": t.input_code, "output": t.output_code}
        for t in testcases
        ]

        data = {
            "problem_uuid": str(problem.uuid),
            "problem_updated_at": problem.update_date.isoformat(),
            "update_date": problem.update_date.isoformat(),
            "test_case": testcase_list
        }
            

        return Response(data, status=status.HTTP_200_OK)
