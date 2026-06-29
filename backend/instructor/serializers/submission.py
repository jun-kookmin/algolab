from __future__ import annotations
import uuid
import json
import re
from django.contrib.auth import get_user_model
from django.db.models import Max
from rest_framework import serializers
from api import models
from .language import LanguageSimpleSerializer
from ..constants import language_index, normalize_language_name
from .problem import detect_language_from_code
from django.utils import timezone
from accounts.permissions import user_in_groups
from variables.groups import GroupEnum

User = get_user_model()


_LIMIT_VALUE_RE = re.compile(
    r"^\s*(?P<value>[+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:\s*(?P<unit>[a-zA-Z]+)?)\s*$",
    re.IGNORECASE,
)


_TIME_UNITS = {"ms", "millisecond", "milliseconds", "s", "sec", "secs", "second", "seconds"}
_MEMORY_UNITS = {"kb", "kib", "mb", "mib", "gb", "gib", "tb", "tib"}


def _normalize_limit_unit(value):
    if not isinstance(value, str):
        return ""
    return value.strip().lower()


def _coerce_positive_value(raw_value, field_name: str):
    if raw_value is None:
        return None

    if isinstance(raw_value, bool):
        raise serializers.ValidationError({field_name: f"{field_name} 값이 올바르지 않습니다."})

    if isinstance(raw_value, (int, float)):
        if raw_value <= 0:
            raise serializers.ValidationError({field_name: f"{field_name}은(는) 1 이상이어야 합니다."})
        return float(raw_value), "ms"

    s = str(raw_value).strip()
    if not s:
        return None

    match = _LIMIT_VALUE_RE.fullmatch(s)
    if not match:
        raise serializers.ValidationError({field_name: f"{field_name}는 숫자(예: 1000) 또는 단위가 있는 값(예: 1.5s)이어야 합니다."})

    value = float(match.group("value"))
    if value <= 0:
        raise serializers.ValidationError({field_name: f"{field_name}은(는) 1 이상이어야 합니다."})

    unit = _normalize_limit_unit(match.group("unit"))
    return value, unit


def _coerce_limit_time_ms(raw_value):
    parsed = _coerce_positive_value(raw_value, "limit_time")
    if parsed is None:
        return None

    value, unit = parsed
    unit = unit or "ms"
    if unit not in _TIME_UNITS:
        raise serializers.ValidationError({
            "limit_time": "limit_time 단위는 ms 또는 s만 허용됩니다."
        })

    if unit.startswith("s"):
        value *= 1000

    return max(1, int(value))


def _coerce_limit_memory_mb(raw_value):
    parsed = _coerce_positive_value(raw_value, "limit_memory")
    if parsed is None:
        return None

    value, unit = parsed
    unit = unit or "mb"
    if unit not in _MEMORY_UNITS:
        raise serializers.ValidationError({
            "limit_memory": "limit_memory 단위는 kb, mb, gb, tb만 허용됩니다."
        })

    if unit == "kb" or unit == "kib":
        value /= 1024
    elif unit in {"gb", "gib"}:
        value *= 1024
    elif unit in {"tb", "tib"}:
        value *= 1024 * 1024
    elif unit == "mb" or unit == "mib":
        pass

    return max(1, int(value))


def _normalize_submission_code(raw_code):
    if isinstance(raw_code, str):
        return raw_code

    if isinstance(raw_code, dict):
        normalized_files = {}
        for filename, value in raw_code.items():
            if not isinstance(filename, str):
                continue

            filename = filename.strip()
            if not filename:
                continue

            if isinstance(value, str):
                normalized_files[filename] = value
            elif value is None:
                normalized_files[filename] = ""
            else:
                normalized_files[filename] = str(value)

        return json.dumps(normalized_files, ensure_ascii=False)

    raise serializers.ValidationError({"code": "code는 문자열 또는 파일 맵(객체) 이어야 합니다."})


def _is_uuid_like(value) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except (TypeError, ValueError):
        return False

class SubmissionLanguageWriteField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        return super().to_internal_value(data)

class SubmissionLanguageReadField(LanguageSimpleSerializer):
    class Meta(LanguageSimpleSerializer.Meta):
        pass

