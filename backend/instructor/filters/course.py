import datetime
from django_filters import rest_framework as filters

from api import models


class LectureFilter(filters.FilterSet):
    is_current = filters.BooleanFilter(method='filter_current')
    name = filters.CharFilter(field_name='name', lookup_expr='exact')
    language = filters.ModelMultipleChoiceFilter(queryset=models.Language.objects.all(),
                                                 conjoined=True)

    def filter_current(self, queryset, name, value):
        now__ = datetime.date.today()
        if value:
            return queryset.filter(start_date__lt=now__, end_date__gt=now__)
        else:
            return queryset.filter(end_date__lt=now__)

    class Meta:
        model = models.Lecture
        fields = ['name', 'language']