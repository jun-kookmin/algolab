from rest_framework import viewsets

from api import models
from instructor.serializers.language import LanguageSimpleSerializer
from instructor.permissions import IsAdminOrProfessor


class LanguageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Language.objects.all().order_by("id")
    serializer_class = LanguageSimpleSerializer
    permission_classes = [IsAdminOrProfessor]
