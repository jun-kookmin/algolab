from django.contrib.auth import get_user_model
from django.utils import timezone

from rest_framework import serializers

from django.db.models import Q

from api import models
from .language import LanguageSimpleSerializer
from ..constants import (
    normalize_language_name,
    language_index,
)

User = get_user_model()


class LegacyLectureLanguagePKField(serializers.PrimaryKeyRelatedField):
    """과거 클라이언트에서 언어 인덱스(0~3)로 전송해도 자동으로 DB PK로 매핑."""

    def to_internal_value(self, data):
        # 과거 UI가 0,1,2,3 또는 c/cpp/java/python 등을 보내는 경우 언어명으로 매핑
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


class CurrentLectureDefault():
    requires_context = True
    def __call__(self, serializer_field):
        kwargs = serializer_field.context['view'].kwargs
        return (
            kwargs.get("lectures_uuid")
            or kwargs.get("lecture_uuid")
            or kwargs.get("lecture_pk")
            or kwargs.get("lectures_pk")
            or kwargs.get("lecture_id")
        )

class CurrentInstructorDefault():
    requires_context = True
    def __call__(self, serializer_field):
        return serializer_field.context['request'].user


# get /api/v1/lectures
class LectureSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(read_only=True)
    server_time = serializers.SerializerMethodField()
    lecture_language = LegacyLectureLanguagePKField(
        many=True,
        queryset=models.Language.objects.all(),
    )
    language = LanguageSimpleSerializer(many=True, read_only=True)
    # student_count = serializers.IntegerField(source='student.count', read_only=True)
    instructor = serializers.SerializerMethodField(read_only=True)
    name = serializers.CharField(source="lecture_name")

    section_count = serializers.IntegerField(read_only=True)
    problem_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = models.Lecture
        fields = [
            'uuid',
            'lecture_language',
            'language',
            'instructor',
            'name',
            'description',
            'weeks',
            'start_date',
            'end_date',
            'curriculum_locked',
            'server_time',
            'created_date',
            'is_delete',
            'section_count',
            'problem_count',
        ]

        read_only_fields = ['created_date']

    # post /api/v1/lectures
    def create(self, validated_data):
        language = validated_data.pop('lecture_language')
        validated_data['instructor'] = self.context['request'].user
        lecture = super().create(validated_data)
        self._sync_lecture_languages(lecture, language)

        return lecture

    def update(self, instance, validated_data):
        language = validated_data.pop('lecture_language', None)
        lecture = super().update(instance, validated_data)
        if language is not None:
            self._sync_lecture_languages(lecture, language)
        return lecture

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        prefetched = getattr(instance, "prefetched_lang_links", None)
        if prefetched is not None:
            lang_ids = [li.language_id for li in prefetched if li.language_id]
            langs = [li.language for li in prefetched if li.language and not li.language.is_delete]
            rep["lecture_language"] = sorted([
                language_index(name)
                for name in (getattr(l, "language_name", "") for l in langs)
                if language_index(name) is not None
            ])
            rep["language"] = LanguageSimpleSerializer(langs, many=True).data
            return rep

        lang_ids = list(
            models.LanguageInLecture.objects
            .filter(lecture=instance, language__is_delete=False)
            .values_list('language_id', flat=True)
        )
        lang_names = list(models.Language.objects.filter(id__in=lang_ids, is_delete=False).values_list("language_name", flat=True))
        if lang_names:
            rep["lecture_language"] = sorted([
                language_index(name)
                for name in lang_names
                if language_index(name) is not None
            ])
            langs = list(models.Language.objects.filter(id__in=lang_ids, is_delete=False))
            rep["language"] = LanguageSimpleSerializer(langs, many=True).data
        else:
            rep['lecture_language'] = []
            rep['language'] = []
        return rep

    def _sync_lecture_languages(self, lecture, language_list):
        desired_ids = {getattr(lang, "id", lang) for lang in (language_list or [])}
        desired_ids = {int(v) for v in desired_ids if v is not None}

        existing = models.LanguageInLecture.all_objects.filter(lecture=lecture)
        existing_by_lang = {li.language_id: li for li in existing if li.language_id}

        # Remove languages not in desired list (soft delete)
        for lang_id, rel in existing_by_lang.items():
            if lang_id not in desired_ids and not rel.is_delete:
                rel.is_delete = True
                rel.save(update_fields=["is_delete"])

        # Add or restore desired languages
        for lang_id in desired_ids:
            rel = existing_by_lang.get(lang_id)
            if rel:
                if rel.is_delete:
                    rel.is_delete = False
                    rel.save(update_fields=["is_delete"])
                continue
            models.LanguageInLecture.objects.create(
                lecture=lecture,
                language_id=lang_id,
            )
    
    def get_language(self, obj):
        idxs = [language_index(l.language_name) for l in obj.language.all()]
        return sorted([i for i in idxs if i is not None])
    
    def get_instructor(self, obj):
        return obj.instructor.username

    def get_server_time(self, obj):
        return timezone.now()


