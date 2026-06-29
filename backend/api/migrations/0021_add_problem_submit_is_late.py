from django.db import migrations, models
from django.db.models import F


def populate_is_late(apps, schema_editor):
    ProblemSubmit = apps.get_model("api", "ProblemSubmit")
    # due_date가 있고 제출시간이 마감 이후인 경우 late로 표시
    ProblemSubmit.objects.filter(
        section_problem__due_date__isnull=False,
        submission_time__gt=F("section_problem__due_date"),
    ).update(is_late=True)


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0020_alter_examuser_lecture_user_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="problemsubmit",
            name="is_late",
            field=models.BooleanField(db_column="IsLate", default=False, verbose_name="지각 제출 여부"),
        ),
        migrations.RunPython(populate_is_late, migrations.RunPython.noop),
    ]
