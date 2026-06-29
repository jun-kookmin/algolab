from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models.signals import post_save
from django.dispatch import receiver
from variables import GroupEnum


#https://stackoverflow.com/a/48544585
User = get_user_model()


@receiver(post_save, sender=User)
def set_default_user_group(sender, instance, created, **kwargs):
    if created:
        instance.groups.add(Group.objects.get(name=str(GroupEnum.STUDENT)))
