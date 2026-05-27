import os
import cv2
import pickle
import numpy as np
import albumentations as A

from insightface.app import FaceAnalysis

# =========================================================
# CONFIG
# =========================================================

import sys

# =========================================================
# MEMBERS — can be overridden via env var TRAIN_MEMBER
# so the FastAPI backend can trigger training per employee
# =========================================================

_env_member = os.environ.get("TRAIN_MEMBER", "").strip()

MEMBERS = (
    [_env_member]
    if _env_member
    else [
        "Malavika",
    ]
)

DATASET_DIR = "dataset"

AUGMENTED_DIR = "augmented_clean"

EMBEDDINGS_DIR = "embeddings"

# =========================================================
# IMPORTANT
# LESS AUGMENTATION = BETTER EMBEDDINGS
# =========================================================

AUG_PER_IMAGE = 3

# =========================================================
# CREATE FOLDERS
# =========================================================

os.makedirs(
    AUGMENTED_DIR,
    exist_ok=True
)

os.makedirs(
    EMBEDDINGS_DIR,
    exist_ok=True
)

# =========================================================
# SAFE AUGMENTATIONS
# REMOVE:
# - blur
# - noise
# - compression
# - gamma
# =========================================================

transform = A.Compose([

    A.RandomBrightnessContrast(
        brightness_limit=0.15,
        contrast_limit=0.15,
        p=0.6
    ),

    A.HorizontalFlip(
        p=0.5
    ),

    A.Affine(
        rotate=(-5, 5),
        scale=(0.98, 1.02),
        translate_percent=0.02,
        p=0.4
    ),
])

# =========================================================
# LOAD INSIGHTFACE
# =========================================================

print("\nLoading InsightFace...")

app = FaceAnalysis(
    name="buffalo_l",
    providers=["CPUExecutionProvider"]
)

app.prepare(
    ctx_id=-1,
    det_size=(640, 640)
)

print("InsightFace loaded\n")

# =========================================================
# EXTRACT EMBEDDING
# =========================================================

def get_embedding(image):

    faces = app.get(image)

    if len(faces) == 0:
        return None

    # =====================================================
    # IMPORTANT:
    # Use largest face
    # =====================================================

    face = max(

        faces,

        key=lambda x:
        (
            (x.bbox[2] - x.bbox[0]) *
            (x.bbox[3] - x.bbox[1])
        )
    )

    emb = face.embedding

    emb = emb / np.linalg.norm(emb)

    return emb

# =========================================================
# REMOVE BAD EMBEDDINGS
# =========================================================

def filter_embeddings(embeddings):

    if len(embeddings) == 0:
        return []

    matrix = np.stack(embeddings)

    mean_emb = np.mean(
        matrix,
        axis=0
    )

    mean_emb = (
        mean_emb /
        np.linalg.norm(mean_emb)
    )

    filtered = []

    removed = 0

    for emb in embeddings:

        sim = np.dot(
            mean_emb,
            emb
        )

        # ================================================
        # REMOVE OUTLIERS
        # ================================================

        if sim >= 0.45:

            filtered.append(emb)

        else:

            removed += 1

    print(
        f"      Removed "
        f"{removed} bad embeddings"
    )

    return filtered

# =========================================================
# PROCESS STREAM
# =========================================================

def process_stream(folder):

    embeddings = []

    files = [

        f for f in os.listdir(folder)

        if f.lower().endswith(
            (
                ".jpg",
                ".jpeg",
                ".png"
            )
        )
    ]

    print(
        f"    Stream images: "
        f"{len(files)}"
    )

    skipped = 0

    for i, file in enumerate(files):

        path = os.path.join(
            folder,
            file
        )

        image = cv2.imread(path)

        if image is None:

            skipped += 1

            continue

        # =================================================
        # FACE SIZE CHECK
        # =================================================

        faces = app.get(image)

        if len(faces) == 0:

            skipped += 1

            continue

        # =================================================
        # USE LARGEST FACE
        # =================================================

        face = max(

            faces,

            key=lambda x:
            (
                (x.bbox[2] - x.bbox[0]) *
                (x.bbox[3] - x.bbox[1])
            )
        )

        x1, y1, x2, y2 = face.bbox.astype(int)

        face_w = x2 - x1

        face_h = y2 - y1

        # =================================================
        # IGNORE SMALL FACES
        # =================================================

        if face_w < 120 or face_h < 120:

            skipped += 1

            continue

        emb = face.embedding

        emb = emb / np.linalg.norm(emb)

        embeddings.append(emb)

        if (i + 1) % 10 == 0:

            print(
                f"      [{i+1}/{len(files)}] "
                f"processed"
            )

    print(
        f"      Valid stream embeddings: "
        f"{len(embeddings)}"
    )

    return embeddings

