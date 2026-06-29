from django.contrib.auth import get_user_model


from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'name']

    def get_name(self, obj):
        last_name = getattr(obj, "last_name", "") or ""
        first_name = getattr(obj, "first_name", "") or ""
        full = f"{last_name}{first_name}"
        return "".join(full.split())
