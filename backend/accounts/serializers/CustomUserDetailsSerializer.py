from dj_rest_auth.serializers import UserDetailsSerializer
from django.contrib.auth import get_user_model
from rest_framework import serializers
from accounts.permissions import get_user_group_name_set
from variables import GROUP_ORDER

User = get_user_model()


class CustomUserDetailsSerializer(UserDetailsSerializer):
    group = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('pk', 'username', 'first_name', 'last_name', 'group')
        # user 상세 응답은 조회만 허용한다.
        read_only_fields = ('pk', 'username', 'first_name', 'last_name', 'group')

    def get_group(self, obj):
        names = get_user_group_name_set(obj)

        for name in GROUP_ORDER:
            key = str(name).strip().lower()
            if key in names or (key == "administrator" and "admin" in names):
                return key
        return None