# =========================================================
# PROCESS MOBILE
# =========================================================

def process_mobile(folder, name):

    embeddings = []

    save_dir = os.path.join(
        AUGMENTED_DIR,
        name
    )

    os.makedirs(
        save_dir,
        exist_ok=True
    )

    files = [

        f for f in os.listdir(folder)

        if f.lower().endswith(
            (
                ".jpg",
                ".jpeg",
                ".png"
            )
        )
    ]

    print(
        f"    Mobile images: "
        f"{len(files)}"
    )

    skipped = 0

    count = 0

    for i, file in enumerate(files):

        path = os.path.join(
            folder,
            file
        )

        image = cv2.imread(path)

        if image is None:

            skipped += 1

            continue

        image = cv2.resize(
            image,
            (640, 640)
        )

        # =================================================
        # ORIGINAL
        # =================================================

        emb = get_embedding(image)

        if emb is None:

            skipped += 1

            continue

        embeddings.append(emb)

        cv2.imwrite(

            os.path.join(
                save_dir,
                f"{name}_orig_{count}.jpg"
            ),

            image
        )

        # =================================================
        # SAFE AUGMENTATIONS
        # =================================================

        for j in range(AUG_PER_IMAGE):

            aug = transform(
                image=image
            )["image"]

            aug_emb = get_embedding(aug)

            if aug_emb is None:
                continue

            embeddings.append(aug_emb)

            cv2.imwrite(

                os.path.join(
                    save_dir,
                    f"{name}_aug_{count}_{j}.jpg"
                ),

                aug
            )

        count += 1

        print(
            f"      [{i+1}/{len(files)}] "
            f"{file}"
        )

    print(
        f"      Mobile embeddings: "
        f"{len(embeddings)}"
    )

    return embeddings

# =========================================================
# MAIN PROCESS
# =========================================================

summary = []

for name in MEMBERS:

    print("\n" + "=" * 60)

    print(f"PROCESSING: {name}")

    print("=" * 60)

    stream_folder = os.path.join(
        DATASET_DIR,
        name,
        "stream"
    )

    mobile_folder = os.path.join(
        DATASET_DIR,
        name,
        "mobile"
    )

    save_path = os.path.join(
        EMBEDDINGS_DIR,
        f"{name.lower()}.pkl"
    )

    all_embeddings = []

    # =====================================================
    # STREAM
    # =====================================================

    if os.path.exists(stream_folder):

        print("\n  STREAM")

        stream_embs = process_stream(
            stream_folder
        )

        all_embeddings.extend(
            stream_embs
        )

    # =====================================================
    # MOBILE
    # =====================================================

    if os.path.exists(mobile_folder):

        print("\n  MOBILE")

        mobile_embs = process_mobile(
            mobile_folder,
            name
        )

        all_embeddings.extend(
            mobile_embs
        )

    # =====================================================
    # FILTER BAD EMBEDDINGS
    # =====================================================

    print("\n  Filtering embeddings...")

    all_embeddings = filter_embeddings(
        all_embeddings
    )

    # =====================================================
    # CHECK
    # =====================================================

    if len(all_embeddings) == 0:

        print("  FAILED")

        continue

    # =====================================================
    # SAVE
    # =====================================================

    data = {

        "name": name,

        "embeddings": all_embeddings,
    }

    with open(save_path, "wb") as f:

        pickle.dump(data, f)

    print(
        f"\n  SAVED: "
        f"{len(all_embeddings)} embeddings"
    )

    summary.append(
        (
            name,
            len(all_embeddings)
        )
    )

# =========================================================
# SUMMARY
# =========================================================

print("\n" + "=" * 60)

print("FINAL SUMMARY")

print("=" * 60)

grand_total = 0

for name, count in summary:

    grand_total += count

    print(
        f"{name:<15} "
        f"{count}"
    )

print("\nGrand Total:", grand_total)

print("=" * 60)