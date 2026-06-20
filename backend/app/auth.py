from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)


def verify_google_credential(credential: str) -> str:
    """Verify a Google Identity Services ID token and return its verified email.

    Raises HTTP 401 if the token is invalid, the audience does not match the
    configured client id, or the email is not verified by Google.
    """
    settings = get_settings()
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Falha na verificacao do Google",
    )
    try:
        claims = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except (ValueError, GoogleAuthError):
        raise invalid
    if not claims.get("email_verified"):
        raise invalid
    email = claims.get("email")
    if not email:
        raise invalid
    return email.strip().lower()


def create_access_token(email: str) -> str:
    settings = get_settings()
    payload = {
        "sub": email,
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    """Validate the app JWT and confirm the email is still on the allowlist.

    Returns the authenticated admin email.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais invalidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    settings = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials, settings.secret_key, algorithms=["HS256"]
        )
    except jwt.InvalidTokenError:
        raise unauthorized
    email = payload.get("sub")
    if not email or email.lower() not in settings.allowed_admin_emails_list:
        raise unauthorized
    return email
