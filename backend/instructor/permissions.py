import os
import uuid

from django.conf import settings
from rest_framework.permissions import BasePermission

from api import models
from accounts.permissions import user_in_groups
from variables.groups import GroupEnum

ADMIN = GroupEnum.ADMINISTRATOR.value
PROF = GroupEnum.PROFESSOR.value


def _is_admin(user):
    # admin 여부
    return user_in_groups(user, ADMIN)


def _is_admin_or_prof(user):
    # admin or professor
    return user_in_groups(user, ADMIN, PROF)


def _is_instructor_of_lecture(user, lecture):
    # admin or 해당 강의의 교수자
    return _is_admin(user) or (_is_admin_or_prof(user) and lecture.instructor_id == user.id)


def _is_attend_student(user, lecture):
    # 해당 lecture의 수강 student
    return models.StudentInLecture.objects.filter(
        lecture=lecture,
        student_id=user.id,
        is_delete=False,
    ).exists()


def _can_access_lecture(user, lecture):
    # 강의 접근 가능 여부  담당교수 or 관리자 or 실제 수강생인지 확인
    return _is_instructor_of_lecture(user, lecture) or _is_attend_student(user, lecture)


def _is_uuid_like(value):
    # 전달된 값이 uuid인지 검사
    try:
        uuid.UUID(str(value))
        return True
    except (TypeError, ValueError):
        return False


def _extract_lecture(view):
    # URL kwargs에서 강의 식별자를 찾아 Lecture 객체로 변환
    kwargs = getattr(view, "kwargs", {}) or {}
    lecture_value = (
        kwargs.get("lectures_uuid")
        or
        kwargs.get("lecture_pk")
        or kwargs.get("lectures_pk")
        or kwargs.get("lecture_uuid")
        or kwargs.get("uuid")
    )
    if not lecture_value:
        return None

    if _is_uuid_like(lecture_value):
        return models.Lecture.objects.filter(uuid=lecture_value, is_delete=False).first()

    try:
        return models.Lecture.objects.filter(pk=int(lecture_value), is_delete=False).first()
    except (TypeError, ValueError):
        return None


def _extract_obj_lecture(obj):
    # 연결된 Lecture 객체를 추출
    if isinstance(obj, models.Lecture):
        return obj
    if hasattr(obj, "lecture"):
        return obj.lecture
    if hasattr(obj, "exam") and hasattr(obj.exam, "lecture"):
        return obj.exam.lecture
    if hasattr(obj, "section") and hasattr(obj.section, "lecture"):
        return obj.section.lecture
    if hasattr(obj, "section_problem") and hasattr(obj.section_problem, "section"):
        return obj.section_problem.section.lecture
    if hasattr(obj, "problem") and hasattr(obj.problem, "exam") and hasattr(obj.problem.exam, "lecture"):
        return obj.problem.exam.lecture
    return None


def _valid_internal_token(request):
    # 내부 API 토큰 유효성 검사 (토큰 미설정 시 DEBUG 환경에서만 허용)
    configured = getattr(settings, "INTERNAL_API_TOKEN", None) or os.getenv("INTERNAL_API_TOKEN")
    if not configured:
        return bool(getattr(settings, "DEBUG", False))
    header_token = request.META.get("HTTP_X_INTERNAL_TOKEN")
    return header_token == configured


class IsInstructorOfLecture(BasePermission):
    # 강의 담당 교수(또는 관리자)만 허용
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        lecture = _extract_lecture(view)
        if not lecture:
            return True

        return (
            user_in_groups(request.user, ADMIN) or
            (user_in_groups(request.user, PROF) and lecture.instructor_id == request.user.id)
        )

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        lecture = _extract_obj_lecture(obj)
        return bool(lecture and _is_instructor_of_lecture(request.user, lecture))

class IsAttendStudent(BasePermission):
    # 강의 담당 교수/관리자 + 해당 강의 수강생 허용
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        lecture = _extract_lecture(view)
        if not lecture:
            return True

        return (
            user_in_groups(request.user, ADMIN, PROF) or
            models.StudentInLecture.objects.filter(
                lecture=lecture, student_id=request.user.id
            ).exists()
        )

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        lecture = _extract_obj_lecture(obj)
        if lecture is None:
            return False
        return _can_access_lecture(request.user, lecture)


class IsAdminOrProfessor(BasePermission):
    # 관리자 또는 교수 그룹 사용자만 허용
    def has_permission(self, request, view):
        return request.user.is_authenticated and _is_admin_or_prof(request.user)


class IsOwnerOrAdmin(BasePermission):
    # 리소스 작성자 본인 또는 관리자만 허용
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        return bool(getattr(obj, "user_id", None) == request.user.id or _is_admin(request.user))


class IsProblemOwnerOrAdmin(BasePermission):
    # 문제 리소스는 출제자 본인 또는 관리자만 수정/삭제 허용
    def has_permission(self, request, view):
        return request.user.is_authenticated and _is_admin_or_prof(request.user)

    def has_object_permission(self, request, view, obj):
        return bool(_is_admin(request.user) or getattr(obj, "maker_id", None) == request.user.id)


class IsAdmin(BasePermission):
    # 관리자 그룹 사용자만 허용
    def has_permission(self, request, view):
        return request.user.is_authenticated and _is_admin(request.user)


class IsAuthenticatedOrInternal(BasePermission):
    # 일반 인증 사용자 또는 내부 토큰 요청 허용
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated or _valid_internal_token(request))


class IsSelfOrPrivileged(BasePermission):
    # 본인(user_id 일치) 또는 관리자/교수 권한 사용자 허용
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        if _is_admin_or_prof(request.user):
            return True

        target_user_id = (getattr(view, "kwargs", {}) or {}).get("user_id")
        if not target_user_id:
            return True

        return str(request.user.id) == str(target_user_id)


class IsExamParticipantOrInstructor(BasePermission):
    # 시험이 속한 강의의 담당교수/관리자 또는 수강생만 허용
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        exam_value = (
            (getattr(view, "kwargs", {}) or {}).get("pk")
            or (getattr(view, "kwargs", {}) or {}).get("exam_pk")
        )
        if not exam_value:
            return False

        qs = models.Exam.objects.select_related("lecture")
        if _is_uuid_like(exam_value):
            exam = qs.filter(uuid=exam_value).first()
        else:
            try:
                exam = qs.filter(pk=int(exam_value)).first()
            except (TypeError, ValueError):
                return False
        if not exam:
            return False

        return _can_access_lecture(request.user, exam.lecture)


class IsSectionProblemParticipantOrInstructor(BasePermission):
    # 과제가 속한 강의의 담당교수/관리자 또는 수강생만 허용
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        kwargs = (getattr(view, "kwargs", {}) or {})
        section_problem_value = (
            kwargs.get("section_problem_id")
            or kwargs.get("section_problem_pk")
            or kwargs.get("pk")
        )
        if not section_problem_value:
            return False

        qs = models.SectionProblem.objects.select_related("section__lecture").filter(
            is_delete=False,
            section__lecture__is_delete=False,
        )

        if _is_uuid_like(section_problem_value):
            section_problem = qs.filter(uuid=section_problem_value).first()
        else:
            try:
                section_problem = qs.filter(pk=int(section_problem_value)).first()
            except (TypeError, ValueError):
                return False

        if not section_problem:
            return False

        return _can_access_lecture(request.user, section_problem.section.lecture)
