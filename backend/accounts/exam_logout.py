from __future__ import annotations

from django.utils import timezone

from api import models as api_models
from accounts.permissions import user_in_groups
from variables.groups import GroupEnum

ADMIN = GroupEnum.ADMINISTRATOR.value
PROF = GroupEnum.PROFESSOR.value


def finish_active_exam_for_logout(user, exam_identifier) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user_in_groups(user, ADMIN, PROF):
        return False
    if exam_identifier in (None, ""):
        return False

    exam_qs = api_models.Exam.objects.select_related("lecture")
    exam_identifier = str(exam_identifier).strip()
    if not exam_identifier:
        return False

    if exam_identifier.isdigit():
        exam = exam_qs.filter(pk=int(exam_identifier)).first()
    else:
        exam = exam_qs.filter(uuid=exam_identifier).first()
    if exam is None:
        return False

    membership = (
        api_models.StudentInLecture.objects
        .filter(lecture=exam.lecture, student=user, is_delete=False)
        .first()
    )
    if membership is None:
        return False

    exam_user = (
        api_models.ExamUser.objects
        .filter(exam=exam, lecture_user=membership)
        .order_by("-id")
        .first()
    )
    if exam_user is None or exam_user.finished_at:
        return False

    exam_user.finished_at = timezone.now()
    exam_user.finished_by_user = True
    exam_user.save(update_fields=["finished_at", "finished_by_user"])
    return True
