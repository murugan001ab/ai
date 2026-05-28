import cv2
import numpy as np
import pickle
import threading
import time
import os
import json

from confluent_kafka import Producer
from insightface.app import FaceAnalysis
import onnxruntime as ort

from db_config import db_manager

# =========================================================
# DATABASE
# =========================================================

camera_list = db_manager.get_cameras()

db_manager.load_user_zone_permissions()

# =========================================================
# KAFKA
# =========================================================

KAFKA_BROKER = "192.168.0.122:9092"

KAFKA_TOPIC = "face-events"

producer = Producer({
    "bootstrap.servers": KAFKA_BROKER
})

def delivery_report(err, msg):

    if err:
        print(f"Kafka Error: {err}")

    else:
        print(
            f"Delivered to {msg.topic()} "
            f"partition={msg.partition()}"
        )

# =========================================================
# CAMERA CONFIG
# =========================================================

CAMERAS = {}

for cam in camera_list:

    CAMERAS[cam["name"]] = {

        "camera_id": cam["id"],

        "zone_id": cam["zone_id"],

        "rtsp_link": cam["rtsp_url"]
    }

CAM_SELECT = "cam4"

# =========================================================
# CONFIG
# =========================================================

EMBEDDINGS_DIR = "embeddings"

CAPTURE_DIR = "facecaptures"

os.makedirs(CAPTURE_DIR, exist_ok=True)

SIM_THRESHOLD = 0.40

DET_SIZE = (640, 640)

UPSCALE = 1.5

PROCESS_EVERY_N = 2

UNKNOWN_MAX_WAIT = 1.2

UNKNOWN_MIN_FRAMES = 3

UNAUTHORIZED_CONFIRM_TIME = 1

UNAUTHORIZED_MIN_FRAMES = 2

KNOWN_GRACE_TIME = 5

ACTIVE_DETECTIONS = {}

PENDING_UNKNOWN = {}

PENDING_UNAUTHORIZED = {}

RECENT_EVENTS = {}

AUTHORIZED_COLOR = (0, 255, 0)

UNAUTHORIZED_COLOR = (0, 0, 255)

UNKNOWN_COLOR = (0, 255, 255)

# =========================================================
# LOAD EMBEDDINGS
# =========================================================

known_people = []

members = [
    os.path.splitext(f)[0]
    for f in os.listdir(EMBEDDINGS_DIR)
]

for name in members:

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

        known_people.append({
            "name": name,
            "matrix": np.stack(embeddings)
        })

        print(f"Loaded {name}")

    except Exception as e:
        print(f"FAILED {name}: {e}")

# =========================================================
# GPU / CPU AUTO
# =========================================================

print("\nLoading InsightFace...")

providers = ["CPUExecutionProvider"]

ctx_id = -1

try:

    if "CUDAExecutionProvider" in ort.get_available_providers():

        providers = ["CUDAExecutionProvider"]

        ctx_id = 0

        print("GPU ENABLED")

    else:
        print("CPU MODE")

except:
    print("CPU FALLBACK")

app = FaceAnalysis(
    name="buffalo_l",
    providers=providers
)

app.prepare(
    ctx_id=ctx_id,
    det_size=DET_SIZE
)

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
# IDENTIFICATION
# =========================================================

def identify(face_embedding):

    emb = face_embedding / np.linalg.norm(face_embedding)

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

    return best_name, best_score

# =========================================================
# FACE ID
# =========================================================

def generate_face_id(bbox):

    x1, y1, x2, y2 = bbox

    return f"{x1//30}_{y1//30}_{x2//30}_{y2//30}"

# =========================================================
# EXPAND PERSON CROP
# =========================================================

def expand_person_bbox(frame, bbox):

    x1, y1, x2, y2 = bbox

    h, w = frame.shape[:2]

    face_w = x2 - x1

    face_h = y2 - y1

    pad_x = int(face_w * 0.8)

    pad_y_top = int(face_h * 0.5)

    pad_y_bottom = int(face_h * 2.5)

    x1 = max(0, x1 - pad_x)

    x2 = min(w, x2 + pad_x)

    y1 = max(0, y1 - pad_y_top)

    y2 = min(h, y2 + pad_y_bottom)

    return x1, y1, x2, y2

# =========================================================
# SAVE PERSON IMAGE
# =========================================================

def save_person_capture(frame, bbox, name):

    x1, y1, x2, y2 = expand_person_bbox(
        frame,
        bbox
    )

    person_img = frame[y1:y2, x1:x2]

    if person_img.size == 0:
        return None

    person_img = cv2.resize(
        person_img,
        (640, 640)
    )

    filename = f"{name}_{int(time.time())}.jpg"

    path = os.path.join(
        CAPTURE_DIR,
        filename
    )

    cv2.imwrite(path, person_img)

    return filename

# =========================================================
# SEND EVENT
# =========================================================

def send_event(
    name,
    score,
    authorized,
    frame,
    bbox,
    current_time
):

    last_sent = RECENT_EVENTS.get(name, 0)

    if current_time - last_sent < KNOWN_GRACE_TIME:
        return

    img = save_person_capture(
        frame,
        bbox,
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

        "authorized": authorized,

        "image_path": img,

        "timestamp": int(current_time)
    }

    producer.produce(
        KAFKA_TOPIC,
        key=name,
        value=json.dumps(event),
        callback=delivery_report
    )

    producer.poll(0)

    RECENT_EVENTS[name] = current_time

    print(
        f"EVENT SENT => "
        f"{name} | authorized={authorized}"
    )

