import cv2
import numpy as np
import pickle
import threading
import time
import os

from insightface.app import FaceAnalysis
from db_config import db_manager

# =========================================================
# GET CAMERAS FROM DATABASE
# =========================================================

camera_list = db_manager.get_cameras()

print("\nDATABASE CAMERA LIST:")
print(camera_list)

# =========================================================
# CREATE CAMERA DICTIONARY
# =========================================================

CAMERAS = {}

for cam in camera_list:

    CAMERAS[cam["name"]] = {

        "camera_id": cam["id"],

        "zone_id": cam["zone_id"],

        "rtsp_link": cam["rtsp_url"]
    }

print("\nAVAILABLE CAMERAS:")
print(CAMERAS)

# =========================================================
# CONFIG
# =========================================================

CAM_SELECT = "cam4"

EMBEDDINGS_DIR = "embeddings"

SIM_THRESHOLD = 0.35

DET_SIZE = (640, 640)

PROCESS_EVERY_N = 2

UPSCALE = 1.5

# =========================================================
# COLORS
# =========================================================

AUTHORIZED_COLOR = (0, 255, 0)

UNAUTHORIZED_COLOR = (0, 0, 255)

UNKNOWN_COLOR = (0, 255, 255)

# =========================================================
# LOAD MEMBERS FROM EMBEDDINGS
# =========================================================

MEMBERS = []

for file in os.listdir(EMBEDDINGS_DIR):

    file_path = os.path.join(
        EMBEDDINGS_DIR,
        file
    )

    if os.path.isfile(file_path):

        filename_without_ext = os.path.splitext(file)[0]

        MEMBERS.append(
            filename_without_ext
        )

print("\nMEMBERS FOUND:")
print(MEMBERS)

# =========================================================
# LOAD EMBEDDINGS
# =========================================================

print("\nLoading embeddings...")

known_people = []

for name in MEMBERS:

    path = os.path.join(
        EMBEDDINGS_DIR,
        f"{name.lower()}.pkl"
    )

    try:

        with open(path, "rb") as f:

            data = pickle.load(f)

        embeddings = data["embeddings"]

        embeddings = [

            e / np.linalg.norm(e)

            for e in embeddings
        ]

        matrix = np.stack(embeddings)

        known_people.append({

            "name": name,

            "matrix": matrix
        })

        print(
            f"Loaded {len(embeddings)} embeddings -> {name}"
        )

    except Exception as e:

        print(f"FAILED: {name}")

        print(e)

if len(known_people) == 0:

    print("No embeddings loaded")

    exit()

print(
    f"\nLoaded {len(known_people)} people"
)

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
    det_size=DET_SIZE
)

print("Model loaded")

# =========================================================
# CAMERA THREAD
# =========================================================

class CameraReader:

    def __init__(self, url):

        self.cap = cv2.VideoCapture(url)

        self.cap.set(
            cv2.CAP_PROP_BUFFERSIZE,
            1
        )

        self.frame = None

        self.lock = threading.Lock()

        self.running = True

        self.thread = threading.Thread(
            target=self.update,
            daemon=True
        )

        self.thread.start()

    def update(self):

        while self.running:

            ret, frame = self.cap.read()

            if ret:

                with self.lock:

                    self.frame = frame

            time.sleep(0.01)

    def read(self):

        with self.lock:

            if self.frame is None:

                return None

            return self.frame.copy()

    def release(self):

        self.running = False

        self.thread.join()

        self.cap.release()

# =========================================================
# IDENTIFY FACE
# =========================================================

def identify(face_embedding):

    emb = (
        face_embedding /
        np.linalg.norm(face_embedding)
    )

    best_name = "Unknown"

    best_score = -1

    for person in known_people:

        # =================================================
        # COSINE SIMILARITY
        # =================================================

        scores = person["matrix"] @ emb

        # =================================================
        # MAX SCORE
        # =================================================

        score = float(scores.max())

        # =================================================
        # SELECT BEST MATCH
        # =================================================

        if score > best_score:

            best_score = score

            if score >= SIM_THRESHOLD:

                best_name = person["name"]

            else:

                best_name = "Unknown"

    return (
        best_name,
        best_score
    )

