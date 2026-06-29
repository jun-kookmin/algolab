from __future__ import annotations

import re
from django.db.models import Q
import django_filters
from api import models
from ..constants import DIFFICULTY_MAP_IN, TYPE_MAP_IN, normalize_language_name

class ProblemFilter(django_filters.FilterSet):
    difficulty = django_filters.CharFilter(method="filter_difficulty")
    type = django_filters.CharFilter(method="filter_type")
    language = django_filters.CharFilter(method="filter_language")
    name = django_filters.CharFilter(method="filter_name")
    search = django_filters.CharFilter(method="filter_name")
    uuids = django_filters.CharFilter(method="filter_uuids")

    class Meta:
        model = models.Problem
        fields = ["difficulty", "type", "language", "name", "search", "uuids"]

    def filter_name(self, qs, name, value):
        query = (value or "").strip()
        if not query:
            return qs

        return qs.filter(
            Q(problem_name__icontains=query) | Q(description__icontains=query)
        )

    def filter_difficulty(self, qs, name, value): 
        difficulty = DIFFICULTY_MAP_IN.get(value.upper())
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        return qs

    def filter_type(self, qs, name, value):
        type_code = TYPE_MAP_IN.get(value.upper())
        if type_code:
            qs = qs.filter(type=type_code)
        return qs

    def filter_language(self, qs, name, value):
        if not value:
            return qs

        tokens = [t.strip() for t in re.split(r"[,\s]+", value) if t]
        if not tokens:
            return qs

        for token in tokens:
            lang_name = normalize_language_name(token)
            if not lang_name:
                continue

            qs = qs.filter(language__language_name=lang_name)

        return qs.distinct()

    def filter_uuids(self, qs, name, value):
        if not value:
            return qs

        tokens = [t.strip() for t in re.split(r"[,\s]+", value) if t.strip()]
        if not tokens:
            return qs

        return qs.filter(uuid__in=tokens)
