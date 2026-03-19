import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


def _validate_password_strength(password: str) -> str:
    value = password.strip()
    if len(value) < 8:
        raise ValueError("A senha deve ter pelo menos 8 caracteres")
    if value.lower() == value or value.upper() == value:
        raise ValueError("A senha precisa misturar letras maiusculas e minusculas")
    if not any(ch.isdigit() for ch in value):
        raise ValueError("A senha precisa incluir pelo menos um numero")
    return password


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None
    accepted_terms: bool

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)

    @field_validator("accepted_terms")
    @classmethod
    def validate_terms(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Voce precisa aceitar os termos para criar a conta")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: str | None = None
    avatar_url: str | None = None


class GoogleLogin(BaseModel):
    token: str  # Google ID token from frontend


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class DeleteAccountRequest(BaseModel):
    confirmation_text: str
    password: str | None = None

    @field_validator("confirmation_text")
    @classmethod
    def validate_confirmation_text(cls, value: str) -> str:
        if value.strip().upper() != "DELETAR":
            raise ValueError("Digite DELETAR para confirmar")
        return value


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None
    avatar_url: str | None
    plan: str
    email_verified: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}
