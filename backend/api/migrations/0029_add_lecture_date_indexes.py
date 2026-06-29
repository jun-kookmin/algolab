from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0028_add_lecture_curriculum_locked"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="lecture",
            index=models.Index(fields=["start_date", "is_delete"], name="lecture_start_del_idx"),
        ),
        migrations.AddIndex(
            model_name="lecture",
            index=models.Index(fields=["end_date", "is_delete"], name="lecture_end_del_idx"),
        ),
    ]