# section_problem의 problem의 language의 language_name이랑 받은 lanuage랑 비교를 한다.
class SubmissionCreateSerializer(serializers.Serializer):
    section_uuid = serializers.UUIDField(required=False)
    section_id = serializers.CharField(required=False)
    section_problem_uuid = serializers.UUIDField(required=False)
    section_problem_id = serializers.CharField(required=False)
    language = serializers.CharField()
    code = serializers.JSONField()
    limit_time = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    limit_memory = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    def validate(self, attrs):
        section_uuid = attrs.get("section_uuid")
        section_id_raw = attrs.get("section_id")
        section_problem_uuid = attrs.get("section_problem_uuid")
        section_problem_id_raw = attrs.get("section_problem_id")
        lang_name = normalize_language_name(attrs["language"])
        if lang_name is None:
            raise serializers.ValidationError({
                "language": "지원하지 않는 언어 형식입니다."
            })

        section = None
        if section_uuid:
            section = models.Section.objects.filter(uuid=section_uuid).first()
        elif section_id_raw:
            if _is_uuid_like(section_id_raw):
                section = models.Section.objects.filter(uuid=section_id_raw).first()
            else:
                try:
                    section = models.Section.objects.filter(pk=int(section_id_raw)).first()
                except (TypeError, ValueError):
                    section = None
        if section is None:
            raise serializers.ValidationError({
                "section_uuid": "section_uuid 또는 section_id가 필요합니다."
            })

        section_problem = None
        section_problem_qs = models.SectionProblem.objects.select_related("problem", "section")
        if section_problem_uuid:
            section_problem = section_problem_qs.filter(uuid=section_problem_uuid).first()
        elif section_problem_id_raw:
            if _is_uuid_like(section_problem_id_raw):
                section_problem = section_problem_qs.filter(uuid=section_problem_id_raw).first()
            else:
                try:
                    section_problem = section_problem_qs.filter(pk=int(section_problem_id_raw)).first()
                except (TypeError, ValueError):
                    section_problem = None
        if section_problem is None:
            raise serializers.ValidationError({
                "section_problem_uuid": "section_problem_uuid 또는 section_problem_id가 필요합니다."
            })

        if section_problem.section_id != section.id:
            raise serializers.ValidationError({
                "section_problem_uuid": "section과 section_problem의 섹션이 일치하지 않습니다."
            })

        problem = section_problem.problem
        langs = list(problem.language.all())

        # 문제 언어가 비어있어도 템플릿에서 유추 가능한 언어가 있으면 허용
        if not langs:
            template_langs = set()
            for t in problem.ProblemTemplate_problem.all():
                filename = getattr(t, "template_name", "") or ""
                content = getattr(t, "template_content", "") or ""
                detected = detect_language_from_code(filename, content)
                if detected:
                    template_langs.add(detected)
            if template_langs:
                langs = list(
                    models.Language.objects.filter(
                        language_name__in=list(template_langs)
                    )
                )
                if langs:
                    problem.language.add(*langs)
            if not langs:
                raise serializers.ValidationError({"section_problem_id": "문제에 연결된 언어가 없습니다."})

        lang_obj = None
        for l in langs:
            if normalize_language_name(l.language_name) == lang_name:
                lang_obj = l
                break

        if lang_obj is None:
            # 템플릿 언어 기반 허용 (problem.language 누락 보정)
            template_langs = set()
            for t in problem.ProblemTemplate_problem.all():
                filename = getattr(t, "template_name", "") or ""
                content = getattr(t, "template_content", "") or ""
                detected = detect_language_from_code(filename, content)
                if detected:
                    detected = normalize_language_name(detected)
                    template_langs.add(detected.lower())
            if lang_name.lower() in template_langs:
                lang_obj = models.Language.objects.filter(
                    language_name__iexact=lang_name
                ).first()
                if lang_obj:
                    problem.language.add(lang_obj)

        if lang_obj is None:
            allowed_languages = [l.language_name for l in langs]
            raise serializers.ValidationError({
                "language": f"'{lang_name}' 언어는 사용 불가. 가능한 언어: {allowed_languages}"
            })

        limit_time = _coerce_limit_time_ms(attrs.get("limit_time"))
        limit_memory = _coerce_limit_memory_mb(attrs.get("limit_memory"))

        attrs["code"] = _normalize_submission_code(attrs.get("code"))
        attrs["limit_time"] = section_problem.problem.limit_time if limit_time is None else limit_time
        attrs["limit_memory"] = (
            section_problem.problem.limit_memory if limit_memory is None else limit_memory
        )

        attrs["section"] = section
        attrs["section_problem"] = section_problem
        attrs["problem"] = section_problem.problem
        attrs["lang"] = lang_obj
        return attrs


    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        if user.is_anonymous:
            user = User.objects.first()

        section = validated_data["section"]
        section_problem = validated_data["section_problem"]
        lang = validated_data["lang"]
        code = validated_data["code"]
        submitted_at = validated_data.get("submission_time") or timezone.now()
        status_value = validated_data.get("status") or "PENDING"
        is_late = False
        if getattr(section_problem, "due_date", None) is not None:
            is_late = submitted_at > section_problem.due_date

        prev_qs = models.ProblemSubmit.objects.filter(
            user=user,
            section_problem=section_problem,
        )
        prev_meta = prev_qs.aggregate(max_submission_count=Max("submission_count"))
        submission_count = (prev_meta["max_submission_count"] or 0) + 1
        prev_latest = prev_qs.order_by("-submission_time", "-id").first()
        prev_like = prev_latest.like_count if prev_latest else 0

        instance = models.ProblemSubmit.objects.create(
            user=user,
            section=section,
            section_problem=section_problem,
            code=code,
            score=None,
            submission_time=submitted_at,
            execution_time=None,
            error_message=None,
            submission_count=submission_count, 
            judge_count=submission_count,
            status=status_value,
            memory=None,
            is_late=is_late,
            like_count=prev_like,
            view_count=0,
        )

        instance.language.add(lang)
        return instance

