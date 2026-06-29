from __future__ import annotations


import django_filters
from django.db.models import Q

from api import models

class PostFilter(django_filters.FilterSet):
    problem_uuid = django_filters.UUIDFilter(method="filter_problem_uuid")
    class_uuid = django_filters.UUIDFilter(method="filter_class_uuid")
    title = django_filters.CharFilter(field_name="title", lookup_expr="icontains")
    author = django_filters.CharFilter(field_name="user__username", lookup_expr="icontains")
    is_noticed = django_filters.BooleanFilter(method="filter_is_noticed")
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = models.Post
        fields = ["problem_uuid", "class_uuid", "title", "author", "is_noticed", "search"]

    def filter_problem_uuid(self, qs, name, value):
        return qs.filter(ProblemPost_post__problem__uuid=value)

    def filter_class_uuid(self, qs, name, value):
        return qs.filter(PostLecture_post__class_id__uuid=value)

    def filter_is_noticed(self, qs, name, value):
        class_uuid = (
            self.data.get("class_uuid")
            or self.data.get("class_id")
            or self.data.get("class")
        )
        if class_uuid:
            return qs.filter(PostLecture_post__is_noticed=value)
        return qs.filter(is_noticed=value)

    def filter_search(self, qs, name, value):
        search = (value or "").strip()
        if not search:
            return qs

        # 검색은 제목/작성자 기준만 허용
        return qs.filter(Q(title__icontains=search) | Q(user__username__icontains=search))
