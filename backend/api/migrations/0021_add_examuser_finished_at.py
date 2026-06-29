from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0020_alter_examuser_lecture_user_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="examuser",
            name="finished_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                db_column="FinishedAt",
                verbose_name="시험 종료 시간",
            ),
        ),
    ]