# =========================================================
# CAMERA INIT
# =========================================================

camera_data = CAMERAS[CAM_SELECT]

CAMERA_ID = camera_data["camera_id"]

ZONE_ID = camera_data["zone_id"]

RTSP_URL = camera_data["rtsp_link"]

cam = CameraReader(RTSP_URL)

time.sleep(2)

if cam.read() is None:

    print("Camera not opening")

    exit()

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

    if frame_count % PROCESS_EVERY_N == 0:

        scaled = cv2.resize(
            frame,
            None,
            fx=UPSCALE,
            fy=UPSCALE
        )

        faces = app.get(scaled)

        last_results = []

        current_time = time.time()

        # =====================================================
        # CLEAN OLD UNKNOWN CACHE
        # =====================================================

        remove_unknown = []

        for fid, data in PENDING_UNKNOWN.items():

            if current_time - data["start"] > 10:
                remove_unknown.append(fid)

        for fid in remove_unknown:
            del PENDING_UNKNOWN[fid]

        # =====================================================
        # PROCESS FACES
        # =====================================================

        for face in faces:

            name, score = identify(face.embedding)

            x1, y1, x2, y2 = (
                face.bbox / UPSCALE
            ).astype(int)

            bbox = (x1, y1, x2, y2)

            face_id = generate_face_id(bbox)

            # =================================================
            # UNKNOWN
            # =================================================

            if name == "Unknown":

                if face_id not in PENDING_UNKNOWN:

                    PENDING_UNKNOWN[face_id] = {
                        "start": current_time,
                        "frames": 1
                    }

                else:

                    PENDING_UNKNOWN[face_id]["frames"] += 1

                elapsed = (
                    current_time
                    - PENDING_UNKNOWN[face_id]["start"]
                )

                frames = (
                    PENDING_UNKNOWN[face_id]["frames"]
                )

                if (
                    elapsed >= UNKNOWN_MAX_WAIT
                    and frames >= UNKNOWN_MIN_FRAMES
                ):

                    if face_id not in ACTIVE_DETECTIONS:

                        send_event(
                            name="Unknown",
                            score=score,
                            authorized=False,
                            frame=frame,
                            bbox=bbox,
                            current_time=current_time
                        )

                        ACTIVE_DETECTIONS[face_id] = current_time

                    label = "UNKNOWN"

                    color = UNKNOWN_COLOR

                else:

                    label = "CHECKING"

                    color = UNKNOWN_COLOR

            # =================================================
            # KNOWN PERSON
            # =================================================

            else:

                if face_id in PENDING_UNKNOWN:
                    del PENDING_UNKNOWN[face_id]

                is_allowed = db_manager.is_zone_allowed(
                    name,
                    ZONE_ID
                )

                
                print(is_allowed)

                if is_allowed:

                    send_event(
                        name=name,
                        score=score,
                        authorized=True,
                        frame=frame,
                        bbox=bbox,
                        current_time=current_time
                    )

                    label = f"{name} - AUTHORIZED"

                    color = AUTHORIZED_COLOR

                    if name in PENDING_UNAUTHORIZED:
                        del PENDING_UNAUTHORIZED[name]

                # =============================================
                # UNAUTHORIZED
                # =============================================

                else:

                    if name not in PENDING_UNAUTHORIZED:

                        PENDING_UNAUTHORIZED[name] = {

                            "start": current_time,

                            "frames": 1
                        }

                    else:

                        PENDING_UNAUTHORIZED[name]["frames"] += 1

                    elapsed = (
                        current_time
                        - PENDING_UNAUTHORIZED[name]["start"]
                    )

                    frames = (
                        PENDING_UNAUTHORIZED[name]["frames"]
                    )

                    if (
                        elapsed >= UNAUTHORIZED_CONFIRM_TIME
                        and frames >= UNAUTHORIZED_MIN_FRAMES
                    ):

                        send_event(
                            name=name,
                            score=score,
                            authorized=False,
                            frame=frame,
                            bbox=bbox,
                            current_time=current_time
                        )

                        label = f"{name} - UNAUTHORIZED"

                        color = UNAUTHORIZED_COLOR

                    else:

                        label = f"{name} - VERIFYING"

                        color = UNAUTHORIZED_COLOR

            # =================================================
            # STORE DRAW RESULT
            # =================================================

            last_results.append(
                (
                    (x1, y1, x2, y2),
                    label,
                    color
                )
            )

    # =====================================================
    # DRAW UI
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
            (x1, y1 - 30),
            (x2, y1),
            color,
            -1
        )

        cv2.putText(
            frame,
            label,
            (x1 + 5, y1 - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )

    # =====================================================
    # FPS
    # =====================================================

    if frame_count % 30 == 0:

        fps = 30 / (
            time.time() - fps_start
        )

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

    cv2.imshow(
        "Face Recognition",
        cv2.resize(frame, (1280, 720))
    )

    if cv2.waitKey(1) == ord("q"):
        break

# =========================================================
# CLEANUP
# =========================================================

cam.release()

cv2.destroyAllWindows()

producer.flush()

print("Stopped")