from django.contrib.auth import get_user_model
import uuid as uuidlib

from rest_framework import serializers

from django.db import transaction

from api import models
from instructor.soft_delete import soft_delete_section_problems
from rest_framework.exceptions import ValidationError
from ..constants import language_index, normalize_language_name

from django.shortcuts import get_object_or_404

User = get_user_model()

# get /api/v1/lectures/{lid}/homework
class SectionSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(read_only=True)
    problem_count = serializers.SerializerMethodField()
    title = serializers.CharField(source="section_name")

    class Meta:
        model = models.Section
        fields = ["uuid", "title", "description", "week", "share", "is_delete", "problem_count"]

    def get_problem_count(self, obj):
        annotated_count = getattr(obj, "problem_count", None)
        if annotated_count is not None:
            return annotated_count
        return obj.SectionProblem_section.count()


class SectionStudentSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(read_only=True)
    title = serializers.CharField(source="section_name")

    class Meta:
        model = models.Section
        fields = ["uuid", "title", "description"]


# post /api/v1/lectures/{lid}/homework
class SectionCreateSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(read_only=True)
    name = serializers.CharField(source="section_name")

    class Meta:
        model = models.Section
        fields = ["uuid", "name", "description"]

        extra_kwargs = {
            'uuid': {'read_only': True}, 
        }
    
    def create(self, validated_data):
        kwargs = self.context["view"].kwargs
        lecture_uuid = (
            kwargs.get("lectures_uuid")
            or kwargs.get("lecture_uuid")
            or kwargs.get("lectures_pk")
            or kwargs.get("lecture_pk")
        )
        lecture = get_object_or_404(models.Lecture, uuid=lecture_uuid, is_delete=False)
        validated_data["is_delete"] = False

        exists = models.Section.objects.filter(
            lecture=lecture,
            section_name=validated_data.get("section_name", ""),
            is_delete=False,
        ).exists()
        if exists:
            raise ValidationError("이미 동일한 섹션 이름이 존재합니다.")
        
        # week 자동 증가
        last_section = (
            models.Section.objects.filter(lecture=lecture)
            .order_by("-week")
            .first()
        )
        validated_data["week"] = last_section.week + 1 if last_section else 1
        validated_data["lecture"] = lecture

        return super().create(validated_data)


class LegacyLanguagePKField(serializers.PrimaryKeyRelatedField):
    """과거 클라이언트에서 전달되는 언어 인덱스(0~3)를 DB PK로 매핑."""

    def to_internal_value(self, data):
        # bool은 정수 취급되지 않도록 먼저 처리
        if isinstance(data, bool):
            return super().to_internal_value(data)
        if data is None:
            return None
        if isinstance(data, str) and not data.strip():
            return None

        legacy_name = normalize_language_name(data)
        if legacy_name is not None:
            language = models.Language.objects.filter(
                language_name__iexact=legacy_name,
                is_delete=False,
            ).first()
            if language is not None:
                data = language.pk

        return super().to_internal_value(data)


# PUT /api/v1/lectures/{lid}/homework/{sid}
class SectionProblemRequestSerializer(serializers.Serializer):
    uuid = serializers.UUIDField(required=False)
    problem_uuid = serializers.CharField(required=False, allow_blank=True)
    problem_id = serializers.CharField(required=False)
    start_date = serializers.DateTimeField()
    end_date = serializers.DateTimeField()
    language = serializers.ListField(
        child=LegacyLanguagePKField(
            queryset=models.Language.objects.all()
        ),
        required=False,
    )
    points = serializers.IntegerField(required=False, min_value=0)

    def validate(self, data):
        if not data.get("uuid") and not data.get("problem_uuid") and not data.get("problem_id"):
            raise serializers.ValidationError(
                "problem_uuid (or problem_id) is required"
            )
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        if start_date is not None and end_date is not None and start_date >= end_date:
            raise serializers.ValidationError(
                "start_date must be earlier than end_date"
            )
        return data

    @staticmethod
    def _get_problem(problem_identifier):
        if problem_identifier is None:
            raise serializers.ValidationError("problem_uuid (or problem_id) is required")

        raw = str(problem_identifier).strip()
        if not raw:
            raise serializers.ValidationError("problem_uuid (or problem_id) is required")

        try:
            if raw.isdigit():
                return models.Problem.objects.get(pk=int(raw))

            problem_uuid = uuidlib.UUID(raw)
            return models.Problem.objects.get(uuid=problem_uuid)
        except ValueError:
            raise serializers.ValidationError("problem_uuid must be valid UUID or numeric problem_id")
        except models.Problem.DoesNotExist:
            raise serializers.ValidationError(f"problem not found: {problem_identifier}")

