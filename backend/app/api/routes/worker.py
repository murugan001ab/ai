from pathlib import Path
import asyncio
import os
import sys

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import selectinload

from app.api.deps import (
    AdminOrSuperAdmin,
    CurrentUser,
    DBSession,
)
from app.crud.user import crud_user, crud_worker_image

from app.models.user import User
from app.models.user_zone_permission import (
    UserZonePermission,
)
from app.models.worker_image import WorkerImage
from app.schemas.base import BaseResponse
from app.schemas.user import UserReadWithRole

router = APIRouter(
    prefix="/users",
    tags=["User Management"],
)

UPLOAD_DIR = (
    "/home/hacker/Projects/ai/models/dataset"
)

MODELS_DIR = "/home/hacker/Projects/ai/models"

TRAIN_SCRIPT = os.path.join(
    MODELS_DIR,
    "2_augment_faces.py",
)

os.makedirs(UPLOAD_DIR, exist_ok=True)


# ==========================================
# UPLOAD USER TRAINING IMAGES
# ==========================================

@router.post(
    "/{user_id}/images",
    response_model=BaseResponse[
        UserReadWithRole
    ],
)
async def upload_user_images(
    user_id: int,
    db: DBSession,
    _: CurrentUser,
    images: list[UploadFile] = File(...),
):
    # =========================
    # GET USER
    # =========================

    user = await crud_user.get(
        db,
        user_id,
        options=[
            selectinload(User.worker_images),
        ],
    )

    if not user or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # =========================
    # VALIDATE FILES
    # =========================

    allowed_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }

    if not images:
        raise HTTPException(
            status_code=400,
            detail="No images uploaded",
        )

    # =========================
    # EXISTING IMAGE COUNT
    # =========================

    existing_count = len(
        user.worker_images
    )

    MIN_IMAGES = 10
    total_after_upload = existing_count + len(images)

    if total_after_upload < MIN_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"At least {MIN_IMAGES} images are required for training. "
                f"You have {existing_count} existing image(s). "
                f"Please upload at least {MIN_IMAGES - existing_count} more."
            ),
        )

    # =========================
    # CREATE WORKER FOLDER
    # dataset/{employee_id}/
    # =========================

    worker_dir = os.path.join(
        UPLOAD_DIR,
        user.employee_id,"mobile"
    )

    os.makedirs(worker_dir, exist_ok=True)

    saved_paths = []

    # =========================
    # SAVE FILES
    # =========================

    for index, image in enumerate(
        images,
        start=1,
    ):
        ext = Path(
            image.filename
        ).suffix.lower()

        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {ext}",
            )

        image_number = (
            existing_count + index
        )

        filename = (
            f"{user.employee_id}_{image_number}{ext}"
        )

        absolute_path = os.path.join(
            worker_dir,
            filename,
        )

        # relative path stored as employee_id/filename
        relative_path = os.path.join(
            user.employee_id,
            filename,
        )

        # SAVE FILE
        with open(
            absolute_path,
            "wb",
        ) as f:
            content = await image.read()
            f.write(content)

        # SAVE DB RECORD
        await crud_worker_image.create(
            db,
            obj_in={
                "user_id": user.id,
                "image_path": relative_path,
            },
        )

        saved_paths.append(relative_path)

    # =========================
    # SET PROFILE IMAGE
    # =========================

    if (
        not user.profile_image
        and saved_paths
    ):
        user.profile_image = (
            saved_paths[0]
        )

    # user must retrain now
    user.is_trained = False

    db.add(user)

    await db.flush()
    await db.refresh(user)

    # =========================
    # RELOAD RELATIONSHIPS
    # =========================

    user = await crud_user.get(
        db,
        user.id,
        options=[
            selectinload(User.role),

            selectinload(
                User.zone_permissions
            ).selectinload(
                UserZonePermission.zone
            ),

            selectinload(
                User.worker_images
            ),
        ],
    )

    return BaseResponse(
        data=UserReadWithRole.model_validate(
            user
        ),
        message="Images uploaded",
    )


# ==========================================
# TRIGGER FACE TRAINING  (background)
# POST /users/{user_id}/train
# ==========================================

