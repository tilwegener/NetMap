from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


VALID_NOTIFICATION_PROVIDERS = {"apprise", "ntfy", "telegram", "signal", "smtp", "webhook"}


class NotificationProfileBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    provider: str
    enabled: bool = True
    config: dict[str, Any] = Field(default_factory=dict)

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, value: str) -> str:
        provider = value.strip().lower()
        if provider not in VALID_NOTIFICATION_PROVIDERS:
            raise ValueError(f"provider must be one of {sorted(VALID_NOTIFICATION_PROVIDERS)}")
        return provider


class NotificationProfileCreate(NotificationProfileBase):
    pass


class NotificationProfileUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    provider: str | None = None
    enabled: bool | None = None
    config: dict[str, Any] | None = None

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, value: str | None) -> str | None:
        if value is None:
            return None
        provider = value.strip().lower()
        if provider not in VALID_NOTIFICATION_PROVIDERS:
            raise ValueError(f"provider must be one of {sorted(VALID_NOTIFICATION_PROVIDERS)}")
        return provider


class NotificationProfileRead(NotificationProfileBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
