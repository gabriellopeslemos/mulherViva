from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import create_access_token, get_current_admin, verify_google_credential
from ..config import get_settings
from ..schemas import GoogleLoginRequest, MeResponse, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/google", response_model=TokenResponse)
def google_login(body: GoogleLoginRequest):
    email = verify_google_credential(body.credential)
    if email not in get_settings().allowed_admin_emails_list:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este e-mail nao tem acesso ao painel",
        )
    return TokenResponse(access_token=create_access_token(email))


@router.post("/dev-login", response_model=TokenResponse)
def dev_login():
    """Issue an admin token without Google. Only exists when DEV_AUTH_BYPASS=true."""
    settings = get_settings()
    if not settings.dev_auth_bypass:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
    emails = settings.allowed_admin_emails_list
    if not emails:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ALLOWED_ADMIN_EMAILS vazio",
        )
    return TokenResponse(access_token=create_access_token(emails[0]))


@router.get("/me", response_model=MeResponse)
def me(email: str = Depends(get_current_admin)):
    return MeResponse(email=email)
