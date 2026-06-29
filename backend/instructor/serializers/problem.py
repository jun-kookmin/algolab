from __future__ import annotations
import json
from typing import Any
from django.contrib.auth import get_user_model
from rest_framework import serializers
from api import models
from accounts.permissions import user_in_groups
from instructor.soft_delete import soft_delete_problem_checkers
from variables.groups import GroupEnum
from ..constants import (
    DIFFICULTY_MAP_OUT, DIFFICULTY_MAP_IN,
    TYPE_MAP_OUT, TYPE_MAP_IN,
    normalize_language_name,
    language_index,
)

User = get_user_model()
ADMIN = GroupEnum.ADMINISTRATOR.value
LOCKED_PRIMARY_TEMPLATE_FILENAMES = {
    "Python": "main.py",
    "Java": "Main.java",
}


def _can_edit_problem_for_request(obj, request):
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return False
    return bool(user_in_groups(user, ADMIN) or getattr(obj, "maker_id", None) == user.id)

def detect_language_from_code(filename, content):
    '''
    각 언어에 대한 고정 변환자 template 파일 확장자명을 기준으로 정함
    .h의 경우 양방향이 존재, 내부 내용을 보고 판단
    '''
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "h":
        cpp_keywords = [
            "class ", "namespace", "std::", "using namespace std",
            "#include <iostream>", "template ", "friend ",
            "operator<<", "operator>>"
        ]
        if any(kw in content for kw in cpp_keywords):
            return "C++"
        return "C"

    ext2key = {
        "py": "Python",

        # C
        "c": "C",
        
        # C++
        "cpp": "C++",
        "cc": "C++",
        "cxx": "C++",
        "hpp": "C++",
        "hh": "C++",
        "hxx": "C++",

        # Java
        "java": "Java",
    }

    return ext2key.get(ext)


def normalize_locked_primary_template_filenames(template_codes):
    if not isinstance(template_codes, list):
        return template_codes

    for block in template_codes:
        if not isinstance(block, dict):
            continue
        language = block.get("language")
        locked_filename = LOCKED_PRIMARY_TEMPLATE_FILENAMES.get(language)
        files = block.get("files")
        if not locked_filename or not isinstance(files, list) or not files:
            continue

        locked_index = next(
            (
                idx
                for idx, file in enumerate(files)
                if isinstance(file, dict) and file.get("filename") == locked_filename
            ),
            None,
        )
        if locked_index not in (None, 0):
            locked_file = files.pop(locked_index)
            files.insert(0, locked_file)

        first_file = files[0]
        if not isinstance(first_file, dict):
            continue

        first_file["filename"] = locked_filename

    return template_codes


def normalize_template_code_buckets_for_output(template_buckets):
    normalized = []
    for block in template_buckets:
        if not isinstance(block, dict):
            continue
        files = block.get("files")
        if isinstance(files, list):
            block["files"] = normalize_locked_primary_template_filenames([{
                "language": block.get("language"),
                "files": files,
            }])[0]["files"]
        normalized.append(block)
    return normalized

class ProblemListSerializer(serializers.ModelSerializer):
    language = serializers.SerializerMethodField()
    difficulty = serializers.SerializerMethodField()
    type = serializers.SerializerMethodField()  
    uuid = serializers.UUIDField(read_only=True)
    share = serializers.BooleanField()
    can_edit = serializers.SerializerMethodField()
    maker_name = serializers.SerializerMethodField()

    class Meta:
        model = models.Problem
        fields = ["uuid", "problem_name", "difficulty", "type", "language", "share", "can_edit", "maker_name"]

    def get_type(self, obj):
        return TYPE_MAP_OUT.get(obj.type)
    
    def get_difficulty(self, obj):
        return DIFFICULTY_MAP_OUT.get(obj.difficulty)

    def get_language(self, obj):
        idxs = [language_index(l.language_name) for l in obj.language.all()]
        return sorted([i for i in idxs if i is not None])

    def get_can_edit(self, obj):
        return _can_edit_problem_for_request(obj, self.context.get("request"))

    def get_maker_name(self, obj):
        maker = getattr(obj, "maker", None)
        if not maker:
            return ""
        try:
            full_name = maker.get_full_name()
        except Exception:
            full_name = ""
        full_name = (full_name or "").strip()
        if full_name:
            return full_name
        return getattr(maker, "username", "") or ""


