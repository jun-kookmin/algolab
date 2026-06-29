import uuid
from django.db import migrations, models


def populate_uuids(apps, schema_editor):
    model_names = [
        "Problem",
        "ProblemTemplate",
        "ProblemInOut",
        "ProblemChecker",
        "Section",
        "SectionProblem",
        "Exam",
        "ExamUser",
        "ExamProblem",
        "Lecture",
        "StudentInLecture",
        "ProblemSubmit",
        "ExamSubmit",
        "Board",
        "Post",
        "ProblemPost",
        "PostReply",
        "PostLecture",
    ]

    for name in model_names:
        Model = apps.get_model("api", name)
        for obj in Model.objects.filter(uuid__isnull=True):
            obj.uuid = uuid.uuid4()
            obj.save(update_fields=["uuid"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0015_merge_20251117_1524"),
    ]

    operations = [
        migrations.AddField(
            model_name="board",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="exam",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="examproblem",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="examuser",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="examsubmit",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="lecture",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="post",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="postlecture",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="postreply",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="problem",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="problemchecker",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="probleminout",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="problempost",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="problemtemplate",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="problemsubmit",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="section",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="sectionproblem",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="studentinlecture",
            name="uuid",
            field=models.UUIDField(db_index=True, default=None, editable=False, null=True),
        ),
        migrations.RunPython(populate_uuids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="board",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="exam",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="examproblem",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="examuser",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="examsubmit",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="lecture",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="post",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="postlecture",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="postreply",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="problem",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="problemchecker",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="probleminout",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="problempost",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="problemtemplate",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="problemsubmit",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="section",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="sectionproblem",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="studentinlecture",
            name="uuid",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
