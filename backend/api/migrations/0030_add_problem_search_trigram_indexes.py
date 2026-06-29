from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0029_add_lecture_date_indexes"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE EXTENSION IF NOT EXISTS pg_trgm;\n"
                "CREATE INDEX IF NOT EXISTS problem_name_trgm_expr_idx ON \"problem\" USING GIN (UPPER(\"ProblemName\") gin_trgm_ops);\n"
                "CREATE INDEX IF NOT EXISTS problem_description_trgm_expr_idx ON \"problem\" USING GIN (UPPER(\"ProblemContent\") gin_trgm_ops);"
            ),
            reverse_sql=(
                "DROP INDEX IF EXISTS problem_name_trgm_expr_idx;\n"
                "DROP INDEX IF EXISTS problem_description_trgm_expr_idx;"
            ),
        )
    ]
