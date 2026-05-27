import cv2
import numpy as np
import pickle
import threading
import time
import os
import json

from confluent_kafka import Producer
from insightface.app import FaceAnalysis
from psycopg2.extras import RealDictCursor

from db_config import db_manager

# =========================================================
# LOAD DATABASE DATA
# =========================================================

camera_list = db_manager.get_cameras()

db_manager.load_user_zone_permissions()

print("\nDATABASE CAMERA LIST:")
print(camera_list)

# =========================================================
# KAFKA CONFIG
# =========================================================

KAFKA_BROKER = "localhost:9092"

KAFKA_TOPIC = "face-events"

producer = Producer({
    "bootstrap.servers": KAFKA_BROKER
})

# =========================================================
# KAFKA CALLBACK
# =========================================================

def delivery_report(err, msg):

    if err is not None:

        print(f"Kafka Error: {err}")

    else:

        print(
            f"Delivered to {msg.topic()} "
            f"partition={msg.partition()}"
        )

# =========================================================
# CAMERA DICTIONARY
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

CAPTURE_DIR = "facecaptures"

os.makedirs(CAPTURE_DIR, exist_ok=True)

SIM_THRESHOLD = 0.35

DET_SIZE = (640, 640)

PROCESS_EVERY_N = 2

UPSCALE = 1.5

DETECTION_TIMEOUT = 5

# =========================================================
# COLORS
# =========================================================

AUTHORIZED_COLOR = (0, 255, 0)

UNAUTHORIZED_COLOR = (0, 0, 255)

UNKNOWN_COLOR = (0, 255, 255)

# =========================================================
# ACTIVE DETECTIONS
# =========================================================

ACTIVE_DETECTIONS = {}

# =========================================================
# LOAD MEMBERS
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

        scores = person["matrix"] @ emb

        score = float(scores.max())

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
# SAVE FACE IMAGE
# =========================================================

def save_face_capture(frame, name):

    filename = f"{name}_{int(time.time())}.jpg"

    path = os.path.join(
        CAPTURE_DIR,
        filename
    )

    cv2.imwrite(path, frame)

    return filename

# =========================================================
# CHECK CAMERA
# =========================================================

if CAM_SELECT not in CAMERAS:

    print(f"\nERROR: {CAM_SELECT} not found")

    print(list(CAMERAS.keys()))

    exit()

# =========================================================
# CAMERA DETAILS
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

        current_visible_people = set()

        for face in faces:

            name, score = identify(
                face.embedding
            )

            current_time = time.time()

            x1, y1, x2, y2 = (

                face.bbox / UPSCALE

            ).astype(int)

            # =============================================
            # UNKNOWN PERSON
            # =============================================

            if name == "Unknown":

                label = "UNKNOWN"

                color = UNKNOWN_COLOR

            else:

                current_visible_people.add(name)

                is_allowed = db_manager.is_zone_allowed(
                    name,
                    ZONE_ID
                )

                if is_allowed:

                    label = f"{name} - AUTHORIZED"

                    color = AUTHORIZED_COLOR

                else:

                    label = f"{name} - UNAUTHORIZED"

                    color = UNAUTHORIZED_COLOR

                # =========================================
                # SEND EVENT ONLY ONCE
                # =========================================

                if name not in ACTIVE_DETECTIONS:

                    image_path = save_face_capture(
                        frame,
                        name
                    )

                    event = {

                        "event_name": "face-events",

                        "camera_id": CAMERA_ID,

                        "zone_id": ZONE_ID,

                        "name": name,

                        "similarity": round(
                            float(score),
                            4
                        ),

                        "authorized": is_allowed,

                        "image_path": image_path,

                        "timestamp": int(current_time)
                    }

                    producer.produce(
                        KAFKA_TOPIC,
                        key=name,
                        value=json.dumps(event),
                        callback=delivery_report
                    )

                    producer.poll(0)

                    ACTIVE_DETECTIONS[name] = current_time

                    print(
                        f"[EVENT SENT] {event}"
                    )

                else:

                    ACTIVE_DETECTIONS[name] = current_time

            # =============================================
            # STORE DRAW RESULT
            # =============================================

            last_results.append(

                (
                    (x1, y1, x2, y2),
                    label,
                    color
                )
            )

        # =================================================
        # REMOVE PEOPLE WHO LEFT FRAME
        # =================================================

        remove_keys = []

        for person, last_seen in ACTIVE_DETECTIONS.items():

            if person not in current_visible_people:

                if time.time() - last_seen > DETECTION_TIMEOUT:

                    remove_keys.append(person)

        for person in remove_keys:

            del ACTIVE_DETECTIONS[person]

            print(f"{person} left frame")

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

producer.flush()

print("Stopped")