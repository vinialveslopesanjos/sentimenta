import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.data_snapshot import DataSnapshot
from app.models.user import User
from app.schemas.data_snapshot import DataSnapshotResponse
from app.services.data_snapshot_service import get_latest_data_snapshot, serialize_data_snapshot


router = APIRouter(prefix="/data-snapshots", tags=["data-snapshots"])


@router.get("/latest", response_model=DataSnapshotResponse | None)
def get_latest_snapshot(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return serialize_data_snapshot(get_latest_data_snapshot(db, user_id=current_user.id))


@router.get("/{snapshot_id}", response_model=DataSnapshotResponse)
def get_snapshot(
    snapshot_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    snapshot = (
        db.query(DataSnapshot)
        .filter(
            DataSnapshot.id == snapshot_id,
            DataSnapshot.user_id == current_user.id,
        )
        .first()
    )
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Data snapshot not found")
    return serialize_data_snapshot(snapshot)