class ProblemDetailSerializer(serializers.ModelSerializer):
    description = serializers.CharField(allow_blank=True, allow_null=True)
    difficulty = serializers.SerializerMethodField()
    type = serializers.SerializerMethodField()
    language = serializers.SerializerMethodField()
    template_codes = serializers.SerializerMethodField()
    checker_code = serializers.SerializerMethodField()
    testcases = serializers.SerializerMethodField()
    uuid = serializers.UUIDField(read_only=True)
    share = serializers.BooleanField()
    can_edit = serializers.SerializerMethodField()
    
    
    class Meta:
        model = models.Problem
        fields = [
            "uuid", "problem_name", "description", "difficulty", "language",
            "type", "limit_time", "limit_memory", "checker_code", "template_codes", "testcases", "share", "can_edit",
        ]

    def get_difficulty(self, obj):
        return DIFFICULTY_MAP_OUT.get(obj.difficulty)

    def get_type(self, obj):
        return TYPE_MAP_OUT.get(obj.type, "GENERAL")

    def get_template_codes(self, obj):
        buckets = {}
        qs = obj.ProblemTemplate_problem.all()

        for t in qs:
            filename = t.template_name or ""
            content = t.template_content or ""

            # 언어 자동 판별 (확장자 + 내용 기반)
            lang = detect_language_from_code(filename, content)
            if not lang:
                continue

            if lang not in buckets:
                buckets[lang] = {"language": lang, "files": []}

            buckets[lang]["files"].append({
                "filename": filename,
                "content": content,
            })

        return normalize_template_code_buckets_for_output(list(buckets.values()))
    
    def get_checker_code(self, obj):
        chk = obj.ProblemChecker_problem.first() if obj.type == "PC" else None
        return chk.code if chk else None

    def get_testcases(self, obj):
        testcases = []
        for idx, tc in enumerate(obj.ProblemInOut_problem.all(), start=1):
            testcases.append({
                "input": {
                    "index": idx,
                    "content": tc.input_code,
                },
                "output": {
                    "index": idx,
                    "content": tc.output_code,
                },
            })
        return testcases
    
    def get_language(self, obj):
        idxs = [language_index(l.language_name) for l in obj.language.all()]
        return sorted([i for i in idxs if i is not None])

    def get_can_edit(self, obj):
        return _can_edit_problem_for_request(obj, self.context.get("request"))


class ProblemPreviewSerializer(serializers.ModelSerializer):
    description = serializers.CharField(allow_blank=True, allow_null=True)
    difficulty = serializers.SerializerMethodField()
    type = serializers.SerializerMethodField()
    language = serializers.SerializerMethodField()
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = models.Problem
        fields = [
            "uuid", "problem_name", "description", "difficulty", "language",
            "type", "limit_time", "limit_memory",
        ]

    def get_difficulty(self, obj):
        return DIFFICULTY_MAP_OUT.get(obj.difficulty)

    def get_type(self, obj):
        return TYPE_MAP_OUT.get(obj.type, "GENERAL")

    def get_language(self, obj):
        idxs = [language_index(l.language_name) for l in obj.language.all()]
        return sorted([i for i in idxs if i is not None])


