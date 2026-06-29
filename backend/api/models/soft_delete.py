from django.db import models
from django.utils.translation import gettext_lazy as _


class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        count = self.update(is_delete=True)
        return count, {self.model._meta.label: count}

    def hard_delete(self):
        return super().delete()

    def alive(self):
        return self.filter(is_delete=False)

    def dead(self):
        return self.filter(is_delete=True)


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_delete=False)

    def with_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db)

    def hard_delete(self):
        return self.with_deleted().hard_delete()


class SoftDeleteModel(models.Model):
    is_delete = models.BooleanField(
        verbose_name=_("삭제여부"),
        db_column="isDeleted",
        default=False,
    )

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        self.is_delete = True
        self.save(update_fields=["is_delete"], using=using)
        return 1, {self._meta.label: 1}

    def hard_delete(self, using=None, keep_parents=False):
        return super().delete(using=using, keep_parents=keep_parents)