# =========================================================
# CHECK CAMERA
# =========================================================

if CAM_SELECT not in CAMERAS:

    print(f"\nERROR: {CAM_SELECT} not found")

    print(list(CAMERAS.keys()))

    exit()

# =========================================================
# GET CAMERA DETAILS
# =========================================================

camera_data = CAMERAS[CAM_SELECT]

CAMERA_ID = camera_data["camera_id"]

ZONE_ID = camera_data["zone_id"]

RTSP_URL = camera_data["rtsp_link"]

print(f"\nCamera ID : {CAMERA_ID}")

print(f"Zone ID   : {ZONE_ID}")

print(f"RTSP URL  : {RTSP_URL}")

# =========================================================
# OPEN CAMERA
# =========================================================

print(f"\nOpening {CAM_SELECT}")

cam = CameraReader(RTSP_URL)

time.sleep(2)

frame = cam.read()

if frame is None:

    print("Cannot open RTSP")

    exit()

print("Camera connected")

print("Frame shape:", frame.shape)

# =========================================================
# MAIN LOOP
# =========================================================

frame_count = 0

last_results = []

fps_start = time.time()

fps = 0

while True:

    frame = cam.read()

    if frame is None:

        continue

    frame_count += 1

    # =====================================================
    # FACE DETECTION
    # =====================================================

    if frame_count % PROCESS_EVERY_N == 0:

        scaled = cv2.resize(
            frame,
            None,
            fx=UPSCALE,
            fy=UPSCALE
        )

        faces = app.get(scaled)

        print(
            f"Faces detected: {len(faces)}"
        )

        last_results = []

        for face in faces:

            name, score = identify(
                face.embedding
            )

            print(
                f"{name} | similarity={score:.4f}"
            )

            # =============================================
            # SCALE BACK BBOX
            # =============================================

            x1, y1, x2, y2 = (

                face.bbox / UPSCALE

            ).astype(int)

            # =============================================
            # AUTHORIZATION LOGIC
            # =============================================

            if name == "Unknown":

                label = "UNKNOWN PERSON"

                color = UNKNOWN_COLOR

            else:

                # =========================================
                # HR ZONE => UNAUTHORIZED
                # =========================================

                if ZONE_ID == 2:

                    label = f"{name} - UNAUTHORIZED"

                    color = UNAUTHORIZED_COLOR

                # =========================================
                # OTHER ZONES => AUTHORIZED
                # =========================================

                else:

                    label = f"{name} - AUTHORIZED"

                    color = AUTHORIZED_COLOR

            last_results.append(

                (
                    (x1, y1, x2, y2),
                    label,
                    color
                )
            )

    # =====================================================
    # DRAW RESULTS
    # =====================================================

    for (
        (x1, y1, x2, y2),
        label,
        color
    ) in last_results:

        cv2.rectangle(
            frame,
            (x1, y1),
            (x2, y2),
            color,
            2
        )

        cv2.rectangle(
            frame,
            (x1, y1 - 35),
            (x2, y1),
            color,
            -1
        )

        cv2.putText(
            frame,
            label,
            (x1 + 5, y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )

    # =====================================================
    # FPS
    # =====================================================

    if frame_count % 30 == 0:

        elapsed = (
            time.time() -
            fps_start
        )

        fps = 30 / elapsed

        fps_start = time.time()

    cv2.putText(
        frame,
        f"FPS: {fps:.1f}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"CAMERA ID: {CAMERA_ID}",
        (20, 80),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"ZONE ID: {ZONE_ID}",
        (20, 120),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )

    # =====================================================
    # DISPLAY
    # =====================================================

    display = cv2.resize(
        frame,
        (1280, 720)
    )

    cv2.imshow(
        "Face Recognition",
        display
    )

    key = cv2.waitKey(1)

    if key == ord("q"):

        break

# =========================================================
# CLEANUP
# =========================================================

cam.release()

cv2.destroyAllWindows()

print("Stopped")