class ProblemSolveSerializer(serializers.ModelSerializer):
    """
    문제풀이 화면에서 학생 응답 전용 Serializer.
    테스트케이스, checker_code, share는 노출하지 않습니다.
    """
    description = serializers.CharField(allow_blank=True, allow_null=True)
    difficulty = serializers.SerializerMethodField()
    type = serializers.SerializerMethodField()
    language = serializers.SerializerMethodField()
    template_codes = serializers.SerializerMethodField()
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = models.Problem
        fields = [
            "uuid", "problem_name", "description", "difficulty", "language",
            "type", "limit_time", "limit_memory", "template_codes",
        ]

    def get_difficulty(self, obj):
        return DIFFICULTY_MAP_OUT.get(obj.difficulty)

    def get_type(self, obj):
        return TYPE_MAP_OUT.get(obj.type, "GENERAL")

    def get_template_codes(self, obj):
        buckets = {}
        qs = obj.ProblemTemplate_problem.all()

        for t in qs:
            filename = t.template_name or ""
            content = t.template_content or ""

            # 언어 자동 판별 (확장자 + 내용 기반)
            lang = detect_language_from_code(filename, content)
            if not lang:
                continue

            if lang not in buckets:
                buckets[lang] = {"language": lang, "files": []}

            buckets[lang]["files"].append({
                "filename": filename,
                "content": content,
            })

        return normalize_template_code_buckets_for_output(list(buckets.values()))

    def get_language(self, obj):
        idxs = [language_index(l.language_name) for l in obj.language.all()]
        return sorted([i for i in idxs if i is not None])


class ProblemSolveInstructorSerializer(ProblemSolveSerializer):
    """
    인솔버(교수/관리자) 응답 전용 Serializer.
    checker_code/share는 강의진에게만 전달.
    """
    checker_code = serializers.SerializerMethodField()
    share = serializers.BooleanField()

    class Meta(ProblemSolveSerializer.Meta):
        fields = [
            "uuid", "problem_name", "description", "difficulty", "language",
            "type", "limit_time", "limit_memory", "checker_code", "template_codes", "share",
        ]

    def get_checker_code(self, obj):
        chk = obj.ProblemChecker_problem.first() if obj.type == "PC" else None
        return chk.code if chk else None


class ProblemListPublicSerializer(ProblemListSerializer):
    class Meta(ProblemListSerializer.Meta):
        fields = ["uuid", "problem_name", "difficulty", "type", "language", "can_edit", "maker_name"]


class LegacyProblemLanguagePKField(serializers.PrimaryKeyRelatedField):
    """과거 클라이언트에서 언어 인덱스(0~3) 또는 별칭(c/cpp/py)을 보내도 안전하게 처리."""

    def to_internal_value(self, data):
        if isinstance(data, bool):
            return super().to_internal_value(data)

        legacy_name = normalize_language_name(data)
        if legacy_name is not None:
            language = models.Language.objects.filter(
                language_name__iexact=legacy_name,
                is_delete=False,
            ).first()
            if language is not None:
                data = language.pk
        return super().to_internal_value(data)

class FileItemSerializer(serializers.Serializer):
    filename = serializers.CharField()
    content = serializers.CharField()

class TemplateCodeLanguageField(serializers.CharField):
    default_error_messages = {
        "invalid": "지원하지 않는 template language 입니다."
    }

    def to_internal_value(self, data):
        if data is None:
            self.fail("invalid")
        norm = normalize_language_name(data)
        if norm is None:
            self.fail("invalid")
        return norm

class TemplateFilesSerializer(serializers.Serializer):
    language = TemplateCodeLanguageField()
    files = FileItemSerializer(many=True)

class IOItemSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    content = serializers.CharField(allow_blank=True)

class TestcaseSerializer(serializers.Serializer):
    input = IOItemSerializer(required=False)
    output = IOItemSerializer(required=False)