class LectureListCompactSerializer(LectureSerializer):
    class Meta(LectureSerializer.Meta):
        fields = [
            'uuid',
            'lecture_language',
            'language',
            'name',
            'description',
            'start_date',
            'end_date',
            'curriculum_locked',
            'section_count',
            'problem_count',
        ]


class LectureListStudentSerializer(LectureSerializer):
    class Meta(LectureSerializer.Meta):
        fields = [
            'uuid',
            'name',
            'start_date',
            'end_date',
            'section_count',
            'problem_count',
        ]


class LectureStudentDetailSerializer(LectureSerializer):
    class Meta(LectureSerializer.Meta):
        fields = [
            'uuid',
            'name',
            'start_date',
            'end_date',
            'curriculum_locked',
            'lecture_language',
            'language',
            'server_time',
        ]

# get /api/v1/lectures/{lid}/members
class LectureMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.StudentInLecture
        fields = ['uuid', 'role', 'student_code', 'is_delete', 'user_id', 'full_name']

    user_id = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    def get_user_id(self, obj):
        return getattr(obj.student, "id", None)

    def get_full_name(self, obj):
        if obj.student:
            full = f"{obj.student.last_name}{obj.student.first_name}"
            return "".join(full.split())
        return None
    
# get /api/v1/lectures/{lid}/members/{uid} 
class LectureMemberDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.StudentInLecture
        fields = [
            'uuid',
            'role',
            'student_code',
            'is_delete',
            'user_id',
            'full_name',
            'last_submission_at',
        ]

    user_id = serializers.SerializerMethodField()
    last_submission_at = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField() 

    def get_user_id(self, obj):
        return getattr(obj.student, "id", None)
    
    #last_submission_at 계산
    def get_last_submission_at(self, obj):
       return (
            models.ProblemSubmit.objects
            .filter(
                user=obj.student,
                section__lecture=obj.lecture
            )
            .order_by('-submission_time')
            .values_list('submission_time', flat=True)
            .first()
        )
    def get_full_name(self, obj):
        if obj.student:
            full = f"{obj.student.last_name}{obj.student.first_name}"
            return "".join(full.split())
        return None
    
class MemberSerializer(serializers.Serializer):
    student_id = serializers.CharField()

class MembersRequestSerializer(serializers.Serializer):
    members = MemberSerializer(many=True)    

# put /api/v1/lectures/{lid}/members
class MemberAddSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(write_only=True)   # 학번 (username)
    student_code = serializers.CharField(read_only=True)

    class Meta:
        model = models.StudentInLecture
        fields = ['student_id', 'student_code']

    def create(self, validated_data):
        lecture = self.context['lecture']
        student_id = validated_data.pop('student_id')
        normalized_student_id = student_id.strip()

        student = User.objects.filter(username__iexact=normalized_student_id).first()
        canonical_student_id = student.username if student else normalized_student_id

        qs = models.StudentInLecture.all_objects.filter(lecture=lecture)
        if student:
            existing_member = qs.filter(
                Q(student=student) | Q(student_code__iexact=canonical_student_id)
            ).first()
        else:
            # 학번만 있는 대기 멤버와 매칭
            existing_member = qs.filter(student_code__iexact=canonical_student_id).first()

        if existing_member:
            update_fields = []
            if existing_member.student is None and student:
                existing_member.student = student
                update_fields.append("student")
            existing_code = (existing_member.student_code or "").strip()
            if existing_code.lower() != canonical_student_id.lower():
                existing_member.student_code = canonical_student_id
                update_fields.append("student_code")
            if existing_member.is_delete:
                existing_member.is_delete = False
                update_fields.append("is_delete")

            if update_fields:
                existing_member.save(update_fields=update_fields)
            return existing_member

        return models.StudentInLecture.objects.create(
            lecture=lecture,
            student=student,
            student_code=canonical_student_id,
            is_delete=False,
        )
