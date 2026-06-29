from allauth.socialaccount import providers
from allauth.socialaccount.providers.base import ProviderAccount
from allauth.socialaccount.providers.oauth2.provider import OAuth2Provider
from .adapter import ExternalOAuth2Adapter


class ExternalOAuthAccount(ProviderAccount):
    def get_username(self):
        return self.account.extra_data.get("username")

    def get_first_name(self):
        return self.account.extra_data.get("firstName")

    def get_last_name(self):
        return self.account.extra_data.get("lastName")

    def get_user_type(self):
        return self.account.extra_data.get("userType")


class ExternalOAuthProvider(OAuth2Provider):
    id = "external_oauth"
    name = "OAuth"
    redirect_uri_protocol = "https"
    account_class = ExternalOAuthAccount
    oauth2_adapter_class = ExternalOAuth2Adapter

    def get_default_scope(self):
        return ["profile"]

    def extract_uid(self, data):
        return str(data["username"])

    def extract_common_fields(self, data):
        return dict(
            username=data.get("username"),
            first_name=data.get("firstName"),
            last_name=data.get("lastName"),
            user_type=data.get("userType"),
        )


providers.registry.register(ExternalOAuthProvider)