class ProblemDataSerializer(serializers.Serializer):
    title = serializers.CharField()
    description = serializers.CharField()
    type = serializers.ChoiceField(choices=["GENERAL", "CHECKER"])
    difficulty = serializers.ChoiceField(choices=list(DIFFICULTY_MAP_IN.keys()))
    limit_time = serializers.CharField()
    limit_memory = serializers.CharField()
    languages = serializers.ListField(child=serializers.JSONField())
    template_codes = TemplateFilesSerializer(many=True)
    testcases = TestcaseSerializer(many=True, required=False)
    checker_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    share = serializers.BooleanField(required=False)

    def validate(self, attrs):
        from .submission import _coerce_limit_time_ms, _coerce_limit_memory_mb

        attrs["limit_time"] = _coerce_limit_time_ms(attrs.get("limit_time"))
        attrs["limit_memory"] = _coerce_limit_memory_mb(attrs.get("limit_memory"))

        problem_type = attrs.get("type")
        testcases = attrs.get("testcases") or []

        lang_names = []
        for v in attrs.get("languages", []):
            if isinstance(v, bool):
                continue
            name = normalize_language_name(v)
            if name is not None:
                lang_names.append(name)
        if not lang_names:
            raise serializers.ValidationError({"languages": "지원하지 않는 언어 값입니다."})
        attrs["languages"] = lang_names
        if "template_codes" in attrs:
            attrs["template_codes"] = normalize_locked_primary_template_filenames(
                attrs.get("template_codes", [])
            )

        for idx, tc in enumerate(testcases):
            if not isinstance(tc, dict):
                raise serializers.ValidationError({"testcases": f"{idx + 1}번째 테스트케이스 형식이 잘못되었습니다."})

            has_input = tc.get("input") is not None
            has_output = tc.get("output") is not None

            if not has_input and not has_output:
                raise serializers.ValidationError(
                    {"testcases": f"{idx + 1}번째 테스트케이스에 입력/출력이 없습니다."}
                )

            if problem_type != "CHECKER":
                if not (has_input and has_output):
                    raise serializers.ValidationError(
                        {
                            "testcases": f"{idx + 1}번째 테스트케이스는 CHECKER를 제외하고 input/output이 모두 필요합니다."
                        }
                    )
            elif not has_input:
                raise serializers.ValidationError(
                    {
                        "testcases": f"{idx + 1}번째 테스트케이스는 CHECKER에서 입력은 필수입니다."
                    }
                )

        return attrs

class ProblemPostPayloadSerializer(serializers.Serializer):
    problemData = serializers.JSONField()

    def to_internal_value(self, data):
        raw = data.get("problemData")
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raise serializers.ValidationError({"problemData": "Invalid JSON string"})
        if not isinstance(raw, dict):
            raise serializers.ValidationError({"problemData": "Object required"})
        nested = ProblemDataSerializer(data=raw)
        nested.is_valid(raise_exception=True)
        return {"problemData": nested.validated_data}


class TemplateCodeInputSerializer(serializers.Serializer):
    language = serializers.CharField()
    code = serializers.CharField()

class ProblemCreateUpdateSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source="problem_name")
    description = serializers.CharField()
    language = LegacyProblemLanguagePKField(queryset=models.Language.objects.all(), many=True)
    type = serializers.ChoiceField(choices=list(TYPE_MAP_IN.keys()))
    difficulty = serializers.ChoiceField(choices=list(DIFFICULTY_MAP_IN.keys()), required=False)
    template_codes = TemplateFilesSerializer(many=True, required=False)
    checker_code = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    limit_time = serializers.CharField(required=False)
    limit_memory = serializers.CharField(required=False)
    share = serializers.BooleanField(required=False)
    testcases = TestcaseSerializer(many=True, required=False)

    def validate(self, attrs):
        from .submission import _coerce_limit_time_ms, _coerce_limit_memory_mb

        attrs = super().validate(attrs)
        if "limit_time" in attrs:
            attrs["limit_time"] = _coerce_limit_time_ms(attrs.get("limit_time"))
        if "limit_memory" in attrs:
            attrs["limit_memory"] = _coerce_limit_memory_mb(attrs.get("limit_memory"))

        problem_type = attrs.get("type")
        if problem_type is None and self.instance is not None:
            problem_type = TYPE_MAP_OUT.get(self.instance.type, self.instance.type)

        testcases = attrs.get("testcases") or []
        if "template_codes" in attrs:
            attrs["template_codes"] = normalize_locked_primary_template_filenames(
                attrs.get("template_codes", [])
            )

        if problem_type is not None:
            for idx, tc in enumerate(testcases):
                if not isinstance(tc, dict):
                    raise serializers.ValidationError(
                        {"testcases": f"{idx + 1}번째 테스트케이스 형식이 잘못되었습니다."}
                    )

                has_input = tc.get("input") is not None
                has_output = tc.get("output") is not None

                if not has_input and not has_output:
                    raise serializers.ValidationError(
                        {"testcases": f"{idx + 1}번째 테스트케이스에 입력/출력이 없습니다."}
                    )

                if problem_type != "CHECKER":
                    if not (has_input and has_output):
                        raise serializers.ValidationError(
                            {
                                "testcases": f"{idx + 1}번째 테스트케이스는 CHECKER를 제외하고 input/output이 모두 필요합니다."
                            }
                        )
                elif not has_input:
                    raise serializers.ValidationError(
                        {
                            "testcases": f"{idx + 1}번째 테스트케이스는 CHECKER에서 입력은 필수입니다."
                        }
                    )
        return attrs

    class Meta:
        model = models.Problem
        fields = [
            "title", "description", "language", "type", "difficulty",
            "limit_time", "limit_memory",
            "template_codes", "checker_code", "share", "testcases",
        ]

    def create(self, validated_data: dict[str, Any]) -> models.Problem:
        templates = validated_data.pop("template_codes", [])
        checker_code = validated_data.pop("checker_code", None)
        languages = validated_data.pop("language", [])
        validated_data["type"] = TYPE_MAP_IN[validated_data.pop("type")]
        if "difficulty" in validated_data:
            validated_data["difficulty"] = DIFFICULTY_MAP_IN[validated_data["difficulty"]]

        problem = models.Problem.objects.create(**validated_data)
        problem.language.set(languages)

        for tpl in templates:
            for f in tpl.get("files", []):
                models.ProblemTemplate.objects.create(
                    problem=problem,
                    template_content=f["content"],
                    template_name=f["filename"],
                )

        if checker_code:
            models.ProblemChecker.objects.create(
                problem=problem, code=checker_code, name="checker.py"
            )
        return problem

    def update(self, instance: models.Problem, validated_data: dict[str, Any]) -> models.Problem:
        templates = validated_data.pop("template_codes", None)
        checker_code = validated_data.pop("checker_code", None)
        languages = validated_data.pop("language", None)
        testcases = validated_data.pop("testcases", None)

        if "type" in validated_data:
            validated_data["type"] = TYPE_MAP_IN[validated_data.pop("type")]
        if "difficulty" in validated_data:
            validated_data["difficulty"] = DIFFICULTY_MAP_IN[validated_data["difficulty"]]

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if languages is not None:
            instance.language.set(languages)

        if templates is not None:
            instance.ProblemTemplate_problem.all().delete()
            for tpl in templates:
                #lang_key = LANG_KEY_TO_DBNAME.get(tpl["language"], tpl["language"])
                #lang = models.Language.objects.get(language_name=lang_key)

                for f in tpl.get("files", []):
                    models.ProblemTemplate.objects.create(
                        problem=instance,
                #        language=lang,
                        template_content=f["content"],
                        template_name=f["filename"],
                    )

        if testcases is not None:
            instance.ProblemInOut_problem.all().delete()
            for tc in testcases:
                inp = tc.get("input")
                out = tc.get("output")
                in_txt = "" if inp is None else inp.get("content", "")
                out_txt = "" if out is None else out.get("content", "")
                models.ProblemInOut.objects.create(
                    problem=instance,
                    input_code=in_txt,
                    output_code=out_txt,
                )

        if checker_code is not None:
            if checker_code == "":
                soft_delete_problem_checkers(
                    models.ProblemChecker.objects.filter(problem=instance)
                )
            else:
                models.ProblemChecker.objects.update_or_create(
                    problem=instance,
                    defaults={"code": checker_code, "name": "checker.py"},
                )
        return instance
