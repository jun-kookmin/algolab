import os

from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from variables import GroupEnum


def _csv_set_env(name: str) -> set[str]:
    raw = os.getenv(name, "")
    return {item.strip() for item in raw.split(",") if item.strip()}


class AlgolabSocialAccountAdapter(DefaultSocialAccountAdapter):
    def _assign_group(self, user, user_type: str | None):
        """Assign a role based on OAuth user_type. Defaults to student."""
        normalized = (user_type or "").strip().lower()
        compact = "".join(ch for ch in normalized if ch.isalnum())
        upper_compact = compact.upper()

        target = GroupEnum.STUDENT
        professor_codes = {"S2", "S3"}

        is_professor_code = upper_compact in professor_codes

        if is_professor_code:
            target = GroupEnum.PROFESSOR

        # Public default: no OAuth account receives admin automatically.
        admin_usernames = _csv_set_env("OAUTH_ADMIN_USERNAMES")
        admin_group, _ = Group.objects.get_or_create(name=str(GroupEnum.ADMINISTRATOR))
        if str(user.username) not in admin_usernames:
            user.groups.remove(admin_group)

        # 교수/학생 중 하나만 유지
        prof_group, _ = Group.objects.get_or_create(name=str(GroupEnum.PROFESSOR))
        student_group, _ = Group.objects.get_or_create(name=str(GroupEnum.STUDENT))
        if target == GroupEnum.PROFESSOR:
            user.groups.add(prof_group)
            user.groups.remove(student_group)
        else:
            user.groups.add(student_group)
            user.groups.remove(prof_group)

        if str(user.username) in admin_usernames:
            user.groups.add(admin_group)

    def pre_social_login(self, request, sociallogin):
        User = get_user_model()

        try:
            user = User.objects.get(username=sociallogin.user.username)
        except User.DoesNotExist:
            user = User(
                username=sociallogin.user.username,
                first_name=sociallogin.user.first_name,
                last_name=sociallogin.user.last_name
            )
        finally:
            sociallogin.connect(request, user)
            # assign role from OAuth profile (userType), defaulting to student
            user_type = sociallogin.account.extra_data.get("userType")
            self._assign_group(user, user_type)

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)

        return user
