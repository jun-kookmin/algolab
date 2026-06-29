from collections import defaultdict
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from api import models
from drf_spectacular.utils import extend_schema
from django.db.models import Count, Q, F
from django.shortcuts import get_object_or_404

#from ..pagination import SubmissionPagination

from ....serializers.submission import (
    ExamSubmissionCreateSerializer, ExamSubmissionListSerializer,
    ExamSubmissionProblemSerializer, ExamSubmissionDetailSerializer, ExamSubmissionCodeSerializer
)
from ....permissions import IsInstructorOfLecture, IsAttendStudent
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.contrib.auth import get_user_model
from accounts.permissions import (
    user_can_open_submission_target,
    user_in_groups,
    user_is_student_only,
)
from variables.groups import GroupEnum

ADMIN = GroupEnum.ADMINISTRATOR.value
PROF = GroupEnum.PROFESSOR.value
User = get_user_model()

SOLVED_STATUSES = ("CORRECT", "AC", "SV", "SUCCESS", "SOLVED")


@extend_schema(tags=['instructor-exam-submission'])
class ExamSubmissionViewSet(viewsets.GenericViewSet):
    lookup_field = "uuid"
    lookup_url_kwarg = "uuid"
    #pagination_class = SubmissionPagination
    non_student_target_message = "학생 계정만 조회할 수 있습니다."

    def get_permissions(self):
        if self.action == "exam_submissions" and self.request.method.upper() == "POST":
            return [IsAttendStudent()]

        instructor_actions = {
            "exam_submissions",
            "retrieve_exam",
            "get_exam_progress_list",
        }
        if self.action in instructor_actions:
            return [IsInstructorOfLecture()]
        if self.action in {"like_latest_exam"}:
            return [IsAuthenticated()]
        if self.action in {"get_exam_progress_detail", "get_exam_user_code"}:
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

    def _get_exam(self, exam_value):
        if exam_value is None:
            return None
        try:
            if str(exam_value).isdigit():
                return models.Exam.objects.get(id=exam_value)
            return models.Exam.objects.get(uuid=exam_value)
        except models.Exam.DoesNotExist:
            return None

    def _get_exam_from_query(self, request, lecture):
        exam_value = (
            request.query_params.get("exam_uuid")
            or request.query_params.get("exam_id")
            or request.query_params.get("exam")
        )
        if not exam_value:
            return None
        try:
            if str(exam_value).isdigit():
                return models.Exam.objects.get(id=exam_value, lecture=lecture)
            return models.Exam.objects.get(uuid=exam_value, lecture=lecture)
        except models.Exam.DoesNotExist:
            return None

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

    def get_queryset(self):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        exam_uuid = self.kwargs.get("exam_pk")

        lecture_obj = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture_obj:
            return models.ExamSubmit.objects.none()

        qs = (
            models.ExamSubmit.objects
            .select_related("problem__problem", "exam")
            .prefetch_related("language")
        )
        if lecture_obj:
            qs = qs.filter(exam__lecture=lecture_obj)
        if exam_uuid:
            exam_obj = self._get_exam(exam_uuid)
            if not exam_obj:
                return models.ExamSubmit.objects.none()
            qs = qs.filter(exam=exam_obj)

        qs = qs.annotate(
            attempt_count=Count(
                "exam__ExamSubmit_exam",
                filter=Q(
                    exam__ExamSubmit_exam__user=F("user"),
                    exam__ExamSubmit_exam__problem=F("problem"),
                ),
                distinct=True,
            )
        )
        return qs
        
    serializer_action_map = {
        #"list": ExamSubmissionListSerializer,
        #"retrieve": ExamSubmissionDetailSerializer,
        "create": ExamSubmissionCreateSerializer,
        #"update": SubmissionCreateSerializer,
        #"partial_update": SubmissionCreateSerializer,
        #"destroy": SubmissionCreateSerializer,
        "exam_submissions": {
            "GET":  ExamSubmissionListSerializer,
            "POST": ExamSubmissionCreateSerializer,
        },

        "retrieve_exam": ExamSubmissionDetailSerializer,

        "get_exam_progress_list":   ExamSubmissionProblemSerializer,
        "get_exam_progress_detail": ExamSubmissionProblemSerializer,
        
        "get_exam_user_code":     ExamSubmissionCodeSerializer,
    }

    default_serializer_class = ExamSubmissionCreateSerializer

    def get_serializer_class(self):
        mapping = getattr(self, "serializer_action_map", {})
        entry = mapping.get(self.action)

        if entry is None:
            return getattr(self, "default_serializer_class", super().get_serializer_class())

        if isinstance(entry, dict):
            method = self.request.method.upper()
            return entry.get(method, next(iter(entry.values())))

        return entry

    @action(detail=False, methods=["get", "post"], url_path="exam1")
    def exam_submissions(self, request, lecture_pk=None, lectures_pk=None, lectures_uuid=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"detail": "강의를 찾을 수 없습니다."}, status=404)
        if request.method.lower() == "get":
            qs = (
                models.ExamSubmit.objects
                .filter(exam__lecture=lecture)
                .select_related("user", "exam", "problem")
                .prefetch_related("language")
                .order_by("-submission_time", "-id")
            )
            serializer = self.get_serializer(qs, many=True)
            return Response(serializer.data)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(ExamSubmissionDetailSerializer(instance).data)

    @action(detail=True, methods=["get"], url_path="exam-detail")
    def retrieve_exam(self, request, uuid=None, lecture_pk=None, lectures_pk=None, lectures_uuid=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"detail": "강의를 찾을 수 없습니다."}, status=404)
        instance = (
            models.ExamSubmit.objects
            .select_related("user", "exam", "problem")
            .prefetch_related("language")
            .get(uuid=uuid, exam__lecture=lecture)
        )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
  
       
    # GET api/v1/instructor/lectures/{lid}/submissions/exam/exam
    @action(detail=False, methods=["get"], url_path="exam")
    def get_exam_progress_list(self, request, lecture_pk=None, lectures_pk=None, lectures_uuid=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lite_param = str(request.query_params.get("lite", "")).lower()
        lite_mode = lite_param in {"1", "true", "yes", "y", "on"}

        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"error": "강의를 찾을 수 없습니다."}, status=404)
        exam_obj = self._get_exam_from_query(request, lecture)
        if (request.query_params.get("exam_uuid") or request.query_params.get("exam_id") or request.query_params.get("exam")) and not exam_obj:
            return Response({"error": "시험을 찾을 수 없습니다."}, status=404)
        students_qs = (
            models.StudentInLecture.objects
            .select_related("student")
            .filter(lecture=lecture, is_delete=False, student__isnull=False)
            .only("id", "student_id", "student_code", "student__id", "student__first_name", "student__last_name")
        )
        student_ids_qs = students_qs.values_list("student_id", flat=True)
        base_submits = models.ExamSubmit.objects.filter(
            exam__lecture=lecture,
            user_id__in=student_ids_qs,
            problem__is_delete=False,
            problem__problem__is_delete=False,
        )
        if exam_obj:
            base_submits = base_submits.filter(exam=exam_obj)

        attempt_map = {}
        solved_count_by_user = {}
        if not lite_mode:
            # 제출 횟수(문제별) 집계
            attempt_counts = (
                base_submits
                .values("user_id", "problem_id")
                .annotate(cnt=Count("id"))
            )
            attempt_map = {
                (row["user_id"], row["problem_id"]): row["cnt"] for row in attempt_counts
            }

            # 정답 문제 수(사용자별)
            solved_rows = (
                base_submits
                .filter(status__in=SOLVED_STATUSES)
                .values("user_id")
                .annotate(solved_count=Count("problem_id", distinct=True))
            )
            solved_count_by_user = {
                row["user_id"]: row["solved_count"] for row in solved_rows
            }

        # 문제별 최신 제출만 추출 (PostgreSQL DISTINCT ON)
        latest_select_fields = [
            "user_id",
            "problem_id",
            "uuid",
            "status",
            "submission_time",
            "ip",
            "score",
            "problem__uuid",
        ]
        if not lite_mode:
            latest_select_fields.extend(
                ["problem__problem__uuid", "problem__problem__problem_name"]
            )
        latest_submits_qs = (
            base_submits
            .values(*latest_select_fields)
            .order_by("user_id", "problem_id", "-submission_time", "-id")
            .distinct("user_id", "problem_id")
        )
        latest_submits = list(latest_submits_qs)
        serialized_submissions = []
        for sub_obj in latest_submits:
            base_payload = {
                "section_problem_uuid": str(sub_obj["problem__uuid"] or ""),
                "status": sub_obj["status"],
                "submission_time": sub_obj["submission_time"],
                "ip": sub_obj["ip"],
                "score": sub_obj["score"],
            }
            if lite_mode:
                serialized_submissions.append(base_payload)
            else:
                attempt_count = attempt_map.get((sub_obj["user_id"], sub_obj["problem_id"]), 0)
                serialized_submissions.append({
                    "uuid": str(sub_obj["uuid"]),
                    "problem_uuid": str(sub_obj["problem__problem__uuid"] or ""),
                    "section_problem_uuid": str(sub_obj["problem__uuid"] or ""),
                    "title": sub_obj["problem__problem__problem_name"] or "",
                    "score": sub_obj["score"],
                    "attempt_count": attempt_count,
                    "status": sub_obj["status"],
                    "submission_time": sub_obj["submission_time"],
                    "ip": sub_obj["ip"],
                })

        submits_by_user = defaultdict(list)
        for sub_obj, sub_data in zip(latest_submits, serialized_submissions):
            submits_by_user[sub_obj["user_id"]].append(sub_data)
            
        total_problem_count = (
            models.ExamProblem.objects.filter(
                exam=exam_obj, is_delete=False, problem__is_delete=False
            ).count()
            if exam_obj
            else models.ExamProblem.objects.filter(
                exam__lecture=lecture, is_delete=False, problem__is_delete=False
            ).count()
        )
        exam_user_by_student = {}
        if exam_obj:
            due_date = getattr(exam_obj, "due_date", None)
            now = timezone.now()
            exam_users = (
                models.ExamUser.objects
                .filter(exam=exam_obj, lecture_user__lecture=lecture, lecture_user__is_delete=False)
                .values(
                    "lecture_user__student_id",
                    "start_time",
                    "finished_at",
                    "finished_by_user",
                )
            )
            for eu in exam_users:
                student_id = eu.get("lecture_user__student_id")
                if student_id:
                    finished_at = eu["finished_at"]
                    if (
                        not eu.get("finished_by_user")
                        and not finished_at
                        and due_date is not None
                        and now >= due_date
                    ):
                        finished_at = due_date
                    exam_user_by_student[student_id] = {
                        "start_time": eu["start_time"],
                        "finished_at": finished_at,
                        "finished_by_user": eu["finished_by_user"],
                    }
        problem_ids = []
        problem_catalog_qs = models.ExamProblem.objects.filter(
            is_delete=False,
            problem__is_delete=False,
        )
        if exam_obj:
            problem_catalog_qs = problem_catalog_qs.filter(exam=exam_obj)
            problem_ids = list(
                problem_catalog_qs
                .order_by("id")
                .values_list("uuid", flat=True)
            )
            total_problem_count = len(problem_ids)
        else:
            problem_catalog_qs = problem_catalog_qs.filter(exam__lecture=lecture)
        problem_catalog = [
            {
                "section_problem_uuid": str(row["uuid"]),
                "title": str(row["problem__problem_name"] or ""),
                "exam_id": str(row["exam__uuid"] or row["exam_id"] or ""),
            }
            for row in (
                problem_catalog_qs
                .order_by("id")
                .values("uuid", "problem__problem_name", "exam_id", "exam__uuid")
            )
        ]
        progresses = []
        for st in students_qs:
            if st.student is None:
                continue
            student_submits = submits_by_user.get(st.student.id, [])
            total_count = total_problem_count
            exam_user = exam_user_by_student.get(st.student.id)
            progresses.append({
                "user_id": st.student.id,
                "student_number": st.student_code,
                "name": self._display_name(st.student),
                "solved_count": solved_count_by_user.get(st.student.id, 0),
                "total_count": total_count, # 전체 문제 수
                "total_problem_count" : total_problem_count, # 전체 문제 수 
                "problems": student_submits,
                "start_time": exam_user["start_time"] if exam_user else None,
                "finished_at": exam_user["finished_at"] if exam_user else None,
                "finished_by_user": bool(exam_user["finished_by_user"]) if exam_user else False,
            })
        payload = {
            "total": len(progresses),
            "size": len(progresses),
            "data": progresses,
            "problem_ids": [str(pid) for pid in problem_ids],
            "problem_catalog": problem_catalog,
        }
        return Response(payload)

    # GET api/v1/instructor/lectures/{lid}/submissions/exam/exam/{uid}
    @action(detail=False, methods=["get"], url_path="exam/(?P<user_id>[^/.]+)")
    def get_exam_progress_detail(self, request, user_id=None, lecture_pk=None, lectures_pk=None, lectures_uuid=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"error": "강의를 찾을 수 없습니다."}, status=404)
        if not user_id:
            return Response({"error": "user_id is required"}, status=400)
        exam_obj = self._get_exam_from_query(request, lecture)
        if (request.query_params.get("exam_uuid") or request.query_params.get("exam_id") or request.query_params.get("exam")) and not exam_obj:
            return Response({"error": "시험을 찾을 수 없습니다."}, status=404)
        if not self._can_view_user_progress(request, lecture, user_id):
            return Response({"detail": "해당 제출 정보에 접근할 권한이 없습니다."}, status=403)
        invalid_target_response = self._validate_submission_target(request, user_id)
        if invalid_target_response is not None:
            return invalid_target_response
        try:
            student_in_lecture = models.StudentInLecture.objects.select_related("student").get(
                lecture=lecture, student__id=user_id, is_delete=False
            )
        except models.StudentInLecture.DoesNotExist:
            return Response({"error": "학생 정보를 찾을 수 없습니다."}, status=404)
        if student_in_lecture.student is None:
            return Response({"error": "학생 정보가 없습니다."}, status=404)
        user = student_in_lecture.student
        submits = (
            models.ExamSubmit.objects
            .select_related("problem", "exam")
            .prefetch_related("language")
            .filter(
                exam__lecture=lecture,
                user=user,
                problem__is_delete=False,
                problem__problem__is_delete=False,
            )
            .annotate(
                attempt_count=Count(
                    "problem__ExamSubmit_problem",
                    filter=Q(
                        problem__ExamSubmit_problem__user=F("user"),
                        problem__ExamSubmit_problem__exam=F("exam"),
                    ),
                    distinct=True,
                )
            )
            .order_by("-submission_time", "-id")
        )
        if exam_obj:
            submits = submits.filter(exam=exam_obj)
        solved_count = submits.filter(status__in=SOLVED_STATUSES).values("problem_id").distinct().count()
        total_count = (
            models.ExamProblem.objects.filter(
                exam=exam_obj, is_delete=False, problem__is_delete=False
            ).count()
            if exam_obj
            else models.ExamProblem.objects.filter(
                exam__lecture=lecture, is_delete=False, problem__is_delete=False
            ).count()
        )
        serializer = ExamSubmissionDetailSerializer(submits, many=True)
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

    # GET /api/v1/instructor/lectures/{lid}/submissions/exam/{user_id}/users/{exam_problem_id}/
    @action(detail=False, methods=["get"], url_path="exam/(?P<user_id>[^/.]+)/users/(?P<exam_problem_id>[^/.]+)")
    def get_exam_user_code(self, request, lecture_pk=None, lectures_pk=None, lectures_uuid=None, exam_problem_id=None, user_id=None, **kwargs):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"detail": "강의를 찾을 수 없습니다."}, status=404)
        if not self._can_view_user_submission(request, lecture, user_id):
            return Response({"detail": "해당 제출 코드에 접근할 권한이 없습니다."}, status=403)
        invalid_target_response = self._validate_submission_target(request, user_id)
        if invalid_target_response is not None:
            return invalid_target_response

        exam_problem = get_object_or_404(
            models.ExamProblem.objects.filter(
                exam__lecture=lecture,
                is_delete=False,
                problem__is_delete=False,
            ),
            uuid=exam_problem_id,
        )

        qs = (
            models.ExamSubmit.objects
            .select_related("user", "exam", "problem")
            .prefetch_related("language")
            .filter(
                exam__lecture=lecture,
                problem=exam_problem,
                user_id=user_id
            )
            .order_by("-submission_time", "-id")
        )
        if not qs.exists():
            return Response(
                {
                    "lecture_uuid": str(lecture.uuid),
                    "exam_problem_uuid": str(exam_problem.uuid),
                    "count": 0,
                    "results": [],
                    "latest_like_count": 0,
                    "latest_view_count": 0,
                },
                status=200,
            )

        latest = qs.first()
        latest.refresh_from_db(fields=["view_count", "like_count"])

        serializer = ExamSubmissionCodeSerializer(qs, many=True, context={"request": request})
        is_privileged = user_in_groups(request.user, ADMIN, PROF)
        data = {
            "lecture_uuid": str(lecture.uuid),
            "exam_problem_uuid": str(exam_problem.uuid),
            "count": qs.count(),
            "results": serializer.data,
            "latest_like_count": latest.like_count,
            "latest_view_count": latest.view_count,
        }
        if is_privileged:
            data["user_id"] = int(user_id)
        return Response(data, status=200)

    @action(detail=False, methods=["post"], url_path="exam/(?P<user_id>[^/.]+)/users/(?P<exam_problem_id>[^/.]+)/like")
    def like_latest_exam(self, request, lecture_pk=None, lectures_pk=None, lectures_uuid=None, exam_problem_id=None, user_id=None, **kwargs):
        '''
        user의 exam 제출에 대한 좋아요만 반환하는 api
        좋아요만 반환하는 부분은 없기 때문에 사용하지 않을 api
        '''
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = self._get_lecture(lecture_uuid)
        if lecture_uuid and not lecture:
            return Response({"detail": "강의를 찾을 수 없습니다."}, status=404)
        if not self._can_like_submission(request, lecture):
            return Response({"detail": "해당 제출에 접근할 권한이 없습니다."}, status=403)

        latest = (
            models.ExamSubmit.objects
            .filter(
                exam__lecture=lecture,
                problem__uuid=exam_problem_id,
                user_id=user_id
            )
            .order_by("-submission_time", "-id")
            .first()
        )

        if latest is None:
            return Response({"detail": "제출 내역이 없습니다."}, status=404)

        models.ExamSubmit.objects.filter(id=latest.id).update(like_count=F("like_count") + 1)
        latest.refresh_from_db(fields=["like_count"])

        return Response(
            {
                "exam_submit_id": latest.id,
                "like_count": latest.like_count,
            },
            status=200,
        )
