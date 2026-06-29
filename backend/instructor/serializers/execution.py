import uuid
from rest_framework import serializers
from api.models import SectionProblem, ExamProblem
from ..constants import normalize_language_name


def _is_uuid_like(value) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except (TypeError, ValueError):
        return False


def _normalize_language_name(value: str) -> str:
    normalized = normalize_language_name(value)
    return (normalized or str(value or "")).lower()


class ExecutionRunRequestSerializer(serializers.Serializer):
    section_problem_uuid = serializers.UUIDField(required=False)
    section_problem_id = serializers.CharField(required=False)
    exam_problem_uuid = serializers.UUIDField(required=False)
    exam_problem_id = serializers.CharField(required=False)
    problem_uuid = serializers.UUIDField(required=False)
    language = serializers.CharField()
    code = serializers.JSONField()
    input_data = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )

    def validate(self, attrs):
        p_uuid = attrs.get("section_problem_uuid")
        sp_id_raw = attrs.get("section_problem_id")
        exam_problem_uuid = attrs.get("exam_problem_uuid")
        exam_problem_id_raw = attrs.get("exam_problem_id")
        problem_uuid = attrs.get("problem_uuid")
        lang_name = attrs.get("language")
        normalized_lang = _normalize_language_name(lang_name)

        # code를 문자열로 받으면 기본 파일명으로 변환
        code_obj = attrs.get("code")
        if isinstance(code_obj, str):
            attrs["code"] = {"main.py": code_obj}
        elif not isinstance(code_obj, dict):
            raise serializers.ValidationError({"code": "code는 문자열 또는 객체(dict)여야 합니다."})

        # section_problem_uuid가 없으면 problem_uuid로 보완
        sp = None
        exam_problem = None
        if p_uuid:
            try:
                sp = SectionProblem.objects.select_related("problem").get(uuid=p_uuid)
            except SectionProblem.DoesNotExist:
                raise serializers.ValidationError({
                    "section_problem_uuid": "존재하지 않는 section_problem_uuid 입니다."
                })
        elif sp_id_raw:
            qs = SectionProblem.objects.select_related("problem")
            if _is_uuid_like(sp_id_raw):
                sp = qs.filter(uuid=sp_id_raw).first()
            else:
                try:
                    sp = qs.filter(pk=int(sp_id_raw)).first()
                except (TypeError, ValueError):
                    sp = None
        if sp is None and (exam_problem_uuid or exam_problem_id_raw):
            exam_qs = ExamProblem.objects.select_related("problem")
            if exam_problem_uuid:
                exam_problem = exam_qs.filter(uuid=exam_problem_uuid).first()
            elif exam_problem_id_raw:
                if _is_uuid_like(exam_problem_id_raw):
                    exam_problem = exam_qs.filter(uuid=exam_problem_id_raw).first()
                else:
                    try:
                        exam_problem = exam_qs.filter(pk=int(exam_problem_id_raw)).first()
                    except (TypeError, ValueError):
                        exam_problem = None

        if sp is None and exam_problem is None and problem_uuid:
            sp = SectionProblem.objects.select_related("problem").filter(problem__uuid=problem_uuid).first()
            if not sp:
                exam_problem = ExamProblem.objects.select_related("problem").filter(problem__uuid=problem_uuid).first()

        if sp is None and exam_problem is None:
            raise serializers.ValidationError({
                "section_problem_uuid": "section_problem_uuid/section_problem_id 또는 exam_problem_uuid/exam_problem_id 또는 problem_uuid 중 하나가 필요합니다."
            })

        problem = sp.problem if sp is not None else exam_problem.problem
        langs = problem.language.all()
        if not langs.exists():
            raise serializers.ValidationError({
                "section_problem_id": "문제에 연결된 언어가 없습니다."
            })

        lang = None
        for l in langs:
            if _normalize_language_name(l.language_name) == normalized_lang:
                lang = l
                break

        if lang is None:
            raise serializers.ValidationError({
                "language": f"'{lang_name}' 언어는 이 문제에서 사용할 수 없습니다."
            })

        if sp is not None:
            attrs["section_problem"] = sp
        if exam_problem is not None:
            attrs["exam_problem"] = exam_problem
        attrs["lang"] = lang
        attrs["problem"] = problem
        attrs["limit_time"] = problem.limit_time
        attrs["limit_memory"] = problem.limit_memory
        return attrs

class ExecutionRunResponseSerializer(serializers.Serializer):
    job_id = serializers.UUIDField()
    run_token = serializers.CharField(required=False, allow_blank=False)
