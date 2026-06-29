from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0027_add_examuser_finished_by_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="lecture",
            name="curriculum_locked",
            field=models.BooleanField(
                db_column="CurriculumLocked",
                default=False,
                verbose_name="커리큘럼 접근 제한",
            ),
        ),
    ]