@router.post(
    "/{user_id}/train",
    response_model=BaseResponse[UserReadWithRole],
)
async def trigger_training(
    user_id: int,
    db: DBSession,
    _: AdminOrSuperAdmin,
):
    # =========================
    # GET USER
    # =========================
    # print(user_ide)
    user = await crud_user.get(
        db,
        user_id,
        options=[
            selectinload(User.worker_images),
            selectinload(User.role),
            selectinload(
                User.zone_permissions
            ).selectinload(UserZonePermission.zone),
        ],
    )

    if not user or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # =========================
    # NEED MIN 10 IMAGES
    # =========================

    if len(user.worker_images) < 10:
        raise HTTPException(
            status_code=400,
            detail=(
                f"User needs at least 10 uploaded images to train. "
                f"Current count: {len(user.worker_images)}."
            ),
        )

    # =========================
    # CHECK DATASET FOLDER
    # =========================

    worker_dataset = os.path.join(
        UPLOAD_DIR,
        user.employee_id,
    )

    if not os.path.isdir(worker_dataset):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Dataset folder not found for employee "
                f"'{user.employee_id}'. Upload images first."
            ),
        )

    # =========================
    # MARK AS NOT TRAINED YET
    # =========================

    user.is_trained = False
    db.add(user)
    await db.flush()

    # =========================
    # RUN SCRIPT — streaming logs
    # The script reads TRAIN_MEMBER env var
    # and uses relative paths so cwd=MODELS_DIR
    # =========================
    PYTHON_ENV="/home/hacker/Projects/ai/models/.venv/bin/python"
    async def log_stream():
        env = os.environ.copy()
        env["TRAIN_MEMBER"] = user.employee_id
        print(sys.executable)
        proc = await asyncio.create_subprocess_exec(
            PYTHON_ENV,
            TRAIN_SCRIPT,
            cwd=MODELS_DIR,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        # stream stdout line by line to client
        async for line in proc.stdout:
            yield line.decode(errors="replace")

        await proc.wait()

        # =========================
        # UPDATE is_trained IN DB
        # open a fresh session-less update
        # via a simple file flag approach
        # We write result to a temp marker
        # that the status endpoint can read
        # =========================

        flag_dir = os.path.join(
            MODELS_DIR, ".train_flags"
        )
        os.makedirs(flag_dir, exist_ok=True)
        flag_path = os.path.join(
            flag_dir,
            f"{user.employee_id}.status",
        )

        if proc.returncode == 0:
            with open(flag_path, "w") as f:
                f.write("success")
            yield f"\n[TRAINING COMPLETE] ✓ {user.employee_id}\n"
        else:
            with open(flag_path, "w") as f:
                f.write("failed")
            yield f"\n[TRAINING FAILED] ✗ exit code {proc.returncode}\n"

    return StreamingResponse(
        log_stream(),
        media_type="text/plain",
        headers={
            "X-Employee-ID": user.employee_id,
            "Cache-Control": "no-cache",
        },
    )


# ==========================================
# POLL TRAINING RESULT + UPDATE DB
# POST /users/{user_id}/train/commit
# Call this from frontend after stream ends
# ==========================================

@router.post(
    "/{user_id}/train/commit",
    response_model=BaseResponse[UserReadWithRole],
)
async def commit_training_result(
    user_id: int,
    db: DBSession,
    _: CurrentUser,
):
    user = await crud_user.get(
        db,
        user_id,
        options=[
            selectinload(User.role),
            selectinload(
                User.zone_permissions
            ).selectinload(UserZonePermission.zone),
            selectinload(User.worker_images),
        ],
    )

    if not user or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    flag_path = os.path.join(
        MODELS_DIR,
        ".train_flags",
        f"{user.employee_id}.status",
    )

    if not os.path.exists(flag_path):
        raise HTTPException(
            status_code=400,
            detail="No training result found. Run /train first.",
        )

    with open(flag_path) as f:
        result = f.read().strip()

    if result == "success":
        user.is_trained = True
        message = "Training successful — user marked as trained."
    else:
        user.is_trained = False
        message = "Training failed — check logs."

    db.add(user)
    await db.flush()
    await db.refresh(user)

    # clean up flag
    os.remove(flag_path)

    user = await crud_user.get(
        db,
        user.id,
        options=[
            selectinload(User.role),
            selectinload(
                User.zone_permissions
            ).selectinload(UserZonePermission.zone),
            selectinload(User.worker_images),
        ],
    )

    return BaseResponse(
        data=UserReadWithRole.model_validate(user),
        message=message,
    )