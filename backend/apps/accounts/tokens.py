from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

User = get_user_model()

EMAIL_VERIFY_SALT = "dah-email-verify"
TOKEN_MAX_AGE = 86400  # 24h


def make_token(user_pk: int, salt: str) -> str:
    return signing.dumps(user_pk, salt=salt)


def read_token(token: str, salt: str, max_age: int = TOKEN_MAX_AGE) -> int:
    try:
        return signing.loads(token, salt=salt, max_age=max_age)
    except signing.SignatureExpired:
        raise ValueError("Le lien a expiré.")
    except signing.BadSignature:
        raise ValueError("Lien invalide.")


def make_email_verify_token(user: User) -> str:
    return make_token(user.pk, EMAIL_VERIFY_SALT)


def read_email_verify_token(token: str) -> User:
    pk = read_token(token, EMAIL_VERIFY_SALT)
    return User.objects.get(pk=pk)


def make_password_reset_token(user: User) -> str:
    """Jeton à usage unique : il dépend du mot de passe actuel et de la dernière
    connexion (PasswordResetTokenGenerator) — il cesse de fonctionner dès que le
    mot de passe change, et expire après PASSWORD_RESET_TIMEOUT."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    return f"{uid}.{default_token_generator.make_token(user)}"


def read_password_reset_token(token: str) -> User:
    uid, _, secret = (token or "").partition(".")
    try:
        pk = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=pk, is_active=True)
    except (ValueError, TypeError, OverflowError, User.DoesNotExist):
        raise ValueError("Lien invalide ou expiré.")
    if not default_token_generator.check_token(user, secret):
        raise ValueError("Lien invalide ou expiré.")
    return user


