from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from api import models

User = get_user_model()


@receiver(post_save, sender=User)
def attach_user_to_pending_lectures(sender, instance, created, **kwargs):
    """
    자동 회원가입 이후 학번으로 미리 추가된 수강생 자리와 연결한다.
    """
    if not created:
        return

    student_code = instance.username
    pending_members = models.StudentInLecture.all_objects.filter(
        student__isnull=True,
        student_code=student_code,
    )

    for member in pending_members:
        member.student = instance
        member.is_delete = False
        member.save(update_fields=["student", "is_delete"])