class SubmissionListSerializer(serializers.ModelSerializer):
    languages = SubmissionLanguageReadField(many=True, read_only=True, source="language")
    uuid = serializers.UUIDField(read_only=True)
    section_uuid = serializers.UUIDField(source="section.uuid", read_only=True)
    section_problem_uuid = serializers.UUIDField(source="section_problem.uuid", read_only=True)

    class Meta:
        model = models.ProblemSubmit
        fields = [
            "uuid", "section_uuid", "section_problem_uuid",
            "score", "status", "submission_time", "languages",
            "like_count", "view_count",
        ]

class SubmissionDetailSerializer(serializers.ModelSerializer):
    languages = LanguageSimpleSerializer(
        many=True,
        read_only=True,
        source="language"
    )
    uuid = serializers.UUIDField(read_only=True)
    section_uuid = serializers.UUIDField(
        source="section.uuid",
        read_only=True
    )
    problem_uuid = serializers.UUIDField(
        source="section_problem.uuid",
        read_only=True
    )

    class Meta:
        model = models.ProblemSubmit
        fields = [
            "uuid", "user", "section_uuid", "problem_uuid", "code", "score",
            "execution_time", "error_message", "memory",
            "status", "submission_time", "languages", "like_count", "view_count",
        ]
        read_only_fields = fields

class HomeworkProgressProblemSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(read_only=True)
    problem_uuid = serializers.UUIDField(source='section_problem.problem.uuid', read_only=True)
    section_problem_uuid = serializers.UUIDField(source='section_problem.uuid', read_only=True)
    attempt_count = serializers.IntegerField(read_only=True)
    ju_count = serializers.IntegerField(source="judge_count")
    code = serializers.SerializerMethodField()
    code_length = serializers.SerializerMethodField()
    title= serializers.CharField(source='section_problem.problem.problem_name')
    language = serializers.SerializerMethodField()
    is_late = serializers.BooleanField()
    # error_message = serializers.CharField(allow_null=True)

    class Meta:
        model = models.ProblemSubmit
        fields = [
            'uuid', 'problem_uuid', 'section_problem_uuid', 'title',
            'score', 'attempt_count','ju_count', 'status', 'language', 'code',
            'execution_time', 'submission_time', 'memory', 'code_length',
            "like_count", "view_count",
            "is_late",
        ]
    
    def get_code(self, obj):
        if obj.code:    
            return obj.code
        return 0
    
    def get_code_length(self, obj):
        if obj.code:
            return len(obj.code.encode("utf-8")) 
        return 0

    def get_language(self, obj):
        idxs = [language_index(l.language_name) for l in obj.language.all()]
        return sorted([i for i in idxs if i is not None])


class HomeworkProgressListSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(read_only=True)
    problem_uuid = serializers.UUIDField(source='section_problem.problem.uuid', read_only=True)
    section_problem_uuid = serializers.UUIDField(source='section_problem.uuid', read_only=True)
    attempt_count = serializers.IntegerField(read_only=True)
    ju_count = serializers.IntegerField(source="judge_count")
    title = serializers.CharField(source='section_problem.problem.problem_name')
    is_late = serializers.BooleanField()

    class Meta:
        model = models.ProblemSubmit
        fields = [
            'uuid', 'problem_uuid', 'section_problem_uuid', 'title',
            'score', 'attempt_count','ju_count', 'status',
            'submission_time',
            "is_late",
        ]

class HomeworkSubmissionCodeSerializer(serializers.ModelSerializer):
    language = serializers.SerializerMethodField()
    uuid = serializers.UUIDField(read_only=True)
    section_problem_uuid = serializers.UUIDField(source="section_problem.uuid", read_only=True)
    
    class Meta:
        model = models.ProblemSubmit
        fields = [
            "uuid", "section_problem_uuid", "code", "score", "language",
            "submission_time", "execution_time", "submission_count", "status", "memory",
            "like_count", "view_count",
        ]
    def get_language(self, obj):
        idxs = [language_index(l.language_name) for l in obj.language.all()]
        return sorted([i for i in idxs if i is not None])
    
