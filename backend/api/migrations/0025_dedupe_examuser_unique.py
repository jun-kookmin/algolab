from __future__ import annotations

import datetime

from django.db import migrations, models
from django.db.models import Count
from django.utils import timezone


def dedupe_exam_user(apps, schema_editor):
    ExamUser = apps.get_model("api", "ExamUser")
    manager = getattr(ExamUser, "all_objects", ExamUser._base_manager)

    min_dt = datetime.datetime(1970, 1, 1)
    if timezone.is_aware(timezone.now()):
        min_dt = timezone.make_aware(min_dt)

    duplicates = (
        manager.values("exam_id", "lecture_user_id")
        .annotate(cnt=Count("id"))
        .filter(cnt__gt=1, lecture_user_id__isnull=False)
    )

    for row in duplicates:
        qs = manager.filter(
            exam_id=row["exam_id"],
            lecture_user_id=row["lecture_user_id"],
        )
        users = list(qs)
        if len(users) <= 1:
            continue

        def sort_key(obj):
            finished_at = obj.finished_at
            start_time = obj.start_time
            return (
                1 if finished_at else 0,
                finished_at or start_time or min_dt,
                obj.id,
            )

        keep = max(users, key=sort_key)
        ids_to_delete = [u.id for u in users if u.id != keep.id]
        if ids_to_delete:
            manager.filter(id__in=ids_to_delete).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0024_alter_postreply_is_delete"),
    ]

    operations = [
        migrations.RunPython(dedupe_exam_user, reverse_code=migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="examuser",
            constraint=models.UniqueConstraint(
                fields=["exam", "lecture_user"],
                name="uniq_exam_user",
            ),
        ),
    ]
