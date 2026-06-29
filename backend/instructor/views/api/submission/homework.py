from collections import defaultdict
import hashlib
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from api import models
from drf_spectacular.utils import extend_schema
from django.db.models import Case, Count, F, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import get_user_model

#from ..pagination import SubmissionPagination

from ....serializers.submission import (
    SubmissionCreateSerializer, SubmissionListSerializer, HomeworkProgressProblemSerializer,
    SubmissionDetailSerializer, HomeworkSubmissionCodeSerializer
)
from ....permissions import IsInstructorOfLecture, IsAttendStudent, IsSectionProblemParticipantOrInstructor
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import (
    user_can_open_submission_target,
    user_in_groups,
    user_is_student_only,
)
from variables.groups import GroupEnum
from ....constants import language_index

ADMIN = GroupEnum.ADMINISTRATOR.value
PROF = GroupEnum.PROFESSOR.value
SOLVED_STATUSES = ("CORRECT", "AC", "SV")
SOLVED_VIEW_WINDOW_SECONDS = int(getattr(settings, "SOLVED_VIEW_WINDOW_SECONDS", 300))
User = get_user_model()


@extend_schema(tags=['instructor-homework-submission'])
class HomeworkSubmissionViewSet(viewsets.GenericViewSet):
    lookup_field = "uuid"
    lookup_url_kwarg = "uuid"
    #pagination_class = SubmissionPagination
    non_student_target_message = "학생 계정만 조회할 수 있습니다."

    def get_permissions(self):
        if self.action == "homework_submissions" and self.request.method.upper() == "POST":
            return [IsAttendStudent()]

        instructor_actions = {
            "homework_submissions",
            "retrieve_homework",
            "get_progress_list",
        }
        if self.action in instructor_actions:
            return [IsInstructorOfLecture()]
        if self.action in {"like_latest_homework"}:
            return [IsAuthenticated()]
        if self.action in {
            "get_problem_solved_codes",
            "increase_problem_solved_code_view",
            "increase_problem_solved_code_like",
        }:
            return [IsSectionProblemParticipantOrInstructor()]
        if self.action in {"get_progress_detail", "get_homework_user_code"}:
            return [IsAuthenticated()]

        return [IsAuthenticated()]

    def _lecture_uuid(self, kwargs):
        return (
            kwargs.get("lectures_uuid")
            or kwargs.get("lecture_uuid")
            or kwargs.get("lecture_pk")
            or kwargs.get("lectures_pk")
        )

    def _get_lecture(self, lecture_value):
        if lecture_value is None:
            return None
        try:
            return models.Lecture.objects.get(uuid=lecture_value)
        except models.Lecture.DoesNotExist:
            return None

    def _can_view_user_submission(self, request, lecture, user_id):
        if lecture is None:
            return False
        if user_in_groups(request.user, ADMIN):
            return True
        if user_in_groups(request.user, PROF):
            return lecture.instructor_id == request.user.id
        try:
            target_user_id = int(user_id)
        except (TypeError, ValueError):
            return False
        if request.user.id != target_user_id:
            return False
        return models.StudentInLecture.objects.filter(
            lecture=lecture,
            student_id=request.user.id,
            is_delete=False,
        ).exists()

    def _can_view_user_progress(self, request, lecture, user_id):
        if lecture is None:
            return False
        if user_in_groups(request.user, ADMIN):
            return True
        if user_in_groups(request.user, PROF):
            return lecture.instructor_id == request.user.id
        return models.StudentInLecture.objects.filter(
            lecture=lecture,
            student_id=request.user.id,
            is_delete=False,
        ).exists()

    def _can_like_submission(self, request, lecture):
        if lecture is None:
            return False
        if user_in_groups(request.user, ADMIN):
            return True
        if user_in_groups(request.user, PROF):
            return lecture.instructor_id == request.user.id
        return models.StudentInLecture.objects.filter(
            lecture=lecture,
            student_id=request.user.id,
            is_delete=False,
        ).exists()

    def _get_section_problem(self, lecture, section_problem_id):
        section_problem_qs = (
            models.SectionProblem.objects
            .select_related("problem", "section")
            .filter(
                section__lecture=lecture,
                is_delete=False,
            )
        )
        if section_problem_id and str(section_problem_id).isdigit():
            return get_object_or_404(section_problem_qs, pk=section_problem_id)
        return get_object_or_404(section_problem_qs, uuid=section_problem_id)

    def _display_name(self, user_obj):
        if not user_obj:
            return ""
        try:
            full_name = user_obj.get_full_name()
        except Exception:
            full_name = ""
        full_name = (full_name or "").strip()
        if full_name:
            return full_name
        return getattr(user_obj, "username", "") or ""

    def _get_target_user(self, user_id):
        if not user_id:
            return None
        return (
            User.objects
            .prefetch_related("groups")
            .filter(id=user_id)
            .first()
        )

    def _validate_submission_target(self, request, user_id):
        target_user = self._get_target_user(user_id)
        if target_user is None:
            return Response({"detail": "해당 유저가 존재하지 않습니다."}, status=404)
        if not user_can_open_submission_target(request.user, target_user):
            return Response({"detail": self.non_student_target_message}, status=403)
        return None

    def _get_actor(self, request):
        if not request.user.is_authenticated:
            return None
        return f"user:{request.user.id}"

    def _like_cache_key(self, submission_uuid, actor):
        raw = f"submission-like:{submission_uuid}:{actor}"
        return f"submission-like:{hashlib.md5(raw.encode('utf-8')).hexdigest()}"

    def _view_cache_key(self, submission_uuid, actor):
        raw = f"submission-view:{submission_uuid}:{actor}"
        return f"submission-view:{hashlib.md5(raw.encode('utf-8')).hexdigest()}"
    
    def get_queryset(self):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return models.ProblemSubmit.objects.none()
        qs = (
            models.ProblemSubmit.objects
            .select_related("user", "section", "section_problem__problem")
            .prefetch_related("language")
            .order_by("-submission_time", "-id")
        )
        if lecture:
            qs = qs.filter(section__lecture=lecture)
            
        qs = qs.annotate(
        attempt_count=Count(
            "section_problem__ProblemSubmit_sectionproblem",
            filter=Q(
                section_problem__ProblemSubmit_sectionproblem__user=F("user"),
                section_problem__ProblemSubmit_sectionproblem__is_late=False,
            )
        )
    )
        return qs
    
    serializer_action_map = {
        "list": SubmissionListSerializer,
        "retrieve": SubmissionDetailSerializer,
        "create": SubmissionCreateSerializer,
        #"update": SubmissionCreateSerializer,
        #"partial_update": SubmissionCreateSerializer,
        #"destroy": SubmissionCreateSerializer,
        
        "homework_submissions": {
            "GET":  SubmissionListSerializer,
            "POST": SubmissionCreateSerializer,
        },

        "retrieve_homework": SubmissionDetailSerializer,
        "get_progress_list":   HomeworkProgressProblemSerializer,
        "get_progress_detail": HomeworkProgressProblemSerializer,

        "get_homework_user_code": HomeworkSubmissionCodeSerializer,
    }

    default_serializer_class = SubmissionCreateSerializer

    def get_serializer_class(self):
        mapping = getattr(self, "serializer_action_map", {})
        entry = mapping.get(self.action)

        if entry is None:
            return getattr(self, "default_serializer_class", super().get_serializer_class())

        if isinstance(entry, dict):
            method = self.request.method.upper()
            return entry.get(method, next(iter(entry.values())))

        return entry

    @action(detail=False, methods=["get", "post"], url_path="homework")
    def homework_submissions(self, request, lecture_pk=None, lectures_pk=None, lectures_uuid=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"detail": "강의를 찾을 수 없습니다."}, status=404)
        if request.method.lower() == "get":
            lite_param = str(request.query_params.get("lite", "")).lower()
            lite_mode = lite_param in {"1", "true", "yes", "y", "on"}
            if lite_mode:
                return self.get_progress_list(
                    request,
                    lecture_pk=lecture_pk,
                    lectures_pk=lectures_pk,
                    lectures_uuid=lectures_uuid,
                    **kwargs,
                )
            qs = (
                models.ProblemSubmit.objects
                .filter(section__lecture=lecture)
                .select_related("user", "section", "section_problem__problem")
                .prefetch_related("language")
                .order_by("-submission_time", "-id")
            )
            serializer = self.get_serializer(qs, many=True)
            return Response(serializer.data)
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(SubmissionDetailSerializer(instance).data)

    @action(detail=True, methods=["get"], url_path="homework-detail")
    def retrieve_homework(self, request, uuid=None, lecture_pk=None, lectures_pk=None, lectures_uuid=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"detail": "강의를 찾을 수 없습니다."}, status=404)
        instance = (
            models.ProblemSubmit.objects
            .select_related("user", "section", "section_problem")
            .prefetch_related("language")
            .get(uuid=uuid, section__lecture=lecture)
        )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    # GET api/v1/instructor/lecture/{lid}/submissions/homework/
    @action(detail=False, methods=["get"], url_path="homework")
    def get_progress_list(self, request, lecture_pk=None, lectures_pk=None, lectures_uuid=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"error": "강의를 찾을 수 없습니다."}, status=404)
        lite_param = str(request.query_params.get("lite", "")).lower()
        lite_mode = lite_param in {"1", "true", "yes", "y", "on"}

        students_qs = (
            models.StudentInLecture.objects
            .select_related("student")
            .filter(
                lecture=lecture,
                is_delete=False,
                student__isnull=False,
            )
            .only("id", "student_id", "student_code", "student__id", "student__first_name", "student__last_name")
        )
        student_ids_qs = students_qs.values_list("student_id", flat=True)
        
        base_submits = models.ProblemSubmit.objects.filter(
            section__lecture=lecture,
            user_id__in=student_ids_qs,
            section_problem__is_delete=False,
            section_problem__problem__is_delete=False,
            section__is_delete=False,
        )

        attempt_map = {}
        solved_problem_ids_by_user = defaultdict(set)
        if not lite_mode:
            attempt_counts = (
                base_submits.filter(is_late=False)
                .values("user_id", "section_problem_id")
                .annotate(cnt=Count("id"))
            )
            attempt_map = {
                (row["user_id"], row["section_problem_id"]): row["cnt"]
                for row in attempt_counts
            }

            solved_rows = (
                base_submits.filter(status__in=SOLVED_STATUSES, is_late=False)
                .values("user_id", "section_problem_id")
                .distinct()
            )
            for row in solved_rows:
                solved_problem_ids_by_user[row["user_id"]].add(row["section_problem_id"])

        first_correct_attempt_map = {}
        if not lite_mode:
            first_correct_rows = list(
                base_submits
                .filter(is_late=False, status__in=SOLVED_STATUSES)
                .values("user_id", "section_problem_id", "judge_count")
                .order_by("user_id", "section_problem_id", "judge_count", "id")
                .distinct("user_id", "section_problem_id")
            )
            first_correct_attempt_map = {
                (row["user_id"], row["section_problem_id"]): int(row["judge_count"] or 0)
                for row in first_correct_rows
            }

        select_fields = [
            "id",
            "uuid",
            "user_id",
            "section_problem_id",
            "section_problem__uuid",
            "section_problem__problem__uuid",
            "section_problem__problem__problem_name",
            "status",
            "score",
            "judge_count",
            "is_late",
            "submission_time",
        ]

        priority = Case(
            When(is_late=False, status__in=SOLVED_STATUSES, then=Value(0)),
            When(is_late=False, then=Value(1)),
            default=Value(2),
            output_field=IntegerField(),
        )
        chosen = list(
            base_submits
            .values(*select_fields)
            .annotate(_homework_progress_priority=priority)
            .order_by(
                "user_id",
                "section_problem_id",
                "_homework_progress_priority",
                "-submission_time",
                "-id",
            )
            .distinct("user_id", "section_problem_id")
        )

        serialized_submissions = []
        for sub_obj in chosen:
            serialized_submissions.append({
                "uuid": str(sub_obj["uuid"] or sub_obj["section_problem_id"]),
                "problem_uuid": str(sub_obj["section_problem__problem__uuid"] or ""),
                "section_problem_uuid": str(sub_obj["section_problem__uuid"] or ""),
                "title": str(sub_obj["section_problem__problem__problem_name"] or ""),
                "score": sub_obj["score"],
                "attempt_count": attempt_map.get(
                    (sub_obj["user_id"], sub_obj["section_problem_id"]), 0
                ) if not lite_mode else 0,
                "first_correct_attempt_count": first_correct_attempt_map.get(
                    (sub_obj["user_id"], sub_obj["section_problem_id"]), 0
                ) if not lite_mode else 0,
                "ju_count": sub_obj["judge_count"] if not lite_mode else 0,
                "status": sub_obj["status"],
                "submission_time": sub_obj["submission_time"],
                "is_late": bool(sub_obj["is_late"]),
                "id": str(sub_obj["uuid"] or sub_obj["section_problem_id"]),
            })
        submits_by_user = defaultdict(list)
        for sub_obj, sub_data in zip(chosen, serialized_submissions):
            submits_by_user[sub_obj["user_id"]].append(sub_data)
            
        total_count = models.SectionProblem.objects.filter(
            section__lecture=lecture,
            is_delete=False,
            section__is_delete=False,
            problem__is_delete=False,
        ).count()
        problem_catalog = [
            {
                "section_problem_uuid": str(row["uuid"]),
                "title": str(row["problem__problem_name"] or ""),
            }
            for row in (
                models.SectionProblem.objects
                .filter(
                    section__lecture=lecture,
                    is_delete=False,
                    section__is_delete=False,
                    problem__is_delete=False,
                )
                .order_by("id")
                .values("uuid", "problem__problem_name")
            )
        ]
        progresses = []
        for s in students_qs:
            if s.student is None:
                continue
            student_submits = submits_by_user.get(s.student.id, [])
            progresses.append({
                "user_id": s.student.id,
                "student_number": s.student_code,
                "solved_count": len(solved_problem_ids_by_user.get(s.student.id, set())),
                "total_count": total_count,
                "problems": student_submits,
            })
        payload = {
            "total": len(progresses),
            "size": len(progresses),
            "data": progresses,
            "problem_catalog": problem_catalog,
        }
        return Response(payload)
    
    # GET api/v1/instructor/lecture/{lid}/submissions/homework/{uid}
    @action(detail=False, methods=["get"], url_path="homework/(?P<user_id>[^/.]+)")
    def get_progress_detail(self, request, user_id=None, lecture_pk=None, lectures_pk=None, lectures_uuid=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"error": "강의를 찾을 수 없습니다."}, status=404)
        if not user_id:
            return Response({"error": "user_id is required"}, status=400)
        if not self._can_view_user_progress(request, lecture, user_id):
            return Response({"detail": "해당 제출 정보에 접근할 권한이 없습니다."}, status=403)
        invalid_target_response = self._validate_submission_target(request, user_id)
        if invalid_target_response is not None:
            return invalid_target_response
        try:
            student_in_lecture = models.StudentInLecture.objects.select_related("student").get(
                lecture=lecture, 
                student__id=user_id, 
                is_delete=False
            )
        except models.StudentInLecture.DoesNotExist:
            return Response({"error": "학생 정보를 찾을 수 없습니다."}, status=404)
        
        user = student_in_lecture.student
        submits = (
            models.ProblemSubmit.objects
            .select_related("section_problem__problem", "section", "user")
            .prefetch_related("language")
            .filter(
                section__lecture=lecture,
                user=user,
                section_problem__is_delete=False,
                section_problem__problem__is_delete=False,
                section__is_delete=False,
            )
            .annotate(
                attempt_count=Count(
                    "section_problem__ProblemSubmit_sectionproblem",
                    filter=Q(
                        section_problem__ProblemSubmit_sectionproblem__user=F("user"),
                        section_problem__ProblemSubmit_sectionproblem__is_late=False,
                    )
                )
            )
        )
        solved_count = submits.filter(status="CORRECT", is_late=False).values("section_problem_id").distinct().count()
        total_count = models.SectionProblem.objects.filter(
            section__lecture=lecture,
            is_delete=False,
            section__is_delete=False,
            problem__is_delete=False,
        ).count()
        
        serializer = HomeworkProgressProblemSerializer(submits, many=True)
        problems = serializer.data
        if not self._can_view_user_submission(request, lecture, user_id):
            for item in problems:
                item["code"] = ""
                item["code_length"] = 0
        is_privileged = user_in_groups(request.user, ADMIN, PROF)
        payload = {
            "user_id": user.id,
            "student_number": student_in_lecture.student_code,
            "name": self._display_name(student_in_lecture.student),
            "solved_count": solved_count,
            "total_count": total_count,
            "problems": problems,
        }
        return Response(payload)

    # GET /api/v1/instructor/lectures/{lid}/submissions/homework/{user_id}/users/{section_problem_id}/
    @action(detail=False, methods=["get"], url_path="homework/(?P<user_id>[^/.]+)/users/(?P<section_problem_id>[^/.]+)")
    def get_homework_user_code(self, request, lecture_pk=None, lectures_pk=None, lectures_uuid=None, section_problem_id=None, user_id=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"detail": "강의를 찾을 수 없습니다."}, status=404)
        if not self._can_view_user_submission(request, lecture, user_id):
            return Response({"detail": "해당 제출 코드에 접근할 권한이 없습니다."}, status=403)
        invalid_target_response = self._validate_submission_target(request, user_id)
        if invalid_target_response is not None:
            return invalid_target_response

        section_problem = get_object_or_404(
            models.SectionProblem.objects.filter(
                section__lecture=lecture,
                is_delete=False,
                section__is_delete=False,
                problem__is_delete=False,
            ),
            uuid=section_problem_id,
        )

        qs = (
            models.ProblemSubmit.objects
            .select_related("user", "section", "section_problem")
            .prefetch_related("language")
            .filter(
                section__lecture=lecture,
                section_problem=section_problem,
                user_id=user_id
            )
            .order_by("-submission_time", "-id")
        )

        if not qs.exists():
            return Response(
                {
                    "lecture_uuid": str(lecture.uuid),
                    "user_id": int(user_id),
                    "section_problem_uuid": str(section_problem.uuid),
                    "count": 0,
                    "results": [],
                    "latest_like_count": 0,
                    "latest_view_count": 0,
                },
                status=200,
            )

        latest = qs.first()
        latest.refresh_from_db(fields=["view_count", "like_count"])

        serializer = HomeworkSubmissionCodeSerializer(qs, many=True, context={"request": request})
        is_privileged = user_in_groups(request.user, ADMIN, PROF)

        data = {
            "lecture_uuid": str(lecture.uuid),
            "section_problem_uuid": str(section_problem.uuid),
            "count": qs.count(),
            "results": serializer.data,
            "latest_like_count": latest.like_count,
            "latest_view_count": latest.view_count,
        }
        if is_privileged:
            data["user_id"] = int(user_id)
        return Response(data, status=200)

    @action(
        detail=False,
        methods=["post"],
        url_path="homework/(?P<user_id>[^/.]+)/users/(?P<section_problem_id>[^/.]+)/like",
    )
    def like_latest_homework(self, request, lecture_pk=None, lectures_pk=None, lectures_uuid=None, section_problem_id=None, user_id=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"detail": "강의를 찾을 수 없습니다."}, status=404)
        if not self._can_like_submission(request, lecture):
            return Response({"detail": "해당 제출에 접근할 권한이 없습니다."}, status=403)

        latest = (
            models.ProblemSubmit.objects
            .filter(
                section__lecture=lecture,
                section_problem__uuid=section_problem_id,
                user_id=user_id
            )
            .order_by("-submission_time", "-id")
            .first()
        )

        if latest is None:
            return Response({"detail": "제출 내역이 없습니다."}, status=404)

        models.ProblemSubmit.objects.filter(id=latest.id).update(like_count=F("like_count") + 1)
        latest.refresh_from_db(fields=["like_count"])

        return Response(
            {
                "problem_submit_id": latest.id,
                "like_count": latest.like_count,
            },
            status=200,
        )

    # GET /api/v1/instructor/lectures/{lid}/submissions/homework/problem/{section_problem_id}/solved/
    @action(detail=False, methods=["get"], url_path="problem/(?P<section_problem_id>[^/.]+)/solved")
    def get_problem_solved_codes(self, request, lecture_pk=None, lectures_pk=None, lectures_uuid=None, section_problem_id=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"detail": "강의를 찾을 수 없습니다."}, status=404)
        section_problem = self._get_section_problem(lecture, section_problem_id)
        now = timezone.now()
        reveal_code = bool(section_problem and section_problem.due_date and now >= section_problem.due_date)

        solved_qs = (
            models.ProblemSubmit.objects
            .select_related("user")
            .prefetch_related("language")
            .filter(
                section__lecture=lecture,
                section_problem=section_problem,
                status__in=SOLVED_STATUSES,
            )
            .order_by("-submission_time", "-id")
        )
        enrolled_student_ids_qs = models.StudentInLecture.objects.filter(
            lecture=lecture,
            is_delete=False,
        ).values_list("student_id", flat=True)
        solved_qs = solved_qs.filter(user_id__in=enrolled_student_ids_qs)
        # 문제별 제출정보에는 사용자별 "가장 최근 정답 1건"만 노출한다.
        solved_list = list(solved_qs)
        latest_solved_by_user = {}
        for sub in solved_list:
            if sub.user_id not in latest_solved_by_user:
                latest_solved_by_user[sub.user_id] = sub
        latest_solved_submissions = list(latest_solved_by_user.values())

        all_submit_qs = models.ProblemSubmit.objects.filter(
            section__lecture=lecture,
            section_problem=section_problem,
            user_id__in=enrolled_student_ids_qs,
        )
        summary_stats = all_submit_qs.aggregate(
            total=Count("id"),
            correct=Count("id", filter=Q(status__in=SOLVED_STATUSES)),
            wrong=Count("id", filter=Q(status__in=["WRONG", "WA", "NOT_SUBMITTED", "NS"])),
            timeout=Count("id", filter=Q(status="TO")),
            memory_over=Count("id", filter=Q(status="MO")),
            compile_error=Count("id", filter=Q(status="CE")),
            runtime_error=Count("id", filter=Q(status="RE")),
            server_error=Count("id", filter=Q(status="SE")),
        )

        user_ids = list({obj.user_id for obj in latest_solved_submissions})
        student_code_map = dict(
            models.StudentInLecture.objects.filter(
                lecture=lecture,
                is_delete=False,
                student_id__in=user_ids,
            ).values_list("student_id", "student_code")
        )
        is_privileged = user_in_groups(request.user, ADMIN, PROF)
        viewer_id = request.user.id if request.user.is_authenticated else None

        results = []
        actor = self._get_actor(request)
        for sub in latest_solved_submissions:
            if sub.user_id not in student_code_map:
                continue
            like_key = self._like_cache_key(sub.uuid, actor)
            can_view_code = reveal_code or is_privileged or (viewer_id is not None and sub.user_id == viewer_id)
            code_value = sub.code if can_view_code else ""
            visible_fields = {
                "submission_uuid": str(sub.uuid),
                "user_id": sub.user_id,
                "status": sub.status,
                "score": sub.score,
                "code": code_value,
                "code_length": len(sub.code or ""),
                "can_view_code": can_view_code,
                "is_owner": viewer_id is not None and sub.user_id == viewer_id,
                "student_number": student_code_map.get(sub.user_id, ""),
                "language": [
                    language_index(l.language_name)
                    for l in sub.language.all()
                    if language_index(l.language_name) is not None
                ],
                "execution_time": sub.execution_time,
                "memory": sub.memory,
                "submission_time": sub.submission_time,
                "view_count": sub.view_count,
                "like_count": sub.like_count,
                "liked_by_me": bool(cache.get(like_key)),
            }

            if is_privileged:
                visible_fields.update({
                    "user_group": (getattr(sub.user, "group", "") or "").lower(),
                })
            # 비권한 수강생에게도 문제별 제출 현황의 학번은 노출하되,
            # 상세 페이지 이동에 필요한 user_id와 학번만 노출하고,
            # 이름/그룹 같은 추가 신원 정보는 계속 숨긴다.

            results.append(
                visible_fields
            )

        return Response(
            {
                "lecture_uuid": str(lecture.uuid),
                "section_uuid": str(section_problem.section.uuid),
                "section_problem_uuid": str(section_problem.uuid),
                "problem_uuid": str(section_problem.problem.uuid),
                "problem_title": section_problem.problem.problem_name,
                "count": len(results),
                "summary_stats": summary_stats,
                "results": results,
            },
            status=200,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="problem/(?P<section_problem_id>[^/.]+)/solved/(?P<submission_uuid>[^/.]+)/view",
    )
    def increase_problem_solved_code_view(self, request, lecture_pk=None, lectures_pk=None, lectures_uuid=None, section_problem_id=None, submission_uuid=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"detail": "강의를 찾을 수 없습니다."}, status=404)
        section_problem = self._get_section_problem(lecture, section_problem_id)

        submission = get_object_or_404(
            models.ProblemSubmit.objects.select_related("user"),
            uuid=submission_uuid,
            section__lecture=lecture,
            section_problem=section_problem,
            status__in=SOLVED_STATUSES,
        )
        actor = self._get_actor(request)
        if not actor:
            return Response({"detail": "로그인이 필요합니다."}, status=401)
        now = timezone.now()
        reveal_code = bool(section_problem and section_problem.due_date and now >= section_problem.due_date)
        viewer_id = request.user.id if request.user.is_authenticated else None
        is_privileged = user_in_groups(request.user, ADMIN, PROF)
        if not reveal_code and not is_privileged and viewer_id != submission.user_id:
            return Response({"detail": "마감 전에는 타인의 코드를 볼 수 없습니다."}, status=403)
        view_key = self._view_cache_key(submission.uuid, actor)
        should_increase = cache.add(view_key, 1, timeout=SOLVED_VIEW_WINDOW_SECONDS)
        if should_increase:
            models.ProblemSubmit.objects.filter(id=submission.id).update(view_count=F("view_count") + 1)
        submission.refresh_from_db(fields=["view_count", "like_count", "code"])
        return Response(
            {
                "submission_uuid": str(submission.uuid),
                "view_count": submission.view_count,
                "like_count": submission.like_count,
                "code": submission.code,
                "view_increased": bool(should_increase),
            },
            status=200,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="problem/(?P<section_problem_id>[^/.]+)/solved/(?P<submission_uuid>[^/.]+)/like",
    )
    def increase_problem_solved_code_like(self, request, lecture_pk=None, lectures_pk=None, lectures_uuid=None, section_problem_id=None, submission_uuid=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"detail": "강의를 찾을 수 없습니다."}, status=404)
        section_problem = self._get_section_problem(lecture, section_problem_id)

        submission = get_object_or_404(
            models.ProblemSubmit,
            uuid=submission_uuid,
            section__lecture=lecture,
            section_problem=section_problem,
            status__in=SOLVED_STATUSES,
        )
        actor = self._get_actor(request)
        if not actor:
            return Response({"detail": "로그인이 필요합니다."}, status=401)
        now = timezone.now()
        reveal_code = bool(section_problem and section_problem.due_date and now >= section_problem.due_date)
        viewer_id = request.user.id if request.user.is_authenticated else None
        is_privileged = user_in_groups(request.user, ADMIN, PROF)
        if not reveal_code and not is_privileged and viewer_id != submission.user_id:
            return Response({"detail": "마감 전에는 타인의 코드를 볼 수 없습니다."}, status=403)
        if viewer_id == submission.user_id:
            return Response({"detail": "자기 자신의 코드는 좋아요할 수 없습니다."}, status=400)
        like_key = self._like_cache_key(submission.uuid, actor)
        liked_by_me = bool(cache.get(like_key))
        if liked_by_me:
            cache.delete(like_key)
            models.ProblemSubmit.objects.filter(id=submission.id, like_count__gt=0).update(like_count=F("like_count") - 1)
            liked_by_me = False
        else:
            cache.set(like_key, 1, timeout=None)
            models.ProblemSubmit.objects.filter(id=submission.id).update(like_count=F("like_count") + 1)
            liked_by_me = True
        submission.refresh_from_db(fields=["like_count", "view_count"])

        return Response(
            {
                "submission_uuid": str(submission.uuid),
                "like_count": submission.like_count,
                "view_count": submission.view_count,
                "liked_by_me": liked_by_me,
            },
            status=200,
        )