class ExamSubmissionCreateSerializer(serializers.Serializer):
    exam_uuid = serializers.UUIDField(required=False)
    exam_id = serializers.CharField(required=False)
    exam_problem_uuid = serializers.UUIDField(required=False)
    exam_problem_id = serializers.CharField(required=False)
    language = serializers.CharField()
    code = serializers.JSONField()

    def validate(self, attrs):
        exam_uuid = attrs.get("exam_uuid")
        exam_id_raw = attrs.get("exam_id")
        exam_problem_uuid = attrs.get("exam_problem_uuid")
        exam_problem_id_raw = attrs.get("exam_problem_id")
        lang_name = normalize_language_name(attrs["language"])
        if lang_name is None:
            raise serializers.ValidationError({
                "language": "지원하지 않는 언어 형식입니다."
            })

        exam = None
        if exam_uuid:
            exam = models.Exam.objects.filter(uuid=exam_uuid).first()
        elif exam_id_raw:
            if _is_uuid_like(exam_id_raw):
                exam = models.Exam.objects.filter(uuid=exam_id_raw).first()
            else:
                try:
                    exam = models.Exam.objects.filter(pk=int(exam_id_raw)).first()
                except (TypeError, ValueError):
                    exam = None
        if exam is None:
            raise serializers.ValidationError({"exam_uuid": "exam_uuid 또는 exam_id가 필요합니다."})

        exam_problem = None
        exam_problem_qs = models.ExamProblem.objects.select_related("problem")
        if exam_problem_uuid:
            exam_problem = exam_problem_qs.filter(uuid=exam_problem_uuid).first()
        elif exam_problem_id_raw:
            if _is_uuid_like(exam_problem_id_raw):
                exam_problem = exam_problem_qs.filter(uuid=exam_problem_id_raw).first()
            else:
                try:
                    exam_problem = exam_problem_qs.filter(pk=int(exam_problem_id_raw)).first()
                except (TypeError, ValueError):
                    exam_problem = None
        if exam_problem is None:
            raise serializers.ValidationError({
                "exam_problem_uuid": "exam_problem_uuid 또는 exam_problem_id가 필요합니다."
            })

        langs = exam_problem.problem.language.all()
        if not langs.exists():
            raise serializers.ValidationError({"exam_problem_id": "문제에 연결된 언어가 없습니다."})

        lang_obj = None
        for l in langs:
            if normalize_language_name(l.language_name) == lang_name:
                lang_obj = l
                break

        if lang_obj is None:
            allowed = [l.language_name for l in langs]
            raise serializers.ValidationError({
                "language": f"'{lang_name}' 언어는 사용 불가. 가능한 언어: {allowed}"
            })

        attrs["code"] = _normalize_submission_code(attrs.get("code"))

        attrs["exam"] = exam
        attrs["exam_problem"] = exam_problem
        attrs["problem"] = exam_problem.problem
        attrs["lang"] = lang_obj

        user = self.context["request"].user
        is_privileged = user_in_groups(user, GroupEnum.ADMINISTRATOR.value, GroupEnum.PROFESSOR.value)
        now = timezone.now()
        if not is_privileged:
            if getattr(exam, "start_date", None) and now < exam.start_date:
                raise serializers.ValidationError({"exam_uuid": "시험 시작 전입니다."})
            if getattr(exam, "due_date", None) and now > exam.due_date:
                raise serializers.ValidationError({"exam_uuid": "시험 시간이 종료되었습니다."})
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user

        if user.is_anonymous:
            # 테스트용 기본 유저 (예: 첫 번째 유저 또는 특정 username)
            user = User.objects.first()
        
        exam = validated_data["exam"]
        exam_problem = validated_data["exam_problem"]
        lang = validated_data["lang"]
        code = validated_data["code"]

        ip = (
            validated_data.get("ip")
            or self.context["request"].META.get("HTTP_X_FORWARDED_FOR", "")
            or self.context["request"].META.get("REMOTE_ADDR", "")
        )

        prev_qs = models.ExamSubmit.objects.filter(
            user=user,
            problem=exam_problem,
        )
        prev_meta = prev_qs.aggregate(max_submission_count=Max("submission_count"))
        submission_count = (prev_meta["max_submission_count"] or 0) + 1
        prev_latest = prev_qs.order_by("-submission_time", "-id").first()
        prev_like = prev_latest.like_count if prev_latest else 0
        
        instance = models.ExamSubmit.objects.create(
            user=user,
            exam=exam,
            problem=exam_problem,
            code=code,
            score=None,
            ip=ip,
            execution_time=None,
            error_message=None,
            submission_count=submission_count,
            judge_count=submission_count,
            status="PENDING",
            memory=None,
            submission_time=timezone.now(),
            like_count=prev_like,
            view_count=0,
        )
        instance.language.add(lang)
        return instance
    
class ExamSubmissionListSerializer(serializers.ModelSerializer):
    languages = LanguageSimpleSerializer(many=True, read_only=True, source="language")
    uuid = serializers.UUIDField(read_only=True)
    exam_uuid = serializers.UUIDField(source="exam.uuid", read_only=True)
    problem_uuid = serializers.UUIDField(source="problem.uuid", read_only=True)

    class Meta:
        model = models.ExamSubmit
        fields = [
            "uuid", "exam_uuid", "problem_uuid",
            "score", "status", "submission_time", "languages",
            "like_count", "view_count",
        ]

class ExamSubmissionDetailSerializer(serializers.ModelSerializer):
    languages = LanguageSimpleSerializer(many=True, read_only=True, source="language")
    uuid = serializers.UUIDField(read_only=True)
    exam_uuid = serializers.UUIDField(source="exam.uuid", read_only=True)
    problem_uuid = serializers.UUIDField(source="problem.uuid", read_only=True)

    class Meta:
        model = models.ExamSubmit
        fields = [
            "uuid", "user", "exam_uuid", "problem_uuid", "code", "score",
            "execution_time", "error_message", "memory", "status",
            "submission_time", "languages", "like_count", "view_count", "ip",
        ]
        read_only_fields = fields
        
class SubmissionCodeFileSerializer(serializers.Serializer):
    file_name = serializers.CharField()
    code = serializers.CharField()

class SubmissionSourcesResponseSerializer(serializers.Serializer):
    files = SubmissionCodeFileSerializer(many=True)
    source = serializers.CharField()


