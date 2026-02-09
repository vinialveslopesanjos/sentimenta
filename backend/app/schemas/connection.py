import uuid
from datetime import datetime

from pydantic import BaseModel


class YouTubeConnectRequest(BaseModel):
    channel_handle: str  # e.g. "@RaiamSantos"


class ConnectionResponse(BaseModel):
    id: uuid.UUID
    platform: str
    username: str
    display_name: str | None
    profile_url: str | None
    profile_image_url: str | None
    followers_count: int
    status: str
    connected_at: datetime
    last_sync_at: datetime | None

    model_config = {"from_attributes": True}


class OAuthURLResponse(BaseModel):
    auth_url: str


class SyncResponse(BaseModel):
    connection_id: uuid.UUID
    task_id: str
    message: str
