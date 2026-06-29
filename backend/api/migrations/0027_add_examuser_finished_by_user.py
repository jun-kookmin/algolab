from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0026_post_is_noticed"),
    ]

    operations = [
        migrations.AddField(
            model_name="examuser",
            name="finished_by_user",
            field=models.BooleanField(
                default=False,
                db_column="FinishedByUser",
                verbose_name="사용자 종료 여부",
            ),
        ),
    ]
