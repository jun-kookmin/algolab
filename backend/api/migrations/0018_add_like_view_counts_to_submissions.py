from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0017_alter_studentinlecture_student"),
    ]

    operations = [
        migrations.AddField(
            model_name="problemsubmit",
            name="like_count",
            field=models.PositiveIntegerField(
                db_column="LikeCount", default=0, verbose_name="좋아요 수"
            ),
        ),
        migrations.AddField(
            model_name="problemsubmit",
            name="view_count",
            field=models.PositiveIntegerField(
                db_column="ViewCount", default=0, verbose_name="조회수"
            ),
        ),
        migrations.AddField(
            model_name="examsubmit",
            name="like_count",
            field=models.PositiveIntegerField(
                db_column="LikeCount", default=0, verbose_name="좋아요 수"
            ),
        ),
        migrations.AddField(
            model_name="examsubmit",
            name="view_count",
            field=models.PositiveIntegerField(
                db_column="ViewCount", default=0, verbose_name="조회수"
            ),
        ),
    ]