class ExamSubmissionProblemSerializer(serializers.ModelSerializer):
    problem_uuid = serializers.UUIDField(source="problem.problem.uuid", read_only=True)
    section_problem_uuid = serializers.UUIDField(source="problem.uuid", read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    language = serializers.SerializerMethodField()
    attempt_count = serializers.IntegerField(source="submission_count")
    title = serializers.CharField(source="problem.problem.problem_name", read_only=True)
    code_length = serializers.SerializerMethodField()
    
    class Meta:
        model = models.ExamSubmit
        fields = [
            "uuid", "problem_uuid", "section_problem_uuid", "title", "score", "attempt_count", "status", 
            "language", "code", "execution_time", "submission_time", "memory", "code_length",
            "like_count", "view_count",
        ]
    
    def get_code_length(self, obj):
        if obj.code:
            return len(obj.code.encode("utf-8")) 
        return 0
    
    def get_language(self, obj):
        idxs = [language_index(l.language_name) for l in obj.language.all()]
        return sorted([i for i in idxs if i is not None])


class ExamProgressListSerializer(serializers.ModelSerializer):
    problem_uuid = serializers.UUIDField(source="problem.problem.uuid", read_only=True)
    section_problem_uuid = serializers.UUIDField(source="problem.uuid", read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    title = serializers.CharField(source="problem.problem.problem_name", read_only=True)
    attempt_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = models.ExamSubmit
        fields = [
            "uuid", "problem_uuid", "section_problem_uuid", "title", "score", "attempt_count", "status",
            "submission_time", "ip",
        ]

class ExamSubmissionDetailSerializer(serializers.ModelSerializer):
    problem_uuid = serializers.UUIDField(source="problem.problem.uuid", read_only=True)
    section_problem_uuid = serializers.UUIDField(source="problem.uuid", read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    language = serializers.SerializerMethodField()
    title = serializers.CharField(source="problem.problem.problem_name", read_only=True)
    attempt_count = serializers.IntegerField(read_only=True)
    code_length = serializers.SerializerMethodField()
    
    class Meta:
        model = models.ExamSubmit
        fields = [
            "uuid", "problem_uuid", "section_problem_uuid", "title", "score", "code", "attempt_count", "status", 
            "language", "execution_time", "submission_time", "memory", "code_length", "ip",
            "like_count", "view_count",
        ]

    def get_code_length(self, obj):
        if obj.code:
            return len(obj.code.encode("utf-8")) 
        return 0

    def get_language(self, obj):
        idxs = [language_index(l.language_name) for l in obj.language.all()]
        return sorted([i for i in idxs if i is not None])
    
class ExamSubmissionCodeSerializer(serializers.ModelSerializer):
    language = serializers.SerializerMethodField()
    uuid = serializers.UUIDField(read_only=True)
    problem_uuid = serializers.UUIDField(source="problem.uuid", read_only=True)
    
    class Meta:
        model = models.ExamSubmit
        fields = [
            "uuid", "problem_uuid", "code", "score", "language",
            "submission_time", "execution_time", "submission_count", "status", "memory",
            "like_count", "view_count",
        ]

    def get_language(self, obj):
        idxs = [language_index(l.language_name) for l in obj.language.all()]
        return sorted([i for i in idxs if i is not None])
    
class UnifiedProgressProblemSerializer(serializers.Serializer):
    uuid = serializers.UUIDField()
    problem_uuid = serializers.UUIDField(required=False, allow_null=True)
    exam_problem_uuid = serializers.UUIDField(required=False, allow_null=True)
    section_problem_uuid = serializers.UUIDField(required=False, allow_null=True)
    title = serializers.CharField()
    score = serializers.IntegerField(allow_null=True)
    attempt_count = serializers.IntegerField()
    ju_count = serializers.IntegerField()
    status = serializers.CharField()
    language = serializers.ListField(child=serializers.IntegerField())
    code = serializers.CharField()
    execution_time = serializers.FloatField(allow_null=True)
    submission_time = serializers.DateTimeField()
    memory = serializers.IntegerField(allow_null=True)
    code_length = serializers.IntegerField()
