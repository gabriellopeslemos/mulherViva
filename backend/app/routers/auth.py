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


@router.get("/me", response_model=MeResponse)
def me(email: str = Depends(get_current_admin)):
    return MeResponse(email=email)
