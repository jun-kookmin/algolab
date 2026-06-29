from dj_rest_auth.serializers import LogoutSerializer

from accounts.session_control import clear_user_session


class CustomLogoutSerializer(LogoutSerializer):
    def save(self, **kwargs):
        result = super().save(**kwargs)
        request = kwargs.get("request")
        user = getattr(request, "user", None) if request is not None else None
        if user is not None and user.is_authenticated:
            clear_user_session(user)
        return result
