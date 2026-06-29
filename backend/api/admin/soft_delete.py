from django.contrib import admin


class SoftDeleteAdmin(admin.ModelAdmin):
    """
    Admin that shows all rows (including soft-deleted) and performs hard delete.
    """

    def get_queryset(self, request):
        if hasattr(self.model, "all_objects"):
            return self.model.all_objects.get_queryset()
        return super().get_queryset(request)

    def delete_model(self, request, obj):
        if hasattr(obj, "hard_delete"):
            obj.hard_delete()
        else:
            super().delete_model(request, obj)

    def delete_queryset(self, request, queryset):
        if hasattr(self.model, "all_objects"):
            self.model.all_objects.filter(
                pk__in=queryset.values_list("pk", flat=True)
            ).delete()
        else:
            super().delete_queryset(request, queryset)

    def get_list_filter(self, request):
        filters = list(super().get_list_filter(request))
        if hasattr(self.model, "is_delete") and "is_delete" not in filters:
            filters.append("is_delete")
        return filters