class SectionProblemUpdateSerializer(serializers.Serializer):
    id = serializers.CharField(required=False)
    title = serializers.CharField(required=False)
    problems = SectionProblemRequestSerializer(many=True)

    @transaction.atomic
    def update(self, section, validated_data):
        problems = validated_data.get("problems", [])

        existing_problems = {
            str(p.uuid): p
            for p in models.SectionProblem.all_objects.filter(section=section)
        }
        requested_ids = []

        for problem in problems:
            if problem.get("uuid"):
                sp = existing_problems.get(str(problem["uuid"]))
                if not sp:
                    raise ValidationError(f"invalid sectionproblem uuid: {problem['uuid']}")
                
                sp.start_date = problem["start_date"]
                sp.due_date = problem["end_date"]
                sp.is_delete = False
                sp.save(update_fields=["start_date", "due_date", "is_delete"])
            else:
                problem_identifier = problem.get("problem_uuid", problem.get("problem_id"))
                prob_obj = SectionProblemRequestSerializer._get_problem(problem_identifier)
                sp = models.SectionProblem.all_objects.filter(
                    section=section,
                    problem_id=prob_obj.id,
                    start_date=problem["start_date"],
                    due_date=problem["end_date"],
                ).first()
                if sp:
                    sp.is_delete = False
                    sp.save(update_fields=["is_delete"])
                else:
                    sp = models.SectionProblem.objects.create(
                        section=section,
                        problem=prob_obj,
                        start_date=problem["start_date"],
                        due_date=problem["end_date"],
                        score=problem.get("points") if "points" in problem else None,
                        is_delete=False,
                    )

            language_ids = problem.get("language") or []
            sp.language.set(language_ids)
            if "points" in problem:
                sp.score = problem["points"]
                sp.save(update_fields=["score"])
            requested_ids.append(str(sp.uuid))

        for sp_uuid, sp in existing_problems.items():
            if sp_uuid not in requested_ids and not sp.is_delete:
                soft_delete_section_problems(
                    models.SectionProblem.objects.filter(id=sp.id)
                )

        return section



# get /api/v1/lectures/{lid}/homework/{hid}
class ProblemInSectionSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(read_only=True)
    problem_uuid = serializers.UUIDField(source="problem.uuid", read_only=True)
    title = serializers.CharField(source="problem.problem_name")
    language = serializers.SerializerMethodField()
    start_date = serializers.DateTimeField(format="%Y-%m-%dT%H:%M")
    end_date = serializers.DateTimeField(format="%Y-%m-%dT%H:%M", source="due_date")
    solve_state = serializers.SerializerMethodField()
    attempt_count = serializers.IntegerField(read_only=True, default=0)
    first_correct_attempt_count = serializers.IntegerField(
        read_only=True,
        allow_null=True,
        default=None,
    )
    all_attempt_count = serializers.IntegerField(read_only=True, default=0)
    all_first_correct_attempt_count = serializers.IntegerField(
        read_only=True,
        allow_null=True,
        default=None,
    )

    class Meta:
        model = models.SectionProblem
        fields = [
            "uuid",
            "problem_uuid",
            "title",
            "language",
            "start_date",
            "end_date",
            "solve_state",
            "attempt_count",
            "first_correct_attempt_count",
            "all_attempt_count",
            "all_first_correct_attempt_count",
        ]
        

    def get_language(self, obj):
        idxs = [language_index(l.language_name) for l in obj.language.all()]
        return sorted([i for i in idxs if i is not None])

    def get_solve_state(self, obj):
        if getattr(obj, "has_solved", False):
            return "solved"
        if getattr(obj, "has_attempt", False):
            return "wrong"
        return "none"


class ProblemInSectionStudentSerializer(ProblemInSectionSerializer):
    class Meta(ProblemInSectionSerializer.Meta):
        fields = [
            "uuid",
            "problem_uuid",
            "title",
            "start_date",
            "end_date",
            "solve_state",
            "attempt_count",
            "first_correct_attempt_count",
            "all_attempt_count",
            "all_first_correct_attempt_count",
        ]
